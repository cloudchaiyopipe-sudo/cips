/* eslint-disable react-hooks/exhaustive-deps */
// resources/js/pages/home-garden-summary.tsx
import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { router } from '@inertiajs/react';
import Navbar from '../components/Navbar';
import { useLanguage } from '../contexts/LanguageContext';

import {
    CanvasCoordinate,
    GardenPlannerData,
    ZONE_TYPES,
    SPRINKLER_TYPES,
    loadGardenData,
    formatArea,
    validateGardenData,
    clipCircleToPolygon,
    getManualSprinklerColor,
    Sprinkler,
} from '../utils/homeGardenData';
import { calculateGardenStatistics } from '../utils/gardenStatistics';
interface HomeGardenSummaryProps {
    data?: GardenPlannerData;
}

interface DimensionLine {
    id: string;
    start: CanvasCoordinate;
    end: CanvasCoordinate;
    label: string;
    distance: number;
    direction: 'auto' | 'left' | 'right' | 'top' | 'bottom';
}

interface ViewportState {
    zoom: number;
    panX: number;
    panY: number;
}

class SummaryErrorBoundary extends React.Component<
    { children: React.ReactNode; t: (key: string) => string },
    { hasError: boolean; error?: Error }
> {
    constructor(props: { children: React.ReactNode; t: (key: string) => string }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Summary Error:', error, errorInfo);
    }

    render() {
        const { t } = this.props;
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6">
                    <Navbar />
                    <div className="rounded-lg bg-red-900 p-6 text-center text-white pt-20">
                        <h2 className="mb-4 text-xl font-bold">
                            {t('เกิดข้อผิดพลาดในการแสดงสรุปผล')}
                        </h2>
                        <p className="mb-4">{t('ไม่สามารถโหลดข้อมูลการออกแบบได้')}</p>
                        <button
                            onClick={() => router.visit('/home-garden-planner')}
                            className="rounded bg-red-600 px-4 py-2 hover:bg-red-700"
                        >
                            {t('กลับไปหน้าออกแบบ')}
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const CanvasRenderer: React.FC<{
    gardenData: GardenPlannerData;
    canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}> = ({ gardenData, canvasRef }) => {
    const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const activeCanvasRef = canvasRef || internalCanvasRef;
    const containerRef = useRef<HTMLDivElement>(null);

    const [viewport, setViewport] = useState<ViewportState>({
        zoom: 1,
        panX: 0,
        panY: 0,
    });

    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number } | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

    const dimensionLines = useMemo(() => {
        try {
            const savedDimensions = localStorage.getItem('gardenDimensionLines');
            if (savedDimensions) {
                return JSON.parse(savedDimensions) as DimensionLine[];
            }
        } catch (error) {
            console.warn('Could not load dimension lines:', error);
        }
        return [];
    }, []);

    const canvasBounds = useMemo(() => {
        // For Image mode, base the bounds on the full image dimensions to show the entire plan
        const isImageMode = gardenData.designMode === 'image';
        const imgW = gardenData.imageData?.width;
        const imgH = gardenData.imageData?.height;
        if (
            isImageMode &&
            typeof imgW === 'number' &&
            typeof imgH === 'number' &&
            imgW > 0 &&
            imgH > 0
        ) {
            return {
                minX: 0,
                maxX: imgW,
                minY: 0,
                maxY: imgH,
                width: imgW,
                height: imgH,
                centerX: imgW / 2,
                centerY: imgH / 2,
            };
        }

        // Default (Canvas mode): use drawn zone extents
        const zonePoints: CanvasCoordinate[] = [];

        gardenData.gardenZones?.forEach((zone) => {
            if (zone.canvasCoordinates && zone.canvasCoordinates.length > 0) {
                zonePoints.push(...zone.canvasCoordinates);
            }
        });

        if (zonePoints.length === 0) {
            return {
                minX: 0,
                maxX: 0,
                minY: 0,
                maxY: 0,
                width: 0,
                height: 0,
                centerX: 0,
                centerY: 0,
            };
        }

        const minX = Math.min(...zonePoints.map((p) => p.x));
        const maxX = Math.max(...zonePoints.map((p) => p.x));
        const minY = Math.min(...zonePoints.map((p) => p.y));
        const maxY = Math.max(...zonePoints.map((p) => p.y));

        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        return { minX, maxX, minY, maxY, width, height, centerX, centerY };
    }, [gardenData]);

    const baseTransform = useMemo(() => {
        if (canvasBounds.width === 0 || canvasBounds.height === 0) {
            return { scale: 1, offsetX: 0, offsetY: 0 };
        }

        const padding = 50;
        const scaleX = (canvasSize.width - 2 * padding) / canvasBounds.width;
        const scaleY = (canvasSize.height - 2 * padding) / canvasBounds.height;
        const scale = Math.min(scaleX, scaleY, 2);

        const offsetX = canvasSize.width / 2 - canvasBounds.centerX * scale;
        const offsetY = canvasSize.height / 2 - canvasBounds.centerY * scale;

        return { scale, offsetX, offsetY };
    }, [canvasBounds, canvasSize]);

    const transform = useMemo(() => {
        return {
            scale: baseTransform.scale * viewport.zoom,
            offsetX: baseTransform.offsetX * viewport.zoom + viewport.panX,
            offsetY: baseTransform.offsetY * viewport.zoom + viewport.panY,
        };
    }, [baseTransform, viewport]);

    const transformPoint = useCallback(
        (point: CanvasCoordinate) => {
            return {
                x: point.x * transform.scale + transform.offsetX,
                y: point.y * transform.scale + transform.offsetY,
            };
        },
        [transform]
    );

    const handleZoom = useCallback(
        (delta: number, centerX: number, centerY: number) => {
            setViewport((prev) => {
                const zoomFactor = delta > 0 ? 1.1 : 0.9;
                const newZoom = Math.max(0.1, Math.min(5, prev.zoom * zoomFactor));

                const worldX =
                    (centerX - prev.panX - baseTransform.offsetX * prev.zoom) /
                    (baseTransform.scale * prev.zoom);
                const worldY =
                    (centerY - prev.panY - baseTransform.offsetY * prev.zoom) /
                    (baseTransform.scale * prev.zoom);

                const newPanX =
                    centerX -
                    (worldX * baseTransform.scale * newZoom + baseTransform.offsetX * newZoom);
                const newPanY =
                    centerY -
                    (worldY * baseTransform.scale * newZoom + baseTransform.offsetY * newZoom);

                return {
                    zoom: newZoom,
                    panX: newPanX,
                    panY: newPanY,
                };
            });
        },
        [baseTransform]
    );

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    }, []);

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (isDragging && lastMousePos) {
                const deltaX = e.clientX - lastMousePos.x;
                const deltaY = e.clientY - lastMousePos.y;

                setViewport((prev) => ({
                    ...prev,
                    panX: prev.panX + deltaX,
                    panY: prev.panY + deltaY,
                }));

                setLastMousePos({ x: e.clientX, y: e.clientY });
            }
        },
        [isDragging, lastMousePos]
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setLastMousePos(null);
    }, []);

    const resetView = useCallback(() => {
        setViewport({ zoom: 1, panX: 0, panY: 0 });
    }, []);

    const drawDimensionLines = useCallback(
        (ctx: CanvasRenderingContext2D) => {
            if (dimensionLines.length === 0) return;

            ctx.save();

            dimensionLines.forEach((dimension) => {
                const startScreen = transformPoint(dimension.start);
                const endScreen = transformPoint(dimension.end);

                const dx = endScreen.x - startScreen.x;
                const dy = endScreen.y - startScreen.y;
                const length = Math.sqrt(dx * dx + dy * dy);

                if (length < 1) return;

                const unitX = dx / length;
                const unitY = dy / length;
                const offsetDistance = (30 * transform.scale) / baseTransform.scale;

                let offsetX = 0;
                let offsetY = 0;

                if (dimension.direction === 'auto') {
                    offsetX = -unitY * offsetDistance;
                    offsetY = unitX * offsetDistance;
                } else if (dimension.direction === 'left') {
                    offsetX = -offsetDistance;
                    offsetY = 0;
                } else if (dimension.direction === 'right') {
                    offsetX = offsetDistance;
                    offsetY = 0;
                } else if (dimension.direction === 'top') {
                    offsetX = 0;
                    offsetY = -offsetDistance;
                } else if (dimension.direction === 'bottom') {
                    offsetX = 0;
                    offsetY = offsetDistance;
                }

                const dimStart = {
                    x: startScreen.x + offsetX,
                    y: startScreen.y + offsetY,
                };
                const dimEnd = {
                    x: endScreen.x + offsetX,
                    y: endScreen.y + offsetY,
                };

                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2 * Math.max(0.5, transform.scale / baseTransform.scale);
                ctx.beginPath();
                ctx.moveTo(dimStart.x, dimStart.y);
                ctx.lineTo(dimEnd.x, dimEnd.y);
                ctx.stroke();

                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 1 * Math.max(0.5, transform.scale / baseTransform.scale);
                ctx.setLineDash([
                    3 * Math.max(0.5, transform.scale / baseTransform.scale),
                    3 * Math.max(0.5, transform.scale / baseTransform.scale),
                ]);

                ctx.beginPath();
                ctx.moveTo(startScreen.x, startScreen.y);
                ctx.lineTo(dimStart.x, dimStart.y);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(endScreen.x, endScreen.y);
                ctx.lineTo(dimEnd.x, dimEnd.y);
                ctx.stroke();

                ctx.setLineDash([]);

                const arrowSize = 8 * Math.max(0.5, transform.scale / baseTransform.scale);
                const angle1 = Math.atan2(dimEnd.y - dimStart.y, dimEnd.x - dimStart.x);
                const angle2 = angle1 + Math.PI;

                ctx.beginPath();
                ctx.moveTo(dimStart.x, dimStart.y);
                ctx.lineTo(
                    dimStart.x + Math.cos(angle1 + 0.3) * arrowSize,
                    dimStart.y + Math.sin(angle1 + 0.3) * arrowSize
                );
                ctx.moveTo(dimStart.x, dimStart.y);
                ctx.lineTo(
                    dimStart.x + Math.cos(angle1 - 0.3) * arrowSize,
                    dimStart.y + Math.sin(angle1 - 0.3) * arrowSize
                );
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(dimEnd.x, dimEnd.y);
                ctx.lineTo(
                    dimEnd.x + Math.cos(angle2 + 0.3) * arrowSize,
                    dimEnd.y + Math.sin(angle2 + 0.3) * arrowSize
                );
                ctx.moveTo(dimEnd.x, dimEnd.y);
                ctx.lineTo(
                    dimEnd.x + Math.cos(angle2 - 0.3) * arrowSize,
                    dimEnd.y + Math.sin(angle2 - 0.3) * arrowSize
                );
                ctx.stroke();

                const midX = (dimStart.x + dimEnd.x) / 2;
                const midY = (dimStart.y + dimEnd.y) / 2;

                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.font = `bold ${12 * Math.max(0.8, transform.scale / baseTransform.scale)}px Arial`;
                const textMetrics = ctx.measureText(dimension.label);
                const textWidth = textMetrics.width;
                const textHeight = 16 * Math.max(0.8, transform.scale / baseTransform.scale);

                ctx.fillRect(
                    midX - textWidth / 2 - 4 * Math.max(0.5, transform.scale / baseTransform.scale),
                    midY - textHeight / 2,
                    textWidth + 8 * Math.max(0.5, transform.scale / baseTransform.scale),
                    textHeight
                );

                ctx.fillStyle = '#FFD700';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(dimension.label, midX, midY);
            });

            ctx.restore();
        },
        [dimensionLines, transformPoint, transform, baseTransform]
    );
    const imgPump = new Image();
    imgPump.src = '/images/water-pump.png';

    const drawElements = useCallback(
        (ctx: CanvasRenderingContext2D, scale: number) => {
            try {
                gardenData.gardenZones?.forEach((zone) => {
                    if (!zone.canvasCoordinates || zone.canvasCoordinates.length < 3) return;

                    const zoneType = ZONE_TYPES.find((z) => z.id === zone.type);
                    ctx.fillStyle = zoneType?.color + '33' || '#66666633';
                    ctx.strokeStyle = zoneType?.color || '#666666';
                    ctx.lineWidth =
                        (zone.parentZoneId ? 3 : 2) *
                        Math.max(0.5, transform.scale / baseTransform.scale);

                    if (zone.type === 'forbidden' || zone.parentZoneId) {
                        ctx.setLineDash([
                            5 * Math.max(0.5, transform.scale / baseTransform.scale),
                            5 * Math.max(0.5, transform.scale / baseTransform.scale),
                        ]);
                    }

                    ctx.beginPath();
                    const firstPoint = transformPoint(zone.canvasCoordinates[0]);
                    ctx.moveTo(firstPoint.x, firstPoint.y);
                    zone.canvasCoordinates.forEach((coord) => {
                        const point = transformPoint(coord);
                        ctx.lineTo(point.x, point.y);
                    });
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    ctx.setLineDash([]);

                    const centerX =
                        zone.canvasCoordinates.reduce((sum, c) => sum + c.x, 0) /
                        zone.canvasCoordinates.length;
                    const centerY =
                        zone.canvasCoordinates.reduce((sum, c) => sum + c.y, 0) /
                        zone.canvasCoordinates.length;
                    const centerPoint = transformPoint({ x: centerX, y: centerY });

                    ctx.fillStyle = '#fff';
                    ctx.font = `bold ${12 * Math.max(0.8, transform.scale / baseTransform.scale)}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(zone.name, centerPoint.x, centerPoint.y);

                    try {
                        const area =
                            gardenData.canvasData && zone.canvasCoordinates
                                ? zone.canvasCoordinates.reduce((sum, coord, i) => {
                                      const nextCoord =
                                          zone.canvasCoordinates![
                                              (i + 1) % zone.canvasCoordinates!.length
                                          ];
                                      return sum + (coord.x * nextCoord.y - nextCoord.x * coord.y);
                                  }, 0) /
                                  2 /
                                  (scale * scale)
                                : 0;
                        ctx.font = `${10 * Math.max(0.8, transform.scale / baseTransform.scale)}px Arial`;
                        ctx.fillStyle = '#ddd';
                        ctx.fillText(
                            formatArea(Math.abs(area)),
                            centerPoint.x,
                            centerPoint.y +
                                15 * Math.max(0.8, transform.scale / baseTransform.scale)
                        );
                    } catch (error) {
                        console.error('Error drawing zone area:', error);
                    }
                });

                gardenData.pipes?.forEach((pipe) => {
                    if (!pipe.canvasStart || !pipe.canvasEnd) return;

                    const startPoint = transformPoint(pipe.canvasStart);
                    const endPoint = transformPoint(pipe.canvasEnd);

                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.strokeStyle = '#8B5CF6';
                    ctx.lineWidth = 8 * Math.max(0.5, transform.scale / baseTransform.scale);

                    ctx.beginPath();
                    ctx.moveTo(startPoint.x, startPoint.y);
                    ctx.lineTo(endPoint.x, endPoint.y);
                    ctx.stroke();
                });

                gardenData.sprinklers?.forEach((sprinkler) => {
                    if (!sprinkler.canvasPosition) return;
                    const zone = gardenData.gardenZones?.find((z) => z.id === sprinkler.zoneId);
                    const sprinklerPoint = transformPoint(sprinkler.canvasPosition);

                    if (zone && zone.canvasCoordinates && zone.canvasCoordinates.length >= 3) {
                        if (zone.type === 'forbidden') {
                            return;
                        }

                        try {
                            const clipResult = clipCircleToPolygon(
                                sprinkler.canvasPosition,
                                sprinkler.type.radius,
                                zone.canvasCoordinates,
                                scale
                            );

                            const radiusPixels = sprinkler.type.radius * scale * transform.scale;

                            if (clipResult === 'FULL_CIRCLE') {
                                ctx.fillStyle = sprinkler.type.color + '1A';
                                ctx.strokeStyle = sprinkler.type.color;
                                ctx.lineWidth =
                                    2 * Math.max(0.5, transform.scale / baseTransform.scale);
                                ctx.beginPath();
                                ctx.arc(
                                    sprinklerPoint.x,
                                    sprinklerPoint.y,
                                    radiusPixels,
                                    0,
                                    Math.PI * 2
                                );
                                ctx.fill();
                                ctx.stroke();
                            } else if (clipResult === 'MASKED_CIRCLE') {
                                ctx.save();
                                ctx.beginPath();
                                const firstZonePoint = transformPoint(zone.canvasCoordinates[0]);
                                ctx.moveTo(firstZonePoint.x, firstZonePoint.y);
                                for (let i = 1; i < zone.canvasCoordinates.length; i++) {
                                    const zonePoint = transformPoint(zone.canvasCoordinates[i]);
                                    ctx.lineTo(zonePoint.x, zonePoint.y);
                                }
                                ctx.closePath();
                                ctx.clip();

                                ctx.fillStyle = sprinkler.type.color + '1A';
                                ctx.strokeStyle = sprinkler.type.color;
                                ctx.lineWidth =
                                    2 * Math.max(0.5, transform.scale / baseTransform.scale);
                                ctx.beginPath();
                                ctx.arc(
                                    sprinklerPoint.x,
                                    sprinklerPoint.y,
                                    radiusPixels,
                                    0,
                                    Math.PI * 2
                                );
                                ctx.fill();
                                ctx.stroke();
                                ctx.restore();
                            } else if (Array.isArray(clipResult) && clipResult.length >= 3) {
                                const canvasResult = clipResult as CanvasCoordinate[];
                                ctx.fillStyle = sprinkler.type.color + '1A';
                                ctx.strokeStyle = sprinkler.type.color;
                                ctx.lineWidth =
                                    2 * Math.max(0.5, transform.scale / baseTransform.scale);
                                ctx.beginPath();
                                const firstClipPoint = transformPoint(canvasResult[0]);
                                ctx.moveTo(firstClipPoint.x, firstClipPoint.y);
                                canvasResult.forEach((point) => {
                                    const clipPoint = transformPoint(point);
                                    ctx.lineTo(clipPoint.x, clipPoint.y);
                                });
                                ctx.closePath();
                                ctx.fill();
                                ctx.stroke();
                            }
                            // If no coverage, don't show anything to ensure strict zone boundaries
                        } catch (error) {
                            console.error('Error drawing sprinkler radius:', error);
                            // Don't show fallback circle to ensure strict zone boundaries
                        }
                    } else if (sprinkler.zoneId === 'virtual_zone') {
                        const radiusPixels = sprinkler.type.radius * scale * transform.scale;

                        ctx.fillStyle = sprinkler.type.color + '1A';
                        ctx.strokeStyle = sprinkler.type.color;
                        ctx.lineWidth = 2 * Math.max(0.5, transform.scale / baseTransform.scale);
                        ctx.setLineDash([
                            8 * Math.max(0.5, transform.scale / baseTransform.scale),
                            4 * Math.max(0.5, transform.scale / baseTransform.scale),
                        ]);
                        ctx.beginPath();
                        ctx.arc(sprinklerPoint.x, sprinklerPoint.y, radiusPixels, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                        ctx.setLineDash([]);
                    } else {
                        // No zone or zone without coordinates - draw full circle
                        const radiusPixels = sprinkler.type.radius * scale * transform.scale;

                        ctx.fillStyle = sprinkler.type.color + '1A';
                        ctx.strokeStyle = sprinkler.type.color;
                        ctx.lineWidth = 2 * Math.max(0.5, transform.scale / baseTransform.scale);
                        ctx.beginPath();
                        ctx.arc(sprinklerPoint.x, sprinklerPoint.y, radiusPixels, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    }
                });

                gardenData.sprinklers?.forEach((sprinkler) => {
                    if (!sprinkler.canvasPosition) return;

                    const sprinklerPoint = transformPoint(sprinkler.canvasPosition);

                    // กำหนดสีเหมือนหน้า planner - ใช้ฟังก์ชันเดียวกัน
                    const isAutoSprinkler = (s: Sprinkler): boolean => {
                        // หัวฉีดอัตโนมัติมี id pattern: ${zone.id}_sprinkler_... หรือ ${zone.id}_corner_...
                        return (
                            s.id.includes('_corner_') ||
                            s.id.match(/^[^_]+_sprinkler_/) !== null
                        );
                    };
                    
                    const isMatchingAutoSprinkler = (s: Sprinkler): boolean => {
                        // หัวฉีดอัตโนมัติเป็นสีฟ้าเสมอ
                        if (isAutoSprinkler(s)) {
                            return true;
                        }
                        
                        // สำหรับหัวฉีดที่เพิ่มเอง: ตรวจสอบว่าคุณสมบัติตรงกับ SPRINKLER_TYPES ใดๆ หรือไม่
                        const autoType = SPRINKLER_TYPES.find(
                            (st) => {
                                const radiusMatch = Math.abs(st.radius - s.type.radius) < 0.01;
                                const pressureMatch = Math.abs(st.pressure - s.type.pressure) < 0.01;
                                const flowRateMatch = Math.abs(st.flowRate - s.type.flowRate) < 0.01;
                                
                                return radiusMatch && pressureMatch && flowRateMatch;
                            }
                        );
                        
                        return !!autoType;
                    };
                    
                    const baseColor = getManualSprinklerColor(
                        sprinkler,
                        gardenData.sprinklers || [],
                        isAutoSprinkler,
                        isMatchingAutoSprinkler
                    );

                    ctx.save();

                    // วาดเป็นวงกลมเหมือนหน้า planner
                    const radius = 6 * Math.max(0.5, transform.scale / baseTransform.scale);
                    
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 3 * Math.max(0.5, transform.scale / baseTransform.scale);
                    ctx.shadowOffsetX = 1 * Math.max(0.5, transform.scale / baseTransform.scale);
                    ctx.shadowOffsetY = 1 * Math.max(0.5, transform.scale / baseTransform.scale);

                    ctx.fillStyle = baseColor;
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2 * Math.max(0.5, transform.scale / baseTransform.scale);

                    ctx.translate(sprinklerPoint.x, sprinklerPoint.y);
                    if (sprinkler.orientation) {
                        ctx.rotate((sprinkler.orientation * Math.PI) / 180);
                    }

                    ctx.beginPath();
                    ctx.arc(0, 0, radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    ctx.restore();
                });

                // Render multiple water sources
                if (gardenData.waterSources && gardenData.waterSources.length > 0) {
                    gardenData.waterSources.forEach((waterSource) => {
                        if (!waterSource?.canvasPosition) return;
                        
                        const waterSourcePoint = transformPoint(waterSource.canvasPosition);

                        ctx.save();

                        ctx.beginPath();
                        ctx.arc(
                            waterSourcePoint.x,
                            waterSourcePoint.y,
                            8 * Math.max(0.5, transform.scale / baseTransform.scale),
                            0,
                            Math.PI * 2
                        );
                        ctx.fill();

                        ctx.shadowColor = 'transparent';
                        ctx.fillStyle = '#fff';
                        ctx.font = `bold ${24 * Math.max(0.8, transform.scale / baseTransform.scale)}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        if (waterSource.type === 'pump') {
                            ctx.fillText('⚡', waterSourcePoint.x, waterSourcePoint.y);
                        } else {
                            // วาดรูปภาพปั๊มน้ำ
                            const pumpSize = 24 * Math.max(0.8, transform.scale / baseTransform.scale);
                            ctx.drawImage(
                                imgPump,
                                waterSourcePoint.x - pumpSize / 2,
                                waterSourcePoint.y - pumpSize / 2,
                                pumpSize,
                                pumpSize
                            );
                        }

                        ctx.restore();
                    });
                }

                drawDimensionLines(ctx);
            } catch (error) {
                console.error('Error drawing canvas elements:', error);
            }
        },
        [gardenData, transform, transformPoint, drawDimensionLines, baseTransform]
    );

    const draw = useCallback(() => {
        const canvas = activeCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        try {
            const isImageMode = gardenData.designMode === 'image';

            let scale: number;
            if (isImageMode) {
                scale = gardenData.imageData?.scale || 20;
            } else {
                scale = gardenData.canvasData?.scale || 20;
            }

            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (isImageMode && gardenData.imageData?.url) {
                const img = new Image();
                img.onload = () => {
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    try {
                        const imgWidth = gardenData.imageData?.width || img.width;
                        const imgHeight = gardenData.imageData?.height || img.height;

                        const imgStart = transformPoint({ x: 0, y: 0 });
                        const imgEnd = transformPoint({ x: imgWidth, y: imgHeight });

                        ctx.drawImage(
                            img,
                            imgStart.x,
                            imgStart.y,
                            imgEnd.x - imgStart.x,
                            imgEnd.y - imgStart.y
                        );

                        drawElements(ctx, scale);
                    } catch (error) {
                        console.error('Error drawing image:', error);
                        drawElements(ctx, scale);
                    }
                };
                img.onerror = () => {
                    console.error('Error loading image');
                    drawElements(ctx, scale);
                };
                img.src = gardenData.imageData.url;
            } else {
                drawElements(ctx, scale);
            }
        } catch (error) {
            console.error('Error in canvas draw function:', error);
        }
    }, [gardenData, activeCanvasRef, transform, transformPoint, drawElements]);

    useEffect(() => {
        const updateCanvasSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setCanvasSize({
                    width: Math.max(800, rect.width - 32),
                    height: Math.max(600, rect.height - 32),
                });
            }
        };

        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);

        return () => {
            window.removeEventListener('resize', updateCanvasSize);
        };
    }, [containerRef]);

    useEffect(() => {
        draw();
    }, [draw]);

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            setIsDragging(false);
            setLastMousePos(null);
        };

        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isDragging && lastMousePos) {
                const deltaX = e.clientX - lastMousePos.x;
                const deltaY = e.clientY - lastMousePos.y;

                setViewport((prev) => ({
                    ...prev,
                    panX: prev.panX + deltaX,
                    panY: prev.panY + deltaY,
                }));

                setLastMousePos({ x: e.clientX, y: e.clientY });
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isDragging, lastMousePos, setViewport, setLastMousePos]);

    // Add wheel event listener with passive: false to allow preventDefault
    useEffect(() => {
        const canvas = activeCanvasRef.current;
        if (!canvas) return;

        const wheelHandler = (e: WheelEvent) => {
            e.preventDefault();
            const rect = activeCanvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const centerX = e.clientX - rect.left;
            const centerY = e.clientY - rect.top;

            handleZoom(-e.deltaY, centerX, centerY);
        };

        canvas.addEventListener('wheel', wheelHandler, { passive: false });

        return () => {
            canvas.removeEventListener('wheel', wheelHandler);
        };
    }, [handleZoom]);

    return (
        <div
            ref={containerRef}
            className="relative flex h-full w-full items-center justify-center bg-gray-900 p-4"
        >
            <div className="absolute left-4 top-4 z-10 flex gap-2">
                <button
                    onClick={resetView}
                    className="rounded bg-gray-700 px-3 py-1 text-sm text-white hover:bg-gray-600"
                    title="รีเซ็ตตำแหน่ง"
                >
                    🔄 รีเซ็ต
                </button>
                <div className="rounded bg-gray-800 px-2 py-1 text-xs text-white">
                    ซูม: {(viewport.zoom * 100).toFixed(0)}%
                </div>
            </div>
            <canvas
                ref={activeCanvasRef as React.RefObject<HTMLCanvasElement>}
                width={canvasSize.width}
                height={canvasSize.height}
                className="rounded-lg border border-gray-600 bg-gray-900 shadow-xl"
                style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                }}
                id="canvas-container"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={(e) => {
                    e.preventDefault();
                    if (e.touches.length === 1) {
                        const touch = e.touches[0];
                        const syntheticEvent = {
                            clientX: touch.clientX,
                            clientY: touch.clientY,
                            button: 0,
                            preventDefault: () => {},
                        } as React.MouseEvent<HTMLCanvasElement>;
                        handleMouseDown(syntheticEvent);
                    }
                }}
                onTouchMove={(e) => {
                    e.preventDefault();
                    if (e.touches.length === 1) {
                        const touch = e.touches[0];
                        const syntheticEvent = {
                            clientX: touch.clientX,
                            clientY: touch.clientY,
                            preventDefault: () => {},
                        } as React.MouseEvent<HTMLCanvasElement>;
                        handleMouseMove(syntheticEvent);
                    }
                }}
                onTouchEnd={(e) => {
                    e.preventDefault();
                    handleMouseUp();
                }}
                onTouchCancel={(e) => {
                    e.preventDefault();
                    handleMouseUp();
                }}
            />
        </div>
    );
};

export default function HomeGardenSummary({ data: propsData }: HomeGardenSummaryProps) {
    const { t } = useLanguage();
    const [gardenData, setGardenData] = useState<GardenPlannerData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isCreatingImage, setIsCreatingImage] = useState(false);

    useEffect(() => {
        const initializeData = async () => {
            try {
                setIsLoading(true);

                if (propsData) {
                    setGardenData(propsData);
                } else {
                    const savedData = loadGardenData();
                    if (savedData) {
                        const errors = validateGardenData(savedData);
                        if (errors.length > 0) {
                            setError('ข้อมูลไม่สมบูรณ์: ' + errors.join(', '));
                        } else {
                            setGardenData(savedData);
                        }
                    } else {
                        setError('ไม่พบข้อมูลการออกแบบ');
                    }
                }
            } catch (err) {
                console.error('Error loading data:', err);
                setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
            } finally {
                setIsLoading(false);
            }
        };

        initializeData();
    }, [propsData]);

    const statistics = useMemo(() => {
        if (!gardenData) return null;
        try {
            return calculateGardenStatistics(gardenData);
        } catch (err) {
            console.error('Error calculating statistics:', err);
            return null;
        }
    }, [gardenData]);

    /** แยกหัวฉีดตามสี (เหมือนหน้า planner) พร้อมจำนวนและสเปก */
    const sprinklerByColor = useMemo(() => {
        if (!gardenData?.sprinklers?.length) return [];

        const isAutoSprinkler = (s: Sprinkler): boolean =>
            s.id.includes('_corner_') || s.id.match(/^[^_]+_sprinkler_/) !== null;

        const isMatchingAutoSprinkler = (s: Sprinkler): boolean => {
            if (isAutoSprinkler(s)) return true;
            const autoType = SPRINKLER_TYPES.find(
                (st) =>
                    Math.abs(st.radius - s.type.radius) < 0.01 &&
                    Math.abs(st.pressure - s.type.pressure) < 0.01 &&
                    Math.abs(st.flowRate - s.type.flowRate) < 0.01
            );
            return !!autoType;
        };

        const groups = new Map<
            string,
            { color: string; count: number; radius: number; pressure: number; flowRate: number; typeName: string; sprinklerName: string }
        >();

        gardenData.sprinklers.forEach((sprinkler) => {
            const color = getManualSprinklerColor(
                sprinkler,
                gardenData.sprinklers || [],
                isAutoSprinkler,
                isMatchingAutoSprinkler
            );

            const key = `${color}_${sprinkler.type.radius.toFixed(2)}_${sprinkler.type.pressure.toFixed(2)}_${sprinkler.type.flowRate.toFixed(2)}`;
            const existing = groups.get(key);

            const matchedType = SPRINKLER_TYPES.find(
                (st) =>
                    Math.abs(st.radius - sprinkler.type.radius) < 0.01 &&
                    Math.abs(st.pressure - sprinkler.type.pressure) < 0.01 &&
                    Math.abs(st.flowRate - sprinkler.type.flowRate) < 0.01
            );
            const typeName = matchedType ? matchedType.nameTH : t('หัวฉีดกำหนดเอง');
            const sprinklerName = (sprinkler.type.nameTH || sprinkler.type.nameEN || typeName).trim() || typeName;

            if (existing) {
                existing.count += 1;
            } else {
                groups.set(key, {
                    color,
                    count: 1,
                    radius: sprinkler.type.radius,
                    pressure: sprinkler.type.pressure,
                    flowRate: sprinkler.type.flowRate,
                    typeName,
                    sprinklerName,
                });
            }
        });

        return Array.from(groups.values()).sort((a, b) => b.count - a.count);
    }, [gardenData, t]);

    const createMapImage = async () => {
        let targetElement: HTMLElement | null = null;

        if (
            (gardenData?.designMode === 'canvas' || gardenData?.designMode === 'image') &&
            canvasRef.current
        ) {
            targetElement = canvasRef.current;
        }

        if (!targetElement) {
            console.error('🏡 ไม่พบ element สำหรับ capture');
            return null;
        }

        try {
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const html2canvas = await import('html2canvas');
            const html2canvasLib = html2canvas.default || html2canvas;
            const canvas = await html2canvasLib(targetElement, {
                useCORS: true,
                allowTaint: true,
                scale: 2,
                logging: false,
                backgroundColor: '#1F2937',
                width: targetElement.offsetWidth,
                height: targetElement.offsetHeight,
                onclone: (clonedDoc) => {
                    try {
                        const controls = clonedDoc.querySelectorAll(
                            '.leaflet-control-container, .gm-control-active, .gm-style-cc'
                        );
                        controls.forEach((el) => el.remove());

                        const elements = clonedDoc.querySelectorAll('*');
                        elements.forEach((el: Element) => {
                            const htmlEl = el as HTMLElement;
                            const computedStyle = window.getComputedStyle(htmlEl);

                            const color = computedStyle.color;
                            if (color && (color.includes('oklch') || color.includes('hsl'))) {
                                htmlEl.style.color = '#FFFFFF';
                            }

                            const backgroundColor = computedStyle.backgroundColor;
                            if (
                                backgroundColor &&
                                (backgroundColor.includes('oklch') ||
                                    backgroundColor.includes('hsl'))
                            ) {
                                if (
                                    backgroundColor.includes('transparent') ||
                                    backgroundColor.includes('rgba(0,0,0,0)')
                                ) {
                                    htmlEl.style.backgroundColor = 'transparent';
                                } else {
                                    htmlEl.style.backgroundColor = '#1F2937';
                                }
                            }

                            const borderColor = computedStyle.borderColor;
                            if (
                                borderColor &&
                                (borderColor.includes('oklch') || borderColor.includes('hsl'))
                            ) {
                                htmlEl.style.borderColor = '#374151';
                            }
                        });

                        const problematicElements = clonedDoc.querySelectorAll(
                            '[style*="oklch"], [style*="hsl"]'
                        );
                        problematicElements.forEach((el) => {
                            const htmlEl = el as HTMLElement;
                            htmlEl.style.removeProperty('color');
                            htmlEl.style.removeProperty('background-color');
                            htmlEl.style.removeProperty('border-color');
                            htmlEl.style.removeProperty('outline-color');
                        });
                    } catch (error) {
                        console.warn('⚠️ คำเตือนใน onclone:', error);
                    }
                },
            });

            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

            if (dataUrl && dataUrl !== 'data:,' && dataUrl.length > 100) {
                return dataUrl;
            } else {
                throw new Error('ไม่สามารถสร้างภาพแผนที่ได้');
            }
        } catch (error) {
            console.error('🏡 Error creating map image:', error);

            try {
                const fallbackCanvas = document.createElement('canvas');
                const ctx = fallbackCanvas.getContext('2d');

                if (ctx) {
                    fallbackCanvas.width = 800;
                    fallbackCanvas.height = 600;

                    ctx.fillStyle = '#1F2937';
                    ctx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);

                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '24px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(
                        '🏡 แผนผังสวนบ้าน',
                        fallbackCanvas.width / 2,
                        fallbackCanvas.height / 2 - 40
                    );
                    ctx.fillText(
                        '(ไม่สามารถสร้างภาพแผนที่ได้)',
                        fallbackCanvas.width / 2,
                        fallbackCanvas.height / 2
                    );
                    ctx.fillText(
                        'กรุณาใช้ screenshot แทน',
                        fallbackCanvas.width / 2,
                        fallbackCanvas.height / 2 + 40
                    );

                    return fallbackCanvas.toDataURL('image/jpeg', 0.8);
                }
            } catch (fallbackError) {
                console.error('🏡 การสร้างภาพ fallback ล้มเหลว:', fallbackError);
            }

            return null;
        }
    };

    const handleEquipmentCalculation = useCallback(async () => {
        try {
            setIsCreatingImage(true);

            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'garden-image-loading';
            loadingDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 20px;
                border-radius: 10px;
                z-index: 10000;
                text-align: center;
            `;
            loadingDiv.innerHTML = `
                <div>🏡 ${t('กำลังเตรียมข้อมูลสวนบ้าน...')}</div>
                <div style="margin-top: 10px; font-size: 12px;">${t('กรุณารอสักครู่')}</div>
            `;
            document.body.appendChild(loadingDiv);

            if (gardenData) {
                localStorage.setItem('garden_planner_data', JSON.stringify(gardenData));
            }

            if (statistics) {
                localStorage.setItem('garden_statistics', JSON.stringify(statistics));
            }

            const imageUrl = await createMapImage();

            if (imageUrl) {
                localStorage.setItem('projectMapImage', imageUrl);
                localStorage.setItem('projectType', 'home-garden');

                document.body.removeChild(loadingDiv);

                window.location.href = '/product?mode=garden';
            } else {
                document.body.removeChild(loadingDiv);
                router.visit('/product?mode=garden');
            }
        } catch (error) {
            console.error('🏡 Error navigating to equipment calculation:', error);
            setError('เกิดข้อผิดพลาดในการไปยังหน้าคำนวณอุปกรณ์');

            const loadingDiv = document.getElementById('garden-image-loading');
            if (loadingDiv) {
                document.body.removeChild(loadingDiv);
            }
        } finally {
            setIsCreatingImage(false);
        }
    }, [gardenData, statistics]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center bg-gray-900 p-6">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-white"></div>
                    <p className="text-white">{t('กำลังโหลดข้อมูล...')}</p>
                </div>
            </div>
        );
    }

    if (error || !gardenData || !statistics) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center bg-gray-900 p-6">
                <Navbar />
                <div className="text-center pt-20">
                    <h1 className="mb-4 text-2xl font-bold text-white">
                        {error || t('ไม่พบข้อมูลการออกแบบ')}
                    </h1>
                    <button
                        onClick={() => router.visit('/home-garden-planner')}
                        className="rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
                    >
                        {t('กลับไปหน้าออกแบบ')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <SummaryErrorBoundary t={t}>
            <Navbar />
            <div className="min-h-screen w-full bg-gray-900 p-6 pt-20">
                {error && (
                    <div className="fixed left-4 top-4 z-50 rounded-lg bg-red-600 p-4 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                            <span>{error}</span>
                            <button
                                onClick={() => setError(null)}
                                className="ml-4 text-white hover:text-gray-200"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <h1 className="mb-2 text-2xl font-bold text-white">
                            📊 {t('สรุปผลการออกแบบระบบน้ำ')}
                            <span className="ml-2 text-sm font-normal text-gray-400">
                                (
                                {gardenData.designMode === 'canvas'
                                    ? t('วาดเอง')
                                    : gardenData.designMode === 'image'
                                      ? t('รูปแบบแปลน')
                                      : t('วาดเอง')}
                                )
                            </span>
                        </h1>
                    </div>
                    <div className="text-right text-sm text-gray-400">
                        <div className="flex gap-2">
                            <button
                                onClick={() => router.visit('/home-garden-planner')}
                                className="rounded-lg bg-gray-700 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-600"
                            >
                                ← {t('กลับไปหน้าออกแบบ')}
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleEquipmentCalculation}
                                    disabled={isCreatingImage}
                                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    title={t('คำนวณอุปกรณ์สำหรับสวนบ้าน')}
                                >
                                    {isCreatingImage ? (
                                        <>
                                            <svg
                                                className="mr-2 inline h-4 w-4 animate-spin"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                ></circle>
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                ></path>
                                            </svg>
                                            {t('กำลังเตรียม...')}
                                        </>
                                    ) : (
                                        '💰 ' + t('คำนวณอุปกรณ์')
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <div className="rounded-xl bg-gray-800 p-6">
                            <h3 className="mb-4 text-lg font-semibold text-blue-400">
                                🗺️ {t('แผนผังโครงการ')}
                            </h3>
                            <div className="h-[600px] overflow-hidden rounded-lg border border-gray-600 bg-gray-900">
                                {gardenData.designMode === 'map' ? (
                                    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                                        <p className="text-amber-300">
                                            {t('โหมด Google Map ไม่รองรับแล้ว')}
                                        </p>
                                        <p className="text-sm text-gray-400">
                                            {t('โครงการนี้สร้างด้วยโหมดแผนที่ กรุณากลับไปหน้าออกแบบแล้วเลือกโหมด วาดเอง หรือ รูปแบบแปลน')}
                                        </p>
                                        <button
                                            onClick={() => router.visit('/home-garden-planner')}
                                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                                        >
                                            {t('ไปหน้าออกแบบ')}
                                        </button>
                                    </div>
                                ) : (
                                    <CanvasRenderer gardenData={gardenData} canvasRef={canvasRef} />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-xl bg-gray-800 p-6">
                            <h3 className="mb-4 text-lg font-semibold text-blue-400">
                                📊 {t('ข้อมูลรวม')}
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div className="rounded-lg bg-gray-700 p-3">
                                    <div className="mb-1 text-gray-400">
                                        {t('พื้นที่รวมทั้งหมด')}
                                    </div>
                                    <div className="text-xl font-bold text-white">
                                        {statistics.summary.totalAreaFormatted}
                                    </div>
                                </div>

                                <div className="rounded-lg bg-gray-700 p-3">
                                    <div className="mb-1 text-gray-400">
                                        {t('จำนวนโซน (ไม่รวมพื้นที่ห้าม)')}
                                    </div>
                                    <div className="text-xl font-bold text-green-400">
                                        {statistics.summary.totalZones} {t('โซน')}
                                    </div>
                                </div>

                                <div className="rounded-lg bg-gray-700 p-3">
                                    <div className="mb-1 text-gray-400">
                                        {t('จำนวนหัวฉีดทั้งหมด')}
                                    </div>
                                    <div className="text-xl font-bold text-blue-400">
                                        {statistics.summary.totalSprinklers} {t('ตัว')}
                                    </div>
                                </div>

                                <div className="rounded-lg bg-gray-700 p-3">
                                    <div className="mb-1 text-gray-400">{t('ระบบท่อ')}</div>
                                    <div className="mt-1 grid grid-cols-2 gap-2">
                                        <div>
                                            <div className="text-xs text-gray-500">
                                                {t('ท่อที่ยาวที่สุด')}
                                            </div>
                                            <div className="font-bold text-yellow-400">
                                                {statistics.summary.longestPipeFromSourceFormatted}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500">
                                                {t('ความยาวรวม')}
                                            </div>
                                            <div className="font-bold text-yellow-400">
                                                {statistics.summary.totalPipeLengthFormatted}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {statistics.summary.connectorSummary && (
                                    <div className="rounded-lg bg-gray-700 p-3">
                                        <div className="mb-1 text-gray-400">
                                            🔗 {t('ข้อต่อที่ต้องใช้')}
                                        </div>
                                        <div className="mt-1 space-y-1.5 text-sm">
                                            {Object.entries(statistics.summary.connectorSummary.byWays)
                                                .sort(([a], [b]) => Number(a) - Number(b))
                                                .map(([ways, count]) => (
                                                    <div key={ways} className="flex justify-between text-xs">
                                                        <span className="text-gray-500">
                                                            {t('ข้อต่อ')} {ways} {t('ทาง')}
                                                        </span>
                                                        <span className="font-medium text-orange-400">
                                                            {count} {t('อัน')}
                                                        </span>
                                                    </div>
                                                ))}
                                            {statistics.summary.connectorSummary.straightCouplers > 0 && (
                                                <div className="flex justify-between border-t border-gray-600 pt-1.5 text-xs">
                                                    <span className="text-gray-500">{t('ต่อตรง')}</span>
                                                    <span className="font-medium text-cyan-400">
                                                        {statistics.summary.connectorSummary.straightCouplers} {t('อัน')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {sprinklerByColor.length > 0 && (
                    <div className="mt-6 rounded-xl bg-gray-800 p-6">
                        <h3 className="mb-4 text-lg font-semibold text-blue-400">
                            🎨 {t('หัวฉีดแยกตามประเภท/สี')}
                        </h3>
                        <p className="mb-4 text-sm text-gray-400">
                            {t('แต่ละสีแสดงจำนวนหัวฉีดและสเปก (รัศมี, แรงดัน, อัตราการไหล)')}
                        </p>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {sprinklerByColor.map((group, index) => (
                                <div
                                    key={`${group.color}-${group.radius}-${index}`}
                                    className="rounded-lg border border-gray-600 bg-gray-700 p-4"
                                >
                                    <div className="mb-3 flex items-center gap-3">
                                        <div
                                            className="h-8 w-8 shrink-0 rounded-full border-2 border-white/30"
                                            style={{ backgroundColor: group.color }}
                                            title={group.color}
                                        />
                                        <div>
                                            <div className="font-semibold text-white">
                                                {t('สี')} #{index + 1}
                                            </div>
                                            <div className="text-lg font-bold text-blue-400">
                                                {group.count} {t('หัว')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 text-sm">
                                        <div className="text-gray-400">
                                            <span className="font-medium text-gray-300">{t('ชื่อสปริงเกอร์')}:</span>{' '}
                                            <span className="text-white">{group.sprinklerName}</span>
                                        </div>
                                        <div className="text-gray-400">
                                            <span className="font-medium text-gray-300">{t('ประเภท')}:</span>{' '}
                                            {group.typeName}
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                                            <span className="text-cyan-300">
                                                {t('รัศมี')}: {group.radius.toFixed(1)} {t('ม.')}
                                            </span>
                                            <span className="text-amber-300">
                                                {t('แรงดัน')}: {group.pressure.toFixed(1)} {t('บาร์')}
                                            </span>
                                            <span className="text-emerald-300">
                                                {t('อัตราการไหล')}: {group.flowRate.toFixed(1)} {t('ล./นาที')}
                                            </span>
                                        </div>
                                        <div className="pt-1 text-xs text-gray-500">
                                            {t('รวมอัตราการไหล')}: {(group.flowRate * group.count).toFixed(1)} {t('ล./นาที')}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {statistics.zones.length > 0 && (
                    <div className="mt-6 rounded-xl bg-gray-800 p-6">
                        <h3 className="mb-4 text-lg font-semibold text-green-400">
                            📍 {t('ข้อมูลแยกตามโซน')}
                        </h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-5">
                            {statistics.zones.map((zone, index) => (
                                <div key={zone.zoneId} className="rounded-lg bg-gray-700 p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h4 className="font-semibold text-white">
                                            {index + 1}. {t(zone.zoneName)}
                                        </h4>
                                        <span className="rounded bg-gray-600 px-2 py-1 text-xs text-gray-300">
                                            {t('โซน')}
                                        </span>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">{t('พื้นที่:')}</span>
                                            <span className="font-medium text-white">
                                                {zone.areaFormatted}
                                            </span>
                                        </div>

                                        <div className="flex justify-between">
                                            <span className="text-gray-400">
                                                {t('จำนวนหัวฉีด:')}
                                            </span>
                                            <span className="font-medium text-blue-400">
                                                {zone.sprinklerCount} {t('ตัว')}
                                            </span>
                                        </div>

                                        {zone.totalPipeLength > 0 && (
                                            <div className="border-t border-gray-600 pt-2">
                                                <div className="mb-2 text-gray-400">
                                                    {t('ระบบท่อ:')}
                                                </div>

                                                {/* ความยาวท่อ */}
                                                <div className="mb-2">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-gray-500">
                                                            {t('ความยาวท่อ:')}
                                                        </span>
                                                        <span className="font-medium text-yellow-400">
                                                            {zone.totalPipeLengthFormatted}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* จำนวนทางออก (สปริงเกอร์) */}
                                                <div className="mb-2">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-gray-500">
                                                            {t('จำนวนทางออก:')}
                                                        </span>
                                                        <span className="font-medium text-orange-400">
                                                            {zone.sprinklerCount} {t('ทาง')}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* อัตราการใช้น้ำรวมของท่อ (Q หัวฉีด × จำนวนหัวฉีด) */}
                                                <div className="mb-2">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-gray-500">
                                                            {t('อัตราการใช้น้ำท่อ:')}
                                                        </span>
                                                        <span className="font-medium text-cyan-400">
                                                            {zone.sprinklerCount > 0 &&
                                                            zone.sprinklerFlowRate > 0
                                                                ? `${(zone.sprinklerFlowRate * zone.sprinklerCount).toFixed(1)} ${t('ล./นาที')}`
                                                                : '-'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* ท่อที่ยาวที่สุด */}
                                                <div className="text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">
                                                            {t('ท่อยาวที่สุด:')}
                                                        </span>
                                                        <span className="font-medium text-yellow-400">
                                                            {zone.longestPipeFromSourceFormatted}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </SummaryErrorBoundary>
    );
}
