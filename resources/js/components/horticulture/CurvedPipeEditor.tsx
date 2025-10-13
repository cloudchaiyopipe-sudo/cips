/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Coordinate {
    lat: number;
    lng: number;
}

interface EditablePipe {
    id: string;
    coordinates: Coordinate[];
    type: 'mainPipe' | 'subMainPipe';
    anchorPoints: Coordinate[];
    isEditing: boolean;
}

interface CurvedPipeEditorProps {
    map?: google.maps.Map;
    pipes: EditablePipe[];
    onPipeUpdate: (pipeId: string, newCoordinates: Coordinate[]) => void;
    onEditingChange: (pipeId: string, isEditing: boolean) => void;
    strokeColor?: string;
    strokeWeight?: number;
    editMode?: boolean;
    tension?: number;
    showVisualFeedback?: boolean;
}

// const createPEPipeCurve = (
//     anchorPoints: Coordinate[],
//     tension: number = 0.3,
//     segments: number = 50
// ): Coordinate[] => {
//     if (anchorPoints.length < 2) return anchorPoints;

//     if (anchorPoints.length === 2) {
//         const points: Coordinate[] = [];
//         for (let i = 0; i <= segments; i++) {
//             const t = i / segments;
//             const lat = anchorPoints[0].lat + t * (anchorPoints[1].lat - anchorPoints[0].lat);
//             const lng = anchorPoints[0].lng + t * (anchorPoints[1].lng - anchorPoints[0].lng);
//             points.push({ lat, lng });
//         }
//         return points;
//     }

//     const allPoints: Coordinate[] = [];
//     allPoints.push(anchorPoints[0]);

//     for (let i = 0; i < anchorPoints.length - 1; i++) {
//         const p0 = i === 0 ? anchorPoints[0] : anchorPoints[i - 1];
//         const p1 = anchorPoints[i];
//         const p2 = anchorPoints[i + 1];
//         const p3 = i === anchorPoints.length - 2 ? anchorPoints[i + 1] : anchorPoints[i + 2];

//         const segmentPoints = createCardinalSplineSegment(p0, p1, p2, p3, tension, segments);
//         allPoints.push(...segmentPoints.slice(1));
//     }

//     if (allPoints.length > 0) {
//         allPoints[0] = { ...anchorPoints[0] };
//         allPoints[allPoints.length - 1] = { ...anchorPoints[anchorPoints.length - 1] };
//     }

//     return allPoints;
// };

    // const createSmoothCurve = (anchorPoints: Coordinate[], segments: number = 30): Coordinate[] => {
    //     return createPEPipeCurve(anchorPoints, 0.3, segments);
    // };

// const createCardinalSplineSegment = (
//     p0: Coordinate,
//     p1: Coordinate,
//     p2: Coordinate,
//     p3: Coordinate,
//     tension: number,
//     segments: number
// ): Coordinate[] => {
//     const points: Coordinate[] = [];
//     const s = (1 - tension) / 2;

//     for (let i = 0; i <= segments; i++) {
//         const t = i / segments;
//         const t2 = t * t;
//         const t3 = t2 * t;

//         const h1 = 2 * t3 - 3 * t2 + 1;
//         const h2 = -2 * t3 + 3 * t2;
//         const h3 = t3 - 2 * t2 + t;
//         const h4 = t3 - t2;

//         const m1_lat = s * (p2.lat - p0.lat);
//         const m1_lng = s * (p2.lng - p0.lng);
//         const m2_lat = s * (p3.lat - p1.lat);
//         const m2_lng = s * (p3.lng - p1.lng);

//         const lat = h1 * p1.lat + h2 * p2.lat + h3 * m1_lat + h4 * m2_lat;
//         const lng = h1 * p1.lng + h2 * p2.lng + h3 * m1_lng + h4 * m2_lng;

//         points.push({ lat, lng });
//     }

//     return points;
// };

// const createCatmullRomSegment = (
//     p0: Coordinate,
//     p1: Coordinate,
//     p2: Coordinate,
//     p3: Coordinate,
//     segments: number
// ): Coordinate[] => {
//     return createCardinalSplineSegment(p0, p1, p2, p3, 0.3, segments);
// };

// const extractAnchorPoints = (coordinates: Coordinate[], maxPoints: number = 8): Coordinate[] => {
//     if (coordinates.length <= maxPoints) {
//         return coordinates;
//     }
//     const anchorPoints: Coordinate[] = [];
//     const step = Math.floor(coordinates.length / (maxPoints - 1));
//     anchorPoints.push(coordinates[0]);
//     for (let i = step; i < coordinates.length - step; i += step) {
//         anchorPoints.push(coordinates[i]);
//     }
//     anchorPoints.push(coordinates[coordinates.length - 1]);

//     return anchorPoints;
// };

const calculateCornerRadius = (
    angle: number,
    tension: number = 0.3,
    minRadius: number = 0.000025,
    maxRadius: number = 0.000085
): number => {
    const absAngle = Math.abs(angle);
    if (absAngle < 0.12) return 0;
    const sharpnessFactor = Math.sin(absAngle / 2);
    return minRadius + (maxRadius - minRadius) * sharpnessFactor * tension * 0.5;
};

const createCircularCorner = (
    prev: Coordinate,
    corner: Coordinate,
    next: Coordinate,
    radius: number
): {
    tangent1: Coordinate;
    tangent2: Coordinate;
    center: Coordinate;
    startAngle: number;
    endAngle: number;
    arc: Coordinate[];
    radiusLine1: Coordinate[];
    radiusLine2: Coordinate[];
} | null => {
    if (radius <= 0) return null;

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

    if (angle < 0.1 || angle > Math.PI - 0.1) return null;

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

    const arcSegments = Math.max(5, Math.floor(Math.abs(angle) * 10));
    const arc: Coordinate[] = [];

    let deltaAngle = endAngle - startAngle;
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    for (let i = 0; i <= arcSegments; i++) {
        const t = i / arcSegments;
        const currentAngle = startAngle + deltaAngle * t;

        arc.push({
            lat: center.lat + radius * Math.sin(currentAngle),
            lng: center.lng + radius * Math.cos(currentAngle),
        });
    }

    const radiusLine1: Coordinate[] = [center, tangent1];
    const radiusLine2: Coordinate[] = [center, tangent2];

    return {
        tangent1,
        tangent2,
        center,
        startAngle,
        endAngle,
        arc,
        radiusLine1,
        radiusLine2,
    };
};

const createPEPipeWithCircularCorners = (
    anchorPoints: Coordinate[],
    tension: number = 0.3,
    segments: number = 50
): Coordinate[] => {
    if (anchorPoints.length < 2) return anchorPoints;

    if (anchorPoints.length === 2) {
        const points: Coordinate[] = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            points.push({
                lat: anchorPoints[0].lat + t * (anchorPoints[1].lat - anchorPoints[0].lat),
                lng: anchorPoints[0].lng + t * (anchorPoints[1].lng - anchorPoints[0].lng),
            });
        }
        return points;
    }

    const path: Coordinate[] = [];

    for (let i = 0; i < anchorPoints.length; i++) {
        const current = anchorPoints[i];
        const prev = i > 0 ? anchorPoints[i - 1] : null;
        const next = i < anchorPoints.length - 1 ? anchorPoints[i + 1] : null;

        if (i === 0) {  
            path.push(current);
        } else if (i === anchorPoints.length - 1) {
            path.push(current);
        } else {
            const angle = calculateCornerAngle(prev!, current, next!);
            const radius = calculateCornerRadius(angle, tension);
            const cornerData = createCircularCorner(prev!, current, next!, radius);

            if (cornerData && radius > 0 && Math.abs(angle) > 0.15) {
                path.push(cornerData.tangent1);

                path.push(...cornerData.arc);

                path.push(cornerData.tangent2);
            } else {
                path.push(current);
            }
        }
    }

    if (path.length > 0) {
        path[0] = { ...anchorPoints[0] };
        path[path.length - 1] = { ...anchorPoints[anchorPoints.length - 1] };
    }

    return path;
};

const createSmoothCurvePreservingEnds = (
    anchorPoints: Coordinate[],
    tension: number = 0.3,
    segments: number = 50
): Coordinate[] => {
    return createPEPipeWithCircularCorners(anchorPoints, tension, segments);
};

const calculateCornerAngle = (p1: Coordinate, corner: Coordinate, p3: Coordinate): number => {
    const v1 = { x: p1.lat - corner.lat, y: p1.lng - corner.lng };
    const v2 = { x: p3.lat - corner.lat, y: p3.lng - corner.lng };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const cross = v1.x * v2.y - v1.y * v2.x;

    return Math.atan2(cross, dot);
};

const CurvedPipeEditor: React.FC<CurvedPipeEditorProps> = ({
    map,
    pipes,
    onPipeUpdate,
    onEditingChange,
    strokeColor = '#2563eb',
    strokeWeight = 3,
    editMode = false,
    // tension = 0.3,
    showVisualFeedback = true,
}) => {
    const polylineRefs = useRef<Map<string, google.maps.Polyline>>(new Map());
    const anchorMarkerRefs = useRef<Map<string, google.maps.Marker[]>>(new Map());
    const originalEndPointsRef = useRef<Map<string, { first: Coordinate; last: Coordinate }>>(
        new Map()
    );
    const [, setEditingPipeId] = useState<string | null>(null);

    const realTimeGuideRefs = useRef<Map<string, google.maps.Polyline[]>>(new Map());
    const [, setIsDragging] = useState<boolean>(false);
    const [, setDragMarkerInfo] = useState<{
        pipeId: string;
        markerIndex: number;
    } | null>(null);

    const showRealTimeGuides = useCallback(
        (pipeId: string, markerIndex: number, currentPosition: Coordinate) => {
            if (!map || !showVisualFeedback || !editMode) return;

            const pipe = pipes.find((p) => p.id === pipeId);
            if (!pipe || !pipe.isEditing) return;

            if (markerIndex < 0 || markerIndex >= pipe.anchorPoints.length) return;

            const existingGuides = realTimeGuideRefs.current.get(pipeId) || [];
            existingGuides.forEach((guide) => guide.setMap(null));

            const guides: google.maps.Polyline[] = [];

            const anchorPoints = [...pipe.anchorPoints];
            anchorPoints[markerIndex] = currentPosition;

            if (markerIndex > 0 && markerIndex < anchorPoints.length - 1) {
                const prevPoint = anchorPoints[markerIndex - 1];
                const nextPoint = anchorPoints[markerIndex + 1];

                if (!prevPoint || !nextPoint || !pipe.anchorPoints[markerIndex]) return;

                try {
                    const dragDistance = Math.sqrt(
                        Math.pow(currentPosition.lat - pipe.anchorPoints[markerIndex].lat, 2) +
                            Math.pow(currentPosition.lng - pipe.anchorPoints[markerIndex].lng, 2)
                    );

                    const radius = Math.max(0.000004, Math.min(0.000015, dragDistance * 0.25));

                    const cornerResult = createCircularCorner(
                        prevPoint,
                        currentPosition,
                        nextPoint,
                        radius
                    );

                    if (cornerResult && cornerResult.arc && cornerResult.arc.length > 0) {
                        const realPipePath: Coordinate[] = [];

                        realPipePath.push(prevPoint);
                        realPipePath.push(cornerResult.tangent1);

                        realPipePath.push(...cornerResult.arc);

                        realPipePath.push(cornerResult.tangent2);
                        realPipePath.push(nextPoint);

                        const pipeGuide = new google.maps.Polyline({
                            path: realPipePath.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                            geodesic: false,
                            strokeColor: '#00FF00',
                            strokeOpacity: 1.0,
                            strokeWeight: 6,
                            map: map,
                            zIndex: 2000,
                            clickable: false,
                        });

                        guides.push(pipeGuide);
                    }
                } catch (error) {
                    console.error(error);
                }
            }

            realTimeGuideRefs.current.set(pipeId, guides);
        },
        [map, pipes, showVisualFeedback]
    );

    const hideRealTimeGuides = useCallback((pipeId: string) => {
        const guides = realTimeGuideRefs.current.get(pipeId) || [];
        guides.forEach((guide) => guide.setMap(null));
        realTimeGuideRefs.current.delete(pipeId);
    }, []);

    const createAnchorMarker = useCallback(
        (position: Coordinate, pipeId: string, index: number): google.maps.Marker => {
            if (!map) throw new Error('Map not available');

            const pipe = pipes.find((p) => p.id === pipeId);
            const isEndPoint = pipe && (index === 0 || index === pipe.anchorPoints.length - 1);

            const marker = new google.maps.Marker({
                position: { lat: position.lat, lng: position.lng },
                map,
                draggable: !isEndPoint,
                clickable: !isEndPoint,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 6,
                    fillColor: '#ef4444',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                },
                title: isEndPoint
                    ? `ปลายท่อ ${index === 0 ? 'เริ่มต้น' : 'สิ้นสุด'} (ไม่สามารถลากได้)`
                    : `จุดควบคุม ${index + 1}`,
                zIndex: 1001,
                visible: editMode,
            });

            marker.addListener('dragstart', () => {
                if (isEndPoint) {
                    marker.setDraggable(false);
                    return;
                }

                setIsDragging(true);
                setDragMarkerInfo({ pipeId, markerIndex: index });
            });

            marker.addListener('drag', () => {
                const currentPosition = marker.getPosition();
                if (currentPosition && !isEndPoint && showVisualFeedback) {
                    const dragPosition = {
                        lat: currentPosition.lat(),
                        lng: currentPosition.lng(),
                    };
                    showRealTimeGuides(pipeId, index, dragPosition);
                }
            });

            marker.addListener('dragend', () => {
                setIsDragging(false);
                setDragMarkerInfo(null);
                hideRealTimeGuides(pipeId);

                const newPosition = marker.getPosition();

                if (newPosition && !isEndPoint) {
                    const pipe = pipes.find((p) => p.id === pipeId);
                    if (pipe) {
                        const updatedAnchorPoints = [...pipe.anchorPoints];
                        updatedAnchorPoints[index] = {
                            lat: newPosition.lat(),
                            lng: newPosition.lng(),
                        };

                        if (updatedAnchorPoints.length > 0) {
                            const originalEndPoints = originalEndPointsRef.current.get(pipeId);
                            const originalFirst = originalEndPoints?.first || {
                                lat: pipe.anchorPoints[0].lat,
                                lng: pipe.anchorPoints[0].lng,
                            };
                            const originalLast = originalEndPoints?.last || {
                                lat: pipe.anchorPoints[pipe.anchorPoints.length - 1].lat,
                                lng: pipe.anchorPoints[pipe.anchorPoints.length - 1].lng,
                            };

                            if (!originalEndPoints) {
                                originalEndPointsRef.current.set(pipeId, {
                                    first: originalFirst,
                                    last: originalLast,
                                });
                            }

                            updatedAnchorPoints[0] = originalFirst;
                            updatedAnchorPoints[updatedAnchorPoints.length - 1] = originalLast;
                        }

                        const newCoordinates = createPEPipeWithCircularCorners(
                            updatedAnchorPoints,
                            0.25,
                            25
                        );
                        onPipeUpdate(pipeId, newCoordinates);
                    }
                } else if (newPosition && isEndPoint) {
                    marker.setPosition({ lat: position.lat, lng: position.lng });
                }
            });

            marker.addListener('dblclick', () => {
                const pipe = pipes.find((p) => p.id === pipeId);
                if (pipe && pipe.anchorPoints.length > 2 && !isEndPoint) {
                    const updatedAnchorPoints = pipe.anchorPoints.filter((_, i) => i !== index);
                    const newCoordinates = createSmoothCurvePreservingEnds(updatedAnchorPoints, 50);
                    onPipeUpdate(pipeId, newCoordinates);
                }
            });

            return marker;
        },
        [
            map,
            pipes,
            onPipeUpdate,
            editMode,
            showRealTimeGuides,
            hideRealTimeGuides,
            showVisualFeedback,
        ]
    );

    const createPolyline = useCallback(
        (pipe: EditablePipe): google.maps.Polyline => {
            if (!map) throw new Error('Map not available');

            let pipeColor = strokeColor;
            if (!pipe.isEditing) {
                if (pipe.type === 'mainPipe') {
                    pipeColor = '#FF0000';
                } else if (pipe.type === 'subMainPipe') {
                    pipeColor = '#8B5CF6';
                }
            }

            const polyline = new google.maps.Polyline({
                path: pipe.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                geodesic: true,
                strokeColor: pipe.isEditing ? '#ef4444' : pipeColor,
                strokeOpacity: pipe.isEditing ? 1 : 0.8,
                strokeWeight: pipe.isEditing ? strokeWeight + 2 : strokeWeight,
                map: map,
                zIndex: pipe.isEditing ? 1000 : 999,
                clickable: true,
            });

            polyline.addListener('click', (event: google.maps.MapMouseEvent) => {
                if (editMode && event.latLng) {
                    togglePipeEditing(pipe.id);
                }
            });

            polyline.addListener('rightclick', (event: google.maps.MapMouseEvent) => {
                if (editMode && pipe.isEditing && event.latLng) {
                    const newPoint = {
                        lat: event.latLng.lat(),
                        lng: event.latLng.lng(),
                    };

                    const insertIndex = findBestInsertPosition(newPoint, pipe.anchorPoints);
                    const updatedAnchorPoints = [...pipe.anchorPoints];
                    updatedAnchorPoints.splice(insertIndex, 0, newPoint);

                    const newCoordinates = createSmoothCurvePreservingEnds(updatedAnchorPoints, 50);
                    onPipeUpdate(pipe.id, newCoordinates);
                }
            });

            return polyline;
        },
        [map, strokeColor, strokeWeight, editMode, onPipeUpdate]
    );

    const findBestInsertPosition = (newPoint: Coordinate, anchorPoints: Coordinate[]): number => {
        let minDistance = Infinity;
        let bestIndex = 1;

        for (let i = 1; i < anchorPoints.length - 1; i++) {
            const distance = distanceFromPointToLineSegment(
                newPoint,
                anchorPoints[i],
                anchorPoints[i + 1]
            );

            if (distance < minDistance) {
                minDistance = distance;
                bestIndex = i + 1;
            }
        }

        if (anchorPoints.length <= 2) {
            return 1;
        }

        return bestIndex;
    };

    const distanceFromPointToLineSegment = (
        point: Coordinate,
        lineStart: Coordinate,
        lineEnd: Coordinate
    ): number => {
        const A = point.lat - lineStart.lat;
        const B = point.lng - lineStart.lng;
        const C = lineEnd.lat - lineStart.lat;
        const D = lineEnd.lng - lineStart.lng;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;
        if (param < 0) {
            xx = lineStart.lat;
            yy = lineStart.lng;
        } else if (param > 1) {
            xx = lineEnd.lat;
            yy = lineEnd.lng;
        } else {
            xx = lineStart.lat + param * C;
            yy = lineStart.lng + param * D;
        }

        const dx = point.lat - xx;
        const dy = point.lng - yy;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const togglePipeEditing = useCallback(
        (pipeId: string) => {
            const pipe = pipes.find((p) => p.id === pipeId);
            if (!pipe) return;

            const newEditingState = !pipe.isEditing;

            if (newEditingState) {
                setEditingPipeId(pipeId);
                pipes.forEach((p) => {
                    if (p.id !== pipeId && p.isEditing) {
                        onEditingChange(p.id, false);
                    }
                });
            } else {
                setEditingPipeId(null);
                originalEndPointsRef.current.delete(pipeId);
            }

            onEditingChange(pipeId, newEditingState);
        },
        [pipes, onEditingChange]
    );

    const updatePolylines = useCallback(() => {
        if (!map) return;

        polylineRefs.current.forEach((polyline) => polyline.setMap(null));
        polylineRefs.current.clear();

        pipes.forEach((pipe) => {
            const polyline = createPolyline(pipe);
            polylineRefs.current.set(pipe.id, polyline);

            if (pipe.isEditing && editMode) {
                const markers = anchorMarkerRefs.current.get(pipe.id);
                if (markers) {
                    markers.forEach((marker, index) => {
                        const isEndPoint = index === 0 || index === pipe.anchorPoints.length - 1;
                        if (isEndPoint) {
                            const originalEndPoints = originalEndPointsRef.current.get(pipe.id);
                            let originalPoint: Coordinate;

                            if (originalEndPoints) {
                                originalPoint =
                                    index === 0 ? originalEndPoints.first : originalEndPoints.last;
                            } else {
                                originalPoint = pipe.anchorPoints[index];
                                if (!originalEndPointsRef.current.has(pipe.id)) {
                                    originalEndPointsRef.current.set(pipe.id, {
                                        first: pipe.anchorPoints[0],
                                        last: pipe.anchorPoints[pipe.anchorPoints.length - 1],
                                    });
                                }
                            }

                            marker.setPosition({ lat: originalPoint.lat, lng: originalPoint.lng });
                            marker.setDraggable(false);
                        }
                    });
                }
            }
        });
    }, [map, pipes, createPolyline, editMode]);

    const updateAnchorMarkers = useCallback(() => {
        if (!map) return;
        anchorMarkerRefs.current.forEach((markers) => {
            markers.forEach((marker) => marker.setMap(null));
        });
        anchorMarkerRefs.current.clear();
        pipes.forEach((pipe) => {
            if (pipe.isEditing && editMode) {
                const markers = pipe.anchorPoints.map((point, index) => {
                    const marker = createAnchorMarker(point, pipe.id, index);
                    const isEndPoint = index === 0 || index === pipe.anchorPoints.length - 1;
                    if (isEndPoint) {
                        const originalEndPoints = originalEndPointsRef.current.get(pipe.id);
                        let originalPoint: Coordinate;

                        if (originalEndPoints) {
                            originalPoint =
                                index === 0 ? originalEndPoints.first : originalEndPoints.last;
                        } else {
                            originalPoint = point;
                            if (!originalEndPointsRef.current.has(pipe.id)) {
                                originalEndPointsRef.current.set(pipe.id, {
                                    first: pipe.anchorPoints[0],
                                    last: pipe.anchorPoints[pipe.anchorPoints.length - 1],
                                });
                            }
                        }

                        marker.setPosition({ lat: originalPoint.lat, lng: originalPoint.lng });
                        marker.setDraggable(false);
                        marker.setClickable(false);
                    }
                    return marker;
                });
                anchorMarkerRefs.current.set(pipe.id, markers);
            }
        });
    }, [map, pipes, createAnchorMarker, editMode]);

    useEffect(() => {
        updatePolylines();
    }, [updatePolylines]);

    useEffect(() => {
        updateAnchorMarkers();
    }, [updateAnchorMarkers]);

    useEffect(() => {
        anchorMarkerRefs.current.forEach((markers) => {
            markers.forEach((marker) => marker.setVisible(editMode));
        });
    }, [editMode]);

    useEffect(() => {
        if (!editMode) {
            realTimeGuideRefs.current.forEach((guides) => {
                guides.forEach((guide) => guide.setMap(null));
            });
            realTimeGuideRefs.current.clear();
            setIsDragging(false);
            setDragMarkerInfo(null);
        }
    }, [editMode]);

    useEffect(() => {
        return () => {
            polylineRefs.current.forEach((polyline) => polyline.setMap(null));
            anchorMarkerRefs.current.forEach((markers) => {
                markers.forEach((marker) => marker.setMap(null));
            });
            realTimeGuideRefs.current.forEach((guides) => {
                guides.forEach((guide) => guide.setMap(null));
            });
        };
    }, []);

    return null;
};

export default CurvedPipeEditor;
