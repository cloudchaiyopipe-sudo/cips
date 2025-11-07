import React from 'react';
import { ZoneControlPoint } from '../../utils/zoneEditUtils';
import { Coordinate } from '../../utils/irrigationZoneUtils';

interface ZoneControlPointsProps {
    controlPoints: ZoneControlPoint[];
    onPointDragStart: (point: ZoneControlPoint, event: React.MouseEvent) => void;
    onPointDrag: (event: React.MouseEvent) => void;
    onPointDragEnd: () => void;
    isDragging: boolean;
    draggedPointIndex: number | null;
    mapBounds?: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
}

const ZoneControlPoints: React.FC<ZoneControlPointsProps> = ({
    controlPoints,
    onPointDragStart,
    onPointDrag,
    onPointDragEnd,
    isDragging,
    draggedPointIndex,
    mapBounds,
}) => {
    const coordinateToPixel = (coord: Coordinate): { x: number; y: number } => {
        if (!mapBounds) return { x: 0, y: 0 };

        const mapWidth = window.innerWidth || 800;
        const mapHeight = window.innerHeight || 600;

        const lngRange = mapBounds.east - mapBounds.west;
        const latRange = mapBounds.north - mapBounds.south;

        if (lngRange === 0 || latRange === 0) {
            return { x: mapWidth / 2, y: mapHeight / 2 };
        }

        const x = ((coord.lng - mapBounds.west) / lngRange) * mapWidth;
        const y = ((mapBounds.north - coord.lat) / latRange) * mapHeight;

        return {
            x: Math.max(0, Math.min(mapWidth, x)),
            y: Math.max(0, Math.min(mapHeight, y)),
        };
    };

    const handleMouseDown = (point: ZoneControlPoint, event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        onPointDragStart(point, event);
    };

    const handleMouseMove = (event: React.MouseEvent) => {
        if (isDragging) {
            event.preventDefault();
            onPointDrag(event);
        }
    };

    const handleMouseUp = () => {
        if (isDragging) {
            onPointDragEnd();
        }
    };

    React.useEffect(() => {
        if (isDragging) {
            const handleGlobalMouseMove = (e: MouseEvent) => {
                onPointDrag(e as unknown as React.MouseEvent<Element, MouseEvent>);
            };
            const handleGlobalMouseUp = () => {
                onPointDragEnd();
            };

            document.addEventListener('mousemove', handleGlobalMouseMove);
            document.addEventListener('mouseup', handleGlobalMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleGlobalMouseMove);
                document.removeEventListener('mouseup', handleGlobalMouseUp);
            };
        }
    }, [isDragging, onPointDrag, onPointDragEnd]);

    if (!controlPoints || controlPoints.length === 0) {
        return null;
    }

    return (
        <div
            className="pointer-events-none absolute inset-0"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {controlPoints
                .filter((point) => point.index % 1 === 0)
                .map((point) => {
                    const pixelPos = coordinateToPixel(point.position);
                    const isBeingDragged = draggedPointIndex === point.index;
                    const isMidPoint = point.index % 1 !== 0;

                    return (
                        <div
                            key={point.id}
                            className={`
                            pointer-events-auto absolute z-50 cursor-pointer
                            ${isBeingDragged ? 'z-[60]' : ''}
                        `}
                            style={{
                                left: `${pixelPos.x - 6}px`,
                                top: `${pixelPos.y - 6}px`,
                                transform: isBeingDragged ? 'scale(1.3)' : 'scale(1)',
                                transition: isBeingDragged ? 'none' : 'transform 0.2s ease',
                            }}
                            onMouseDown={(e) => handleMouseDown(point, e)}
                            title={`จุดควบคุม ${isMidPoint ? '(กึ่งกลาง)' : '(มุม)'} - ลากเพื่อแก้ไขโซน`}
                        >
                            <div
                                className={`
                                h-3 w-3 rounded-full border-2 shadow-lg
                                ${
                                    isMidPoint
                                        ? 'border-blue-600 bg-blue-400'
                                        : 'border-orange-600 bg-orange-400'
                                }
                                ${
                                    isBeingDragged
                                        ? 'border-red-700 bg-red-500 shadow-xl'
                                        : 'hover:bg-opacity-80'
                                }
                            `}
                            />

                            {!isMidPoint && (
                                <div className="absolute inset-0 border border-dashed border-orange-300 opacity-50" />
                            )}
                        </div>
                    );
                })}

            {controlPoints.length > 0 && (
                <div className="pointer-events-auto absolute left-4 top-4 max-w-sm rounded-lg border bg-white p-3 shadow-lg">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-800">
                        <span>🎯</span>
                        <span>โหมดแก้ไขโซน</span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full border border-orange-600 bg-orange-400"></div>
                            <span>จุดมุม - ลากเพื่อเปลี่ยนรูปทรงโซน</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                            💡 เคล็ดลับ: ลากจุดมุมเพื่อปรับขนาดและรูปทรงของโซน
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZoneControlPoints;
