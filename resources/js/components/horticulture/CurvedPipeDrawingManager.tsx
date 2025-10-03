/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Coordinate {
    lat: number;
    lng: number;
}

interface GuideData {
    center: Coordinate;
    radius: number;
    tangent1: Coordinate;
    tangent2: Coordinate;
    radiusLine1: Coordinate[];
    radiusLine2: Coordinate[];
}

interface CurvedPipeDrawingManagerProps {
    map?: google.maps.Map;
    isActive: boolean;
    pipeType: 'mainPipe' | 'subMainPipe';
    onPipeComplete: (coordinates: Coordinate[], pipeType: string) => void;
    onCancel?: () => void;
    strokeColor?: string;
    strokeWeight?: number;
    showGuides?: boolean;
    onAnchorPointsChange?: (count: number) => void;
}

// ฟังก์ชันคำนวณรัศมีโค้งจากระยะการลาก (ลดความโค้งลง 90%)
const calculateRadiusFromDragDistance = (
    cornerPoint: Coordinate,
    draggedPoint: Coordinate
): number => {
    const latDiff = draggedPoint.lat - cornerPoint.lat;
    const lngDiff = draggedPoint.lng - cornerPoint.lng;
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

    // ลดความโค้งลงมาก - ใช้ radius เล็กมากๆ
    const minRadius = 0.000005; // ~0.5 เมตร
    const maxRadius = 0.00005; // ~5 เมตร (ลดจาก 50 เมตร)

    // ใช้เพียง 20% ของระยะลาก เพื่อให้โค้งเบาๆ
    const adjustedDistance = distance * 0.2;

    return Math.max(minRadius, Math.min(maxRadius, adjustedDistance));
};

// ฟังก์ชันสร้าง Circular Arc ง่ายๆ
const createCircularCorner = (
    prev: Coordinate,
    corner: Coordinate,
    next: Coordinate,
    radius: number
): {
    tangent1: Coordinate;
    tangent2: Coordinate;
    center: Coordinate;
    arc: Coordinate[];
    radiusLine1: Coordinate[];
    radiusLine2: Coordinate[];
} | null => {
    if (radius <= 0) return null;

    // คำนวณ unit vectors
    const v1 = {
        lat: prev.lat - corner.lat,
        lng: prev.lng - corner.lng,
    };
    const v2 = {
        lat: next.lat - corner.lat,
        lng: next.lng - corner.lng,
    };

    const len1 = Math.sqrt(v1.lat * v1.lat + v1.lng * v1.lng);
    const len2 = Math.sqrt(v2.lat * v2.lat + v2.lng * v2.lng);

    if (len1 === 0 || len2 === 0) return null;

    v1.lat /= len1;
    v1.lng /= len1;
    v2.lat /= len2;
    v2.lng /= len2;

    const dot = v1.lat * v2.lat + v1.lng * v2.lng;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

    if (angle < 0.05 || angle > Math.PI - 0.05) return null;

    const halfAngle = angle / 2;
    const tangentDistance = radius / Math.tan(halfAngle);

    const tangent1 = {
        lat: corner.lat + v1.lat * tangentDistance,
        lng: corner.lng + v1.lng * tangentDistance,
    };

    const tangent2 = {
        lat: corner.lat + v2.lat * tangentDistance,
        lng: corner.lng + v2.lng * tangentDistance,
    };

    const bisector = {
        lat: (v1.lat + v2.lat) / 2,
        lng: (v1.lng + v2.lng) / 2,
    };

    const bisectorLen = Math.sqrt(bisector.lat * bisector.lat + bisector.lng * bisector.lng);
    if (bisectorLen === 0) return null;

    bisector.lat /= bisectorLen;
    bisector.lng /= bisectorLen;

    const centerDistance = radius / Math.sin(halfAngle);
    const center = {
        lat: corner.lat + bisector.lat * centerDistance,
        lng: corner.lng + bisector.lng * centerDistance,
    };

    const startAngle = Math.atan2(tangent1.lat - center.lat, tangent1.lng - center.lng);
    const endAngle = Math.atan2(tangent2.lat - center.lat, tangent2.lng - center.lng);

    const arcSegments = Math.max(8, Math.floor(Math.abs(angle) * 20));
    const arc: Coordinate[] = [];

    let deltaAngle = endAngle - startAngle;
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    if (Math.abs(deltaAngle) > Math.PI) {
        deltaAngle = deltaAngle > 0 ? deltaAngle - 2 * Math.PI : deltaAngle + 2 * Math.PI;
    }

    for (let i = 0; i <= arcSegments; i++) {
        const t = i / arcSegments;
        const currentAngle = startAngle + deltaAngle * t;

        arc.push({
            lat: center.lat + radius * Math.sin(currentAngle),
            lng: center.lng + radius * Math.cos(currentAngle),
        });
    }

    return {
        tangent1,
        tangent2,
        center,
        arc,
        radiusLine1: [center, tangent1],
        radiusLine2: [center, tangent2],
    };
};

// ฟังก์ชันสร้างท่อแบบใหม่: รักษาแนวท่อ + ปรับรัศมีโค้งเท่านั้น
const createSimpleDragCurvePipe = (
    anchorPoints: Coordinate[],
    radiusControls: Map<number, number> // lineIndex -> radius
): { path: Coordinate[]; guides: GuideData[] } => {
    if (anchorPoints.length < 2) {
        return { path: anchorPoints, guides: [] };
    }

    if (anchorPoints.length === 2) {
        // 2 จุด = เส้นตรงธรรมดา
        const path: Coordinate[] = [];
        const lineIndex = 0;
        const customRadius = radiusControls.get(lineIndex);

        if (customRadius && customRadius > 0.000005) {
            // For 2-point lines, we can create a simple curved path
            // This is a simplified implementation for basic corner rounding
            const midPoint = {
                lat: (anchorPoints[0].lat + anchorPoints[1].lat) / 2,
                lng: (anchorPoints[0].lng + anchorPoints[1].lng) / 2,
            };

            // Add slight curve by offsetting the midpoint
            const offset = customRadius * 0.1;
            const direction = {
                lat: anchorPoints[1].lat - anchorPoints[0].lat,
                lng: anchorPoints[1].lng - anchorPoints[0].lng,
            };
            const length = Math.sqrt(direction.lat * direction.lat + direction.lng * direction.lng);
            if (length > 0) {
                direction.lat /= length;
                direction.lng /= length;

                const perpendicular = {
                    lat: -direction.lng,
                    lng: direction.lat,
                };

                midPoint.lat += perpendicular.lat * offset;
                midPoint.lng += perpendicular.lng * offset;
            }

            path.push(anchorPoints[0], midPoint, anchorPoints[1]);
            return { path, guides: [] };
        }

        // สร้างเส้นตรงปกติ
        for (let i = 0; i <= 50; i++) {
            const t = i / 50;
            path.push({
                lat: anchorPoints[0].lat + t * (anchorPoints[1].lat - anchorPoints[0].lat),
                lng: anchorPoints[0].lng + t * (anchorPoints[1].lng - anchorPoints[0].lng),
            });
        }
        return { path, guides: [] };
    }

    // 3+ จุด: สร้างเส้นตรงระหว่างจุด + โค้งที่มุม
    const path: Coordinate[] = [];
    const guides: GuideData[] = [];

    // สร้างเส้นโดย rounding เฉพาะมุม
    path.push(anchorPoints[0]); // เริ่มต้นที่จุดแรก

    for (let i = 1; i < anchorPoints.length - 1; i++) {
        const prev = anchorPoints[i - 1];
        const current = anchorPoints[i];
        const next = anchorPoints[i + 1];

        // ดู radius control สำหรับเส้นก่อนหน้าและถัดไป
        const prevLineRadius = radiusControls.get(i - 1) || 0; // เส้น i-1 -> i
        const nextLineRadius = radiusControls.get(i) || 0; // เส้น i -> i+1

        // ใช้ radius ที่ใหญ่กว่า หรือค่าเฉลี่ย
        const effectiveRadius = Math.max(prevLineRadius, nextLineRadius);

        if (effectiveRadius > 0.000005) {
            // สร้างโค้งที่มุม
            const cornerData = createCircularCorner(prev, current, next, effectiveRadius);

            if (cornerData) {
                guides.push({
                    center: cornerData.center,
                    radius: effectiveRadius,
                    tangent1: cornerData.tangent1,
                    tangent2: cornerData.tangent2,
                    radiusLine1: cornerData.radiusLine1,
                    radiusLine2: cornerData.radiusLine2,
                });

                // เพิ่มโค้ง
                path.push(...cornerData.arc.slice(1, -1));
            } else {
                path.push(current);
            }
        } else {
            path.push(current); // ใช้เส้นตรง
        }
    }

    // เพิ่มจุดสุดท้าย
    path.push(anchorPoints[anchorPoints.length - 1]);

    // รักษาจุดเริ่มต้นและจุดสิ้นสุดให้แน่นอน
    if (path.length > 0) {
        path[0] = { ...anchorPoints[0] };
        path[path.length - 1] = { ...anchorPoints[anchorPoints.length - 1] };
    }

    return { path, guides };
};

const CurvedPipeDrawingManager: React.FC<CurvedPipeDrawingManagerProps> = ({
    map,
    isActive,
    pipeType,
    onPipeComplete,
    onCancel,
    strokeColor = '#ff4444',
    strokeWeight = 3,
    showGuides = true,
    onAnchorPointsChange,
}) => {
    const [anchorPoints, setAnchorPoints] = useState<Coordinate[]>([]);
    const [previewPath, setPreviewPath] = useState<Coordinate[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentMousePosition, setCurrentMousePosition] = useState<Coordinate | null>(null);
    const [dragDistances, setDragDistances] = useState<Map<number, Coordinate>>(new Map());
    const [isDragging, setIsDragging] = useState(false);
    const [dragIndex, setDragIndex] = useState<number>(-1);
    const [guides, setGuides] = useState<GuideData[]>([]);

    // Virtual radius control - แยกจาก anchor points ต้นฉบับ
    const [radiusControls, setRadiusControls] = useState<Map<number, number>>(new Map()); // index -> radius
    const [virtualDragMarkers, setVirtualDragMarkers] = useState<google.maps.Marker[]>([]); // virtual markers สำหรับลาก

    const previewPolylineRef = useRef<google.maps.Polyline | null>(null);
    const anchorMarkersRef = useRef<google.maps.Marker[]>([]);
    const mouseListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const rightClickListenerRef = useRef<google.maps.MapsEventListener | null>(null);

    // Guide visualization refs
    const guidePolylinesRef = useRef<google.maps.Polyline[]>([]);
    const guideCentersRef = useRef<google.maps.Marker[]>([]);
    const guideCirclesRef = useRef<google.maps.Circle[]>([]);
    const dragGuideLineRef = useRef<google.maps.Polyline | null>(null);

    // สร้าง marker สำหรับแต่ละจุด (แบบใหม่: อ่านอย่างเดียว + virtual radius controls)
    const createAnchorMarker = useCallback(
        (position: Coordinate, index: number): google.maps.Marker => {
            if (!map) throw new Error('Map not available');

            const isEndPoint = index === 0 || index === anchorPoints.length - 1;

            const marker = new google.maps.Marker({
                position: { lat: position.lat, lng: position.lng },
                map: map,
                draggable: false, // 🔒 ห้ามลาก anchor points เด็ดขาด - รักษาแนวท่อ
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: isEndPoint ? 10 : 8,
                    fillColor: isEndPoint ? '#22c55e' : '#ef4444',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                },
                title: isEndPoint ? `ปลายท่อ (คงที่)` : `จุดควบคุม (คงที่)`,
                zIndex: 1000,
                visible: true,
            });

            return marker;
        },
        [map]
    );

    // สร้าง Virtual Radius Control Markers (สำหรับลากปรับรัศมีโค้งเท่านั้น)
    const createVirtualRadiusMarker = useCallback(
        (lineStart: Coordinate, lineEnd: Coordinate, lineIndex: number): google.maps.Marker => {
            if (!map) throw new Error('Map not available');

            // คำนวณจุดกึ่งกลางของเส้น
            const midPoint = {
                lat: (lineStart.lat + lineEnd.lat) / 2,
                lng: (lineStart.lng + lineEnd.lng) / 2,
            };

            // คำนวณทิศทางตั้งฉาก (perpendicular) ของเส้น
            const lineVector = {
                lat: lineEnd.lat - lineStart.lat,
                lng: lineEnd.lng - lineStart.lng,
            };
            const perpVector = {
                lat: -lineVector.lng, // ตั้งฉาก 90 องศา
                lng: lineVector.lat,
            };

            // Normalize perpendicular vector
            const length = Math.sqrt(
                perpVector.lat * perpVector.lat + perpVector.lng * perpVector.lng
            );
            if (length > 0) {
                perpVector.lat /= length;
                perpVector.lng /= length;
            }

            // ตำแหน่งเริ่มต้นของ virtual marker (ห่างจากเส้น 20 เมตร)
            const initialOffset = 0.0002; // ~20 เมตร
            const virtualPosition = {
                lat: midPoint.lat + perpVector.lat * initialOffset,
                lng: midPoint.lng + perpVector.lng * initialOffset,
            };

            const virtualMarker = new google.maps.Marker({
                position: { lat: virtualPosition.lat, lng: virtualPosition.lng },
                map: map,
                draggable: true, // ✅ ลากได้เฉพาะ virtual markers
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 6,
                    fillColor: '#ff6b35', // สีส้ม แตกต่างจาก anchor points
                    fillOpacity: 0.8,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                },
                title: `ลากเพื่อปรับรัศมีโค้ง`,
                zIndex: 1001,
                visible: showGuides, // แสดงเฉพาะเมื่อ showGuides = true
            });

            virtualMarker.addListener('dragstart', () => {
                setIsDragging(true);
                setDragIndex(lineIndex);

                // แสดง guide line จากจุดกึ่งกลางไปยัง virtual marker
                if (dragGuideLineRef.current) {
                    dragGuideLineRef.current.setPath([midPoint, virtualPosition]);
                    dragGuideLineRef.current.setVisible(true);
                }
            });

            virtualMarker.addListener('drag', () => {
                const newPosition = virtualMarker.getPosition();
                if (newPosition) {
                    const draggedCoord = {
                        lat: newPosition.lat(),
                        lng: newPosition.lng(),
                    };

                    // คำนวณระยะห่างจากจุดกึ่งกลาง = รัศมีโค้ง
                    const dragDistance = Math.sqrt(
                        Math.pow(draggedCoord.lat - midPoint.lat, 2) +
                            Math.pow(draggedCoord.lng - midPoint.lng, 2)
                    );

                    setRadiusControls((prev) => {
                        const newMap = new Map(prev);
                        newMap.set(lineIndex, Math.max(0.00001, Math.min(0.0001, dragDistance))); // 1-10 เมตร
                        return newMap;
                    });

                    // อัปเดต guide line
                    if (dragGuideLineRef.current) {
                        dragGuideLineRef.current.setPath([midPoint, draggedCoord]);
                    }
                }
            });

            virtualMarker.addListener('dragend', () => {
                setIsDragging(false);
                setDragIndex(-1);

                // ซ่อน guide line
                if (dragGuideLineRef.current) {
                    dragGuideLineRef.current.setVisible(false);
                }
            });

            return virtualMarker;
        },
        [map, showGuides]
    );

    // อัปเดต preview path
    useEffect(() => {
        if (anchorPoints.length === 0) {
            setPreviewPath([]);
            setGuides([]);
            if (onAnchorPointsChange) onAnchorPointsChange(0);
            return;
        }

        const pathPoints = [...anchorPoints];
        if (currentMousePosition && isDrawing) {
            pathPoints.push(currentMousePosition);
        }

        if (pathPoints.length >= 2) {
            const result = createSimpleDragCurvePipe(pathPoints, radiusControls);
            setPreviewPath(result.path);
            setGuides(result.guides);
        } else {
            setPreviewPath(pathPoints);
            setGuides([]);
        }

        if (onAnchorPointsChange) onAnchorPointsChange(anchorPoints.length);
    }, [anchorPoints, currentMousePosition, isDrawing, radiusControls]); // เปลี่ยนจาก dragDistances เป็น radiusControls

    // สร้าง drag guide line (ขณะลากจะเห็นเส้นจากจุดเดิมไปจุดที่ลาก)
    useEffect(() => {
        if (!map) return;

        if (!dragGuideLineRef.current) {
            dragGuideLineRef.current = new google.maps.Polyline({
                strokeColor: '#ff9800',
                strokeOpacity: 0.8,
                strokeWeight: 3,
                map: map,
                visible: true,
                path: [],
                zIndex: 2000,
                icons: [
                    {
                        icon: {
                            path: 'M 0,-2 0,2',
                            strokeOpacity: 0.8,
                            scale: 1,
                        },
                        offset: '0',
                        repeat: '10px',
                    },
                ],
            });
        }

        return () => {
            if (dragGuideLineRef.current) {
                dragGuideLineRef.current.setMap(null);
                dragGuideLineRef.current = null;
            }
        };
    }, [map]);

    // จัดการการเริ่มต้น/หยุดการวาด
    useEffect(() => {
        if (isActive && !isDrawing) {
            setIsDrawing(true);
            setAnchorPoints([]);
            setRadiusControls(new Map());

            if (map && !mouseListenerRef.current) {
                // ซ่อน Google Maps Drawing Manager controls
                try {
                    const mapDiv = map.getDiv();
                    const drawingControls = mapDiv?.querySelectorAll(
                        '[role="button"][title*="Draw"], [role="button"][title*="drawing"], .gmnoprint'
                    );
                    drawingControls?.forEach((control) => {
                        if (control instanceof HTMLElement) {
                            control.style.display = 'none';
                        }
                    });
                } catch (e) {
                    // ignore errors
                }

                // ล้าง listeners เก่า
                if (clickListenerRef.current) {
                    google.maps.event.removeListener(clickListenerRef.current);
                    clickListenerRef.current = null;
                }
                if (rightClickListenerRef.current) {
                    google.maps.event.removeListener(rightClickListenerRef.current);
                    rightClickListenerRef.current = null;
                }

                // เมาส์ move
                mouseListenerRef.current = map.addListener(
                    'mousemove',
                    (event: google.maps.MapMouseEvent) => {
                        if (event.latLng) {
                            setCurrentMousePosition({
                                lat: event.latLng.lat(),
                                lng: event.latLng.lng(),
                            });
                        }
                    }
                );

                // คลิกซ้าย = เพิ่มจุด
                setTimeout(() => {
                    if (map && !clickListenerRef.current) {
                        clickListenerRef.current = map.addListener(
                            'click',
                            (event: google.maps.MapMouseEvent) => {
                                if (event.latLng && !isDragging) {
                                    const newPoint = {
                                        lat: event.latLng.lat(),
                                        lng: event.latLng.lng(),
                                    };

                                    setAnchorPoints((prev) => {
                                        const updated = [...prev, newPoint];
                                        return updated;
                                    });
                                }
                            }
                        );
                    }
                }, 500);

                // แก้ไข pointer events
                const mapElement = map.getDiv();
                if (mapElement) {
                    mapElement.style.pointerEvents = 'auto';
                    mapElement.style.zIndex = '1';
                }

                // คลิกขวา = จบการวาด
                rightClickListenerRef.current = map.addListener('rightclick', () => {
                    if (anchorPoints.length >= 2) {
                        const finalResult = createSimpleDragCurvePipe(anchorPoints, radiusControls);
                        onPipeComplete(finalResult.path, pipeType);

                        setIsDrawing(false);
                        setAnchorPoints([]);
                        setRadiusControls(new Map());
                        setCurrentMousePosition(null);
                    }
                });
            }
        } else if (!isActive && isDrawing) {
            setIsDrawing(false);
            setAnchorPoints([]);
            setRadiusControls(new Map());
            setCurrentMousePosition(null);

            if (onCancel) {
                onCancel();
            }
        }
    }, [isActive, isDrawing, map, pipeType, onPipeComplete, onCancel, isDragging]);

    // อัปเดต preview polyline
    useEffect(() => {
        if (!map) return;

        const pipeColor = pipeType === 'mainPipe' ? '#2563eb' : strokeColor;

        if (previewPath.length > 1) {
            if (previewPolylineRef.current) {
                previewPolylineRef.current.setPath(
                    previewPath.map((p) => ({ lat: p.lat, lng: p.lng }))
                );
            } else {
                previewPolylineRef.current = new google.maps.Polyline({
                    path: previewPath.map((p) => ({ lat: p.lat, lng: p.lng })),
                    geodesic: false,
                    strokeColor: pipeColor,
                    strokeOpacity: 0.8,
                    strokeWeight: strokeWeight,
                    map: map,
                    zIndex: 999,
                });
            }
        }

        return () => {
            if (previewPolylineRef.current) {
                previewPolylineRef.current.setMap(null);
                previewPolylineRef.current = null;
            }
        };
    }, [map, previewPath, strokeColor, strokeWeight, pipeType]);

    // อัปเดต anchor markers + virtual radius markers
    useEffect(() => {
        // ล้าง markers เก่า
        anchorMarkersRef.current.forEach((marker) => marker.setMap(null));
        anchorMarkersRef.current = [];

        virtualDragMarkers.forEach((marker) => marker.setMap(null));
        setVirtualDragMarkers([]);

        // สร้าง anchor markers ใหม่ (อ่านอย่างเดียว)
        anchorPoints.forEach((point, index) => {
            const marker = createAnchorMarker(point, index);
            anchorMarkersRef.current.push(marker);
        });

        // สร้าง virtual radius control markers ระหว่างทุกเส้น
        if (anchorPoints.length >= 2 && showGuides) {
            const virtualMarkers: google.maps.Marker[] = [];

            for (let i = 0; i < anchorPoints.length - 1; i++) {
                const lineStart = anchorPoints[i];
                const lineEnd = anchorPoints[i + 1];
                const virtualMarker = createVirtualRadiusMarker(lineStart, lineEnd, i);
                virtualMarkers.push(virtualMarker);
            }

            setVirtualDragMarkers(virtualMarkers);
        }

        return () => {
            anchorMarkersRef.current.forEach((marker) => marker.setMap(null));
            virtualDragMarkers.forEach((marker) => marker.setMap(null));
        };
    }, [anchorPoints, createAnchorMarker, createVirtualRadiusMarker, showGuides]); // เพิ่ม showGuides

    // อัปเดต Visual Guides
    useEffect(() => {
        if (!map) {
            guidePolylinesRef.current.forEach((polyline) => polyline.setMap(null));
            guideCentersRef.current.forEach((marker) => marker.setMap(null));
            guideCirclesRef.current.forEach((circle) => circle.setMap(null));
            guidePolylinesRef.current = [];
            guideCentersRef.current = [];
            guideCirclesRef.current = [];
            return;
        }

        // ล้าง guides เก่า
        guidePolylinesRef.current.forEach((polyline) => polyline.setMap(null));
        guideCentersRef.current.forEach((marker) => marker.setMap(null));
        guideCirclesRef.current.forEach((circle) => circle.setMap(null));
        guidePolylinesRef.current = [];
        guideCentersRef.current = [];
        guideCirclesRef.current = [];

        // สร้าง Visual Guides ใหม่
        if (showGuides) {
            guides.forEach((guide, index) => {
                // เส้นรัศมี
                const radiusLine1 = new google.maps.Polyline({
                    path: guide.radiusLine1,
                    strokeColor: '#ff6b35',
                    strokeOpacity: 0.7,
                    strokeWeight: 2,
                    map: map,
                    zIndex: 1002,
                });

                const radiusLine2 = new google.maps.Polyline({
                    path: guide.radiusLine2,
                    strokeColor: '#ff6b35',
                    strokeOpacity: 0.7,
                    strokeWeight: 2,
                    map: map,
                    zIndex: 1002,
                });

                // จุดศูนย์กลาง
                const centerMarker = new google.maps.Marker({
                    position: guide.center,
                    map: map,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 6,
                        fillColor: '#ff6b35',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                    },
                    title: `ศูนย์กลางโค้ง (รัศมี: ${(guide.radius * 111320).toFixed(1)} ม.)`,
                    zIndex: 1004,
                });

                // วงกลมรัศมี
                const radiusInMeters = guide.radius * 111320;
                if (radiusInMeters > 0.5) {
                    const previewCircle = new google.maps.Circle({
                        center: guide.center,
                        radius: radiusInMeters,
                        strokeColor: '#ff6b35',
                        strokeOpacity: 0.3,
                        strokeWeight: 1,
                        fillColor: '#ff6b35',
                        fillOpacity: 0.05,
                        map: map,
                        zIndex: 998,
                    });
                    guideCirclesRef.current.push(previewCircle);
                }

                guidePolylinesRef.current.push(radiusLine1, radiusLine2);
                guideCentersRef.current.push(centerMarker);
            });
        }
    }, [map, guides, showGuides]);

    // Cleanup
    useEffect(() => {
        return () => {
            anchorMarkersRef.current.forEach((marker) => marker.setMap(null));
            guidePolylinesRef.current.forEach((polyline) => polyline.setMap(null));
            guideCentersRef.current.forEach((marker) => marker.setMap(null));
            guideCirclesRef.current.forEach((circle) => circle.setMap(null));

            if (mouseListenerRef.current) {
                google.maps.event.removeListener(mouseListenerRef.current);
            }
            if (clickListenerRef.current) {
                google.maps.event.removeListener(clickListenerRef.current);
            }
            if (rightClickListenerRef.current) {
                google.maps.event.removeListener(rightClickListenerRef.current);
            }
            if (previewPolylineRef.current) {
                previewPolylineRef.current.setMap(null);
            }
            if (dragGuideLineRef.current) {
                dragGuideLineRef.current.setMap(null);
            }
        };
    }, []);

    return null;
};

export default CurvedPipeDrawingManager;
