import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import { useLanguage } from '../../contexts/LanguageContext';
import Navbar from '../../components/Navbar';
import HorticultureMapComponent from '../../components/horticulture/HorticultureMapComponent';
import HorticultureDrawingManager from '../../components/horticulture/HorticultureDrawingManager';
import EnhancedHorticultureSearchControl from '../../components/horticulture/HorticultureSearchControl';
import DistanceMeasurementOverlay from '../../components/horticulture/DistanceMeasurementOverlay';
import { getCropByValue, getTranslatedCropByValue } from './choose-crop';
import { parseCompletedSteps, toCompletedStepsCsv } from '../../utils/stepUtils';
import { 
    FieldCropPageProps, 
    Coordinate, 
    PlantPoint, 
    Obstacle, 
    FIELD_STYLING 
} from '../../types/fieldCropTypes';
import { useFieldData } from '../../hooks/useFieldData';

// Yield back to the browser between heavy batches without blocking UI
const yieldToFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// Helper function to safely save data to localStorage with size optimization
const safeSetItem = (key: string, data: unknown, maxSizeKB: number = 5000) => {
    try {
        const dataString = JSON.stringify(data);
        const dataSizeKB = new Blob([dataString]).size / 1024;

        if (dataSizeKB > maxSizeKB) {
            // Data size exceeds limit, optimizing...

            // Optimize by reducing precision
            const dataObj = data as Record<string, unknown>;
            const optimizedData = {
                ...dataObj,
                mainArea: Array.isArray(dataObj.mainArea)
                    ? dataObj.mainArea.map((coord: unknown) => {
                          const c = coord as { lat: number; lng: number };
                          return {
                              lat: Math.round(c.lat * 1000000) / 1000000,
                              lng: Math.round(c.lng * 1000000) / 1000000,
                          };
                      })
                    : [],
                obstacles: Array.isArray(dataObj.obstacles)
                    ? dataObj.obstacles.map((obs: unknown) => {
                          const o = obs as { coordinates: unknown[]; [key: string]: unknown };
                          return {
                              ...o,
                              coordinates: Array.isArray(o.coordinates)
                                  ? o.coordinates.map((coord: unknown) => {
                                        const c = coord as { lat: number; lng: number };
                                        return {
                                            lat: Math.round(c.lat * 1000000) / 1000000,
                                            lng: Math.round(c.lng * 1000000) / 1000000,
                                        };
                                    })
                                  : [],
                          };
                      })
                    : [],
                plantPoints: Array.isArray(dataObj.plantPoints)
                    ? dataObj.plantPoints.map((point: unknown) => {
                          const p = point as {
                              lat: number;
                              lng: number;
                              cropType: string;
                              isValid: boolean;
                          };
                          return {
                              lat: Math.round(p.lat * 1000000) / 1000000,
                              lng: Math.round(p.lng * 1000000) / 1000000,
                              cropType: p.cropType,
                              isValid: p.isValid,
                          };
                      })
                    : [],
            };

            const optimizedString = JSON.stringify(optimizedData);
            const optimizedSizeKB = new Blob([optimizedString]).size / 1024;

            if (optimizedSizeKB > maxSizeKB) {
                // Data still too large after optimization, further reducing plant points...
                // Further reduce plant points precision
                const dataObj = optimizedData as Record<string, unknown>;
                const furtherOptimizedData = {
                    ...dataObj,
                    plantPoints: Array.isArray(dataObj.plantPoints)
                        ? dataObj.plantPoints.map((point: unknown) => {
                              const p = point as {
                                  lat: number;
                                  lng: number;
                                  cropType: string;
                                  isValid: boolean;
                              };
                              return {
                                  lat: Math.round(p.lat * 100000) / 100000, // 5 decimal places
                                  lng: Math.round(p.lng * 100000) / 100000,
                                  cropType: p.cropType,
                                  isValid: p.isValid,
                              };
                          })
                        : [],
                };

                const furtherOptimizedString = JSON.stringify(furtherOptimizedData);
                const furtherOptimizedSizeKB = new Blob([furtherOptimizedString]).size / 1024;

                if (furtherOptimizedSizeKB > maxSizeKB) {
                    // Data still too large, sampling plant points...
                    // Sample plant points (keep every 2nd point)
                    const sampledPlantPoints = Array.isArray(furtherOptimizedData.plantPoints)
                        ? furtherOptimizedData.plantPoints.filter((_, index) => index % 2 === 0)
                        : [];
                    const finalData = {
                        ...furtherOptimizedData,
                        plantPoints: sampledPlantPoints,
                    };
                    localStorage.setItem(key, JSON.stringify(finalData));
                } else {
                    localStorage.setItem(key, furtherOptimizedString);
                }
            } else {
                localStorage.setItem(key, optimizedString);
            }
        } else {
            localStorage.setItem(key, dataString);
        }
        return true;
    } catch {
        // Error saving to localStorage
        return false;
    }
};

// Type guard and helper to safely detach Google Maps overlays without TS errors
const hasSetMap = (obj: unknown): obj is { setMap: (map: google.maps.Map | null) => void } => {
    return typeof obj === 'object' && obj !== null && 'setMap' in (obj as Record<string, unknown>);
};
const detachOverlay = (overlay: unknown) => {
    if (hasSetMap(overlay)) overlay.setMap(null);
};

// Using standardized types from fieldCropTypes.ts

interface StepData {
    id: number;
    key: string;
    title: string;
    description: string;
    route: string;
}

// Type for plant point arrays that can carry real count and real points information
type PlantPointArrayWithRealCount = PlantPoint[] & {
    __realCount?: number;
    __realPoints?: PlantPoint[];
};

// Helper function to safely extract real count
const extractRealCount = (plantPoints: PlantPoint[]): number => {
    const pointsWithRealCount = plantPoints as PlantPointArrayWithRealCount;
    return pointsWithRealCount.__realCount || plantPoints.length;
};

// Helper function to safely extract real points
const extractRealPoints = (plantPoints: PlantPoint[]): PlantPoint[] => {
    const pointsWithRealCount = plantPoints as PlantPointArrayWithRealCount;
    return pointsWithRealCount.__realPoints || plantPoints;
};

// Using standardized Obstacle interface from fieldCropTypes.ts

export default function InitialArea(props: FieldCropPageProps) {
    const {
        crops,
        currentStep = 1,
        completedSteps = '',
        mainArea: mainAreaData,
        obstacles: obstaclesData,
        plantPoints: plantPointsData,
        areaRai: areaRaiData,
        perimeterMeters: perimeterMetersData,
        rowSpacing: rowSpacingData,
        plantSpacing: plantSpacingData,
    } = props;
    const { t, language } = useLanguage();
    
    // Use standardized field data management
    const { fieldData, updateFieldData } = useFieldData(props);
    
    const [selectedCrops, setSelectedCrops] = useState<string[]>(fieldData.selectedCrops);
    const [completed, setCompleted] = useState<number[]>([]);
    const activeStep = currentStep;

    // Map and Area States
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([fieldData.mapCenter.lat, fieldData.mapCenter.lng]);
    const [mapZoom, setMapZoom] = useState<number>(fieldData.mapZoom);
    const [mainArea, setMainArea] = useState<Coordinate[]>(fieldData.mainArea);
    const [areaRai, setAreaRai] = useState<number | null>(fieldData.areaRai);
    const [perimeterMeters, setPerimeterMeters] = useState<number | null>(fieldData.perimeterMeters);
    const [isMainAreaSet, setIsMainAreaSet] = useState<boolean>(fieldData.mainArea.length >= 3);
    const [isEditingMainArea, setIsEditingMainArea] = useState<boolean>(false);

    // Drawing States
    const [isDrawing, setIsDrawing] = useState<boolean>(false);
    const [drawingManagerRef, setDrawingManagerRef] =
        useState<google.maps.drawing.DrawingManager | null>(null);
    const [selectedShape, setSelectedShape] = useState<string>('polygon');
    const [drawnPolygon, setDrawnPolygon] = useState<google.maps.Polygon | null>(null);

    // Plant and Obstacle States
    const [plantPoints, setPlantPoints] = useState<PlantPoint[]>(fieldData.plantPoints); // Display points (limited to 500)
    const [realPlantPoints, setRealPlantPoints] = useState<PlantPoint[]>(fieldData.plantPoints); // All real plant points
    const [realPlantCount, setRealPlantCount] = useState<number>(fieldData.realPlantCount || 0); // Track real point count for calculations
    const [isGeneratingPlants, setIsGeneratingPlants] = useState<boolean>(false);
    const [obstacles, setObstacles] = useState<Obstacle[]>(fieldData.obstacles);
    const [isDrawingObstacle, setIsDrawingObstacle] = useState<boolean>(false);
    const [selectedObstacleType, setSelectedObstacleType] = useState<'water_source' | 'building' | 'rock' | 'other'>(
        'water_source'
    );
    const [selectedObstacleShape, setSelectedObstacleShape] = useState<string>('polygon');
    const [obstacleOverlays, setObstacleOverlays] = useState<google.maps.Polygon[]>([]);
    const [distanceOverlaysByObstacle, setDistanceOverlaysByObstacle] = useState<
        Record<string, { lines: google.maps.Polyline[]; labels: google.maps.Marker[] }>
    >({});

    // Plant calculation state
    const [calculatedRows, setCalculatedRows] = useState<number>(0);
    const [calculatedColumns, setCalculatedColumns] = useState<number>(0);

    // Spacing States
    const [rowSpacing, setRowSpacing] = useState<Record<string, number>>(fieldData.rowSpacing);
    const [plantSpacing, setPlantSpacing] = useState<Record<string, number>>(fieldData.plantSpacing);
    const [tempRowSpacing, setTempRowSpacing] = useState<Record<string, string>>({});
    const [tempPlantSpacing, setTempPlantSpacing] = useState<Record<string, string>>({});
    const [editingRowSpacingForCrop, setEditingRowSpacingForCrop] = useState<string | null>(null);
    const [editingPlantSpacingForCrop, setEditingPlantSpacingForCrop] = useState<string | null>(
        null
    );

    // Plant points state

    // Refs for state synchronization
    const mainAreaRef = useRef<Coordinate[]>(mainArea);
    const obstaclesRef = useRef<Obstacle[]>(obstacles);
    const drawnPolygonRef = useRef<google.maps.Polygon | null>(drawnPolygon);
    const selectedObstacleTypeRef = useRef<'water_source' | 'building' | 'rock' | 'other'>(selectedObstacleType);
    const isDrawingObstacleRef = useRef<boolean>(false);
    const obstacleOverlaysRef = useRef<google.maps.Polygon[]>([]);
    const distanceOverlaysByObstacleRef = useRef<
        Record<string, { lines: google.maps.Polyline[]; labels: google.maps.Marker[] }>
    >({});
    const drawingManagerObjRef = useRef<google.maps.drawing.DrawingManager | null>(null);

    // Refs for race condition prevention and cleanup
    const currentGenerationIdRef = useRef<number>(0);
    const plantPointMarkersRef = useRef<google.maps.Marker[]>([]);
    const listenersRef = useRef<google.maps.MapsEventListener[]>([]);

    // State synchronization effects
    useEffect(() => {
        mainAreaRef.current = mainArea;
    }, [mainArea]);
    useEffect(() => {
        obstaclesRef.current = obstacles;
    }, [obstacles]);
    useEffect(() => {
        drawnPolygonRef.current = drawnPolygon;
    }, [drawnPolygon]);
    useEffect(() => {
        selectedObstacleTypeRef.current = selectedObstacleType;
    }, [selectedObstacleType]);
    useEffect(() => {
        isDrawingObstacleRef.current = isDrawingObstacle;
    }, [isDrawingObstacle]);
    useEffect(() => {
        obstacleOverlaysRef.current = obstacleOverlays;
    }, [obstacleOverlays]);
    useEffect(() => {
        distanceOverlaysByObstacleRef.current = distanceOverlaysByObstacle;
    }, [distanceOverlaysByObstacle]);
    useEffect(() => {
        drawingManagerObjRef.current = drawingManagerRef;
    }, [drawingManagerRef]);

    // Component cleanup effect
    useEffect(() => {
        const startingGenerationId = currentGenerationIdRef.current;
        return () => {
            // Increment generation ID to cancel any ongoing operations using captured value
            currentGenerationIdRef.current = startingGenerationId + 1;

            // Remove all stored event listeners to prevent memory leaks
            listenersRef.current.forEach((listener) => google.maps.event.removeListener(listener));
            listenersRef.current = [];

            // Remove all overlays from the map
            drawnPolygonRef.current?.setMap(null);
            obstacleOverlaysRef.current.forEach((overlay) => overlay.setMap(null));

            // Clear all plant point markers
            plantPointMarkersRef.current.forEach((marker) => {
                if (marker && marker.setMap) {
                    marker.setMap(null);
                }
            });
            plantPointMarkersRef.current = [];

            Object.values(distanceOverlaysByObstacleRef.current).forEach(({ lines, labels }) => {
                lines.forEach((l) => l.setMap(null));
                labels.forEach((lb) => lb.setMap(null));
            });
            drawingManagerObjRef.current?.setMap(null);
        };
    }, []);

    // ===== UTILITY FUNCTIONS =====

    // Compute area and perimeter for a set of coordinates with optional holes
    const computeAreaAndPerimeter = useCallback(
        (coordinates: Coordinate[], holes: Coordinate[][] = []) => {
            try {
                if (!window.google?.maps?.geometry?.spherical || coordinates.length < 3) {
                    setAreaRai(null);
                    setPerimeterMeters(null);
                    return;
                }
                const latLngs = coordinates.map((c) => new google.maps.LatLng(c.lat, c.lng));
                let areaSqm = google.maps.geometry.spherical.computeArea(latLngs);
                // subtract holes
                if (holes && holes.length > 0) {
                    for (const hole of holes) {
                        if (hole.length >= 3) {
                            const holeLatLngs = hole.map(
                                (c) => new google.maps.LatLng(c.lat, c.lng)
                            );
                            areaSqm -= google.maps.geometry.spherical.computeArea(holeLatLngs);
                        }
                    }
                }
                const pathForPerimeter = [...latLngs, latLngs[0]];
                const perimeter = google.maps.geometry.spherical.computeLength(pathForPerimeter);
                setAreaRai(areaSqm > 0 ? areaSqm / 1600 : 0);
                setPerimeterMeters(perimeter);
            } catch {
                setAreaRai(null);
                setPerimeterMeters(null);
            }
        },
        []
    );

    // Coordinate extraction functions
    const extractCoordinatesFromPolygon = useCallback(
        (polygon: google.maps.Polygon): Coordinate[] => {
            const coordinates: Coordinate[] = [];
            const path = polygon.getPath();
            for (let i = 0; i < path.getLength(); i++) {
                const latLng = path.getAt(i);
                coordinates.push({ lat: latLng.lat(), lng: latLng.lng() });
            }
            return coordinates;
        },
        []
    );

    const extractCoordinatesFromRectangle = useCallback(
        (rectangle: google.maps.Rectangle): Coordinate[] => {
            const bounds = rectangle.getBounds();
            if (!bounds) return [];
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            return [
                { lat: ne.lat(), lng: ne.lng() },
                { lat: ne.lat(), lng: sw.lng() },
                { lat: sw.lat(), lng: sw.lng() },
                { lat: sw.lat(), lng: ne.lng() },
            ];
        },
        []
    );

    const extractCoordinatesFromCircle = useCallback((circle: google.maps.Circle): Coordinate[] => {
        const center = circle.getCenter();
        const radius = circle.getRadius();
        const coordinates: Coordinate[] = [];
        if (!center) return [];
        const points = 32;
        for (let i = 0; i < points; i++) {
            const angle = (i * 2 * Math.PI) / points;
            const lat = center.lat() + (radius / 111000) * Math.cos(angle);
            const lng =
                center.lng() +
                (radius / (111000 * Math.cos((center.lat() * Math.PI) / 180))) * Math.sin(angle);
            coordinates.push({ lat, lng });
        }
        return coordinates;
    }, []);

    // Generic helpers to unify polygon operations across coordinate systems
    const pointInPolygonGeneric = useCallback(
        <T,>(point: T, polygon: T[], getX: (p: T) => number, getY: (p: T) => number): boolean => {
            let inside = false;
            const x = getX(point);
            const y = getY(point);
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = getX(polygon[i]);
                const yi = getY(polygon[i]);
                const xj = getX(polygon[j]);
                const yj = getY(polygon[j]);
                if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
                    inside = !inside;
            }
            return inside;
        },
        []
    );

    const distanceToPolygonEdgeGeneric = useCallback(
        <T,>(point: T, polygon: T[], getX: (p: T) => number, getY: (p: T) => number): number => {
            let minDistance = Infinity;
            const px = getX(point);
            const py = getY(point);
            for (let i = 0; i < polygon.length; i++) {
                const j = (i + 1) % polygon.length;
                const x1 = getX(polygon[i]);
                const y1 = getY(polygon[i]);
                const x2 = getX(polygon[j]);
                const y2 = getY(polygon[j]);
                const A = px - x1;
                const B = py - y1;
                const C = x2 - x1;
                const D = y2 - y1;
                const dot = A * C + B * D;
                const lenSq = C * C + D * D;
                const param = lenSq !== 0 ? dot / lenSq : -1;
                let xx: number, yy: number;
                if (param < 0) {
                    xx = x1;
                    yy = y1;
                } else if (param > 1) {
                    xx = x2;
                    yy = y2;
                } else {
                    xx = x1 + param * C;
                    yy = y1 + param * D;
                }
                const dx = px - xx;
                const dy = py - yy;
                const distance = Math.sqrt(dx * dx + dy * dy);
                minDistance = Math.min(minDistance, distance);
            }
            return minDistance;
        },
        []
    );

    // Utility function to check if point is inside polygon (lat/lng)
    const isPointInPolygon = useCallback(
        (point: Coordinate, polygon: Coordinate[]): boolean => {
            return pointInPolygonGeneric(
                point,
                polygon,
                (p) => p.lat,
                (p) => p.lng
            );
        },
        [pointInPolygonGeneric]
    );

    // Calculate distance from point to polygon edge (CPU-based)
    const distanceToPolygonEdge = useCallback(
        (point: Coordinate, polygon: Coordinate[]): number => {
            // convert degrees to meters approximation applied after
            const d = distanceToPolygonEdgeGeneric(
                point,
                polygon,
                (p) => p.lat,
                (p) => p.lng
            );
            return d * 111000; // rough conversion to meters
        },
        [distanceToPolygonEdgeGeneric]
    );

    // ===== CROP AND SPACING FUNCTIONS =====

    const getCropSpacingInfo = useCallback(
        (cropValue: string) => {
            const crop = getCropByValue(cropValue);
            const defaultRowSpacing = crop?.rowSpacing ?? 50;
            const defaultPlantSpacing = crop?.plantSpacing ?? 20;
            const currentRowSpacing = rowSpacing[cropValue] ?? defaultRowSpacing;
            const currentPlantSpacing = plantSpacing[cropValue] ?? defaultPlantSpacing;

            return {
                rowSpacing: currentRowSpacing,
                plantSpacing: currentPlantSpacing,
                plantsPerSqm: (10000 / (currentRowSpacing * currentPlantSpacing)).toFixed(1),
                isRowModified: currentRowSpacing !== defaultRowSpacing,
                isPlantModified: currentPlantSpacing !== defaultPlantSpacing,
                cropName:
                    getTranslatedCropByValue(cropValue, language as 'en' | 'th')?.name || cropValue,
            };
        },
        [rowSpacing, plantSpacing, language]
    );

    // ===== LOD (LEVEL OF DETAIL) FUNCTIONS =====
    // Using utility functions from lodClusteringUtils.ts

    // Effect to track map zoom changes
    useEffect(() => {
        if (!map) return;

        const handleZoomChanged = () => {
            const currentZoom = map.getZoom();
            if (currentZoom !== undefined) {
                setMapZoom(currentZoom);
            }
        };

        // Listen for zoom changes
        const zoomListener = map.addListener('zoom_changed', handleZoomChanged);

        // Set initial zoom
        handleZoomChanged();

        return () => {
            google.maps.event.removeListener(zoomListener);
        };
    }, [map]);

    // ===== PLANT POINT FUNCTIONS =====

    // Helper function to calculate point size based on point count
    const calculatePointSize = useCallback((pointCount: number): number => {
        if (pointCount >= 5000) {
            return 8 * 0.4; // 60% reduction (40% of original size)
        } else if (pointCount >= 2000) {
            return 8 * 0.6; // 40% reduction (60% of original size)
        } else if (pointCount >= 800) {
            return 8 * 0.8; // 20% reduction (80% of original size)
        } else {
            return 8; // Original size
        }
    }, []);


    // Enhanced function to clear all existing plant markers immediately
    const clearAllPlantMarkers = useCallback(() => {
        plantPointMarkersRef.current.forEach((marker) => marker.setMap(null));
    }, []);

    // Geometry helpers
    const computeCentroid = useCallback((points: Coordinate[]): Coordinate => {
        if (points.length === 0) return { lat: 0, lng: 0 };
        let sumLat = 0;
        let sumLng = 0;
        for (const p of points) {
            sumLat += p.lat;
            sumLng += p.lng;
        }
        return { lat: sumLat / points.length, lng: sumLng / points.length };
    }, []);

    const toLocalXY = useCallback((p: Coordinate, origin: Coordinate) => {
        const latFactor = 111000;
        const lngFactor = 111000 * Math.cos((origin.lat * Math.PI) / 180);
        return {
            x: (p.lng - origin.lng) * lngFactor,
            y: (p.lat - origin.lat) * latFactor,
        };
    }, []);

    const toLatLngFromXY = useCallback((xy: { x: number; y: number }, origin: Coordinate) => {
        const latFactor = 111000;
        const lngFactor = 111000 * Math.cos((origin.lat * Math.PI) / 180);
        return {
            lat: xy.y / latFactor + origin.lat,
            lng: xy.x / lngFactor + origin.lng,
        };
    }, []);

    const isPointInPolygonXY = useCallback(
        (point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean => {
            return pointInPolygonGeneric(
                point,
                polygon,
                (p) => p.x,
                (p) => p.y
            );
        },
        [pointInPolygonGeneric]
    );

    const distanceToPolygonEdgeXY = useCallback(
        (point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): number => {
            return distanceToPolygonEdgeGeneric(
                point,
                polygon,
                (p) => p.x,
                (p) => p.y
            );
        },
        [distanceToPolygonEdgeGeneric]
    );

    // Create distance overlays (lines + labels) for a water obstacle
    const createDistanceOverlaysForWaterObstacle = useCallback(
        (obstacle: Obstacle) => {
            if (!map || mainArea.length < 3) return;

            const origin = computeCentroid(mainArea);
            const mainXY = mainArea.map((p) => toLocalXY(p, origin));
            const obsXY = obstacle.coordinates.map((p) => toLocalXY(p, origin));

            const centroidObs = computeCentroid(obstacle.coordinates);
            const cxy = toLocalXY(centroidObs, origin);

            // helpers to compute line-polygon intersections
            const intersectHorizontal = (
                y: number,
                poly: Array<{ x: number; y: number }>
            ): number[] => {
                const xs: number[] = [];
                for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                    const a = poly[i];
                    const b = poly[j];
                    if (a.y > y !== b.y > y) {
                        const x = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
                        xs.push(x);
                    }
                }
                return xs.sort((a, b) => a - b);
            };
            const intersectVertical = (
                x: number,
                poly: Array<{ x: number; y: number }>
            ): number[] => {
                const ys: number[] = [];
                for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                    const a = poly[i];
                    const b = poly[j];
                    if (a.x > x !== b.x > x) {
                        const y = a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x);
                        ys.push(y);
                    }
                }
                return ys.sort((a, b) => a - b);
            };

            const xsObs = intersectHorizontal(cxy.y, obsXY);
            const xsMain = intersectHorizontal(cxy.y, mainXY);
            const ysObs = intersectVertical(cxy.x, obsXY);
            const ysMain = intersectVertical(cxy.x, mainXY);

            let xLeftObs = Math.max(...xsObs.filter((x) => x < cxy.x));
            let xRightObs = Math.min(...xsObs.filter((x) => x > cxy.x));
            let xLeftMain = Math.max(...xsMain.filter((x) => x < cxy.x));
            let xRightMain = Math.min(...xsMain.filter((x) => x > cxy.x));

            let yBottomObs = Math.max(...ysObs.filter((y) => y < cxy.y));
            let yTopObs = Math.min(...ysObs.filter((y) => y > cxy.y));
            let yBottomMain = Math.max(...ysMain.filter((y) => y < cxy.y));
            let yTopMain = Math.min(...ysMain.filter((y) => y > cxy.y));

            // Fallback to bounding boxes if intersections are not finite
            const obsXs = obsXY.map((p) => p.x);
            const obsYs = obsXY.map((p) => p.y);
            const mainXs = mainXY.map((p) => p.x);
            const mainYs = mainXY.map((p) => p.y);
            const obsBBox = {
                minX: Math.min(...obsXs),
                maxX: Math.max(...obsXs),
                minY: Math.min(...obsYs),
                maxY: Math.max(...obsYs),
            };
            const mainBBox = {
                minX: Math.min(...mainXs),
                maxX: Math.max(...mainXs),
                minY: Math.min(...mainYs),
                maxY: Math.max(...mainYs),
            };
            if (!isFinite(xLeftObs)) xLeftObs = obsBBox.minX;
            if (!isFinite(xRightObs)) xRightObs = obsBBox.maxX;
            if (!isFinite(xLeftMain)) xLeftMain = mainBBox.minX;
            if (!isFinite(xRightMain)) xRightMain = mainBBox.maxX;
            if (!isFinite(yBottomObs)) yBottomObs = obsBBox.minY;
            if (!isFinite(yTopObs)) yTopObs = obsBBox.maxY;
            if (!isFinite(yBottomMain)) yBottomMain = mainBBox.minY;
            if (!isFinite(yTopMain)) yTopMain = mainBBox.maxY;

            const overlays: { lines: google.maps.Polyline[]; labels: google.maps.Marker[] } = {
                lines: [],
                labels: [],
            };

            const makeLabelMarker = (pos: google.maps.LatLngLiteral, text: string) => {
                const svg = `<?xml version="1.0"?><svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'></svg>`; // placeholder, use label instead
                return new google.maps.Marker({
                    position: pos,
                    map: map,
                    label: { text, color: '#22c55e', fontSize: '12px', fontWeight: 'bold' },
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
                        anchor: new google.maps.Point(0, 0),
                        scaledSize: new google.maps.Size(0, 0),
                    },
                    clickable: false,
                    optimized: true,
                });
            };

            const addLine = (aXY: { x: number; y: number }, bXY: { x: number; y: number }) => {
                const a = toLatLngFromXY(aXY, origin);
                const b = toLatLngFromXY(bXY, origin);
                const line = new google.maps.Polyline({
                    path: [a, b],
                    strokeColor: '#ffffff',
                    strokeOpacity: 1,
                    strokeWeight: 2,
                    map: map,
                    clickable: false,
                    zIndex: 999,
                });
                overlays.lines.push(line);
                const meters = Math.hypot(bXY.x - aXY.x, bXY.y - aXY.y);
                // Place label outside the main area: from main-boundary point (aXY), step outward (away from obstacle)
                // using only the outward direction to keep labels aligned horizontally/vertically
                const vx = aXY.x - bXY.x; // outward direction from boundary toward outside (opposite to interior)
                const vy = aXY.y - bXY.y;
                const vlen = Math.hypot(vx, vy) || 1;
                const ux = vx / vlen;
                const uy = vy / vlen;
                // Increase outward distance a bit more for left-right (horizontal) labels
                const isHorizontal = Math.abs(vx) > Math.abs(vy);
                const outward = isHorizontal ? 5 : 3; // meters outside the main area
                const labelXY = { x: aXY.x + ux * outward, y: aXY.y + uy * outward };
                const label = makeLabelMarker(
                    toLatLngFromXY(labelXY, origin),
                    `📏 ${meters.toFixed(1)} m`
                );
                overlays.labels.push(label);
            };

            if (isFinite(xLeftObs) && isFinite(xLeftMain) && xLeftMain < xLeftObs) {
                // main-boundary -> obstacle
                addLine({ x: xLeftMain, y: cxy.y }, { x: xLeftObs, y: cxy.y });
            }
            if (isFinite(xRightObs) && isFinite(xRightMain) && xRightMain > xRightObs) {
                // main-boundary -> obstacle (swap order to keep bXY = obstacle)
                addLine({ x: xRightMain, y: cxy.y }, { x: xRightObs, y: cxy.y });
            }
            if (isFinite(yBottomObs) && isFinite(yBottomMain) && yBottomMain < yBottomObs) {
                // main-boundary -> obstacle
                addLine({ x: cxy.x, y: yBottomMain }, { x: cxy.x, y: yBottomObs });
            }
            if (isFinite(yTopObs) && isFinite(yTopMain) && yTopMain > yTopObs) {
                // main-boundary -> obstacle (swap order to keep bXY = obstacle)
                addLine({ x: cxy.x, y: yTopMain }, { x: cxy.x, y: yTopObs });
            }

            setDistanceOverlaysByObstacle((prev) => ({ ...prev, [obstacle.id]: overlays }));
        },
        [map, mainArea, computeCentroid, toLocalXY, toLatLngFromXY]
    );

    // Main area polygon rendering effect
    useEffect(() => {
        if (!map || !isMainAreaSet || mainArea.length < 3 || isEditingMainArea) return;

        // Recreate main area polygon
        if (drawnPolygonRef.current) {
            detachOverlay(drawnPolygonRef.current);
        }

        const createEditablePolygon = (coordinates: Coordinate[], holes: Coordinate[][] = []) => {
            const styledPolygon = new google.maps.Polygon({
                paths: [coordinates, ...holes],
                fillColor: FIELD_STYLING.MAIN_AREA.fillColor,
                fillOpacity: FIELD_STYLING.MAIN_AREA.fillOpacity,
                strokeColor: FIELD_STYLING.MAIN_AREA.strokeColor,
                strokeWeight: FIELD_STYLING.MAIN_AREA.strokeWeight,
                strokeOpacity: FIELD_STYLING.MAIN_AREA.strokeOpacity,
                editable: false,
                draggable: false,
                clickable: true,
                zIndex: FIELD_STYLING.MAIN_AREA.zIndex,
            });

            styledPolygon.setMap(map);

            const paths = styledPolygon.getPaths();
            const outerPath = paths.getAt(0);
            const syncFromPolygonPath = () => {
                const updated: Coordinate[] = [];
                for (let i = 0; i < outerPath.getLength(); i++) {
                    const latLng = outerPath.getAt(i);
                    updated.push({ lat: latLng.lat(), lng: latLng.lng() });
                }
                setMainArea(updated);
                computeAreaAndPerimeter(updated, []);
            };

            listenersRef.current.push(outerPath.addListener('set_at', syncFromPolygonPath));
            listenersRef.current.push(outerPath.addListener('insert_at', syncFromPolygonPath));
            listenersRef.current.push(outerPath.addListener('remove_at', syncFromPolygonPath));
            listenersRef.current.push(
                styledPolygon.addListener('dragstart', () => {
                    map.setOptions({ draggable: false });
                })
            );
            listenersRef.current.push(
                styledPolygon.addListener('dragend', () => {
                    map.setOptions({ draggable: true });
                    syncFromPolygonPath();
                })
            );

            return styledPolygon;
        };

        const styledPolygon = createEditablePolygon(mainArea, []);
        setDrawnPolygon(styledPolygon);
        drawnPolygonRef.current = styledPolygon;
    }, [map, isMainAreaSet, mainArea, computeAreaAndPerimeter, isEditingMainArea]);

    // Obstacle overlays rendering effect
    useEffect(() => {
        if (!map || obstacles.length === 0) return;

        obstacleOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
        setObstacleOverlays([]);

        Object.values(distanceOverlaysByObstacleRef.current).forEach(({ lines, labels }) => {
            lines.forEach((l) => l.setMap(null));
            labels.forEach((lb) => lb.setMap(null));
        });
        setDistanceOverlaysByObstacle({});

        const newObstacleOverlays: google.maps.Polygon[] = [];
        obstacles.forEach((obstacle) => {
            const obstacleColors = FIELD_STYLING.OBSTACLES[obstacle.type] || FIELD_STYLING.OBSTACLES.default;

            const polygon = new google.maps.Polygon({
                paths: [obstacle.coordinates],
                fillColor: obstacleColors.fill,
                strokeColor: obstacleColors.stroke,
                fillOpacity: FIELD_STYLING.OBSTACLES.fillOpacity,
                strokeWeight: FIELD_STYLING.OBSTACLES.strokeWeight,
                strokeOpacity: FIELD_STYLING.OBSTACLES.strokeOpacity,
                editable: false,
                draggable: false,
                clickable: true,
                map: map,
                zIndex: FIELD_STYLING.OBSTACLES.zIndex,
            });

            newObstacleOverlays.push(polygon);

            if (obstacle.type === 'water_source') {
                createDistanceOverlaysForWaterObstacle(obstacle);
            }
        });

        setObstacleOverlays(newObstacleOverlays);
    }, [map, obstacles, createDistanceOverlaysForWaterObstacle]);

    // Effect: Update displayed points when density changes

    // Plant points markers rendering effect
    useEffect(() => {
        if (!map) return;

        // Always clear existing markers first
        clearAllPlantMarkers();

        // Increment generation ID for this recreation
        const generationId = ++currentGenerationIdRef.current;

        // Use all plant points directly
        const filteredPoints = plantPoints;

        // Calculate dynamic point size based on total point count (not filtered count)
        const pointSize = calculatePointSize(plantPoints.length);
        const anchorPoint = pointSize / 2;

        const plantIcon = {
            url:
                'data:image/svg+xml;charset=UTF-8,' +
                encodeURIComponent(`
                <svg width="${pointSize}" height="${pointSize}" viewBox="0 0 ${pointSize} ${pointSize}" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="${anchorPoint}" cy="${anchorPoint}" r="${anchorPoint * 0.75}" fill="#22c55e" stroke="#16a34a" stroke-width="1"/>
                </svg>
            `),
            scaledSize: new google.maps.Size(pointSize, pointSize),
            anchor: new google.maps.Point(anchorPoint, anchorPoint),
        };

        const newMarkers: google.maps.Marker[] = [];
        filteredPoints.forEach((point) => {
            // Check if still current generation
            if (currentGenerationIdRef.current !== generationId) {
                // Clean up any markers created so far
                newMarkers.forEach((m) => m.setMap(null));
                return;
            }

            const marker = new google.maps.Marker({
                position: { lat: point.lat, lng: point.lng },
                map: map,
                icon: plantIcon,
                title: `Plant: ${point.cropType}`,
                optimized: true,
                clickable: false,
            });
            newMarkers.push(marker);
        });

        // Only update if still current generation
        if (currentGenerationIdRef.current === generationId) {
            plantPointMarkersRef.current = newMarkers;
        } else {
            // Clean up if generation was cancelled
            newMarkers.forEach((m) => m.setMap(null));
        }
    }, [map, plantPoints, clearAllPlantMarkers, calculatePointSize, mapZoom]);

    // Calculate plant count and row/column info without creating actual points
    const calculatePlantCountOnly = useCallback(
        async (generationId: number): Promise<{ count: number; rows: number; columns: number }> => {
            if (mainArea.length < 3 || selectedCrops.length === 0) {
                return { count: 0, rows: 0, columns: 0 };
            }

            const primaryCrop = selectedCrops[0];
            const cropInfo = getCropSpacingInfo(primaryCrop);
            const rowSpacingM = cropInfo.rowSpacing / 100;
            const plantSpacingM = cropInfo.plantSpacing / 100;
            const bufferDistance = plantSpacingM * 0.3;


            const origin = computeCentroid(mainArea);

            const mainXY = mainArea.map((p) => toLocalXY(p, origin));
            const obstaclesXY = obstacles.map((o) =>
                o.coordinates.map((p) => toLocalXY(p, origin))
            );

            const xs = mainXY.map((p) => p.x);
            const ys = mainXY.map((p) => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            let plantCount = 0;
            let actualRows = 0;
            let maxColumnsInAnyRow = 0;

            // Calculate center Y coordinate for starting from the middle
            const centerY = (minY + maxY) / 2;

            // Calculate how many rows we can fit above and below center
            const totalHeight = maxY - minY;
            const maxRows = Math.floor(totalHeight / rowSpacingM);
            const rowsAboveCenter = Math.floor(maxRows / 2);
            const rowsBelowCenter = maxRows - rowsAboveCenter;

            // Generate rows starting from center and expanding outward
            const allRowYs: number[] = [];

            // Add center row first
            allRowYs.push(centerY);

            // Add rows above center (going up)
            for (let i = 1; i <= rowsAboveCenter; i++) {
                const yAbove = centerY + i * rowSpacingM;
                if (yAbove <= maxY) {
                    allRowYs.push(yAbove);
                }
            }

            // Add rows below center (going down)
            for (let i = 1; i <= rowsBelowCenter; i++) {
                const yBelow = centerY - i * rowSpacingM;
                if (yBelow >= minY) {
                    allRowYs.push(yBelow);
                }
            }

            // Sort rows from bottom to top for consistent ordering
            allRowYs.sort((a, b) => a - b);

            // Count plants for each row
            for (let rowIndex = 0; rowIndex < allRowYs.length; rowIndex++) {
                const y = allRowYs[rowIndex];

                // Check generation ID frequently during long operations
                if (rowIndex % 10 === 0) {
                    if (currentGenerationIdRef.current !== generationId) {
                        return { count: 0, rows: 0, columns: 0 };
                    }
                    await yieldToFrame();
                }

                let plantsInThisRow = 0;
                let plantIndex = 0;
                for (let x = minX; x <= maxX; x += plantSpacingM) {
                    // Additional check for very long rows
                    if (plantIndex % 50 === 0 && currentGenerationIdRef.current !== generationId) {
                        return { count: 0, rows: 0, columns: 0 };
                    }

                    const pt = { x, y };
                    const insideMain = isPointInPolygonXY(pt, mainXY);
                    const insideAnyHole = obstaclesXY.some((poly) => isPointInPolygonXY(pt, poly));
                    if (insideMain && !insideAnyHole) {
                        const distanceFromEdge = Math.min(
                            distanceToPolygonEdgeXY(pt, mainXY),
                            ...obstaclesXY.map((poly) => distanceToPolygonEdgeXY(pt, poly))
                        );
                        if (distanceFromEdge >= bufferDistance) {
                            plantCount++;
                            plantsInThisRow++;
                        }
                    }
                    plantIndex++;
                }

                if (plantsInThisRow > 0) {
                    actualRows++;
                    maxColumnsInAnyRow = Math.max(maxColumnsInAnyRow, plantsInThisRow);
                }
            }


            return { count: plantCount, rows: actualRows, columns: maxColumnsInAnyRow };
        },
        [
            mainArea,
            selectedCrops,
            obstacles,
            getCropSpacingInfo,
            computeCentroid,
            toLocalXY,
            isPointInPolygonXY,
            distanceToPolygonEdgeXY,
        ]
    );

    // Save field data to localStorage immediately after plant count calculation
    const saveFieldDataToLocalStorage = useCallback(
        (plantCount: number, rows: number, columns: number) => {
            try {
                const fieldDataToSave = {
                    mainArea: mainArea.length >= 3 ? mainArea : [],
                    obstacles: obstacles.filter((obs) => obs.coordinates.length >= 3),
                    plantPoints: (() => {
                        // Create a minimal plant points array to preserve realPlantCount
                        const minimalPoints: PlantPoint[] = [];

                        // If we have real plant count, create a single dummy point to preserve the count
                        if (plantCount > 0) {
                            minimalPoints.push({
                                id: 'dummy-point-for-count',
                                lat: 0,
                                lng: 0,
                                cropType: selectedCrops[0] || 'unknown',
                                isValid: false,
                            });
                        }

                        // Preserve real count and real points in the plant points data
                        (minimalPoints as PlantPointArrayWithRealCount).__realCount = plantCount;
                        (minimalPoints as PlantPointArrayWithRealCount).__realPoints = [];
                        return minimalPoints;
                    })(),
                    // Add realPlantCount as a separate property to ensure it's saved
                    realPlantCount: plantCount,
                    calculatedRows: rows,
                    calculatedColumns: columns,
                    areaRai: typeof areaRai === 'number' && !isNaN(areaRai) ? areaRai : null,
                    perimeterMeters:
                        typeof perimeterMeters === 'number' && !isNaN(perimeterMeters)
                            ? perimeterMeters
                            : null,
                    rowSpacing: Object.fromEntries(
                        Object.entries(rowSpacing).filter(
                            ([, value]) => typeof value === 'number' && !isNaN(value) && value > 0
                        )
                    ),
                    plantSpacing: Object.fromEntries(
                        Object.entries(plantSpacing).filter(
                            ([, value]) => typeof value === 'number' && !isNaN(value) && value > 0
                        )
                    ),
                    selectedCrops: selectedCrops,
                    mapCenter: { lat: mapCenter[0], lng: mapCenter[1] },
                    mapZoom: mapZoom,
                };


                // Use standardized storage approach
                updateFieldData(fieldDataToSave);
            } catch {
                // Error saving field data to localStorage
            }
        },
        [
            mainArea,
            obstacles,
            selectedCrops,
            areaRai,
            perimeterMeters,
            rowSpacing,
            plantSpacing,
            mapCenter,
            mapZoom,
            updateFieldData,
        ]
    );

    // [FIX] Enhanced plant generation logic with proper race condition handling and error recovery
    const runPlantGeneration = useCallback(async () => {
        setIsGeneratingPlants(true);

        try {
            // Increment generation ID to start a new generation, invalidating previous ones
            const generationId = ++currentGenerationIdRef.current;

            // Clear previous markers immediately for better UX
            clearAllPlantMarkers();

            // Calculate plant count and row/column info (no actual point generation)
            const result = await Promise.race([
                calculatePlantCountOnly(generationId),
                new Promise<{ count: number; rows: number; columns: number }>((_, reject) =>
                    setTimeout(() => reject(new Error(t('Plant count calculation timeout'))), 10000)
                ),
            ]);

            // Check if this is still the latest request before proceeding
            if (currentGenerationIdRef.current !== generationId) {
                return;
            }

            // Validate calculated result
            if (typeof result.count !== 'number' || result.count === 0) {
                setPlantPoints([]);
                setRealPlantPoints([]);
                setRealPlantCount(0);
                setCalculatedRows(0);
                setCalculatedColumns(0);
                return;
            }

            // Set the calculated plant count and row/column info
            setRealPlantCount(result.count);
            setCalculatedRows(result.rows);
            setCalculatedColumns(result.columns);
            setRealPlantPoints([]); // No actual points stored
            setPlantPoints([]); // No display points


            // Save to localStorage immediately after calculation
            saveFieldDataToLocalStorage(result.count, result.rows, result.columns);
        } catch (error) {
            if (error instanceof Error && error.message === t('Plant count calculation timeout')) {
                alert(
                    t(
                        'Plant count calculation took too long. Please try with a smaller area or different spacing.'
                    )
                );
            } else {
                alert(
                    t('Error calculating plant count. Please check your area and spacing settings.')
                );
            }
            // Clear any partial results
            setPlantPoints([]);
            setRealPlantPoints([]);
            setRealPlantCount(0);
            setCalculatedRows(0);
            setCalculatedColumns(0);
        } finally {
            setIsGeneratingPlants(false);
        }
    }, [calculatePlantCountOnly, clearAllPlantMarkers, saveFieldDataToLocalStorage, t]);

    // Handle plant point generation
    const handleGeneratePlantPoints = useCallback(async () => {

        if (!isMainAreaSet || selectedCrops.length === 0) {
            alert(t('Please set main area and select crops first'));
            return;
        }
        runPlantGeneration();
    }, [isMainAreaSet, selectedCrops, runPlantGeneration, t]);

    // [FIX] Enhanced clear plant points with proper cleanup
    const clearPlantPoints = useCallback(() => {
        // Increment generation ID to cancel any ongoing operations
        currentGenerationIdRef.current++;

        // Clear states
        setPlantPoints([]);
        setRealPlantPoints([]);
        setRealPlantCount(0);
        setCalculatedRows(0);
        setCalculatedColumns(0);

        // Clear all markers
        clearAllPlantMarkers();
    }, [clearAllPlantMarkers]);

    // Water requirement info based on primary crop and current plant count
    const waterRequirementInfo = useMemo(() => {
        if (selectedCrops.length === 0)
            return { perPlant: null as number | null, total: null as number | null };
        const primary = getCropByValue(selectedCrops[0]);
        if (!primary) return { perPlant: null as number | null, total: null as number | null };
        const perPlant = primary.waterRequirement; // liters/plant/day
        const total = realPlantCount * perPlant; // Use real plant count for accurate calculation
        return { perPlant, total };
    }, [selectedCrops, realPlantCount]);

    // ===== OBSTACLE FUNCTIONS =====

    // Clear obstacles function
    const clearObstacles = useCallback(() => {
        setObstacles([]);
        obstacleOverlays.forEach((overlay) => overlay.setMap(null));
        setObstacleOverlays([]);
        Object.values(distanceOverlaysByObstacle).forEach(({ lines, labels }) => {
            lines.forEach((l) => l.setMap(null));
            labels.forEach((lb) => lb.setMap(null));
        });
        setDistanceOverlaysByObstacle({});
        if (drawnPolygon && mainArea.length >= 3) {
            drawnPolygon.setPaths([mainArea]);
            computeAreaAndPerimeter(mainArea, []);
        }
    }, [
        obstacleOverlays,
        drawnPolygon,
        mainArea,
        computeAreaAndPerimeter,
        distanceOverlaysByObstacle,
    ]);

    // Delete specific obstacle function
    const deleteObstacle = useCallback(
        (obstacleId: string) => {
            const obstacleIndex = obstacles.findIndex((obs) => obs.id === obstacleId);
            if (obstacleIndex !== -1) {
                if (obstacleOverlays[obstacleIndex]) {
                    obstacleOverlays[obstacleIndex].setMap(null);
                }

                setObstacles((prev) => prev.filter((obs) => obs.id !== obstacleId));
                setObstacleOverlays((prev) => prev.filter((_, index) => index !== obstacleIndex));
                const remaining = obstacles
                    .filter((obs) => obs.id !== obstacleId)
                    .map((o) => o.coordinates);
                if (drawnPolygon && mainArea.length >= 3) {
                    drawnPolygon.setPaths([mainArea, ...remaining]);
                    computeAreaAndPerimeter(mainArea, remaining);
                }
            }
        },
        [obstacles, obstacleOverlays, drawnPolygon, mainArea, computeAreaAndPerimeter]
    );

    // Obstacle drawing functions
    const startDrawingObstacle = useCallback(
        (obstacleType: typeof selectedObstacleType, shapeType: string = 'polygon') => {
            if (!drawingManagerRef || !isMainAreaSet) return;

            setIsDrawingObstacle(true);
            setSelectedObstacleType(obstacleType);
            setSelectedObstacleShape(shapeType);

            const obstacleColors =
                obstacleType === 'water_source'
                    ? { fill: '#3b82f6', stroke: '#1d4ed8' }
                    : { fill: '#6b7280', stroke: '#374151' };

            const drawingMode =
                shapeType === 'rectangle'
                    ? google.maps.drawing.OverlayType.RECTANGLE
                    : shapeType === 'circle'
                      ? google.maps.drawing.OverlayType.CIRCLE
                      : google.maps.drawing.OverlayType.POLYGON;

            drawingManagerRef.setOptions({
                polygonOptions: {
                    fillColor: obstacleColors.fill,
                    fillOpacity: 0.4,
                    strokeColor: obstacleColors.stroke,
                    strokeWeight: 2,
                    strokeOpacity: 1,
                    editable: true,
                    draggable: false,
                    clickable: true,
                },
                rectangleOptions: {
                    fillColor: obstacleColors.fill,
                    fillOpacity: 0.4,
                    strokeColor: obstacleColors.stroke,
                    strokeWeight: 2,
                    strokeOpacity: 1,
                    editable: true,
                    draggable: false,
                    clickable: true,
                },
                circleOptions: {
                    fillColor: obstacleColors.fill,
                    fillOpacity: 0.4,
                    strokeColor: obstacleColors.stroke,
                    strokeWeight: 2,
                    strokeOpacity: 1,
                    editable: true,
                    draggable: false,
                    clickable: true,
                },
            });

            drawingManagerRef.setDrawingMode(drawingMode);
        },
        [drawingManagerRef, isMainAreaSet]
    );

    const stopDrawingObstacle = useCallback(() => {
        if (!drawingManagerRef) return;

        setIsDrawingObstacle(false);
        drawingManagerRef.setDrawingMode(null);
        drawingManagerRef.setOptions({
            polygonOptions: {
                fillColor: '#86EFAC',
                fillOpacity: 0.3,
                strokeColor: '#22C55E',
                strokeWeight: 3,
                strokeOpacity: 1,
                editable: true,
                draggable: false,
                clickable: true,
            },
            rectangleOptions: {
                fillColor: '#86EFAC',
                fillOpacity: 0.3,
                strokeColor: '#22C55E',
                strokeWeight: 3,
                strokeOpacity: 1,
                editable: true,
                draggable: false,
                clickable: true,
            },
            circleOptions: {
                fillColor: '#86EFAC',
                fillOpacity: 0.3,
                strokeColor: '#22C55E',
                strokeWeight: 3,
                strokeOpacity: 1,
                editable: true,
                draggable: false,
                clickable: true,
            },
        });
    }, [drawingManagerRef]);

    const steps: StepData[] = [
        {
            id: 1,
            key: 'area-creating',
            title: t('Area Creating'),
            description: t('Set up the initial area for your field'),
            route: '/step1-field-area',
        },
        {
            id: 2,
            key: 'irrigation-generate',
            title: t('Irrigation Generate'),
            description: t('Generate irrigation system and settings'),
            route: '/step2-irrigation-system',
        },
        {
            id: 3,
            key: 'zone-obstacle',
            title: t('Zone Obstacle'),
            description: t('Define zones and obstacles'),
            route: '/step3-zones-obstacles',
        },
        {
            id: 4,
            key: 'pipe-generate',
            title: t('Pipe Generate'),
            description: t('Generate pipe layout and connections'),
            route: '/step4-pipe-system',
        },
    ];

    // Data initialization effect
    useEffect(() => {
        // If this is a browser reload, mirror the Reset behavior on this page
        const navEntries =
            typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function'
                ? (performance.getEntriesByType('navigation') as PerformanceEntry[])
                : [];
        const navTiming = navEntries[0] as PerformanceNavigationTiming | undefined;
        const legacyNav =
            typeof performance !== 'undefined'
                ? (performance as Performance & { navigation?: PerformanceNavigation }).navigation
                : undefined;
        const isReload = navTiming?.type === 'reload' || legacyNav?.type === 1;
        // Detect presence of currentStep in the URL to avoid false "fresh load" resets when navigating back
        const currentStepParamPresent = (() => {
            try {
                if (typeof window === 'undefined') return false;
                const qs = new URLSearchParams(window.location.search);
                return qs.has('currentStep');
            } catch {
                return false;
            }
        })();
        if (isReload) {
            if (!currentStepParamPresent) {
                localStorage.removeItem('fieldCropData');
                setMainArea([]);
                setAreaRai(null);
                setPerimeterMeters(null);
                setIsMainAreaSet(false);
                setPlantPoints([]);
                setRealPlantPoints([]);
                setRealPlantCount(0);
                setCalculatedRows(0);
                setCalculatedColumns(0);
                setObstacles([]);
                setRowSpacing({});
                setPlantSpacing({});
                setMapCenter([13.7563, 100.5018]);
                setMapZoom(16);
                if (map) {
                    if (drawnPolygonRef.current) {
                        drawnPolygonRef.current.setMap(null);
                        drawnPolygonRef.current = null;
                    }
                    obstacleOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
                    setObstacleOverlays([]);
                    clearAllPlantMarkers();
                    Object.values(distanceOverlaysByObstacleRef.current).forEach(
                        ({ lines, labels }) => {
                            lines.forEach((l) => l.setMap(null));
                            labels.forEach((lb) => lb.setMap(null));
                        }
                    );
                    setDistanceOverlaysByObstacle({});
                }
            }
        }

        const hasUrlParams =
            crops ||
            completedSteps ||
            mainAreaData ||
            obstaclesData ||
            plantPointsData ||
            areaRaiData ||
            perimeterMetersData ||
            rowSpacingData ||
            plantSpacingData ||
            currentStepParamPresent ||
            // Check if we have data in localStorage (indicating we're navigating back from a completed flow)
            (() => {
                try {
                    const stored = localStorage.getItem('fieldCropData');
                    return stored && JSON.parse(stored);
                } catch {
                    return false;
                }
            })();

        if (!hasUrlParams) {
            // Only clear storage if not navigating within flow and not a completed project
            const hasCompletedProject = (() => {
                try {
                    const stored = localStorage.getItem('fieldCropData');
                    if (!stored) return false;
                    const data = JSON.parse(stored);
                    // Check if we have completed project data (zones, pipes, irrigation)
                    return data.zones?.length > 0 || data.pipes?.length > 0 || 
                           data.irrigationPositions?.sprinklers?.length > 0 || 
                           data.irrigationPositions?.pivots?.length > 0;
                } catch {
                    return false;
                }
            })();
            
            if (!currentStepParamPresent && !hasCompletedProject) {
                localStorage.removeItem('fieldCropData');
            }
            
            // Only reset state if we don't have a completed project
            if (!hasCompletedProject) {
                setMainArea([]);
                setAreaRai(null);
                setPerimeterMeters(null);
                setIsMainAreaSet(false);
                setPlantPoints([]);
                setRealPlantPoints([]);
                setRealPlantCount(0);
                setCalculatedRows(0);
                setCalculatedColumns(0);
                setObstacles([]);
                setRowSpacing({});
                setPlantSpacing({});
                setMapCenter([13.7563, 100.5018]);
                setMapZoom(16);
            }

            if (map) {
                if (drawnPolygonRef.current) {
                    drawnPolygonRef.current.setMap(null);
                    drawnPolygonRef.current = null;
                }
                obstacleOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
                setObstacleOverlays([]);
                clearAllPlantMarkers();
                Object.values(distanceOverlaysByObstacleRef.current).forEach(
                    ({ lines, labels }) => {
                        lines.forEach((l) => l.setMap(null));
                        labels.forEach((lb) => lb.setMap(null));
                    }
                );
                setDistanceOverlaysByObstacle({});
            }

            return; // Exit early to prevent any data loading
        }

        if (crops) {
            const cropList = crops.split(',').filter((crop) => crop.trim());
            setSelectedCrops(cropList);

            setRowSpacing((prev) => {
                const updated: Record<string, number> = { ...prev };
                cropList.forEach((cropValue) => {
                    const crop = getCropByValue(cropValue);
                    if (crop !== undefined && updated[cropValue] === undefined) {
                        updated[cropValue] = crop.rowSpacing;
                    }
                });
                return updated;
            });
            setPlantSpacing((prev) => {
                const updated: Record<string, number> = { ...prev };
                cropList.forEach((cropValue) => {
                    const crop = getCropByValue(cropValue);
                    if (crop !== undefined && updated[cropValue] === undefined) {
                        updated[cropValue] = crop.plantSpacing;
                    }
                });
                return updated;
            });
        }

        if (completedSteps) {
            const completedArray = parseCompletedSteps(completedSteps);
            setCompleted(completedArray);
        }

        if (hasUrlParams) {
            try {
                const fieldDataStr = localStorage.getItem('fieldCropData');
                if (fieldDataStr) {
                    const fieldData = JSON.parse(fieldDataStr);

                    // Validate and load main area data
                    if (
                        fieldData.mainArea &&
                        Array.isArray(fieldData.mainArea) &&
                        fieldData.mainArea.length >= 3
                    ) {
                        // Validate coordinates
                        const validMainArea = fieldData.mainArea.filter(
                            (coord: unknown) =>
                                coord &&
                                typeof (coord as Coordinate).lat === 'number' &&
                                typeof (coord as Coordinate).lng === 'number' &&
                                !isNaN((coord as Coordinate).lat) &&
                                !isNaN((coord as Coordinate).lng) &&
                                (coord as Coordinate).lat >= -90 &&
                                (coord as Coordinate).lat <= 90 &&
                                (coord as Coordinate).lng >= -180 &&
                                (coord as Coordinate).lng <= 180
                        ) as Coordinate[];

                        if (validMainArea.length >= 3) {
                            setMainArea(validMainArea);
                            setIsMainAreaSet(true);
                        }
                    }

                    // Validate and load obstacles data
                    if (
                        fieldData.obstacles &&
                        Array.isArray(fieldData.obstacles) &&
                        fieldData.obstacles.length > 0
                    ) {
                        const validObstacles = fieldData.obstacles.filter((obstacle: unknown) => {
                            const obs = obstacle as Obstacle;
                            return (
                                obs &&
                                obs.id &&
                                obs.type &&
                                Array.isArray(obs.coordinates) &&
                                obs.coordinates.length >= 3 &&
                                obs.coordinates.every(
                                    (coord: Coordinate) =>
                                        coord &&
                                        typeof coord.lat === 'number' &&
                                        typeof coord.lng === 'number' &&
                                        !isNaN(coord.lat) &&
                                        !isNaN(coord.lng) &&
                                        coord.lat >= -90 &&
                                        coord.lat <= 90 &&
                                        coord.lng >= -180 &&
                                        coord.lng <= 180
                                )
                            );
                        }) as Obstacle[];

                        if (validObstacles.length > 0) {
                            setObstacles(validObstacles);
                        }
                    }

                    // Validate and load plant points data
                    if (
                        fieldData.plantPoints &&
                        Array.isArray(fieldData.plantPoints) &&
                        fieldData.plantPoints.length > 0
                    ) {
                        const validPlantPoints = fieldData.plantPoints.filter((point: unknown) => {
                            const pt = point as PlantPoint;
                            return (
                                pt &&
                                pt.id &&
                                typeof pt.lat === 'number' &&
                                typeof pt.lng === 'number' &&
                                !isNaN(pt.lat) &&
                                !isNaN(pt.lng) &&
                                pt.lat >= -90 &&
                                pt.lat <= 90 &&
                                pt.lng >= -180 &&
                                pt.lng <= 180
                            );
                        }) as PlantPoint[];

                        if (validPlantPoints.length > 0) {
                            // Extract real count and real points if available
                            const realCount = extractRealCount(validPlantPoints);
                            const realPoints = extractRealPoints(validPlantPoints);
                            setRealPlantCount(realCount);
                            setRealPlantPoints(realPoints);

                            // Set plantPoints to show all real points
                            setPlantPoints(realPoints);
                        }
                    }

                    // Validate and load numeric data
                    if (
                        fieldData.areaRai !== null &&
                        fieldData.areaRai !== undefined &&
                        !isNaN(fieldData.areaRai)
                    ) {
                        setAreaRai(fieldData.areaRai);
                    }

                    if (
                        fieldData.perimeterMeters !== null &&
                        fieldData.perimeterMeters !== undefined &&
                        !isNaN(fieldData.perimeterMeters)
                    ) {
                        setPerimeterMeters(fieldData.perimeterMeters);
                    }

                    // Load calculated rows and columns if available
                    if (
                        fieldData.calculatedRows !== null &&
                        fieldData.calculatedRows !== undefined &&
                        !isNaN(fieldData.calculatedRows)
                    ) {
                        setCalculatedRows(fieldData.calculatedRows);
                    }

                    if (
                        fieldData.calculatedColumns !== null &&
                        fieldData.calculatedColumns !== undefined &&
                        !isNaN(fieldData.calculatedColumns)
                    ) {
                        setCalculatedColumns(fieldData.calculatedColumns);
                    }

                    // Validate and load spacing data
                    if (fieldData.rowSpacing && typeof fieldData.rowSpacing === 'object') {
                        const validRowSpacing: Record<string, number> = {};
                        Object.entries(fieldData.rowSpacing).forEach(([key, value]) => {
                            if (
                                typeof value === 'number' &&
                                !isNaN(value) &&
                                value > 0 &&
                                value <= 300
                            ) {
                                validRowSpacing[key] = value;
                            }
                        });
                        if (Object.keys(validRowSpacing).length > 0) {
                            setRowSpacing(validRowSpacing);
                        }
                    }

                    if (fieldData.plantSpacing && typeof fieldData.plantSpacing === 'object') {
                        const validPlantSpacing: Record<string, number> = {};
                        Object.entries(fieldData.plantSpacing).forEach(([key, value]) => {
                            if (
                                typeof value === 'number' &&
                                !isNaN(value) &&
                                value > 0 &&
                                value <= 200
                            ) {
                                validPlantSpacing[key] = value;
                            }
                        });
                        if (Object.keys(validPlantSpacing).length > 0) {
                            setPlantSpacing(validPlantSpacing);
                        }
                    }

                    // Validate and load map data
                    if (
                        fieldData.mapCenter &&
                        typeof fieldData.mapCenter.lat === 'number' &&
                        typeof fieldData.mapCenter.lng === 'number' &&
                        !isNaN(fieldData.mapCenter.lat) &&
                        !isNaN(fieldData.mapCenter.lng) &&
                        fieldData.mapCenter.lat >= -90 &&
                        fieldData.mapCenter.lat <= 90 &&
                        fieldData.mapCenter.lng >= -180 &&
                        fieldData.mapCenter.lng <= 180
                    ) {
                        setMapCenter([fieldData.mapCenter.lat, fieldData.mapCenter.lng]);
                    }

                    if (
                        fieldData.mapZoom &&
                        typeof fieldData.mapZoom === 'number' &&
                        !isNaN(fieldData.mapZoom) &&
                        fieldData.mapZoom >= 1 &&
                        fieldData.mapZoom <= 22
                    ) {
                        setMapZoom(fieldData.mapZoom);
                    }

                    return;
                }
            } catch {
                // Clear corrupted data
                localStorage.removeItem('fieldCropData');
            }
        }

        if (mainAreaData) {
            try {
                const parsed = JSON.parse(mainAreaData);
                setMainArea(parsed);
                setIsMainAreaSet(true);
            } catch {
                // Error parsing mainAreaData
            }
        }

        if (obstaclesData) {
            try {
                const parsed = JSON.parse(obstaclesData);
                setObstacles(parsed);
            } catch {
                // Error parsing obstaclesData
            }
        }

        if (plantPointsData) {
            try {
                const parsed = JSON.parse(plantPointsData);
                setPlantPoints(parsed);

                // Extract real count if available, otherwise use displayed count
                const realCount = extractRealCount(parsed);
                setRealPlantCount(realCount);
            } catch {
                // Error parsing plantPointsData
            }
        }

        if (areaRaiData) {
            setAreaRai(parseFloat(areaRaiData));
        }
        if (perimeterMetersData) {
            setPerimeterMeters(parseFloat(perimeterMetersData));
        }

        if (rowSpacingData) {
            try {
                const parsed = JSON.parse(rowSpacingData);
                setRowSpacing(parsed);
            } catch {
                // Error parsing rowSpacingData
            }
        }

        if (plantSpacingData) {
            try {
                const parsed = JSON.parse(plantSpacingData);
                setPlantSpacing(parsed);
            } catch {
                // Error parsing plantSpacingData
            }
        }
    }, [
        crops,
        completedSteps,
        mainAreaData,
        obstaclesData,
        plantPointsData,
        areaRaiData,
        perimeterMetersData,
        rowSpacingData,
        plantSpacingData,
        map,
        clearAllPlantMarkers,
    ]);

    // Spacing handlers
    const handleRowSpacingEdit = (cropValue: string) => {
        setTempRowSpacing((prev) => ({
            ...prev,
            [cropValue]: (rowSpacing[cropValue] || 50).toString(),
        }));
        setEditingRowSpacingForCrop(cropValue);
    };

    const handleRowSpacingConfirm = (cropValue: string) => {
        const newValue = parseFloat(tempRowSpacing[cropValue] || '');
        if (!isNaN(newValue) && newValue > 0) {
            setRowSpacing((prev) => ({ ...prev, [cropValue]: newValue }));
            setEditingRowSpacingForCrop(null);
            setTempRowSpacing((prev) => {
                const updated = { ...prev };
                delete updated[cropValue];
                return updated;
            });
        } else {
            alert(t('Please enter a positive number for row spacing'));
        }
    };

    const handleRowSpacingCancel = (cropValue: string) => {
        setEditingRowSpacingForCrop(null);
        setTempRowSpacing((prev) => {
            const updated = { ...prev };
            delete updated[cropValue];
            return updated;
        });
    };

    const handlePlantSpacingEdit = (cropValue: string) => {
        setTempPlantSpacing((prev) => ({
            ...prev,
            [cropValue]: (plantSpacing[cropValue] || 20).toString(),
        }));
        setEditingPlantSpacingForCrop(cropValue);
    };

    const handlePlantSpacingConfirm = (cropValue: string) => {
        const newValue = parseFloat(tempPlantSpacing[cropValue] || '');
        if (!isNaN(newValue) && newValue > 0) {
            setPlantSpacing((prev) => ({ ...prev, [cropValue]: newValue }));
            setEditingPlantSpacingForCrop(null);
            setTempPlantSpacing((prev) => {
                const updated = { ...prev };
                delete updated[cropValue];
                return updated;
            });
        } else {
            alert(t('Please enter a positive number for plant spacing'));
        }
    };

    const handlePlantSpacingCancel = (cropValue: string) => {
        setEditingPlantSpacingForCrop(null);
        setTempPlantSpacing((prev) => {
            const updated = { ...prev };
            delete updated[cropValue];
            return updated;
        });
    };

    const resetSpacingToDefaults = () => {
        setRowSpacing((prev) => {
            const updated: Record<string, number> = { ...prev };
            selectedCrops.forEach((cropValue) => {
                const crop = getCropByValue(cropValue);
                if (crop) updated[cropValue] = crop.rowSpacing;
            });
            return updated;
        });
        setPlantSpacing((prev) => {
            const updated: Record<string, number> = { ...prev };
            selectedCrops.forEach((cropValue) => {
                const crop = getCropByValue(cropValue);
                if (crop) updated[cropValue] = crop.plantSpacing;
            });
            return updated;
        });
        setEditingRowSpacingForCrop(null);
        setEditingPlantSpacingForCrop(null);
        setTempRowSpacing({});
        setTempPlantSpacing({});
    };

    const handleMapLoad = (loadedMap: google.maps.Map) => {
        setMap(loadedMap);
        listenersRef.current.push(
            loadedMap.addListener('zoom_changed', () => {
                const newZoom = loadedMap.getZoom() || 16;
                setMapZoom(newZoom);
            })
        );

        if (!window.google?.maps?.drawing) {
            alert(t('Drawing tools could not be loaded. Please refresh the page.'));
            return;
        }

        const drawingManager = new google.maps.drawing.DrawingManager({
            drawingMode: null,
            drawingControl: false,
            polygonOptions: {
                fillColor: '#86EFAC',
                fillOpacity: 0.3,
                strokeColor: '#22C55E',
                strokeWeight: 3,
                strokeOpacity: 1,
                editable: true,
                draggable: false,
                clickable: true,
            },
            rectangleOptions: {
                fillColor: '#86EFAC',
                fillOpacity: 0.3,
                strokeColor: '#22C55E',
                strokeWeight: 3,
                strokeOpacity: 1,
                editable: true,
                draggable: false,
                clickable: true,
            },
            circleOptions: {
                fillColor: '#86EFAC',
                fillOpacity: 0.3,
                strokeColor: '#22C55E',
                strokeWeight: 3,
                strokeOpacity: 1,
                editable: true,
                draggable: false,
                clickable: true,
            },
        });

        drawingManager.setMap(loadedMap);
        setDrawingManagerRef(drawingManager);

        const createEditablePolygon = (
            coordinates: Coordinate[],
            holes: Coordinate[][] = [],
            isEditable: boolean = false
        ) => {
            const styledPolygon = new google.maps.Polygon({
                paths: [coordinates, ...holes],
                fillColor: '#86EFAC',
                fillOpacity: 0.3,
                strokeColor: '#22C55E',
                strokeWeight: isEditable ? 4 : 3, // Thicker stroke when editing for better visibility
                strokeOpacity: 1,
                editable: isEditable,
                draggable: false,
                clickable: true,
                zIndex: 1000,
            });
            styledPolygon.setMap(loadedMap);

            if (isEditable) {
                const paths = styledPolygon.getPaths();
                const outerPath = paths.getAt(0);
                const syncFromPolygonPath = () => {
                    const updated: Coordinate[] = [];
                    for (let i = 0; i < outerPath.getLength(); i++) {
                        const latLng = outerPath.getAt(i);
                        updated.push({ lat: latLng.lat(), lng: latLng.lng() });
                    }
                    setMainArea(updated);
                    computeAreaAndPerimeter(updated, []);
                };
                listenersRef.current.push(outerPath.addListener('set_at', syncFromPolygonPath));
                listenersRef.current.push(outerPath.addListener('insert_at', syncFromPolygonPath));
                listenersRef.current.push(outerPath.addListener('remove_at', syncFromPolygonPath));
                listenersRef.current.push(
                    styledPolygon.addListener('dragstart', () =>
                        loadedMap.setOptions({ draggable: false })
                    )
                );
                listenersRef.current.push(
                    styledPolygon.addListener('dragend', () => {
                        loadedMap.setOptions({ draggable: true });
                        syncFromPolygonPath();
                    })
                );
            }
            return styledPolygon;
        };

        const validateObstacleInMainAreaWithRefs = (obstacleCoords: Coordinate[]): boolean => {
            if (mainAreaRef.current.length < 3) return false;
            if (drawnPolygonRef.current && window.google?.maps?.geometry?.poly) {
                try {
                    const tolerance = 5e-6;
                    return obstacleCoords.every((point) => {
                        const latLng = new google.maps.LatLng(point.lat, point.lng);
                        const inPoly = google.maps.geometry.poly.containsLocation(
                            latLng,
                            drawnPolygonRef.current as google.maps.Polygon
                        );
                        const onEdge = google.maps.geometry.poly.isLocationOnEdge(
                            latLng,
                            drawnPolygonRef.current as google.maps.Polygon,
                            tolerance
                        );
                        return inPoly || onEdge;
                    });
                } catch {
                    /* fall through to CPU method */
                }
            }
            const edgeToleranceMeters = 2.0;
            return obstacleCoords.every((point) => {
                if (isPointInPolygon(point, mainAreaRef.current)) return true;
                const distanceToEdge = distanceToPolygonEdge(point, mainAreaRef.current);
                return distanceToEdge <= edgeToleranceMeters;
            });
        };

        listenersRef.current.push(
            drawingManager.addListener('polygoncomplete', (polygon: google.maps.Polygon) => {
                const coordinates = extractCoordinatesFromPolygon(polygon);
                const isObstacleIntent =
                    drawingManager.get('polygonOptions').fillColor !== '#86EFAC';

                if (drawnPolygonRef.current != null && isObstacleIntent) {
                    if (validateObstacleInMainAreaWithRefs(coordinates)) {
                        const newObstacle: Obstacle = {
                            id: `obstacle_${Date.now()}`,
                            type: selectedObstacleTypeRef.current,
                            coordinates: coordinates,
                            name: `${selectedObstacleTypeRef.current}_${obstaclesRef.current.length + 1}`,
                        };
                        const obstacleColors =
                            newObstacle.type === 'water_source'
                                ? { fill: '#3b82f6', stroke: '#1d4ed8' }
                                : { fill: '#6b7280', stroke: '#374151' };
                        polygon.setOptions({
                            fillColor: obstacleColors.fill,
                            strokeColor: obstacleColors.stroke,
                            fillOpacity: 0.4,
                            strokeOpacity: 1,
                            strokeWeight: 2,
                            editable: false,
                            draggable: false,
                            clickable: true,
                        });
                        setObstacles((prev) => [...prev, newObstacle]);
                        setObstacleOverlays((prev) => [...prev, polygon]);
                        if (newObstacle.type === 'water_source')
                            createDistanceOverlaysForWaterObstacle(newObstacle);
                        // Remove any plant points overlapped by this obstacle
                        try {
                            setPlantPoints((prev) => {
                                const thresholdMeters = 0.5;
                                return prev.filter((pt) => {
                                    if (isPointInPolygon(pt, newObstacle.coordinates)) return false;
                                    const d = distanceToPolygonEdge(pt, newObstacle.coordinates);
                                    return d > thresholdMeters;
                                });
                            });
                        } catch {
                            // Error removing overlapped plant points
                        }
                        computeAreaAndPerimeter(mainAreaRef.current, []);
                    } else {
                        alert(t('Obstacle must be within the main area'));
                        polygon.setMap(null);
                    }

                    setIsDrawingObstacle(false);
                    drawingManager.setDrawingMode(null);
                    drawingManager.setOptions({
                        polygonOptions: {
                            fillColor: '#86EFAC',
                            fillOpacity: 0.3,
                            strokeColor: '#22C55E',
                            strokeWeight: 2,
                            strokeOpacity: 1,
                            editable: true,
                            draggable: false,
                            clickable: true,
                        },
                    });
                    return;
                }

                if (drawnPolygonRef.current == null) {
                    setMainArea(coordinates);
                    computeAreaAndPerimeter(coordinates, []);
                    setIsDrawing(false);
                    setIsMainAreaSet(true);
                    setIsEditingMainArea(false); // Start in confirm mode
                    drawingManager.setDrawingMode(null);

                    const prevPoly = drawnPolygonRef.current;
                    if (prevPoly) {
                        detachOverlay(prevPoly);
                    }

                    // Create polygon in confirm mode (not editable)
                    const styledPolygon = createEditablePolygon(coordinates, [], false);
                    setDrawnPolygon(styledPolygon);
                    drawnPolygonRef.current = styledPolygon;
                    polygon.setMap(null);
                    return;
                }

                polygon.setMap(null);
                stopDrawingObstacle();
            })
        );

        listenersRef.current.push(
            drawingManager.addListener('rectanglecomplete', (rectangle: google.maps.Rectangle) => {
                const coordinates = extractCoordinatesFromRectangle(rectangle);
                const isObstacleIntent =
                    drawingManager.get('rectangleOptions').fillColor !== '#86EFAC';

                if (isObstacleIntent && isDrawingObstacleRef.current) {
                    if (validateObstacleInMainAreaWithRefs(coordinates)) {
                        const newObstacle: Obstacle = {
                            id: `obstacle-${Date.now()}`,
                            type: selectedObstacleTypeRef.current,
                            coordinates: coordinates,
                            name:
                                selectedObstacleTypeRef.current === 'water_source'
                                    ? t('Water Source')
                                    : t('Other Obstacle'),
                        };

                        setObstacles((prev) => [...prev, newObstacle]);

                        const styledPolygon = createEditablePolygon(coordinates, [], true);
                        setObstacleOverlays((prev) => [...prev, styledPolygon]);

                        try {
                            setPlantPoints((prev) => {
                                const thresholdMeters = 0.5;
                                return prev.filter((pt) => {
                                    if (!isPointInPolygon(pt, mainAreaRef.current)) return true;
                                    if (isPointInPolygon(pt, newObstacle.coordinates)) return false;
                                    const d = distanceToPolygonEdge(pt, newObstacle.coordinates);
                                    return d > thresholdMeters;
                                });
                            });
                        } catch {
                            // Error removing overlapped plant points
                        }
                        computeAreaAndPerimeter(mainAreaRef.current, []);
                    } else {
                        alert(t('Obstacle must be within the main area'));
                        rectangle.setMap(null);
                    }

                    setIsDrawingObstacle(false);
                    drawingManager.setDrawingMode(null);
                    drawingManager.setOptions({
                        rectangleOptions: {
                            fillColor: '#86EFAC',
                            fillOpacity: 0.3,
                            strokeColor: '#22C55E',
                            strokeWeight: 2,
                            strokeOpacity: 1,
                            editable: true,
                            draggable: false,
                            clickable: true,
                        },
                    });
                    return;
                }

                if (drawnPolygonRef.current != null) {
                    rectangle.setMap(null);
                    return;
                }
                setMainArea(coordinates);
                computeAreaAndPerimeter(coordinates, []);
                setIsDrawing(false);
                setIsMainAreaSet(true);
                setIsEditingMainArea(false); // Start in confirm mode
                drawingManager.setDrawingMode(null);
                const prevPoly = drawnPolygonRef.current;
                if (prevPoly) {
                    detachOverlay(prevPoly);
                }
                const styledPolygon = createEditablePolygon(coordinates, [], false);
                setDrawnPolygon(styledPolygon);
                drawnPolygonRef.current = styledPolygon;
                rectangle.setMap(null);
            })
        );

        listenersRef.current.push(
            drawingManager.addListener('circlecomplete', (circle: google.maps.Circle) => {
                const coordinates = extractCoordinatesFromCircle(circle);
                const isObstacleIntent =
                    drawingManager.get('circleOptions').fillColor !== '#86EFAC';

                if (isObstacleIntent && isDrawingObstacleRef.current) {
                    if (validateObstacleInMainAreaWithRefs(coordinates)) {
                        const newObstacle: Obstacle = {
                            id: `obstacle-${Date.now()}`,
                            type: selectedObstacleTypeRef.current,
                            coordinates: coordinates,
                            name:
                                selectedObstacleTypeRef.current === 'water_source'
                                    ? t('Water Source')
                                    : t('Other Obstacle'),
                        };

                        setObstacles((prev) => [...prev, newObstacle]);

                        const styledPolygon = createEditablePolygon(coordinates, [], true);
                        setObstacleOverlays((prev) => [...prev, styledPolygon]);

                        try {
                            setPlantPoints((prev) => {
                                const thresholdMeters = 0.5;
                                return prev.filter((pt) => {
                                    if (!isPointInPolygon(pt, mainAreaRef.current)) return true;
                                    if (isPointInPolygon(pt, newObstacle.coordinates)) return false;
                                    const d = distanceToPolygonEdge(pt, newObstacle.coordinates);
                                    return d > thresholdMeters;
                                });
                            });
                        } catch {
                            // Error removing overlapped plant points
                        }
                        computeAreaAndPerimeter(mainAreaRef.current, []);
                    } else {
                        alert(t('Obstacle must be within the main area'));
                        circle.setMap(null);
                    }

                    setIsDrawingObstacle(false);
                    drawingManager.setDrawingMode(null);
                    drawingManager.setOptions({
                        circleOptions: {
                            fillColor: '#86EFAC',
                            fillOpacity: 0.3,
                            strokeColor: '#22C55E',
                            strokeWeight: 2,
                            strokeOpacity: 1,
                            editable: true,
                            draggable: false,
                            clickable: true,
                        },
                    });
                    return;
                }

                if (drawnPolygonRef.current != null) {
                    circle.setMap(null);
                    return;
                }
                setMainArea(coordinates);
                computeAreaAndPerimeter(coordinates, []);
                setIsDrawing(false);
                setIsMainAreaSet(true);
                setIsEditingMainArea(false); // Start in confirm mode
                drawingManager.setDrawingMode(null);
                const prevPoly = drawnPolygonRef.current;
                if (prevPoly) {
                    detachOverlay(prevPoly);
                }
                const styledPolygon = createEditablePolygon(coordinates, [], false);
                setDrawnPolygon(styledPolygon);
                drawnPolygonRef.current = styledPolygon;
                circle.setMap(null);
            })
        );
    };

    // ===== EVENT HANDLERS =====

    const handleSearch = useCallback(
        (lat: number, lng: number) => {
            setMapCenter([lat, lng]);
            if (map) {
                map.panTo({ lat, lng });
                map.setZoom(17);
            }
        },
        [map]
    );

    // Drawing control functions
    const startDrawing = (shapeType: string) => {
        if (!drawingManagerRef || isMainAreaSet) return;

        setIsDrawing(true);
        setSelectedShape(shapeType);

        const drawingMode =
            shapeType === 'rectangle'
                ? google.maps.drawing.OverlayType.RECTANGLE
                : shapeType === 'circle'
                  ? google.maps.drawing.OverlayType.CIRCLE
                  : google.maps.drawing.OverlayType.POLYGON;

        drawingManagerRef.setDrawingMode(drawingMode);
    };

    const stopDrawing = () => {
        if (!drawingManagerRef) return;

        setIsDrawing(false);
        drawingManagerRef.setDrawingMode(null);
    };

    const clearArea = () => {
        setMainArea([]);
        setAreaRai(null);
        setPerimeterMeters(null);
        setIsMainAreaSet(false);
        setIsEditingMainArea(false);
        clearPlantPoints();
        clearObstacles();
        if (drawnPolygon) {
            drawnPolygon.setMap(null);
            setDrawnPolygon(null);
        }
        stopDrawing();
    };

    const confirmMainArea = () => {
        if (drawnPolygonRef.current) {
            drawnPolygonRef.current.setEditable(false);
            drawnPolygonRef.current.setOptions({
                strokeWeight: 3, // Normal stroke weight when confirmed
                strokeColor: '#22C55E',
            });
            setIsEditingMainArea(false);
        }
    };

    const editMainArea = () => {
        if (drawnPolygonRef.current) {
            drawnPolygonRef.current.setEditable(true);
            drawnPolygonRef.current.setOptions({
                strokeWeight: 4, // Thicker stroke weight when editing for better visibility
                strokeColor: '#22C55E',
            });
            setIsEditingMainArea(true);
        }
    };

    const handleDrawingComplete = useCallback(
        (coordinates: Coordinate[], shapeType: string) => {
            if (shapeType === 'polygon' || shapeType === 'rectangle' || shapeType === 'circle') {
                setMainArea(coordinates);
                computeAreaAndPerimeter(coordinates);
            }
        },
        [computeAreaAndPerimeter]
    );

    const handleBackToCropSelection = () => {
        localStorage.removeItem('fieldCropData');
        router.get('/choose-crop', { crops: selectedCrops.join(',') });
    };

    const handleBack = () => {
        // Don't clear localStorage when going back to previous step
        // The data should be preserved for navigation between steps
        router.get('/choose-crop', { crops: selectedCrops.join(',') });
    };

    const handleStepClick = (step: StepData) => {
        if (step.id === activeStep) return;

        // Check if all 4 steps are completed
        const allStepsCompleted =
            completed.length >= 4 &&
            completed.includes(1) &&
            completed.includes(2) &&
            completed.includes(3) &&
            completed.includes(4);

        // If all steps are completed, allow free navigation
        if (allStepsCompleted) {
            navigateToStep(step);
            return;
        }

        // Original logic for incomplete steps
        if (completed.includes(step.id)) {
            navigateToStep(step);
            return;
        }
        if (step.id > activeStep && completed.includes(step.id - 1)) {
            navigateToStep(step);
            return;
        }
        if (step.id === 1) navigateToStep(step);
    };

    const navigateToStep = (step: StepData) => {
        // Persist current field state so going forward/back preserves the main area and overlays
        try {
            const fieldData = {
                mainArea: mainArea.length >= 3 ? mainArea : [],
                obstacles: obstacles.filter((obs) => obs.coordinates.length >= 3),
                plantPoints: (() => {
                    // Create a minimal plant points array to preserve realPlantCount
                    // Since we only calculate count now, we need to store the count information
                    const minimalPoints: PlantPoint[] = [];

                    // If we have real plant count, create a single dummy point to preserve the count
                    if (realPlantCount > 0) {
                        minimalPoints.push({
                            id: 'dummy-point-for-count',
                            lat: 0,
                            lng: 0,
                            cropType: selectedCrops[0] || 'unknown',
                            isValid: false,
                        });
                    }

                    // Preserve real count and real points in the plant points data
                    (minimalPoints as PlantPointArrayWithRealCount).__realCount = realPlantCount;
                    (minimalPoints as PlantPointArrayWithRealCount).__realPoints = realPlantPoints;
                    return minimalPoints;
                })(),
                // Add realPlantCount as a separate property to ensure it's saved
                realPlantCount: realPlantCount,
                calculatedRows: calculatedRows,
                calculatedColumns: calculatedColumns,
                areaRai: typeof areaRai === 'number' && !isNaN(areaRai) ? areaRai : null,
                perimeterMeters:
                    typeof perimeterMeters === 'number' && !isNaN(perimeterMeters)
                        ? perimeterMeters
                        : null,
                rowSpacing: Object.fromEntries(
                    Object.entries(rowSpacing).filter(
                        ([, value]) => typeof value === 'number' && !isNaN(value) && value > 0
                    )
                ),
                plantSpacing: Object.fromEntries(
                    Object.entries(plantSpacing).filter(
                        ([, value]) => typeof value === 'number' && !isNaN(value) && value > 0
                    )
                ),
                mapCenter: map
                    ? {
                          lat: map.getCenter()?.lat() || 13.7563,
                          lng: map.getCenter()?.lng() || 100.5018,
                      }
                    : { lat: 13.7563, lng: 100.5018 },
                mapZoom: map ? Math.max(1, Math.min(22, map.getZoom() || 16)) : 16,
            };
            safeSetItem('fieldCropData', fieldData);
        } catch {
            // Error saving field data before navigation
        }

        const params = {
            crops: selectedCrops.join(','),
            currentStep: step.id,
            completedSteps: toCompletedStepsCsv(completed),
        };
        router.get(step.route, params);
    };

    const handleContinue = () => {
        // Enforce: 1) main area set, 2) at least one water source, 3) generated plant points
        if (mainArea.length < 3 || !hasWaterSource || realPlantCount === 0) {
            alert(
                t(
                    'Please set main area, add a water source, and generate plant points before continuing'
                )
            );
            return;
        }
        const newCompleted = [...completed];
        if (!newCompleted.includes(activeStep)) newCompleted.push(activeStep);

        // Validate data before saving
        const fieldData = {
            mainArea: mainArea.length >= 3 ? mainArea : [],
            obstacles: obstacles.filter((obs) => obs.coordinates.length >= 3),
            plantPoints: (() => {
                // Create minimal plant points array to preserve realPlantCount
                // Create minimal points array to preserve realPlantCount
                const minimalPoints: PlantPoint[] =
                    realPlantCount > 0
                        ? [
                              {
                                  id: 'dummy-point-for-count',
                                  lat: 0,
                                  lng: 0,
                                  cropType: selectedCrops[0] || 'unknown',
                                  isValid: false,
                              },
                          ]
                        : [];

                // Preserve real count and real points in the plant points data
                (minimalPoints as PlantPointArrayWithRealCount).__realCount = realPlantCount;
                (minimalPoints as PlantPointArrayWithRealCount).__realPoints = realPlantPoints;
                return minimalPoints;
            })(),
            // Add realPlantCount as a separate property to ensure it's saved
            realPlantCount: realPlantCount,
            areaRai: typeof areaRai === 'number' && !isNaN(areaRai) ? areaRai : null,
            perimeterMeters:
                typeof perimeterMeters === 'number' && !isNaN(perimeterMeters)
                    ? perimeterMeters
                    : null,
            calculatedRows: calculatedRows,
            calculatedColumns: calculatedColumns,
            rowSpacing: Object.fromEntries(
                Object.entries(rowSpacing).filter(
                    ([, value]) => typeof value === 'number' && !isNaN(value) && value > 0
                )
            ),
            plantSpacing: Object.fromEntries(
                Object.entries(plantSpacing).filter(
                    ([, value]) => typeof value === 'number' && !isNaN(value) && value > 0
                )
            ),
            mapCenter: map
                ? {
                      lat: map.getCenter()?.lat() || 13.7563,
                      lng: map.getCenter()?.lng() || 100.5018,
                  }
                : { lat: 13.7563, lng: 100.5018 },
            mapZoom: map ? Math.max(1, Math.min(22, map.getZoom() || 16)) : 16,
        };

        try {
            // Check data size before saving
            const dataString = JSON.stringify(fieldData);
            const dataSizeKB = new Blob([dataString]).size / 1024;

            if (dataSizeKB > 5000) {
                // 5MB limit

                // Create minimal points array to preserve realPlantCount
                const minimalPoints: PlantPoint[] =
                    realPlantCount > 0
                        ? [
                              {
                                  id: 'dummy-point-for-count',
                                  lat: 0,
                                  lng: 0,
                                  cropType: selectedCrops[0] || 'unknown',
                                  isValid: false,
                              },
                          ]
                        : [];

                // Preserve real count and real points in optimized data
                (minimalPoints as PlantPointArrayWithRealCount).__realCount = realPlantCount;
                (minimalPoints as PlantPointArrayWithRealCount).__realPoints = realPlantPoints;

                const optimizedData = {
                    ...fieldData,
                    plantPoints: minimalPoints,
                    realPlantCount: realPlantCount,
                    mainArea: fieldData.mainArea.map((coord) => ({
                        lat: Math.round(coord.lat * 1000000) / 1000000,
                        lng: Math.round(coord.lng * 1000000) / 1000000,
                    })),
                    obstacles: fieldData.obstacles.map((obs) => ({
                        ...obs,
                        coordinates: obs.coordinates.map((coord) => ({
                            lat: Math.round(coord.lat * 1000000) / 1000000,
                            lng: Math.round(coord.lng * 1000000) / 1000000,
                        })),
                    })),
                };

                const optimizedString = JSON.stringify(optimizedData);
                const optimizedSizeKB = new Blob([optimizedString]).size / 1024;

                if (optimizedSizeKB > 5000) {
                    // Create minimal points array to preserve realPlantCount
                    const minimalPoints: PlantPoint[] =
                        realPlantCount > 0
                            ? [
                                  {
                                      id: 'dummy-point-for-count',
                                      lat: 0,
                                      lng: 0,
                                      cropType: selectedCrops[0] || 'unknown',
                                      isValid: false,
                                  },
                              ]
                            : [];

                    // Preserve real count and real points in further optimized data
                    (minimalPoints as PlantPointArrayWithRealCount).__realCount = realPlantCount;
                    (minimalPoints as PlantPointArrayWithRealCount).__realPoints = realPlantPoints;

                    const furtherOptimizedData = {
                        ...optimizedData,
                        plantPoints: minimalPoints,
                        realPlantCount: realPlantCount,
                    };

                    const furtherOptimizedString = JSON.stringify(furtherOptimizedData);
                    const furtherOptimizedSizeKB = new Blob([furtherOptimizedString]).size / 1024;

                    if (furtherOptimizedSizeKB > 5000) {
                        // Use minimal points array to preserve realPlantCount
                        const minimalPoints: PlantPoint[] =
                            realPlantCount > 0
                                ? [
                                      {
                                          id: 'dummy-point-for-count',
                                          lat: 0,
                                          lng: 0,
                                          cropType: selectedCrops[0] || 'unknown',
                                          isValid: false,
                                      },
                                  ]
                                : [];

                        // Preserve real count and real points in sampled data
                        (minimalPoints as PlantPointArrayWithRealCount).__realCount =
                            realPlantCount;
                        (minimalPoints as PlantPointArrayWithRealCount).__realPoints =
                            realPlantPoints;
                        const finalData = {
                            ...furtherOptimizedData,
                            plantPoints: minimalPoints,
                            realPlantCount: realPlantCount,
                        };
                        safeSetItem('fieldCropData', finalData);
                    } else {
                        localStorage.setItem('fieldCropData', furtherOptimizedString);
                    }
                } else {
                    localStorage.setItem('fieldCropData', optimizedString);
                }
            } else {
                localStorage.setItem('fieldCropData', dataString);
            }
        } catch {
            // Error saving field data to localStorage

            // Try to save minimal data as fallback
            try {
                // Create minimal points array to preserve realPlantCount
                const minimalPoints: PlantPoint[] =
                    realPlantCount > 0
                        ? [
                              {
                                  id: 'dummy-point-for-count',
                                  lat: 0,
                                  lng: 0,
                                  cropType: selectedCrops[0] || 'unknown',
                                  isValid: false,
                              },
                          ]
                        : [];

                // Preserve real count and real points in fallback optimized data
                (minimalPoints as PlantPointArrayWithRealCount).__realCount = realPlantCount;
                (minimalPoints as PlantPointArrayWithRealCount).__realPoints = realPlantPoints;

                const minimalData = {
                    mainArea: fieldData.mainArea.map((coord) => ({
                        lat: Math.round(coord.lat * 100000) / 100000,
                        lng: Math.round(coord.lng * 100000) / 100000,
                    })),
                    obstacles: fieldData.obstacles.map((obs) => ({
                        ...obs,
                        coordinates: obs.coordinates.map((coord) => ({
                            lat: Math.round(coord.lat * 100000) / 100000,
                            lng: Math.round(coord.lng * 100000) / 100000,
                        })),
                    })),
                    plantPoints: minimalPoints,
                    realPlantCount: realPlantCount,
                    areaRai: fieldData.areaRai,
                    perimeterMeters: fieldData.perimeterMeters,
                    calculatedRows: fieldData.calculatedRows || 0,
                    calculatedColumns: fieldData.calculatedColumns || 0,
                    rowSpacing: fieldData.rowSpacing,
                    plantSpacing: fieldData.plantSpacing,
                    mapCenter: fieldData.mapCenter,
                    mapZoom: fieldData.mapZoom,
                };
                safeSetItem('fieldCropData', minimalData);
            } catch {
                // Failed to save even minimal data
                // Clear localStorage and try again
                try {
                    localStorage.clear();
                    // Create minimal points array to preserve realPlantCount
                    const minimalPoints: PlantPoint[] =
                        realPlantCount > 0
                            ? [
                                  {
                                      id: 'dummy-point-for-count',
                                      lat: 0,
                                      lng: 0,
                                      cropType: selectedCrops[0] || 'unknown',
                                      isValid: false,
                                  },
                              ]
                            : [];

                    // Preserve real count and real points in heavily optimized data
                    (minimalPoints as PlantPointArrayWithRealCount).__realCount = realPlantCount;
                    (minimalPoints as PlantPointArrayWithRealCount).__realPoints = realPlantPoints;

                    const minimalData = {
                        mainArea: fieldData.mainArea.map((coord) => ({
                            lat: Math.round(coord.lat * 100000) / 100000,
                            lng: Math.round(coord.lng * 100000) / 100000,
                        })),
                        obstacles: fieldData.obstacles.map((obs) => ({
                            ...obs,
                            coordinates: obs.coordinates.map((coord) => ({
                                lat: Math.round(coord.lat * 100000) / 100000,
                                lng: Math.round(coord.lng * 100000) / 100000,
                            })),
                        })),
                        plantPoints: minimalPoints,
                        realPlantCount: realPlantCount,
                        areaRai: fieldData.areaRai,
                        perimeterMeters: fieldData.perimeterMeters,
                        calculatedRows: fieldData.calculatedRows || 0,
                        calculatedColumns: fieldData.calculatedColumns || 0,
                        rowSpacing: fieldData.rowSpacing,
                        plantSpacing: fieldData.plantSpacing,
                        mapCenter: fieldData.mapCenter,
                        mapZoom: fieldData.mapZoom,
                    };
                    safeSetItem('fieldCropData', minimalData);
                } catch {
                    // Failed to clear localStorage
                }
            }
        }

        const params = {
            crops: selectedCrops.join(','),
            currentStep: 2,
            completedSteps: toCompletedStepsCsv(newCompleted),
        };
        router.get('/step2-irrigation-system', params);
    };

    const isStepAccessible = (stepId: number): boolean => {
        if (stepId === 1) return true;
        if (stepId === activeStep) return false;
        return completed.includes(stepId) || completed.includes(stepId - 1);
    };

    const getStepStatus = (stepId: number): 'completed' | 'active' | 'accessible' | 'disabled' => {
        if (completed.includes(stepId)) return 'completed';
        if (stepId === activeStep) return 'active';
        if (stepId === 1) return 'accessible';
        if (completed.includes(stepId - 1)) return 'accessible';
        return 'disabled';
    };

    const obstacleCount = useMemo(() => obstacles.length, [obstacles]);
    const hasWaterSource = useMemo(
        () => obstacles.some((o) => o.type === 'water_source'),
        [obstacles]
    );

    return (
        <>
            <Head title={t('Initial Area Setup')} />

            <div
                className="min-h-screen overflow-hidden text-white"
                style={{ backgroundColor: '#000005' }}
            >
                <Navbar />

                <div className="h-[calc(100vh-4rem)] overflow-hidden">
                    <div className="flex h-full">
                        {/* Left Side - Control Panel */}
                        <div
                            className="flex w-80 flex-col border-r border-white"
                            style={{ backgroundColor: '#000005' }}
                        >
                            {/* Header with Step Navigation */}
                            <div className="border-b border-white p-4">
                                <button
                                    onClick={handleBackToCropSelection}
                                    className="mb-4 flex items-center text-sm text-blue-400 hover:text-blue-300"
                                >
                                    <svg
                                        className="mr-2 h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 19l-7-7 7-7"
                                        />
                                    </svg>
                                    {t('Back to Crop Selection')}
                                </button>

                                <div className="mb-3">
                                    <h1 className="text-lg font-bold text-white">
                                        {steps.find((s) => s.id === activeStep)?.title}
                                    </h1>
                                </div>

                                {/* Step Navigation */}
                                <div className="mb-4 flex items-center justify-between">
                                    {steps.map((step, index) => {
                                        const status = getStepStatus(step.id);
                                        const isClickable = isStepAccessible(step.id);

                                        return (
                                            <div key={step.id} className="flex items-center">
                                                <button
                                                    onClick={() =>
                                                        isClickable && handleStepClick(step)
                                                    }
                                                    disabled={!isClickable}
                                                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                                                        status === 'completed'
                                                            ? 'cursor-pointer bg-green-600 text-white hover:bg-green-500'
                                                            : status === 'active'
                                                              ? 'cursor-not-allowed bg-blue-600 text-white'
                                                              : status === 'accessible'
                                                                ? 'cursor-pointer bg-gray-600 text-white hover:bg-gray-500'
                                                                : 'cursor-not-allowed bg-gray-700 text-gray-400'
                                                    }`}
                                                >
                                                    {status === 'completed' ? (
                                                        <svg
                                                            className="h-3 w-3"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                    ) : (
                                                        step.id
                                                    )}
                                                </button>

                                                {index < steps.length - 1 && (
                                                    <div
                                                        className={`mx-2 h-0.5 w-8 ${completed.includes(step.id) ? 'bg-green-600' : 'bg-gray-600'}`}
                                                    ></div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="space-y-6 p-4">
                                    {/* Selected Crops */}
                                    {selectedCrops.length > 0 && (
                                        <div className="rounded-lg border border-white p-4">
                                            <h3 className="mb-3 text-sm font-semibold text-white">
                                                {t('Selected Crops')}
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedCrops.map((crop, idx) => {
                                                    const cropData = getCropByValue(crop);
                                                    const translatedCrop = getTranslatedCropByValue(
                                                        crop,
                                                        language as 'en' | 'th'
                                                    );
                                                    return (
                                                        <span
                                                            key={idx}
                                                            className="flex items-center gap-1 rounded border border-white bg-blue-600 px-3 py-1 text-xs text-white"
                                                        >
                                                            <span className="text-sm">
                                                                {cropData?.icon || '🌱'}
                                                            </span>
                                                            <span>
                                                                {translatedCrop?.name || crop}
                                                            </span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Crop Spacing Settings */}
                                    {selectedCrops.length > 0 && (
                                        <div className="rounded-lg border border-white p-4">
                                            <div className="mb-3 flex items-center justify-between">
                                                <h3 className="text-sm font-semibold text-white">
                                                    {t('Crop Spacing Settings')}
                                                </h3>
                                                <button
                                                    onClick={resetSpacingToDefaults}
                                                    className="rounded bg-gray-600 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-500"
                                                    title={t('Reset Defaults')}
                                                >
                                                    ↺ {t('Reset Defaults')}
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                {selectedCrops.map((crop) => {
                                                    const spacingInfo = getCropSpacingInfo(crop);
                                                    const isEditingRow =
                                                        editingRowSpacingForCrop === crop;
                                                    const isEditingPlant =
                                                        editingPlantSpacingForCrop === crop;
                                                    return (
                                                        <div
                                                            key={crop}
                                                            className="rounded border border-gray-600 p-3"
                                                        >
                                                            <div className="mb-2 text-xs font-semibold text-blue-300">
                                                                {spacingInfo.cropName}
                                                            </div>
                                                            {/* Row Spacing */}
                                                            <div className="mb-2 flex items-center justify-between">
                                                                <span className="text-xs text-gray-400">
                                                                    {t('Row Spacing')}:
                                                                </span>
                                                                {isEditingRow ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="number"
                                                                            value={
                                                                                tempRowSpacing[
                                                                                    crop
                                                                                ] || ''
                                                                            }
                                                                            onChange={(e) =>
                                                                                setTempRowSpacing(
                                                                                    (prev) => ({
                                                                                        ...prev,
                                                                                        [crop]: e
                                                                                            .target
                                                                                            .value,
                                                                                    })
                                                                                )
                                                                            }
                                                                            className="w-16 rounded border border-gray-500 bg-gray-700 px-1 text-xs text-white"
                                                                            autoFocus
                                                                            onKeyPress={(e) => {
                                                                                if (
                                                                                    e.key ===
                                                                                    'Enter'
                                                                                )
                                                                                    handleRowSpacingConfirm(
                                                                                        crop
                                                                                    );
                                                                                if (
                                                                                    e.key ===
                                                                                    'Escape'
                                                                                )
                                                                                    handleRowSpacingCancel(
                                                                                        crop
                                                                                    );
                                                                            }}
                                                                        />
                                                                        <button
                                                                            onClick={() =>
                                                                                handleRowSpacingConfirm(
                                                                                    crop
                                                                                )
                                                                            }
                                                                            className="text-xs text-green-400 hover:text-green-300"
                                                                        >
                                                                            ✓
                                                                        </button>
                                                                        <button
                                                                            onClick={() =>
                                                                                handleRowSpacingCancel(
                                                                                    crop
                                                                                )
                                                                            }
                                                                            className="text-xs text-red-400 hover:text-red-300"
                                                                        >
                                                                            ✗
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() =>
                                                                            handleRowSpacingEdit(
                                                                                crop
                                                                            )
                                                                        }
                                                                        className={`rounded px-1 text-xs transition-colors hover:bg-gray-600 ${spacingInfo.isRowModified ? 'text-yellow-400' : 'text-white'}`}
                                                                    >
                                                                        {spacingInfo.rowSpacing}cm{' '}
                                                                        {spacingInfo.isRowModified &&
                                                                            ' *'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {/* Plant Spacing */}
                                                            <div className="mb-2 flex items-center justify-between">
                                                                <span className="text-xs text-gray-400">
                                                                    {t('Plant Spacing')}:
                                                                </span>
                                                                {isEditingPlant ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="number"
                                                                            value={
                                                                                tempPlantSpacing[
                                                                                    crop
                                                                                ] || ''
                                                                            }
                                                                            onChange={(e) =>
                                                                                setTempPlantSpacing(
                                                                                    (prev) => ({
                                                                                        ...prev,
                                                                                        [crop]: e
                                                                                            .target
                                                                                            .value,
                                                                                    })
                                                                                )
                                                                            }
                                                                            className="w-16 rounded border border-gray-500 bg-gray-700 px-1 text-xs text-white"
                                                                            autoFocus
                                                                            onKeyPress={(e) => {
                                                                                if (
                                                                                    e.key ===
                                                                                    'Enter'
                                                                                )
                                                                                    handlePlantSpacingConfirm(
                                                                                        crop
                                                                                    );
                                                                                if (
                                                                                    e.key ===
                                                                                    'Escape'
                                                                                )
                                                                                    handlePlantSpacingCancel(
                                                                                        crop
                                                                                    );
                                                                            }}
                                                                        />
                                                                        <button
                                                                            onClick={() =>
                                                                                handlePlantSpacingConfirm(
                                                                                    crop
                                                                                )
                                                                            }
                                                                            className="text-xs text-green-400 hover:text-green-300"
                                                                        >
                                                                            ✓
                                                                        </button>
                                                                        <button
                                                                            onClick={() =>
                                                                                handlePlantSpacingCancel(
                                                                                    crop
                                                                                )
                                                                            }
                                                                            className="text-xs text-red-400 hover:text-red-300"
                                                                        >
                                                                            ✗
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() =>
                                                                            handlePlantSpacingEdit(
                                                                                crop
                                                                            )
                                                                        }
                                                                        className={`rounded px-1 text-xs transition-colors hover:bg-gray-600 ${spacingInfo.isPlantModified ? 'text-yellow-400' : 'text-white'}`}
                                                                    >
                                                                        {spacingInfo.plantSpacing}cm{' '}
                                                                        {spacingInfo.isPlantModified &&
                                                                            ' *'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {/* Plant Density removed as requested */}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="mt-3 text-xs text-yellow-400">
                                                * {t('Modified spacing')}
                                            </div>
                                        </div>
                                    )}

                                    {/* Main Area Control */}
                                    <div className="rounded-lg border border-white p-4">
                                        <h3 className="mb-3 text-sm font-semibold text-white">
                                            🎯 {t('Main Area')}
                                        </h3>
                                        {!isMainAreaSet ? (
                                            <div className="space-y-3">
                                                <div className="rounded bg-blue-900 bg-opacity-30 p-2 text-xs text-blue-300">
                                                    🔍{' '}
                                                    {t(
                                                        'Please draw the main farming area using the tools on the map'
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {t('Status')}:{' '}
                                                    <span className="text-yellow-400">
                                                        {t('Waiting for area')}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div>
                                                    <div
                                                        className={`mb-3 rounded p-2 text-xs ${isEditingMainArea ? 'bg-yellow-900 bg-opacity-30 text-yellow-300' : 'bg-green-900 bg-opacity-30 text-green-300'}`}
                                                    >
                                                        {isEditingMainArea
                                                            ? '✏️ ' +
                                                              t(
                                                                  'Editing main area shape - drag points to modify'
                                                              )
                                                            : '✅ ' +
                                                              t(
                                                                  'Main area has been set successfully'
                                                              )}
                                                    </div>
                                                    <div className="space-y-2 border-t border-gray-700 pt-3 text-xs">
                                                        <h4 className="mb-2 text-sm font-semibold text-white">
                                                            📊 {t('Field Information')}
                                                        </h4>
                                                        <div className="flex justify-between text-gray-400">
                                                            <span>{t('Total Area')}:</span>
                                                            <span>
                                                                {areaRai !== null
                                                                    ? areaRai.toFixed(2)
                                                                    : '--'}{' '}
                                                                {t('rai')}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-gray-400">
                                                            <span>{t('Perimeter')}:</span>
                                                            <span>
                                                                {perimeterMeters !== null
                                                                    ? perimeterMeters.toFixed(1)
                                                                    : '--'}{' '}
                                                                {t('meters')}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-gray-400">
                                                            <span>{t('Main Area')}:</span>
                                                            {mainArea.length >= 3 ? (
                                                                <span className="text-green-400">
                                                                    ✅ {t('Set')}
                                                                </span>
                                                            ) : (
                                                                <span className="text-yellow-400">
                                                                    ⏳ {t('Not Set')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    {!isEditingMainArea ? (
                                                        <button
                                                            onClick={editMainArea}
                                                            className="flex-1 rounded bg-blue-600 px-3 py-2 text-xs text-white transition-colors hover:bg-blue-700"
                                                        >
                                                            ✏️ {t('Edit Shape')}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={confirmMainArea}
                                                            className="flex-1 rounded bg-green-600 px-3 py-2 text-xs text-white transition-colors hover:bg-green-700"
                                                        >
                                                            ✅ {t('Confirm Shape')}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={clearArea}
                                                        className="flex-1 rounded bg-orange-600 px-3 py-2 text-xs text-white transition-colors hover:bg-orange-700"
                                                    >
                                                        🗑️ {t('Clear Area')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Obstacles Controls */}
                                    <div className="rounded-lg border border-white p-4">
                                        <h3 className="mb-3 text-sm font-semibold text-white">
                                            🚧 {t('Obstacles & Features')}
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-gray-400">
                                                    {t('Total Obstacles')}:
                                                </span>
                                                <span className="text-yellow-300">
                                                    {obstacleCount}
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="text-xs text-blue-200">
                                                    💧 {t('Water Source')}:
                                                </div>
                                                <div className="grid grid-cols-3 gap-1">
                                                    <button
                                                        onClick={() =>
                                                            startDrawingObstacle(
                                                                'water_source',
                                                                'polygon'
                                                            )
                                                        }
                                                        disabled={
                                                            isDrawingObstacle || !isMainAreaSet
                                                        }
                                                        className="flex items-center justify-center gap-1 rounded bg-blue-600 px-1 py-1 text-xs text-white transition-colors hover:bg-blue-700 disabled:bg-gray-500"
                                                    >
                                                        <svg
                                                            className="h-3 w-3"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M4 4l16 4-4 16-12-20z"
                                                            />
                                                        </svg>
                                                        {t('Polygon')}
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            startDrawingObstacle(
                                                                'water_source',
                                                                'rectangle'
                                                            )
                                                        }
                                                        disabled={
                                                            isDrawingObstacle || !isMainAreaSet
                                                        }
                                                        className="flex items-center justify-center gap-1 rounded bg-blue-600 px-1 py-1 text-xs text-white transition-colors hover:bg-blue-700 disabled:bg-gray-500"
                                                    >
                                                        <svg
                                                            className="h-3 w-3"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <rect
                                                                x="3"
                                                                y="3"
                                                                width="18"
                                                                height="18"
                                                                rx="2"
                                                                ry="2"
                                                            />
                                                        </svg>
                                                        {t('Rectangle')}
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            startDrawingObstacle(
                                                                'water_source',
                                                                'circle'
                                                            )
                                                        }
                                                        disabled={
                                                            isDrawingObstacle || !isMainAreaSet
                                                        }
                                                        className="flex items-center justify-center gap-1 rounded bg-blue-600 px-1 py-1 text-xs text-white transition-colors hover:bg-blue-700 disabled:bg-gray-500"
                                                    >
                                                        <svg
                                                            className="h-3 w-3"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <circle cx="12" cy="12" r="10" />
                                                        </svg>
                                                        {t('Circle')}
                                                    </button>
                                                </div>
                                                <div className="text-xs text-gray-200">
                                                    🚧 {t('Other obstacles')}:
                                                </div>
                                                <div className="grid grid-cols-3 gap-1">
                                                    <button
                                                        onClick={() =>
                                                            startDrawingObstacle('other', 'polygon')
                                                        }
                                                        disabled={
                                                            isDrawingObstacle || !isMainAreaSet
                                                        }
                                                        className="flex items-center justify-center gap-1 rounded bg-gray-600 px-1 py-1 text-xs text-white transition-colors hover:bg-gray-700 disabled:bg-gray-500"
                                                    >
                                                        <svg
                                                            className="h-3 w-3"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M4 4l16 4-4 16-12-20z"
                                                            />
                                                        </svg>
                                                        {t('Polygon')}
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            startDrawingObstacle(
                                                                'other',
                                                                'rectangle'
                                                            )
                                                        }
                                                        disabled={
                                                            isDrawingObstacle || !isMainAreaSet
                                                        }
                                                        className="flex items-center justify-center gap-1 rounded bg-gray-600 px-1 py-1 text-xs text-white transition-colors hover:bg-gray-700 disabled:bg-gray-500"
                                                    >
                                                        <svg
                                                            className="h-3 w-3"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <rect
                                                                x="3"
                                                                y="3"
                                                                width="18"
                                                                height="18"
                                                                rx="2"
                                                                ry="2"
                                                            />
                                                        </svg>
                                                        {t('Rectangle')}
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            startDrawingObstacle('other', 'circle')
                                                        }
                                                        disabled={
                                                            isDrawingObstacle || !isMainAreaSet
                                                        }
                                                        className="flex items-center justify-center gap-1 rounded bg-gray-600 px-1 py-1 text-xs text-white transition-colors hover:bg-gray-700 disabled:bg-gray-500"
                                                    >
                                                        <svg
                                                            className="h-3 w-3"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <circle cx="12" cy="12" r="10" />
                                                        </svg>
                                                        {t('Circle')}
                                                    </button>
                                                </div>
                                            </div>
                                            {!isMainAreaSet && (
                                                <div className="rounded bg-orange-900 bg-opacity-30 p-2 text-xs text-orange-300">
                                                    🔒{' '}
                                                    {t(
                                                        'Please set main area before adding obstacles'
                                                    )}
                                                </div>
                                            )}
                                            {isDrawingObstacle && (
                                                <button
                                                    onClick={stopDrawingObstacle}
                                                    className="w-full rounded bg-red-600 px-3 py-2 text-xs text-white transition-colors hover:bg-red-700"
                                                >
                                                    {t('Cancel Drawing')}
                                                </button>
                                            )}
                                            {obstacleCount > 0 && (
                                                <>
                                                    <div className="rounded bg-blue-900 bg-opacity-30 p-2 text-xs text-blue-300">
                                                        🔍 {t('Obstacle Layers')}
                                                    </div>
                                                    <div className="max-h-32 space-y-1 overflow-y-auto">
                                                        {obstacles.map((obstacle, index) => (
                                                            <div
                                                                key={obstacle.id}
                                                                className="flex items-center justify-between rounded border-l-4 bg-gray-800 p-2 text-xs"
                                                                style={{
                                                                    borderLeftColor:
                                                                        obstacle.type ===
                                                                        'water_source'
                                                                            ? '#3b82f6'
                                                                            : '#6b7280',
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-lg">
                                                                        {obstacle.type ===
                                                                        'water_source'
                                                                            ? '💧'
                                                                            : '🚧'}
                                                                    </span>
                                                                    <div>
                                                                        <div className="font-medium text-white">
                                                                            {obstacle.type ===
                                                                            'water_source'
                                                                                ? t('Water Source')
                                                                                : t(
                                                                                      'Obstacle'
                                                                                  )}{' '}
                                                                            {index + 1}
                                                                        </div>
                                                                        <div className="text-xs text-gray-400">
                                                                            {
                                                                                obstacle.coordinates
                                                                                    .length
                                                                            }{' '}
                                                                            {t('points')}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() =>
                                                                        deleteObstacle(obstacle.id)
                                                                    }
                                                                    className="rounded px-2 py-1 text-red-400 hover:bg-red-900 hover:bg-opacity-30 hover:text-red-300"
                                                                    title={t('Delete obstacle')}
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={clearObstacles}
                                                        className="w-full rounded bg-red-600 px-3 py-2 text-xs text-white transition-colors hover:bg-red-700"
                                                    >
                                                        🗑️ {t('Clear All Obstacles')}
                                                    </button>
                                                </>
                                            )}
                                            {obstacleCount === 0 && isMainAreaSet && (
                                                <div className="rounded bg-orange-900 bg-opacity-30 p-2 text-xs text-orange-300">
                                                    💡{' '}
                                                    {t(
                                                        'Draw obstacles like water sources, rocks, or buildings within the main area'
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Plant Points Controls */}
                                    <div className="rounded-lg border border-white p-4">
                                        <h3 className="mb-3 text-sm font-semibold text-white">
                                            🌱 {t('Plant Points')}
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleGeneratePlantPoints}
                                                    disabled={isGeneratingPlants || !isMainAreaSet}
                                                    className="flex-1 rounded bg-green-600 px-3 py-2 text-xs text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-500"
                                                >
                                                    {isGeneratingPlants
                                                        ? t('Calculating...')
                                                        : t('Calculate Plant Count')}
                                                </button>
                                                {realPlantCount > 0 && (
                                                    <button
                                                        onClick={clearPlantPoints}
                                                        className="rounded bg-red-600 px-3 py-2 text-xs text-white transition-colors hover:bg-red-700"
                                                    >
                                                        {t('Clear')}
                                                    </button>
                                                )}
                                            </div>
                                            {!isMainAreaSet && (
                                                <div className="rounded bg-orange-900 bg-opacity-30 p-2 text-xs text-orange-300">
                                                    🔒{' '}
                                                    {t(
                                                        'Please set main area before calculating plant count'
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-gray-400">
                                                    {t('Total Plant Count')}:
                                                </span>
                                                <span className="text-green-300">
                                                    {realPlantCount}
                                                </span>
                                            </div>
                                            {realPlantCount > 0 && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-400">
                                                            {t('Rows')}:
                                                        </span>
                                                        <span className="text-blue-300">
                                                            {calculatedRows}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-400">
                                                            {t('Max Columns')}:
                                                        </span>
                                                        <span className="text-blue-300">
                                                            {calculatedColumns}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            {waterRequirementInfo.total !== null && (
                                                <div className="rounded bg-blue-900 bg-opacity-30 p-2 text-xs text-blue-300">
                                                    💧 {t('Total Water Requirement')}:{' '}
                                                    {waterRequirementInfo.total?.toFixed(2)}{' '}
                                                    {t('liters per irrigation')}
                                                </div>
                                            )}
                                            {realPlantCount === 0 && (
                                                <div className="rounded bg-green-900 bg-opacity-30 p-2 text-xs text-green-300">
                                                    🌱{' '}
                                                    {t(
                                                        'Generate optimal planting positions based on your crop spacing settings'
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Action Buttons */}
                            <div className="border-t border-white p-4">
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleBack}
                                        className="flex-1 rounded bg-gray-600 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-500"
                                    >
                                        {t('Back')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setMainArea([]);
                                            setAreaRai(null);
                                            setPerimeterMeters(null);
                                            setIsMainAreaSet(false);
                                            setPlantPoints([]);
                                            setRealPlantPoints([]);
                                            setRealPlantCount(0);
                                            setCalculatedRows(0);
                                            setCalculatedColumns(0);
                                            setObstacles([]);
                                            setRowSpacing({});
                                            setPlantSpacing({});
                                            setMapCenter([13.7563, 100.5018]);
                                            setMapZoom(16);
                                            if (map) {
                                                if (drawnPolygonRef.current) {
                                                    detachOverlay(drawnPolygonRef.current);
                                                    drawnPolygonRef.current = null;
                                                }
                                                obstacleOverlaysRef.current.forEach((overlay) =>
                                                    overlay.setMap(null)
                                                );
                                                setObstacleOverlays([]);
                                                clearAllPlantMarkers();
                                                Object.values(
                                                    distanceOverlaysByObstacleRef.current
                                                ).forEach(({ lines, labels }) => {
                                                    lines.forEach((l) => l.setMap(null));
                                                    labels.forEach((lb) => lb.setMap(null));
                                                });
                                                setDistanceOverlaysByObstacle({});
                                            }
                                            localStorage.removeItem('fieldCropData');
                                        }}
                                        className="flex-1 rounded bg-orange-600 px-4 py-2 text-sm text-white transition-colors hover:bg-orange-500"
                                    >
                                        {t('Reset')}
                                    </button>
                                    <button
                                        onClick={handleContinue}
                                        disabled={
                                            mainArea.length < 3 ||
                                            !hasWaterSource ||
                                            realPlantCount === 0
                                        }
                                        className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-500"
                                    >
                                        {t('Next')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right Side - Google Map */}
                        <div className="relative flex-1">
                            <div
                                className="absolute inset-0 border border-white"
                                style={{ backgroundColor: '#000005' }}
                            >
                                <HorticultureMapComponent
                                    center={mapCenter}
                                    zoom={mapZoom}
                                    onMapLoad={handleMapLoad}
                                    mapOptions={{ maxZoom: 22, fullscreenControl: true }}
                                >
                                    <EnhancedHorticultureSearchControl
                                        onPlaceSelect={handleSearch}
                                        placeholder={`🔍 ${t('Search places...')}`}
                                    />
                                    <HorticultureDrawingManager
                                        editMode={null}
                                        onCreated={handleDrawingComplete}
                                        isEditModeEnabled={true}
                                        mainArea={mainArea}
                                    />

                                    {/* Drawing Tools Overlay - Only show for main area drawing */}
                                    {!isMainAreaSet && (
                                        <div className="pointer-events-none absolute left-4 top-16 z-10 rounded-lg border border-white bg-black bg-opacity-80 p-2 shadow-lg">
                                            <h4 className="mb-1 text-xs font-semibold text-white">
                                                🎯 {t('Drawing Tools')}
                                            </h4>
                                            <div className="pointer-events-auto flex flex-col gap-1">
                                                <button
                                                    onClick={() => startDrawing('polygon')}
                                                    disabled={isDrawing}
                                                    className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${isDrawing && selectedShape === 'polygon' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'} disabled:opacity-50`}
                                                >
                                                    <svg
                                                        className="h-3 w-3"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M4 4l16 4-4 16-12-20z"
                                                        />
                                                    </svg>
                                                    {t('Polygon')}
                                                </button>
                                                <button
                                                    onClick={() => startDrawing('rectangle')}
                                                    disabled={isDrawing}
                                                    className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${isDrawing && selectedShape === 'rectangle' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'} disabled:opacity-50`}
                                                >
                                                    <svg
                                                        className="h-3 w-3"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <rect
                                                            x="3"
                                                            y="3"
                                                            width="18"
                                                            height="18"
                                                            rx="2"
                                                            ry="2"
                                                        />
                                                    </svg>
                                                    {t('Rectangle')}
                                                </button>
                                                <button
                                                    onClick={() => startDrawing('circle')}
                                                    disabled={isDrawing}
                                                    className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${isDrawing && selectedShape === 'circle' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'} disabled:opacity-50`}
                                                >
                                                    <svg
                                                        className="h-3 w-3"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle cx="12" cy="12" r="10" />
                                                    </svg>
                                                    {t('Circle')}
                                                </button>
                                                {isDrawing && (
                                                    <button
                                                        onClick={stopDrawing}
                                                        className="flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs text-white transition-colors hover:bg-red-700"
                                                    >
                                                        <svg
                                                            className="h-3 w-3"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M6 18L18 6M6 6l12 12"
                                                            />
                                                        </svg>
                                                        {t('Cancel')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <DistanceMeasurementOverlay
                                        map={map}
                                        isActive={false}
                                        editMode={'mainArea'}
                                    />
                                </HorticultureMapComponent>

                                {/* Overlays */}
                                {isDrawing && !isMainAreaSet && (
                                    <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-lg border border-blue-500 bg-blue-900 bg-opacity-90 p-3 shadow-lg">
                                        <div className="text-center text-sm text-white">
                                            <div className="mb-1 font-semibold">
                                                🎯 {t('Drawing Mode Active')}
                                            </div>
                                            <div className="text-xs text-blue-200">
                                                {selectedShape === 'polygon'
                                                    ? t(
                                                          'Click points to draw polygon, double-click to finish'
                                                      )
                                                    : selectedShape === 'rectangle'
                                                      ? t('Click and drag to draw rectangle')
                                                      : t('Click and drag to draw circle')}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {isEditingMainArea && (
                                    <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-lg border border-yellow-500 bg-yellow-900 bg-opacity-90 p-3 shadow-lg">
                                        <div className="text-center text-sm text-white">
                                            <div className="mb-1 font-semibold">
                                                ✏️ {t('Editing Main Area')}
                                            </div>
                                            <div className="text-xs text-yellow-200">
                                                {t('Drag the white points to modify the shape')}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="absolute right-16 top-2.5 z-10 rounded-lg border border-white bg-black bg-opacity-80 p-3 text-xs">
                                    <div className="flex gap-2 text-white">
                                        <span>Lat: {mapCenter[0].toFixed(4)}</span>
                                        <span>Lng: {mapCenter[1].toFixed(4)}</span>
                                    </div>
                                </div>

                                {isDrawingObstacle && (
                                    <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-lg border border-purple-500 bg-purple-900 bg-opacity-90 p-3 shadow-lg">
                                        <div className="text-center text-sm text-white">
                                            <div className="mb-1 font-semibold">
                                                🚧 {t('Drawing Obstacle')}
                                            </div>
                                            <div className="text-xs text-purple-200">
                                                {t('Drawing')}:{' '}
                                                {selectedObstacleType.replace('_', ' ')} (
                                                {selectedObstacleShape})
                                            </div>
                                            <div className="text-xs text-purple-200">
                                                {selectedObstacleShape === 'polygon'
                                                    ? t(
                                                          'Click points to draw polygon, double-click to finish'
                                                      )
                                                    : selectedObstacleShape === 'rectangle'
                                                      ? t('Click and drag to draw rectangle')
                                                      : t('Click and drag to draw circle')}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {isGeneratingPlants && (
                                    <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-lg border border-green-500 bg-green-900 bg-opacity-90 p-3 shadow-lg">
                                        <div className="text-center text-sm text-white">
                                            <div className="mb-1 font-semibold">
                                                🌱 {t('Generating Plants')}
                                            </div>
                                            <div className="text-xs text-green-200">
                                                {t('Calculating optimal plant positions...')}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
