/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef } from 'react';
import {
    findClosestPointOnLineSegment as utilsFindClosestPointOnLineSegment,
    calculateDistanceBetweenPoints as utilsCalculateDistanceBetweenPoints,
} from '../../utils/horticultureUtils';

interface Coordinate {
    lat: number;
    lng: number;
}

interface Pipe {
    id: string;
    coordinates: Coordinate[];
    length?: number;
    diameter?: number;
    type?: string;
}

interface HorticultureDrawingManagerProps {
    map?: google.maps.Map;
    editMode: string | null;
    onCreated: (coordinates: Coordinate[], shapeType: string) => void;
    fillColor?: string;
    strokeColor?: string;
    isEditModeEnabled?: boolean;
    mainArea?: Coordinate[];
    pump?: Coordinate | null;
    mainPipes?: Pipe[];
    subMainPipes?: Pipe[];
    t?: (key: string) => string;
    onMainPipeClick?: (pipeId: string, clickPosition: Coordinate) => void;
    onLateralPipeClick?: (event: google.maps.MapMouseEvent) => void;
    onLateralPipeMouseMove?: (event: google.maps.MapMouseEvent) => void;
}

const snapPointToPump = (
    point: Coordinate,
    pumpPosition: Coordinate | null,
    snapThreshold: number = 10
): Coordinate => {
    if (!pumpPosition) {
        return point;
    }

    const distance = calculateDistanceBetweenPoints(point, pumpPosition);

    if (distance <= snapThreshold) {
        return pumpPosition;
    }

    return point;
};



const snapPointToMainAreaBoundary = (
    point: Coordinate,
    mainArea: Coordinate[],
    snapThreshold: number = 5
): Coordinate => {
    if (!mainArea || mainArea.length < 3) {
        return point;
    }

    let closestPoint = point;
    let minDistance = Infinity;

    for (let i = 0; i < mainArea.length; i++) {
        const start = mainArea[i];
        const end = mainArea[(i + 1) % mainArea.length];

        const closestPointOnSegment = findClosestPointOnLineSegment(point, start, end);
        const distance = calculateDistanceBetweenPoints(point, closestPointOnSegment);

        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = closestPointOnSegment;
        }
    }

    if (minDistance <= snapThreshold) {
        return closestPoint;
    }

    return point;
};

const findClosestPointOnLineSegment = utilsFindClosestPointOnLineSegment;

const calculateDistanceBetweenPoints = utilsCalculateDistanceBetweenPoints;




const advancedSnapToMainArea = (
    coordinates: Coordinate[],
    mainArea?: Coordinate[]
): Coordinate[] => {
    if (!mainArea || mainArea.length < 3) {
        return coordinates;
    }

    let longestEdge = 0;
    let longestEdgeStart: Coordinate | null = null;
    let longestEdgeEnd: Coordinate | null = null;

    for (let i = 0; i < mainArea.length; i++) {
        const start = mainArea[i];
        const end = mainArea[(i + 1) % mainArea.length];
        const edgeLength = calculateDistanceBetweenPoints(start, end);

        if (edgeLength > longestEdge) {
            longestEdge = edgeLength;
            longestEdgeStart = start;
            longestEdgeEnd = end;
        }
    }
    const snappedCoordinates = coordinates.map((coord) => {
        if (longestEdgeStart && longestEdgeEnd) {
            const distanceToLongestEdge = calculateDistanceBetweenPoints(
                coord,
                findClosestPointOnLineSegment(coord, longestEdgeStart, longestEdgeEnd)
            );

            if (distanceToLongestEdge <= 3) {
                const snappedPoint = findClosestPointOnLineSegment(
                    coord,
                    longestEdgeStart,
                    longestEdgeEnd
                );
                return snappedPoint;
            }
        }

        return snapPointToMainAreaBoundary(coord, mainArea, 5);
    });

    const snappedCount = snappedCoordinates.filter(
        (coord, index) =>
            coord.lat !== coordinates[index].lat || coord.lng !== coordinates[index].lng
    ).length;

    if (snappedCount > 0) {
        if (
            typeof window !== 'undefined' &&
            (window as unknown as { showSnapNotification?: (message: string) => void })
                .showSnapNotification
        ) {
            (
                window as unknown as { showSnapNotification: (message: string) => void }
            ).showSnapNotification(`${snappedCount} points snapped to main area boundary`);
        }
    }

    return snappedCoordinates;
};

const extractCoordinatesFromShape = (
    shape: google.maps.Polygon | google.maps.Rectangle | google.maps.Circle | google.maps.Polyline
): Coordinate[] => {
    try {
        let coordinates: Coordinate[] = [];

        if (shape instanceof google.maps.Rectangle) {
            const bounds = shape.getBounds();
            if (bounds) {
                const ne = bounds.getNorthEast();
                const sw = bounds.getSouthWest();
                coordinates = [
                    { lat: sw.lat(), lng: sw.lng() },
                    { lat: ne.lat(), lng: sw.lng() },
                    { lat: ne.lat(), lng: ne.lng() },
                    { lat: sw.lat(), lng: ne.lng() },
                ];
            }
        } else if (shape instanceof google.maps.Circle) {
            const center = shape.getCenter();
            const radius = shape.getRadius();
            const points = 32;

            if (center) {
                for (let i = 0; i < points; i++) {
                    const angle = (i * 360) / points;
                    const rad = (angle * Math.PI) / 180;
                    const latOffset = (radius / 111320) * Math.cos(rad);
                    const lngOffset =
                        (radius / (111320 * Math.cos((center.lat() * Math.PI) / 180))) *
                        Math.sin(rad);

                    coordinates.push({
                        lat: center.lat() + latOffset,
                        lng: center.lng() + lngOffset,
                    });
                }
            }
        } else if (shape instanceof google.maps.Polygon) {
            const path = shape.getPath();
            if (path) {
                for (let i = 0; i < path.getLength(); i++) {
                    const latLng = path.getAt(i);
                    coordinates.push({ lat: latLng.lat(), lng: latLng.lng() });
                }
            }
        } else if (shape instanceof google.maps.Polyline) {
            const path = shape.getPath();
            if (path) {
                for (let i = 0; i < path.getLength(); i++) {
                    const latLng = path.getAt(i);
                    coordinates.push({ lat: latLng.lat(), lng: latLng.lng() });
                }
            }
        }

        return coordinates;
    } catch (error) {
        console.error('Error extracting coordinates:', error);
        return [];
    }
};

const getDrawingMode = (editMode: string | null): google.maps.drawing.OverlayType | null => {
    switch (editMode) {
        case 'mainArea':
        case 'zone':
        case 'exclusion':
        case 'plantArea':
        case 'manualZone':
            return google.maps.drawing.OverlayType.POLYGON;
        case 'mainPipe':
        case 'subMainPipe':
        case 'lateralPipe':
            return google.maps.drawing.OverlayType.POLYLINE;
        default:
            return null;
    }
};

const getDrawingModes = (editMode: string | null): google.maps.drawing.OverlayType[] => {
    switch (editMode) {
        case 'mainArea':
        case 'zone':
        case 'exclusion':
        case 'plantArea':
        case 'manualZone':
            return [
                google.maps.drawing.OverlayType.POLYGON,
                google.maps.drawing.OverlayType.RECTANGLE,
                google.maps.drawing.OverlayType.CIRCLE,
            ];
        case 'mainPipe':
        case 'subMainPipe':
        case 'lateralPipe':
            return [google.maps.drawing.OverlayType.POLYLINE];
        default:
            return [];
    }
};

const getShapeOptions = (editMode: string | null, fillColor?: string, strokeColor?: string) => {
    const defaultColor = fillColor || '#4ECDC4';
    const defaultStroke = strokeColor || '#4ECDC4';

    const baseOptions = {
        fillColor: defaultColor,
        fillOpacity: 0.3,
        strokeColor: defaultStroke,
        strokeOpacity: 1,
        strokeWeight: 2,
        editable: true,
        draggable: true,
    };

    switch (editMode) {
        case 'mainArea':
            return {
                polygonOptions: { ...baseOptions, fillColor: '#22C55E', strokeColor: '#22C55E' },
                rectangleOptions: { ...baseOptions, fillColor: '#22C55E', strokeColor: '#22C55E' },
                circleOptions: { ...baseOptions, fillColor: '#22C55E', strokeColor: '#22C55E' },
            };
        case 'zone':
            return {
                polygonOptions: baseOptions,
                rectangleOptions: baseOptions,
                circleOptions: baseOptions,
            };
        case 'exclusion':
            return {
                polygonOptions: { ...baseOptions, fillColor: '#F59E0B', strokeColor: '#F59E0B' },
                rectangleOptions: { ...baseOptions, fillColor: '#F59E0B', strokeColor: '#F59E0B' },
                circleOptions: { ...baseOptions, fillColor: '#F59E0B', strokeColor: '#F59E0B' },
            };
        case 'plantArea':
            return {
                polygonOptions: { ...baseOptions, fillColor: '#8B5CF6', strokeColor: '#8B5CF6' },
                rectangleOptions: { ...baseOptions, fillColor: '#8B5CF6', strokeColor: '#8B5CF6' },
                circleOptions: { ...baseOptions, fillColor: '#8B5CF6', strokeColor: '#8B5CF6' },
            };
        case 'manualZone':
            return {
                polygonOptions: { ...baseOptions, fillColor: '#3B82F6', strokeColor: '#3B82F6' },
                rectangleOptions: { ...baseOptions, fillColor: '#3B82F6', strokeColor: '#3B82F6' },
                circleOptions: { ...baseOptions, fillColor: '#3B82F6', strokeColor: '#3B82F6' },
            };
        case 'mainPipe':
            return {
                polylineOptions: {
                    strokeColor: '#FF0000',
                    strokeWeight: 2,
                    strokeOpacity: 0.9,
                    editable: true,
                    draggable: true,
                },
            };
        case 'subMainPipe':
            return {
                polylineOptions: {
                    strokeColor: '#8B5CF6',
                    strokeWeight: 5,
                    strokeOpacity: 0.9,
                    editable: true,
                    draggable: true,
                },
            };
        case 'lateralPipe':
            return {
                polylineOptions: {
                    strokeColor: '#FFD700',
                    strokeWeight: 2,
                    strokeOpacity: 0.9,
                    editable: true,
                    draggable: true,
                },
            };
        default:
            return {
                polygonOptions: baseOptions,
                rectangleOptions: baseOptions,
                circleOptions: baseOptions,
                polylineOptions: {
                    strokeColor: defaultStroke,
                    strokeWeight: 3,
                    strokeOpacity: 0.9,
                    editable: true,
                    draggable: true,
                },
            };
    }
};

const snapMainPipeCoordinates = (
    coordinates: Coordinate[],
    pumpPosition: Coordinate | null
): Coordinate[] => {
    if (coordinates.length === 0) {
        return coordinates;
    }

    const snappedCoordinates = [...coordinates];
    if (pumpPosition) {
        snappedCoordinates[0] = snapPointToPump(coordinates[0], pumpPosition);
    }

    return snappedCoordinates;
};

const snapSubMainPipeCoordinates = (
    coordinates: Coordinate[]
): Coordinate[] => {
    return coordinates;
};

const optimizeLateralPipeCoordinates = (
    startPoint: Coordinate,
    endPoint: Coordinate,
    originalCoordinates: Coordinate[]
): Coordinate[] => {
    if (originalCoordinates.length <= 2) {
        return [startPoint, endPoint];
    }
    
    const optimized: Coordinate[] = [startPoint];
    
    for (let i = 1; i < originalCoordinates.length - 1; i++) {
        const current = originalCoordinates[i];
        const prev = optimized[optimized.length - 1];
        
        const distance = calculateDistanceBetweenPoints(prev, current);
        
        if (distance > 2) {
            optimized.push(current);
        }
    }
    
    optimized.push(endPoint);
    
    return optimized;
};

const validateLateralPipeInput = (
    coordinates: Coordinate[],
    placementMode: string | null
): boolean => {
    if (!coordinates || coordinates.length < 2) {
        return false;
    }
    
    if (!placementMode) {
        return false;
    }
    
    for (const coord of coordinates) {
        if (
            typeof coord.lat !== 'number' ||
            typeof coord.lng !== 'number' ||
            !isFinite(coord.lat) ||
            !isFinite(coord.lng)
        ) {
            return false;
        }
    }
    
    return true;
};

const enhanceLateralPipeDrawing = (
    coordinates: Coordinate[],
    placementMode: string | null
): Coordinate[] => {
    if (!validateLateralPipeInput(coordinates, placementMode)) {
        return coordinates;
    }
    
    if (coordinates.length === 2) {
        return coordinates;
    }
    
    const startPoint = coordinates[0];
    const endPoint = coordinates[coordinates.length - 1];
    
    return optimizeLateralPipeCoordinates(startPoint, endPoint, coordinates);
};



const HorticultureDrawingManager: React.FC<HorticultureDrawingManagerProps> = ({
    map,
    editMode,
    onCreated,
    fillColor,
    strokeColor,
    isEditModeEnabled = false,
    mainArea,
    pump = null,
    mainPipes = [],
    subMainPipes = [],
    onMainPipeClick,
    onLateralPipeClick,
    onLateralPipeMouseMove,
}) => {
    const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);

    useEffect(() => {
        if (!map || !window.google?.maps?.drawing || !window.google?.maps) {
            if (drawingManagerRef.current) {
                drawingManagerRef.current.setMap(null);
                drawingManagerRef.current = null;
            }
            return;
        }

        if (isEditModeEnabled && !editMode && editMode !== 'manualZone') {
            if (drawingManagerRef.current) {
                drawingManagerRef.current.setMap(null);
                drawingManagerRef.current = null;
            }
            return;
        }

        const drawingModes = getDrawingModes(editMode);
        const shapeOptions = getShapeOptions(editMode, fillColor, strokeColor);

        if (drawingManagerRef.current) {
            drawingManagerRef.current.setMap(null);
        }

        if (drawingModes.length === 0) {
            return;
        }

        try {
            const defaultDrawingMode = getDrawingMode(editMode);

            // Check if Google Maps is fully loaded
            if (!window.google?.maps?.drawing?.DrawingManager) {
                console.warn('Google Maps Drawing Manager not available');
                return;
            }

            const drawingManager = new google.maps.drawing.DrawingManager({
                drawingMode: defaultDrawingMode,
                drawingControl: true,
                drawingControlOptions: {
                    position: google.maps.ControlPosition.BOTTOM_CENTER,
                    drawingModes: drawingModes,
                },
                polygonOptions: {
                    ...shapeOptions.polygonOptions,
                    clickable: false,
                    editable: true,
                    draggable: true,
                },
                rectangleOptions: {
                    ...shapeOptions.rectangleOptions,
                    clickable: false,
                    editable: true,
                    draggable: true,
                },
                circleOptions: {
                    ...shapeOptions.circleOptions,
                    clickable: false,
                    editable: true,
                    draggable: true,
                },
            });

            drawingManager.setMap(map);
            drawingManagerRef.current = drawingManager;



            // Handle lateral pipe mouse movement separately
            if (editMode === 'lateralPipe' && onLateralPipeMouseMove) {
                drawingManager.addListener('mousemove', (event) => {
                    onLateralPipeMouseMove(event);
                });
            }


            const listeners: google.maps.MapsEventListener[] = [];


            listeners.push(
                drawingManager.addListener('polygoncomplete', (polygon: google.maps.Polygon) => {
                    let coordinates = extractCoordinatesFromShape(polygon);

                    if (editMode === 'zone' && mainArea && mainArea.length > 0) {
                        coordinates = advancedSnapToMainArea(coordinates, mainArea);
                    }

                    if (coordinates.length > 0) {
                        onCreated(coordinates, 'polygon');
                    }
                    polygon.setMap(null);
                })
            );

            listeners.push(
                drawingManager.addListener(
                    'rectanglecomplete',
                    (rectangle: google.maps.Rectangle) => {
                        let coordinates = extractCoordinatesFromShape(rectangle);

                        if (editMode === 'zone' && mainArea && mainArea.length > 0) {
                            coordinates = advancedSnapToMainArea(coordinates, mainArea);
                        }

                        if (coordinates.length > 0) {
                            onCreated(coordinates, 'rectangle');
                        }
                        rectangle.setMap(null);
                        
                    }
                )
            );

            listeners.push(
                drawingManager.addListener('circlecomplete', (circle: google.maps.Circle) => {
                    let coordinates = extractCoordinatesFromShape(circle);

                    if (editMode === 'zone' && mainArea && mainArea.length > 0) {
                        coordinates = advancedSnapToMainArea(coordinates, mainArea);
                    }

                    if (coordinates.length > 0) {
                        onCreated(coordinates, 'circle');
                    }
                    circle.setMap(null);
                    
                })
            );

            listeners.push(
                drawingManager.addListener('polylinecomplete', (polyline: google.maps.Polyline) => {
                    let coordinates = extractCoordinatesFromShape(polyline);

                    if (editMode === 'mainPipe') {
                        coordinates = snapMainPipeCoordinates(
                            coordinates,
                            pump
                        );
                    } else if (editMode === 'subMainPipe') {
                        coordinates = snapSubMainPipeCoordinates(coordinates);
                    } else if (editMode === 'lateralPipe') {
                        coordinates = enhanceLateralPipeDrawing(coordinates, editMode);
                    }

                    if (coordinates.length > 0) {
                        onCreated(coordinates, 'polyline');
                    }
                    polyline.setMap(null);
                    
                })
            );

            if (editMode === 'subMainPipe' && onMainPipeClick) {
                mainPipes.forEach((mainPipe) => {
                    if (mainPipe.coordinates && mainPipe.coordinates.length >= 2) {
                        const mainPipePolyline = new google.maps.Polyline({
                            path: mainPipe.coordinates.map((coord) => ({
                                lat: coord.lat,
                                lng: coord.lng,
                            })),
                            geodesic: true,
                            strokeColor: '#FF0000',
                            strokeOpacity: 0.9,
                            strokeWeight: 2,
                            map: map,
                            clickable: true,
                            zIndex: 998,
                        });

                        mainPipePolyline.addListener('mouseover', () => {
                            mainPipePolyline.setOptions({
                                strokeColor: '#FF6B6B',
                                strokeWeight: 10,
                            });
                        });

                        mainPipePolyline.addListener('mouseout', () => {
                            mainPipePolyline.setOptions({
                                strokeColor: '#FF0000',
                                strokeWeight: 2,
                            });
                        });

                        mainPipePolyline.addListener(
                            'click',
                            (event: google.maps.MapMouseEvent) => {
                                if (event.latLng) {
                                    onMainPipeClick(mainPipe.id, {
                                        lat: event.latLng.lat(),
                                        lng: event.latLng.lng(),
                                    });

                                    mainPipePolyline.setOptions({
                                        strokeColor: '#00FF00',
                                        strokeWeight: 12,
                                    });

                                    setTimeout(() => {
                                        mainPipePolyline.setOptions({
                                            strokeColor: '#FF0000',
                                            strokeWeight: 3,
                                        });
                                    }, 500);
                                }
                            }
                        );

                        setTimeout(() => {
                            mainPipePolyline.setMap(null);
                        }, 1000);
                    }
                });
            }

            if (editMode === 'lateralPipe' && onLateralPipeClick) {
                subMainPipes.forEach((subMainPipe) => {
                    if (subMainPipe.coordinates && subMainPipe.coordinates.length >= 2) {
                        const subMainPipePolyline = new google.maps.Polyline({
                            path: subMainPipe.coordinates.map((coord) => ({
                                lat: coord.lat,
                                lng: coord.lng,
                            })),
                            geodesic: true,
                            strokeColor: '#8B5CF6',
                            strokeOpacity: 0.9,
                            strokeWeight: 5,
                            map: map,
                            clickable: true,
                            zIndex: 998,
                        });

                        subMainPipePolyline.addListener('mouseover', () => {
                            subMainPipePolyline.setOptions({
                                strokeColor: '#A78BFA',
                                strokeWeight: 5,
                            });
                        });

                        subMainPipePolyline.addListener('mouseout', () => {
                            subMainPipePolyline.setOptions({
                                strokeColor: '#8B5CF6',
                                strokeWeight: 5,
                            });
                        });

                        subMainPipePolyline.addListener(
                            'click',
                            (event: google.maps.MapMouseEvent) => {
                                if (event.latLng) {
                                    onLateralPipeClick(event);

                                    subMainPipePolyline.setOptions({
                                        strokeColor: '#00FF00',
                                        strokeWeight: 10,
                                    });

                                    setTimeout(() => {
                                        subMainPipePolyline.setOptions({
                                            strokeColor: '#8B5CF6',
                                            strokeWeight: 5,
                                        });
                                    }, 500);
                                }
                            }
                        );

                        setTimeout(() => {
                            subMainPipePolyline.setMap(null);
                        }, 1000);
                    }
                });
            }

            return () => {
                listeners.forEach((listener) => {
                    if (listener) {
                        google.maps.event.removeListener(listener);
                    }
                });

                if (drawingManagerRef.current) {
                    drawingManagerRef.current.setMap(null);
                    drawingManagerRef.current = null;
                }
            };
        } catch (error) {
            console.error('Error creating DrawingManager:', error);
            // Reset drawing manager on error
            if (drawingManagerRef.current) {
                drawingManagerRef.current.setMap(null);
                drawingManagerRef.current = null;
            }
        }
    }, [
        map,
        editMode,
        onCreated,
        fillColor,
        strokeColor,
        isEditModeEnabled,
        mainArea,
        pump,
        mainPipes,
        subMainPipes,
        onMainPipeClick,
        onLateralPipeClick,
        onLateralPipeMouseMove,
    ]);





    useEffect(() => {
        return () => {
            if (drawingManagerRef.current) {
                try {
                    // Check if Google Maps is still available before cleanup
                    if (window.google?.maps?.drawing) {
                        drawingManagerRef.current.setDrawingMode(null);
                        drawingManagerRef.current.setOptions({ drawingControl: false });
                        drawingManagerRef.current.setMap(null);
                    }
                } catch (e) {
                    console.error('Error cleaning up DrawingManager:', e);
                }
                drawingManagerRef.current = null;
            }
        };
    }, []);

    return (
        <>
        </>
    );
};

export default HorticultureDrawingManager;
