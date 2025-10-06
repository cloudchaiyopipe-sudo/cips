import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import Navbar from '../../components/Navbar';
import { useLanguage } from '../../contexts/LanguageContext';
import HorticultureMapComponent from '../../components/horticulture/HorticultureMapComponent';
import { getCropByValue } from './choose-crop';
import { parseCompletedSteps, toCompletedStepsCsv } from '../../utils/stepUtils';
import {
    FieldCropPageProps,
    FieldData,
    Coordinate, 
    Obstacle, 
    PlantPoint,
    IrrigationPositions, 
    IrrigationSettings,
} from '../../types/fieldCropTypes';
import { useFieldData } from '../../hooks/useFieldData';

<<<<<<< HEAD
// Zone interface removed - zones are handled in zone-obstacle page only

interface Obstacle {
    id: string;
    coordinates: { lat: number; lng: number }[];
    type: 'water_source' | 'other' | 'building' | 'rock';
    name?: string;
}
=======
// Using standardized types from fieldCropTypes.ts
>>>>>>> main

interface StepData {
    id: number;
    key: string;
    title: string;
    description: string;
    route: string;
}

<<<<<<< HEAD
interface IrrigationPositions {
    sprinklers: { lat: number; lng: number }[];
    pivots: { lat: number; lng: number }[];
    dripTapes: { lat: number; lng: number }[];
    waterJets: { lat: number; lng: number }[];
}

=======
>>>>>>> main
// Debug logger toggle (set to true only when actively debugging rendering)
const __DEBUG_LOGS__ = false;
const dbg = (...args: unknown[]) => {
    if (__DEBUG_LOGS__) console.log(...args);
};

// Helper function to safely save data to localStorage with size optimization
const safeSetItem = (key: string, data: unknown, maxSizeKB: number = 5000) => {
    try {
        const dataString = JSON.stringify(data);
        const dataSizeKB = new Blob([dataString]).size / 1024;

        if (dataSizeKB > maxSizeKB) {
<<<<<<< HEAD
            console.warn(
                `Data size (${dataSizeKB.toFixed(2)}KB) exceeds limit (${maxSizeKB}KB), optimizing...`
            );
=======
            // Data size exceeds limit, optimizing...
>>>>>>> main

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
                irrigationPositions: (() => {
                    const irrigationPos = dataObj.irrigationPositions as Record<string, unknown>;
                    return {
                        sprinklers: Array.isArray(irrigationPos?.sprinklers)
                            ? irrigationPos.sprinklers.map((pos: unknown) => {
                                  const p = pos as { lat: number; lng: number };
                                  return {
                                      lat: Math.round(p.lat * 1000000) / 1000000,
                                      lng: Math.round(p.lng * 1000000) / 1000000,
                                  };
                              })
                            : [],
                        pivots: Array.isArray(irrigationPos?.pivots)
                            ? irrigationPos.pivots.map((pos: unknown) => {
                                  const p = pos as { lat: number; lng: number };
                                  return {
                                      lat: Math.round(p.lat * 1000000) / 1000000,
                                      lng: Math.round(p.lng * 1000000) / 1000000,
                                  };
                              })
                            : [],
<<<<<<< HEAD
                        dripTapes: Array.isArray(irrigationPos?.dripTapes)
                            ? irrigationPos.dripTapes.map((pos: unknown) => {
                                  const p = pos as { lat: number; lng: number };
                                  return {
                                      lat: Math.round(p.lat * 1000000) / 1000000,
                                      lng: Math.round(p.lng * 1000000) / 1000000,
                                  };
                              })
                            : [],
                        waterJets: Array.isArray(irrigationPos?.waterJets)
                            ? irrigationPos.waterJets.map((pos: unknown) => {
                                  const p = pos as { lat: number; lng: number };
                                  return {
                                      lat: Math.round(p.lat * 1000000) / 1000000,
                                      lng: Math.round(p.lng * 1000000) / 1000000,
                                  };
                              })
                            : [],
=======
>>>>>>> main
                    };
                })(),
            };

            const optimizedString = JSON.stringify(optimizedData);
            const optimizedSizeKB = new Blob([optimizedString]).size / 1024;

            if (optimizedSizeKB > maxSizeKB) {
<<<<<<< HEAD
                console.warn(
                    'Data still too large after optimization, further reducing plant points...'
                );
=======
                // Data still too large after optimization, further reducing plant points...
>>>>>>> main
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
<<<<<<< HEAD
                    console.warn('Data still too large, sampling plant points...');
=======
                    // Data still too large, sampling plant points...
>>>>>>> main
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
<<<<<<< HEAD
    } catch (error) {
        console.error('Error saving to localStorage:', error);
=======
    } catch {
        // Error saving to localStorage
>>>>>>> main
        return false;
    }
};

<<<<<<< HEAD
export default function IrrigationGenerate({
    selectedCrops = [],
    mainArea = [],
    obstacles = [],
    mapCenter = { lat: 13.7563, lng: 100.5018 },
    mapZoom = 18,
    crops,
    currentStep = 2,
    completedSteps = '',
    mainAreaData,
    obstaclesData,
    plantPointsData,
    areaRai,
    perimeterMeters,
    rotationAngle,
    rowSpacing,
    plantSpacing,
}: {
    selectedCrops?: string[];
    mainArea?: { lat: number; lng: number }[];
    obstacles?: Obstacle[];
    mapCenter?: { lat: number; lng: number };
    mapZoom?: number;
    crops?: string;
    currentStep?: number;
    completedSteps?: string;
    mainAreaData?: string;
    obstaclesData?: string;
    plantPointsData?: string;
    areaRai?: string;
    perimeterMeters?: string;
    rotationAngle?: string;
    rowSpacing?: string;
    plantSpacing?: string;
}) {
    const { t } = useLanguage();
=======
export default function IrrigationGenerate(props: FieldCropPageProps) {
    const {
        crops,
        currentStep = 2,
        completedSteps = '',
        mainArea: mainAreaData,
        obstacles: obstaclesData,
        plantPoints: plantPointsData,
        areaRai,
        perimeterMeters,
        rotationAngle,
        rowSpacing,
        plantSpacing,
    } = props;
    const { t } = useLanguage();
    
    // Use standardized field data management
    const { fieldData, updateFieldData } = useFieldData(props);
>>>>>>> main

    // Keep UI responsive during heavy loops - using inline Promise for better performance

    // Parse data from URL parameters
<<<<<<< HEAD
    const [parsedMainArea, setParsedMainArea] = useState<{ lat: number; lng: number }[]>([]);
    const [parsedObstacles, setParsedObstacles] = useState<Obstacle[]>([]);
    const [parsedPlantPoints, setParsedPlantPoints] = useState<
        { id: string; lat: number; lng: number; cropType: string; isValid: boolean }[]
    >([]);
    const [realPlantCount, setRealPlantCount] = useState<number>(0); // Track real plant count for calculations
    const [parsedAreaRai, setParsedAreaRai] = useState<number | null>(null);
    const [parsedPerimeterMeters, setParsedPerimeterMeters] = useState<number | null>(null);
    const [parsedRotationAngle, setParsedRotationAngle] = useState<number>(0);
    const [parsedRowSpacing, setParsedRowSpacing] = useState<Record<string, number>>({});
    const [parsedPlantSpacing, setParsedPlantSpacing] = useState<Record<string, number>>({});
=======
    const [parsedMainArea, setParsedMainArea] = useState<Coordinate[]>(fieldData.mainArea);
    const [parsedObstacles, setParsedObstacles] = useState<Obstacle[]>(fieldData.obstacles);
    const [parsedPlantPoints, setParsedPlantPoints] = useState<PlantPoint[]>(fieldData.plantPoints);
    const [realPlantCount, setRealPlantCount] = useState<number>(fieldData.realPlantCount || 0); // Track real plant count for calculations
    const [parsedAreaRai, setParsedAreaRai] = useState<number | null>(fieldData.areaRai);
    const [parsedPerimeterMeters, setParsedPerimeterMeters] = useState<number | null>(fieldData.perimeterMeters);
    const [parsedRotationAngle, setParsedRotationAngle] = useState<number>(fieldData.rotationAngle || 0);
    const [parsedRowSpacing, setParsedRowSpacing] = useState<Record<string, number>>(fieldData.rowSpacing);
    const [parsedPlantSpacing, setParsedPlantSpacing] = useState<Record<string, number>>(fieldData.plantSpacing);

    // Adjust rotation angle by delta (supports 0.5° increments)
    const adjustRotationAngle = useCallback((delta: number) => {
        setParsedRotationAngle((prev) => {
            const next = prev + delta;
            const clamped = Math.max(-180, Math.min(180, next));
            // round to nearest 0.5
            return Math.round(clamped * 2) / 2;
        });
    }, []);
    const [parsedSelectedCrops, setParsedSelectedCrops] = useState<string[]>(fieldData.selectedCrops);
    const [parsedMapCenter, setParsedMapCenter] = useState<{ lat: number; lng: number }>(fieldData.mapCenter);
    const [parsedMapZoom, setParsedMapZoom] = useState<number>(fieldData.mapZoom);
    const hasInitializedRef = useRef<boolean>(false);

    // Parse data on component mount
    useEffect(() => {
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;

        // On fresh page load (no URL parameters), make behavior match the Reset button
        // Treat as "Reset irrigation only" while keeping existing field data
        const hasUrlParams = !!(
            crops ||
            completedSteps ||
            mainAreaData ||
            obstaclesData ||
            plantPointsData ||
            areaRai ||
            perimeterMeters ||
            rotationAngle ||
            rowSpacing ||
            plantSpacing
        );

        if (!hasUrlParams) {
            try {
                const fieldDataStr = localStorage.getItem('fieldCropData');
                if (fieldDataStr) {
                    const fieldData = JSON.parse(fieldDataStr) as FieldData;

                    // Load field data first before sanitizing
                    if (fieldData.mainArea) {
                        dbg(
                            'Loading mainArea from localStorage:',
                            fieldData.mainArea.length,
                            'points'
                        );
                        setParsedMainArea(fieldData.mainArea);
                    }

                    if (fieldData.obstacles) {
                        dbg(
                            'Loading obstacles from localStorage:',
                            fieldData.obstacles.length,
                            'items'
                        );
                        setParsedObstacles(fieldData.obstacles);
                    }

                    if (fieldData.plantPoints) {
                        dbg(
                            'Loading plantPoints from localStorage:',
                            fieldData.plantPoints.length,
                            'points'
                        );
                        setParsedPlantPoints(fieldData.plantPoints);
                    }

                    // Load realPlantCount from localStorage on fresh load
                    if (
                        typeof fieldData.realPlantCount === 'number' &&
                        fieldData.realPlantCount > 0
                    ) {
                        setRealPlantCount(fieldData.realPlantCount);
                    } else if (fieldData.plantPoints) {
                        // Fallback to plantPoints.__realCount
                        const plantPointsWithRealCount =
                            fieldData.plantPoints as typeof fieldData.plantPoints & {
                                __realCount?: number;
                            };
                        const realCount =
                            plantPointsWithRealCount.__realCount || fieldData.plantPoints.length;
                        setRealPlantCount(realCount);
                    }

                    if (fieldData.areaRai) {
                        dbg('Loading areaRai from localStorage:', fieldData.areaRai);
                        setParsedAreaRai(fieldData.areaRai);
                    }

                    if (fieldData.perimeterMeters) {
                        dbg(
                            'Loading perimeterMeters from localStorage:',
                            fieldData.perimeterMeters
                        );
                        setParsedPerimeterMeters(fieldData.perimeterMeters);
                    }

                    // Initialize rotation angle to 0 on fresh load
                    dbg('Initializing rotationAngle to 0 on fresh load');
                    setParsedRotationAngle(0);

                    if (fieldData.rowSpacing) {
                        dbg('Loading rowSpacing from localStorage:', fieldData.rowSpacing);
                        setParsedRowSpacing(fieldData.rowSpacing);
                    }

                    if (fieldData.plantSpacing) {
                        dbg('Loading plantSpacing from localStorage:', fieldData.plantSpacing);
                        setParsedPlantSpacing(fieldData.plantSpacing);
                    }

                    if (fieldData.selectedCrops) {
                        dbg('Loading selectedCrops from localStorage:', fieldData.selectedCrops);
                        setParsedSelectedCrops(fieldData.selectedCrops);
                    }

                    // Load map state
                    if (fieldData.mapCenter) {
                        dbg('Loading mapCenter from localStorage:', fieldData.mapCenter);
                        setParsedMapCenter(fieldData.mapCenter);
                    }

                    if (fieldData.mapZoom) {
                        dbg('Loading mapZoom from localStorage:', fieldData.mapZoom);
                        setParsedMapZoom(fieldData.mapZoom);
                    }

                    // Then sanitize irrigation data
                    const sanitized: FieldData = {
                        ...(fieldData || {}),
                        selectedIrrigationType: '',
                        irrigationCounts: {
                            sprinkler_system: 0,
                            pivot: 0,
                        },
                        irrigationSettings: {
                            sprinkler_system: {
                                coverageRadius: 8,
                                overlap: 0,
                                flow: 10,
                                pressure: 2.5,
                            },
                            pivot: { coverageRadius: 165, overlap: 0, flow: 50, pressure: 3.0 },
                        },
                        irrigationPositions: {
                            sprinklers: [],
                            pivots: [],
                        },
                    };
                    safeSetItem('fieldCropData', sanitized);
                }
            } catch {
                // Error sanitizing irrigation data on fresh load
            }
            // Clear irrigation overlays if map is loaded
            if (mapRef.current) {
                irrigationMarkersRef.current.forEach((marker) => marker.setMap(null));
                irrigationMarkersRef.current = [];
                irrigationCirclesRef.current.forEach((circle) => circle.setMap(null));
                irrigationCirclesRef.current = [];
            }
        }

        // Parse selectedCrops from crops parameter
        if (crops) {
            const cropList = crops.split(',').filter((crop) => crop.trim());
            setParsedSelectedCrops(cropList);
        }

        // Load data from localStorage if available (back navigation or fresh reload with stored data)
        const shouldLoadFromStorage = (() => {
            try {
                return !!localStorage.getItem('fieldCropData');
            } catch {
                return false;
            }
        })();
        if (hasUrlParams || shouldLoadFromStorage) {
            try {
                dbg('Checking localStorage for fieldCropData...');
                const fieldDataStr = localStorage.getItem('fieldCropData');
                dbg('localStorage fieldCropData:', fieldDataStr ? 'found' : 'not found');
                if (fieldDataStr) {
                    const fieldData = JSON.parse(fieldDataStr) as FieldData;
                    dbg('Loaded field data from localStorage:', fieldData);

                    if (fieldData.mainArea) {
                        dbg('Setting parsedMainArea:', fieldData.mainArea.length, 'points');
                        setParsedMainArea(fieldData.mainArea);
                    }

                    if (fieldData.obstacles) {
                        dbg('Setting parsedObstacles:', fieldData.obstacles.length, 'items');
                        dbg('Obstacles data:', fieldData.obstacles);
                        setParsedObstacles(fieldData.obstacles);
                    }

                    if (fieldData.plantPoints) {
                        dbg('Setting parsedPlantPoints:', fieldData.plantPoints.length, 'points');
                        setParsedPlantPoints(fieldData.plantPoints);
                    }

                    // Load realPlantCount from separate property first, then fallback to plantPoints.__realCount
                    if (
                        typeof fieldData.realPlantCount === 'number' &&
                        fieldData.realPlantCount > 0
                    ) {
                        setRealPlantCount(fieldData.realPlantCount);
                    } else if (fieldData.plantPoints) {
                        // Extract real count if available (from initial-area.tsx with real count)
                        const plantPointsWithRealCount =
                            fieldData.plantPoints as typeof fieldData.plantPoints & {
                                __realCount?: number;
                            };
                        const realCount =
                            plantPointsWithRealCount.__realCount || fieldData.plantPoints.length;
                        setRealPlantCount(realCount);
                        dbg('Real plant count:', realCount);
                    }

                    if (fieldData.areaRai) {
                        dbg('Setting parsedAreaRai:', fieldData.areaRai);
                        setParsedAreaRai(fieldData.areaRai);
                    }

                    if (fieldData.perimeterMeters) {
                        dbg('Setting parsedPerimeterMeters:', fieldData.perimeterMeters);
                        setParsedPerimeterMeters(fieldData.perimeterMeters);
                    }

                    if (fieldData.rotationAngle) {
                        dbg('Setting parsedRotationAngle:', fieldData.rotationAngle);
                        setParsedRotationAngle(fieldData.rotationAngle);
                    }

                    if (fieldData.rowSpacing) {
                        dbg('Setting parsedRowSpacing:', fieldData.rowSpacing);
                        setParsedRowSpacing(fieldData.rowSpacing);
                    }

                    if (fieldData.plantSpacing) {
                        dbg('Setting parsedPlantSpacing:', fieldData.plantSpacing);
                        setParsedPlantSpacing(fieldData.plantSpacing);
                    }

                    // Load map state
                    if (fieldData.mapCenter) {
                        dbg('Setting parsedMapCenter:', fieldData.mapCenter);
                        setParsedMapCenter(fieldData.mapCenter);
                    }

                    if (fieldData.mapZoom) {
                        dbg('Setting parsedMapZoom:', fieldData.mapZoom);
                        setParsedMapZoom(fieldData.mapZoom);
                    }

                    // Load irrigation data if exists
                    if (fieldData.selectedIrrigationType) {
                        setSelectedIrrigationType(fieldData.selectedIrrigationType);
                    }

                    if (fieldData.irrigationCounts) {
                        setIrrigationCounts(fieldData.irrigationCounts as typeof irrigationCounts);
                    }

                    if (fieldData.totalWaterRequirement) {
                        // Will be recalculated based on current data
                    }

                    if (fieldData.irrigationSettings) {
                        setIrrigationSettings(
                            fieldData.irrigationSettings as typeof irrigationSettings
                        );
                    }

                    if (fieldData.irrigationPositions) {
                        setIrrigationPositions(fieldData.irrigationPositions);
                    }

                    // Note: Distance overlays will be recreated from obstacle data
                    // distanceOverlaysByObstacle is not saved due to circular reference
                } else {
                    dbg('No field data found in localStorage');
                }
            } catch {
                // Error loading field data from localStorage
            }
        }
    }, [
        areaRai,
        completedSteps,
        crops,
        mainAreaData,
        obstaclesData,
        perimeterMeters,
        plantPointsData,
        plantSpacing,
        rotationAngle,
        rowSpacing,
        parsedSelectedCrops,
    ]);

    // Use parsed data or fallback to props
    const finalMainArea = useMemo(() => {
        if (parsedMainArea.length > 0) return parsedMainArea;
        if (Array.isArray(mainAreaData)) return mainAreaData;
        return [];
    }, [parsedMainArea, mainAreaData]);

    const finalObstacles = useMemo(() => {
        if (parsedObstacles.length > 0) return parsedObstacles;
        if (Array.isArray(obstaclesData)) return obstaclesData;
        return [];
    }, [parsedObstacles, obstaclesData]);
    const finalPlantPoints = useMemo(
        () => (parsedPlantPoints.length > 0 ? parsedPlantPoints : []),
        [parsedPlantPoints]
    );

    const finalAreaRai = parsedAreaRai !== null ? parsedAreaRai : null;
    const finalPerimeterMeters = parsedPerimeterMeters !== null ? parsedPerimeterMeters : null;
    const finalRotationAngle = parsedRotationAngle !== 0 ? parsedRotationAngle : 0;
    const finalRowSpacing = Object.keys(parsedRowSpacing).length > 0 ? parsedRowSpacing : {};
    const finalPlantSpacing = Object.keys(parsedPlantSpacing).length > 0 ? parsedPlantSpacing : {};
    const finalSelectedCrops = parsedSelectedCrops.length > 0 ? parsedSelectedCrops : fieldData.selectedCrops;
    const finalMapCenter =
        parsedMapCenter.lat !== 13.7563 || parsedMapCenter.lng !== 100.5018
            ? parsedMapCenter
            : fieldData.mapCenter;
    const finalMapZoom = parsedMapZoom !== 18 ? parsedMapZoom : fieldData.mapZoom;

    // (moved below irrigationPositions state)

    // Calculate map center from main area if available, or use saved position
    const calculatedMapCenter =
        finalMainArea.length >= 3
            ? {
                  lat:
                      finalMainArea.reduce((sum, coord) => sum + coord.lat, 0) /
                      finalMainArea.length,
                  lng:
                      finalMainArea.reduce((sum, coord) => sum + coord.lng, 0) /
                      finalMainArea.length,
              }
            : finalMapCenter;

    // Map references
    const mapRef = useRef<google.maps.Map | null>(null);
    const mainAreaPolygonRef = useRef<google.maps.Polygon | null>(null);
    const obstaclePolygonsRef = useRef<google.maps.Polygon[]>([]);
    const plantPointMarkersRef = useRef<google.maps.Marker[]>([]);
    const distanceOverlaysRef = useRef<
        Record<string, { lines: google.maps.Polyline[]; labels: google.maps.Marker[] }>
    >({});
    const irrigationMarkersRef = useRef<google.maps.Marker[]>([]);
    const irrigationCirclesRef = useRef<google.maps.Circle[]>([]);

    // State management
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [selectedIrrigationType, setSelectedIrrigationType] = useState<string>('');
    const [isGeneratingIrrigation, setIsGeneratingIrrigation] = useState(false);
    const [isAngleRegenerating, setIsAngleRegenerating] = useState(false);
    const [irrigationCounts, setIrrigationCounts] = useState({
        sprinkler_system: 0,
        pivot: 0,
    });

    // เพิ่ม state สำหรับเก็บตำแหน่งอุปกรณ์ irrigation
    const [irrigationPositions, setIrrigationPositions] = useState<IrrigationPositions>(fieldData.irrigationPositions);

    // Sprinkler Management States
    const [sprinklerMode, setSprinklerMode] = useState<'none' | 'add' | 'move' | 'delete'>('none');
    const [selectedSprinklers, setSelectedSprinklers] = useState<number[]>([]);

    // Require at least one generated irrigation type before proceeding
    const hasGeneratedIrrigation =
        irrigationPositions.sprinklers.length > 0 ||
        irrigationPositions.pivots.length > 0;

    // Irrigation settings for different types
    const defaultSettings: IrrigationSettings = {
        sprinkler_system: { coverageRadius: 8, overlap: 0, flow: 10, pressure: 2.5 },
        pivot: { coverageRadius: 165, overlap: 0, flow: 50, pressure: 3.0 },
    };

    const [irrigationSettings, setIrrigationSettings] = useState<IrrigationSettings>({
        ...defaultSettings,
        ...(fieldData.irrigationSettings || {})
    });

    // Type guard functions for irrigation settings
    const getSprinklerSettings = useCallback(() => irrigationSettings.sprinkler_system || defaultSettings.sprinkler_system!, [irrigationSettings.sprinkler_system, defaultSettings.sprinkler_system]);
    const getPivotSettings = useCallback(() => irrigationSettings.pivot || defaultSettings.pivot!, [irrigationSettings.pivot, defaultSettings.pivot]);

    // Calculate total water requirement
    const totalWaterRequirement = useMemo(() => {
        // Get water requirement per plant for the primary crop
        const primaryCrop = finalSelectedCrops[0];
        const crop = getCropByValue(primaryCrop);
        const waterPerPlant = crop ? crop.waterRequirement : 0;

        // Calculate total water requirement for all plants using real count
        const totalWaterRequirement = waterPerPlant * realPlantCount;

        return totalWaterRequirement;
    }, [finalSelectedCrops, realPlantCount]);

    const handleBack = () => {
        // Update completed steps automatically
        const updatedCompletedSteps = updateCompletedSteps();

        // Store the actual parsed data in localStorage to preserve all information including irrigation data
        const allData: FieldData = {
            selectedCrops: finalSelectedCrops,
            mainArea: parsedMainArea.length > 0 ? parsedMainArea : finalMainArea,
            zones: [],
            obstacles: parsedObstacles.length > 0 ? parsedObstacles : finalObstacles,
            plantPoints: parsedPlantPoints.length > 0 ? parsedPlantPoints : finalPlantPoints,
            pipes: [],
            areaRai: parsedAreaRai !== null ? parsedAreaRai : finalAreaRai,
            perimeterMeters:
                parsedPerimeterMeters !== null ? parsedPerimeterMeters : finalPerimeterMeters,
            rotationAngle: parsedRotationAngle,
            rowSpacing:
                Object.keys(parsedRowSpacing).length > 0 ? parsedRowSpacing : finalRowSpacing,
            plantSpacing:
                Object.keys(parsedPlantSpacing).length > 0 ? parsedPlantSpacing : finalPlantSpacing,
            selectedIrrigationType,
            irrigationCounts,
            totalWaterRequirement,
            irrigationSettings,
            irrigationPositions,
            mapCenter: parsedMapCenter || finalMapCenter,
            mapZoom: parsedMapZoom || finalMapZoom,
        };
        try {
            safeSetItem('fieldCropData', allData);
        } catch {
            /* ignore storage errors */
        }

        router.get('/step1-field-area', {
            crops: crops || finalSelectedCrops.join(','),
            currentStep: 1,
            completedSteps: updatedCompletedSteps,
        });
    };

    const steps: StepData[] = [
        {
            id: 1,
            key: 'initial-area',
            title: t('Initial Area'),
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

    const persistIrrigation = () => {
        try {
            const fieldDataToSave = {
                selectedCrops: finalSelectedCrops,
                mainArea: finalMainArea,
                obstacles: finalObstacles,
                plantPoints: finalPlantPoints,
                areaRai: finalAreaRai,
                perimeterMeters: finalPerimeterMeters,
                rotationAngle: finalRotationAngle,
                rowSpacing: finalRowSpacing,
                plantSpacing: finalPlantSpacing,
                mapCenter: calculatedMapCenter,
                mapZoom: finalMapZoom,
                selectedIrrigationType,
                irrigationSettings,
                irrigationCounts,
                totalWaterRequirement,
                irrigationPositions,
            };
            
            // Use standardized storage approach
            updateFieldData(fieldDataToSave);
        } catch {
            // ignore storage errors
        }
    };

    const handleStepClick = (step: StepData) => {
        // Check if all 4 steps are completed
        const parsedSteps = parseCompletedSteps(completedSteps);
        const allStepsCompleted =
            parsedSteps.length >= 4 &&
            parsedSteps.includes(1) &&
            parsedSteps.includes(2) &&
            parsedSteps.includes(3) &&
            parsedSteps.includes(4);

        // If all steps are completed, allow free navigation
        if (allStepsCompleted) {
            persistIrrigation();
            const params = {
                crops: crops || finalSelectedCrops.join(','),
                currentStep: step.id,
                completedSteps: completedSteps,
            };
            router.get(step.route, params);
            return;
        }

        // Original logic for incomplete steps
        // Gate: must generate irrigation before moving to zones
        if (step.id === 3 && !hasGeneratedIrrigation) {
            alert(t('Please generate at least one Irrigation Type before continuing to Zones'));
            return;
        }
        // Persist current irrigation state
        persistIrrigation();
        // Update completed steps before navigating
        const updatedCompletedSteps = updateCompletedSteps();

        const params = {
            crops: crops || finalSelectedCrops.join(','),
            currentStep: step.id,
            completedSteps: updatedCompletedSteps,
        };
        router.get(step.route, params);
    };

    // Helper function to check if current step is completed
    const isCurrentStepCompleted = () => {
        switch (currentStep) {
            case 1: // Initial Area
                return finalMainArea.length >= 3;
            case 2: // Irrigation Generate
                // Mark as completed if irrigation has been generated
                return hasGeneratedIrrigation;
            case 3: // Zone Obstacle
                // This will be handled in the zone-obstacle page
                return false;
            case 4: // Pipe Generate
                // This will be handled in the pipe-generate page
                return false;
            default:
                return false;
        }
    };

    // Helper function to update completed steps
    const updateCompletedSteps = () => {
        const existing = parseCompletedSteps(completedSteps);
        let result = existing;
        if (isCurrentStepCompleted()) {
            result = Array.from(new Set([...existing, currentStep]));
        }
        return toCompletedStepsCsv(result);
    };

    const handleNext = () => {
        // Guard: must generate at least one irrigation type before proceeding to zones
        if (!hasGeneratedIrrigation) {
            alert(t('Please generate at least one Irrigation Type before continuing to Zones'));
            return;
        }

        // บันทึกข้อมูล irrigation ลง localStorage
        try {
            const existingData = localStorage.getItem('fieldCropData');
            let fieldData: FieldData = existingData
                ? (JSON.parse(existingData) as FieldData)
                : {
                      selectedCrops: finalSelectedCrops,
                      mainArea: finalMainArea,
                      zones: [],
                      obstacles: finalObstacles,
                      plantPoints: finalPlantPoints,
                      pipes: [],
                      areaRai: finalAreaRai,
                      perimeterMeters: finalPerimeterMeters,
                      rotationAngle: finalRotationAngle,
                      rowSpacing: finalRowSpacing,
                      plantSpacing: finalPlantSpacing,
                      selectedIrrigationType: '',
                      irrigationCounts: {
                          sprinkler_system: 0,
                          pivot: 0,
                      },
                      totalWaterRequirement: 0,
                      irrigationSettings,
                      irrigationPositions,
                      mapCenter: calculatedMapCenter,
                      mapZoom: finalMapZoom,
                  };

            // เพิ่มข้อมูล irrigation ใหม่
            fieldData = {
                ...(fieldData || {}),
                selectedCrops: finalSelectedCrops,
                mainArea: finalMainArea,
                obstacles: finalObstacles,
                plantPoints: finalPlantPoints,
                areaRai: finalAreaRai,
                perimeterMeters: finalPerimeterMeters,
                rotationAngle: finalRotationAngle,
                rowSpacing: finalRowSpacing,
                plantSpacing: finalPlantSpacing,
                mapCenter: calculatedMapCenter,
                mapZoom: finalMapZoom,
                // Irrigation
                selectedIrrigationType,
                irrigationSettings,
                irrigationCounts,
                totalWaterRequirement,
                irrigationPositions,
            };

            safeSetItem('fieldCropData', fieldData);
        } catch {
            // Error saving irrigation data to localStorage
        }

        // Update completed steps automatically
        const updatedCompletedSteps = updateCompletedSteps();

        // ส่งข้อมูลผ่าน URL parameters (minimal)
        const params = {
            crops: crops || finalSelectedCrops.join(','),
            currentStep: 3,
            // Ensure step 2 is marked completed when proceeding to zones
            completedSteps: toCompletedStepsCsv([...parseCompletedSteps(updatedCompletedSteps), 2]),
        };

        router.get('/step3-zones-obstacles', params);
    };

    // Helper function to calculate point size based on point count
    const calculatePointSize = useCallback((pointCount: number): number => {
        if (pointCount >= 5000) {
            return 6 * 0.4; // 60% reduction (40% of original size)
        } else if (pointCount >= 2000) {
            return 6 * 0.6; // 40% reduction (60% of original size)
        } else if (pointCount >= 800) {
            return 6 * 0.8; // 20% reduction (80% of original size)
        } else {
            return 6; // Original size
        }
    }, []);

    // ฟังก์ชันอัปเดตขนาดของ markers แทนการสร้างใหม่ (เหมือนหน้าอื่นๆ)
    const updateMarkerSizes = useCallback((zoom: number) => {
        if (!mapRef.current || irrigationMarkersRef.current.length === 0) return;
        
        // คำนวณขนาดใหม่ตาม zoom level
        let newSize = 12; // ขนาดเริ่มต้น
        if (zoom < 16) newSize = 8;      // ซูมออกมาก
        else if (zoom < 18) newSize = 10; // ซูมออกปานกลาง
        else if (zoom < 20) newSize = 12; // ขนาดปกติ
        else newSize = 14;                // ซูมเข้าใกล้
        
        // อัปเดตขนาดของ sprinkler markers โดยไม่สร้างใหม่
        irrigationMarkersRef.current.forEach((marker) => {
            if (marker.getTitle()?.includes('Sprinkler')) {
                const newIcon = {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="${newSize}" height="${newSize}" viewBox="0 0 ${newSize} ${newSize}" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="${newSize / 2}" cy="${newSize / 2}" r="${newSize / 2 - 1}" fill="#3b82f6" stroke="#1d4ed8" stroke-width="1"/>
                            <circle cx="${newSize / 2}" cy="${newSize / 2}" r="${newSize / 4}" fill="#ffffff"/>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(newSize, newSize),
                    anchor: new google.maps.Point(newSize / 2, newSize / 2),
                };
                marker.setIcon(newIcon);
            } else if (marker.getTitle()?.includes('Pivot')) {
                const newIcon = {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="${newSize}" height="${newSize}" viewBox="0 0 ${newSize} ${newSize}" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="${newSize / 2}" cy="${newSize / 2}" r="${newSize / 2 - 1}" fill="#f97316" stroke="#ea580c" stroke-width="1"/>
                            <circle cx="${newSize / 2}" cy="${newSize / 2}" r="${newSize / 4}" fill="#ffffff"/>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(newSize, newSize),
                    anchor: new google.maps.Point(newSize / 2, newSize / 2),
                };
                marker.setIcon(newIcon);
            }
        });
    }, []);

    const handleMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        setIsMapLoaded(true);

        // Add zoom change listener with debounce เพื่อลดการอัปเดตบ่อยเกินไป
        // แต่ไม่ให้ zoom ทำให้เรนเดอร์ markers ใหม่ (เหมือนหน้าอื่นๆ)
        let zoomDebounceTimer: NodeJS.Timeout | null = null;
        map.addListener('zoom_changed', () => {
            if (zoomDebounceTimer) {
                clearTimeout(zoomDebounceTimer);
            }
            
            zoomDebounceTimer = setTimeout(() => {
                const newZoom = map.getZoom() || 18;
                setParsedMapZoom(newZoom);
                
                // อัปเดตขนาดของ markers แทนการสร้างใหม่ (เหมือนหน้าอื่นๆ)
                updateMarkerSizes(newZoom);
            }, 300); // รอ 300ms หลังจากหยุดซูมค่อยอัปเดต
        });
    }, [updateMarkerSizes]);

    // Real-time regenerate irrigation overlays when angle changes
    useEffect(() => {
        if (!isMapLoaded) return;
        
        // ใช้ debounce timer แทน requestAnimationFrame เพื่อลดการ regenerate บ่อยเกินไป
        const debounceTimer = setTimeout(() => {
            setIsAngleRegenerating(true);
            
            // Only regenerate the currently selected type, if any data exists
            const hasSprinklers = irrigationPositions.sprinklers.length > 0;
            const hasPivots = irrigationPositions.pivots.length > 0;
            
            if (hasSprinklers && hasPivots) {
                // If both exist, regenerate both but with a small delay between them
                generateSprinklerSystem();
                setTimeout(() => generatePivotSystem(), 50);
            } else if (hasSprinklers) {
                generateSprinklerSystem();
            } else if (hasPivots) {
                generatePivotSystem();
            }
            
            // Reset flag after a short delay to allow state updates to complete
            setTimeout(() => setIsAngleRegenerating(false), 150);
        }, 500); // เพิ่ม debounce time เป็น 500ms เพื่อลดการ regenerate บ่อยเกินไป
        
        return () => {
            clearTimeout(debounceTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parsedRotationAngle]);

    // Fit map to main area when main area changes
    useEffect(() => {
        if (mapRef.current && finalMainArea.length >= 3) {
            const bounds = new google.maps.LatLngBounds();
            finalMainArea.forEach((coord) => {
                bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
            });
            mapRef.current.fitBounds(bounds);
        }
    }, [finalMainArea]);

    const handleIrrigationTypeSelect = (type: string) => {
        // Clear all existing irrigation overlays when switching types
        irrigationMarkersRef.current.forEach((marker) => marker.setMap(null));
        irrigationMarkersRef.current = [];
        irrigationCirclesRef.current.forEach((circle) => circle.setMap(null));
        irrigationCirclesRef.current = [];

        // Reset irrigation counts when switching types
        setIrrigationCounts({
            sprinkler_system: 0,
            pivot: 0,
        });

        // Clear irrigation positions when switching types
        setIrrigationPositions({
            sprinklers: [],
            pivots: [],
        });

        setSelectedIrrigationType(type);
    };

    // Function for updating irrigation settings
    const handleSettingsChange = (type: string, field: string, value: number | string) => {
        setIrrigationSettings((prev) => ({
            ...prev,
            [type]: {
                ...(prev[type as keyof typeof prev] || {}),
                [field]: value,
            },
        }));
    };

    // ===== SPRINKLER MANAGEMENT FUNCTIONS =====

    // Add sprinkler at position
    const addSprinkler = useCallback((position: { lat: number; lng: number }) => {
        const newSprinkler = { lat: position.lat, lng: position.lng };
        setIrrigationPositions((prev) => ({
            ...prev,
            sprinklers: [...prev.sprinklers, newSprinkler],
        }));
        setIrrigationCounts((prev) => ({ ...prev, sprinkler_system: prev.sprinkler_system + 1 }));
    }, []);

    // Update sprinkler position
    const updateSprinklerPosition = useCallback(
        (index: number, newPosition: { lat: number; lng: number }) => {
            setIrrigationPositions((prev) => ({
                ...prev,
                sprinklers: prev.sprinklers.map((sprinkler, i) =>
                    i === index ? { lat: newPosition.lat, lng: newPosition.lng } : sprinkler
                ),
            }));
        },
        []
    );

    // Delete sprinkler
    const deleteSprinkler = useCallback((index: number) => {
        setIrrigationPositions((prev) => ({
            ...prev,
            sprinklers: prev.sprinklers.filter((_, i) => i !== index),
        }));
        setIrrigationCounts((prev) => ({
            ...prev,
            sprinkler_system: Math.max(0, prev.sprinkler_system - 1),
        }));
    }, []);

    // Handle sprinkler mode change
    const handleSprinklerModeChange = useCallback((mode: 'none' | 'add' | 'move' | 'delete') => {
        setSprinklerMode(mode);

        // Clear selection when changing modes
        setSelectedSprinklers([]);

        // Control map dragging and cursor based on mode
        if (mapRef.current) {
            const mapDiv = mapRef.current.getDiv();

            switch (mode) {
                case 'add':
                    mapRef.current.setOptions({
                        draggable: false,
                        scrollwheel: true,
                        disableDoubleClickZoom: true,
                        draggableCursor: 'crosshair',
                        draggingCursor: 'crosshair',
                    });
                    mapDiv.style.cursor = 'crosshair';
                    break;
                case 'move':
                    mapRef.current.setOptions({
                        draggable: false,
                        scrollwheel: true,
                        disableDoubleClickZoom: true,
                        draggableCursor: 'move',
                        draggingCursor: 'move',
                    });
                    mapDiv.style.cursor = 'move';
                    break;
                case 'delete':
                    mapRef.current.setOptions({
                        draggable: false,
                        scrollwheel: true,
                        disableDoubleClickZoom: true,
                        draggableCursor: 'pointer',
                        draggingCursor: 'pointer',
                    });
                    mapDiv.style.cursor = 'pointer';
                    break;
                default:
                    mapRef.current.setOptions({
                        draggable: true,
                        scrollwheel: true,
                        disableDoubleClickZoom: false,
                        draggableCursor: undefined,
                        draggingCursor: undefined,
                    });
                    mapDiv.style.cursor = '';
                    mapDiv.style.userSelect = '';
                    break;
            }
        }

    }, []);

    // Handle map click for sprinkler operations
    const handleMapClickForSprinkler = useCallback(
        (event: google.maps.MapMouseEvent) => {
            if (!event.latLng) return;
            
            const clickedPoint = {
                lat: event.latLng.lat(),
                lng: event.latLng.lng(),
            };
            
            if (sprinklerMode === 'add') {
                // เพิ่มสปริงเกลอร์ใหม่
                addSprinkler(clickedPoint);
            } else if (sprinklerMode === 'delete') {
                // หาสปริงเกลอร์ที่ใกล้ที่สุดและลบ
                let closestIndex = -1;
                let closestDistance = Infinity;
                
                irrigationPositions.sprinklers.forEach((sprinkler, index) => {
                    const distance = Math.sqrt(
                        Math.pow(sprinkler.lat - clickedPoint.lat, 2) + 
                        Math.pow(sprinkler.lng - clickedPoint.lng, 2)
                    );
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestIndex = index;
                    }
                });
                
                // ถ้าพบสปริงเกลอร์ในระยะที่เหมาะสม ให้ลบ
                if (closestIndex !== -1 && closestDistance < 0.001) { // ~100m tolerance
                    deleteSprinkler(closestIndex);
                }
            } else if (sprinklerMode === 'move') {
                // หาสปริงเกลอร์ที่ใกล้ที่สุดและเลือกเพื่อขยับ
                let closestIndex = -1;
                let closestDistance = Infinity;
                
                irrigationPositions.sprinklers.forEach((sprinkler, index) => {
                    const distance = Math.sqrt(
                        Math.pow(sprinkler.lat - clickedPoint.lat, 2) + 
                        Math.pow(sprinkler.lng - clickedPoint.lng, 2)
                    );
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestIndex = index;
                    }
                });
                
                // ถ้าพบสปริงเกลอร์ในระยะที่เหมาะสม ให้เลือก
                if (closestIndex !== -1 && closestDistance < 0.001) { // ~100m tolerance
                    setSelectedSprinklers([closestIndex]);
                } else {
                    setSelectedSprinklers([]);
                }
            }
        },
        [sprinklerMode, addSprinkler, deleteSprinkler, irrigationPositions.sprinklers]
    );

    // Handle move sprinkler to new position
    const handleMoveSprinkler = useCallback(
        (event: google.maps.MapMouseEvent) => {
            if (sprinklerMode === 'move' && selectedSprinklers.length > 0 && event.latLng) {
                const newPosition = {
                    lat: event.latLng.lat(),
                    lng: event.latLng.lng(),
                };
                
                // Move all selected sprinklers to new position
                selectedSprinklers.forEach((index) => {
                    updateSprinklerPosition(index, newPosition);
                });
                
                setSelectedSprinklers([]); // Clear selection after move
            }
        },
        [sprinklerMode, selectedSprinklers, updateSprinklerPosition]
    );
>>>>>>> main

    // Adjust rotation angle by delta (supports 0.5° increments)
    const adjustRotationAngle = useCallback((delta: number) => {
        setParsedRotationAngle((prev) => {
            const next = prev + delta;
            const clamped = Math.max(-180, Math.min(180, next));
            // round to nearest 0.5
            return Math.round(clamped * 2) / 2;
        });
    }, []);
    const [parsedSelectedCrops, setParsedSelectedCrops] = useState<string[]>([]);
    const [parsedMapCenter, setParsedMapCenter] = useState<{ lat: number; lng: number }>({
        lat: 13.7563,
        lng: 100.5018,
    });
    const [parsedMapZoom, setParsedMapZoom] = useState<number>(18);
    const hasInitializedRef = useRef<boolean>(false);

<<<<<<< HEAD
    // Parse data on component mount
    useEffect(() => {
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;

        // On fresh page load (no URL parameters), make behavior match the Reset button
        // Treat as "Reset irrigation only" while keeping existing field data
        const hasUrlParams = !!(
            crops ||
            completedSteps ||
            mainAreaData ||
            obstaclesData ||
            plantPointsData ||
            areaRai ||
            perimeterMeters ||
            rotationAngle ||
            rowSpacing ||
            plantSpacing
        );

        if (!hasUrlParams) {
            try {
                const fieldDataStr = localStorage.getItem('fieldCropData');
                if (fieldDataStr) {
                    const fieldData = JSON.parse(fieldDataStr) as FieldData;

                    // Load field data first before sanitizing
                    if (fieldData.mainArea) {
                        dbg(
                            'Loading mainArea from localStorage:',
                            fieldData.mainArea.length,
                            'points'
                        );
                        setParsedMainArea(fieldData.mainArea);
                    }

                    if (fieldData.obstacles) {
                        dbg(
                            'Loading obstacles from localStorage:',
                            fieldData.obstacles.length,
                            'items'
                        );
                        setParsedObstacles(fieldData.obstacles);
                    }

                    if (fieldData.plantPoints) {
                        dbg(
                            'Loading plantPoints from localStorage:',
                            fieldData.plantPoints.length,
                            'points'
                        );
                        setParsedPlantPoints(fieldData.plantPoints);
                    }

                    // Load realPlantCount from localStorage on fresh load
                    if (
                        typeof fieldData.realPlantCount === 'number' &&
                        fieldData.realPlantCount > 0
                    ) {
                        console.log(
                            'Fresh load - Loading realPlantCount from localStorage:',
                            fieldData.realPlantCount
                        );
                        setRealPlantCount(fieldData.realPlantCount);
                    } else if (fieldData.plantPoints) {
                        // Fallback to plantPoints.__realCount
                        const plantPointsWithRealCount =
                            fieldData.plantPoints as typeof fieldData.plantPoints & {
                                __realCount?: number;
                            };
                        const realCount =
                            plantPointsWithRealCount.__realCount || fieldData.plantPoints.length;
                        console.log('Fresh load - Using fallback realPlantCount:', realCount);
                        setRealPlantCount(realCount);
                    }

                    if (fieldData.areaRai) {
                        dbg('Loading areaRai from localStorage:', fieldData.areaRai);
                        setParsedAreaRai(fieldData.areaRai);
                    }

                    if (fieldData.perimeterMeters) {
                        dbg(
                            'Loading perimeterMeters from localStorage:',
                            fieldData.perimeterMeters
                        );
                        setParsedPerimeterMeters(fieldData.perimeterMeters);
                    }

                    // Initialize rotation angle to 0 on fresh load
                    dbg('Initializing rotationAngle to 0 on fresh load');
                    setParsedRotationAngle(0);

                    if (fieldData.rowSpacing) {
                        dbg('Loading rowSpacing from localStorage:', fieldData.rowSpacing);
                        setParsedRowSpacing(fieldData.rowSpacing);
                    }

                    if (fieldData.plantSpacing) {
                        dbg('Loading plantSpacing from localStorage:', fieldData.plantSpacing);
                        setParsedPlantSpacing(fieldData.plantSpacing);
                    }

                    if (fieldData.selectedCrops) {
                        dbg('Loading selectedCrops from localStorage:', fieldData.selectedCrops);
                        setParsedSelectedCrops(fieldData.selectedCrops);
                    }

                    // Load map state
                    if (fieldData.mapCenter) {
                        dbg('Loading mapCenter from localStorage:', fieldData.mapCenter);
                        setParsedMapCenter(fieldData.mapCenter);
                    }

                    if (fieldData.mapZoom) {
                        dbg('Loading mapZoom from localStorage:', fieldData.mapZoom);
                        setParsedMapZoom(fieldData.mapZoom);
                    }

                    // Then sanitize irrigation data
                    const sanitized: FieldData = {
                        ...fieldData,
                        selectedIrrigationType: '',
                        irrigationCounts: {
                            sprinkler_system: 0,
                            pivot: 0,
                            drip_tape: 0,
                            water_jet_tape: 0,
                        },
                        irrigationSettings: {
                            sprinkler_system: {
                                coverageRadius: 8,
                                overlap: 0,
                                flow: 10,
                                pressure: 2.5,
                            },
                            pivot: { coverageRadius: 165, overlap: 0, flow: 50, pressure: 3.0 },
                            drip_tape: {
                                emitterSpacing: 20,
                                placement: 'along_rows',
                                side: 'left',
                                flow: 0.24,
                                pressure: 1.0,
                            },
                            water_jet_tape: {
                                emitterSpacing: 20,
                                placement: 'along_rows',
                                side: 'left',
                                flow: 1.5,
                                pressure: 1.5,
                            },
                        },
                        irrigationPositions: {
                            sprinklers: [],
                            pivots: [],
                            dripTapes: [],
                            waterJets: [],
                        },
                    };
                    safeSetItem('fieldCropData', sanitized);
                }
            } catch (e) {
                console.error('Error sanitizing irrigation data on fresh load:', e);
            }
            // Clear irrigation overlays if map is loaded
            if (mapRef.current) {
                irrigationMarkersRef.current.forEach((marker) => marker.setMap(null));
                irrigationMarkersRef.current = [];
                irrigationCirclesRef.current.forEach((circle) => circle.setMap(null));
                irrigationCirclesRef.current = [];
            }
        }

        // Parse selectedCrops from crops parameter
        if (crops) {
            const cropList = crops.split(',').filter((crop) => crop.trim());
            setParsedSelectedCrops(cropList);
        }

        // Load data from localStorage if available (back navigation or fresh reload with stored data)
        const shouldLoadFromStorage = (() => {
            try {
                return !!localStorage.getItem('fieldCropData');
            } catch {
                return false;
            }
        })();
        if (hasUrlParams || shouldLoadFromStorage) {
            try {
                dbg('Checking localStorage for fieldCropData...');
                const fieldDataStr = localStorage.getItem('fieldCropData');
                dbg('localStorage fieldCropData:', fieldDataStr ? 'found' : 'not found');
                if (fieldDataStr) {
                    const fieldData = JSON.parse(fieldDataStr) as FieldData;
                    dbg('Loaded field data from localStorage:', fieldData);

                    if (fieldData.mainArea) {
                        dbg('Setting parsedMainArea:', fieldData.mainArea.length, 'points');
                        setParsedMainArea(fieldData.mainArea);
                    }

                    if (fieldData.obstacles) {
                        dbg('Setting parsedObstacles:', fieldData.obstacles.length, 'items');
                        dbg('Obstacles data:', fieldData.obstacles);
                        setParsedObstacles(fieldData.obstacles);
                    }

                    if (fieldData.plantPoints) {
                        dbg('Setting parsedPlantPoints:', fieldData.plantPoints.length, 'points');
                        setParsedPlantPoints(fieldData.plantPoints);
                    }

                    // Load realPlantCount from separate property first, then fallback to plantPoints.__realCount
                    if (
                        typeof fieldData.realPlantCount === 'number' &&
                        fieldData.realPlantCount > 0
                    ) {
                        console.log(
                            'Irrigation - Loading realPlantCount from separate property:',
                            fieldData.realPlantCount
                        );
                        setRealPlantCount(fieldData.realPlantCount);
                    } else if (fieldData.plantPoints) {
                        // Extract real count if available (from initial-area.tsx with real count)
                        const plantPointsWithRealCount =
                            fieldData.plantPoints as typeof fieldData.plantPoints & {
                                __realCount?: number;
                            };
                        const realCount =
                            plantPointsWithRealCount.__realCount || fieldData.plantPoints.length;
                        console.log('Irrigation - Loading plant points:', {
                            plantPointsLength: fieldData.plantPoints.length,
                            realCount: realCount,
                            hasRealCount: !!plantPointsWithRealCount.__realCount,
                        });
                        setRealPlantCount(realCount);
                        dbg('Real plant count:', realCount);
                    }

                    if (fieldData.areaRai) {
                        dbg('Setting parsedAreaRai:', fieldData.areaRai);
                        setParsedAreaRai(fieldData.areaRai);
                    }

                    if (fieldData.perimeterMeters) {
                        dbg('Setting parsedPerimeterMeters:', fieldData.perimeterMeters);
                        setParsedPerimeterMeters(fieldData.perimeterMeters);
                    }
=======
    // Delete selected sprinklers
    const deleteSelectedSprinklers = useCallback(() => {
        if (selectedSprinklers.length > 0) {
            // Sort indices in descending order to avoid index shifting issues
            const sortedIndices = [...selectedSprinklers].sort((a, b) => b - a);

            setIrrigationPositions((prev) => {
                const newSprinklers = [...prev.sprinklers];
                sortedIndices.forEach((index) => {
                    newSprinklers.splice(index, 1);
                });
                return { ...prev, sprinklers: newSprinklers };
            });

            setIrrigationCounts((prev) => ({
                ...prev,
                sprinkler_system: Math.max(0, prev.sprinkler_system - selectedSprinklers.length),
            }));

            setSelectedSprinklers([]);
        }
    }, [selectedSprinklers]);
>>>>>>> main

                    if (fieldData.rotationAngle) {
                        dbg('Setting parsedRotationAngle:', fieldData.rotationAngle);
                        setParsedRotationAngle(fieldData.rotationAngle);
                    }

                    if (fieldData.rowSpacing) {
                        dbg('Setting parsedRowSpacing:', fieldData.rowSpacing);
                        setParsedRowSpacing(fieldData.rowSpacing);
                    }

<<<<<<< HEAD
                    if (fieldData.plantSpacing) {
                        dbg('Setting parsedPlantSpacing:', fieldData.plantSpacing);
                        setParsedPlantSpacing(fieldData.plantSpacing);
                    }

                    // Load map state
                    if (fieldData.mapCenter) {
                        dbg('Setting parsedMapCenter:', fieldData.mapCenter);
                        setParsedMapCenter(fieldData.mapCenter);
                    }

                    if (fieldData.mapZoom) {
                        dbg('Setting parsedMapZoom:', fieldData.mapZoom);
                        setParsedMapZoom(fieldData.mapZoom);
                    }

                    // Load irrigation data if exists
                    if (fieldData.selectedIrrigationType) {
                        setSelectedIrrigationType(fieldData.selectedIrrigationType);
                    }

                    if (fieldData.irrigationCounts) {
                        setIrrigationCounts(fieldData.irrigationCounts as typeof irrigationCounts);
                    }

                    if (fieldData.totalWaterRequirement) {
                        // Will be recalculated based on current data
                    }

                    if (fieldData.irrigationSettings) {
                        setIrrigationSettings(
                            fieldData.irrigationSettings as typeof irrigationSettings
                        );
                    }

                    if (fieldData.irrigationPositions) {
                        setIrrigationPositions(fieldData.irrigationPositions);
                    }

                    // Note: Distance overlays will be recreated from obstacle data
                    // distanceOverlaysByObstacle is not saved due to circular reference
                } else {
                    dbg('No field data found in localStorage');
                }
            } catch (e) {
                console.error('Error loading field data from localStorage:', e);
            }
        }
    }, [
        areaRai,
        completedSteps,
        crops,
        mainAreaData,
        obstaclesData,
        perimeterMeters,
        plantPointsData,
        plantSpacing,
        rotationAngle,
        rowSpacing,
        selectedCrops,
    ]);

    // Use parsed data or fallback to props
    const finalMainArea = parsedMainArea.length > 0 ? parsedMainArea : mainArea;
    const finalObstacles = parsedObstacles.length > 0 ? parsedObstacles : obstacles;
    const finalPlantPoints = useMemo(
        () => (parsedPlantPoints.length > 0 ? parsedPlantPoints : []),
        [parsedPlantPoints]
    );

    const finalAreaRai = parsedAreaRai !== null ? parsedAreaRai : null;
    const finalPerimeterMeters = parsedPerimeterMeters !== null ? parsedPerimeterMeters : null;
    const finalRotationAngle = parsedRotationAngle !== 0 ? parsedRotationAngle : 0;
    const finalRowSpacing = Object.keys(parsedRowSpacing).length > 0 ? parsedRowSpacing : {};
    const finalPlantSpacing = Object.keys(parsedPlantSpacing).length > 0 ? parsedPlantSpacing : {};
    const finalSelectedCrops = parsedSelectedCrops.length > 0 ? parsedSelectedCrops : selectedCrops;
    const finalMapCenter =
        parsedMapCenter.lat !== 13.7563 || parsedMapCenter.lng !== 100.5018
            ? parsedMapCenter
            : mapCenter;
    const finalMapZoom = parsedMapZoom !== 18 ? parsedMapZoom : mapZoom;

    // (moved below irrigationPositions state)

    // Calculate map center from main area if available, or use saved position
    const calculatedMapCenter =
        finalMainArea.length >= 3
            ? {
                  lat:
                      finalMainArea.reduce((sum, coord) => sum + coord.lat, 0) /
                      finalMainArea.length,
                  lng:
                      finalMainArea.reduce((sum, coord) => sum + coord.lng, 0) /
                      finalMainArea.length,
              }
            : finalMapCenter;

    // Map references
    const mapRef = useRef<google.maps.Map | null>(null);
    const mainAreaPolygonRef = useRef<google.maps.Polygon | null>(null);
    const obstaclePolygonsRef = useRef<google.maps.Polygon[]>([]);
    const plantPointMarkersRef = useRef<google.maps.Marker[]>([]);
    const distanceOverlaysRef = useRef<
        Record<string, { lines: google.maps.Polyline[]; labels: google.maps.Marker[] }>
    >({});
    const irrigationMarkersRef = useRef<google.maps.Marker[]>([]);
    const irrigationCirclesRef = useRef<google.maps.Circle[]>([]);

    // State management
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [selectedIrrigationType, setSelectedIrrigationType] = useState<string>('');
    const [isGeneratingIrrigation, setIsGeneratingIrrigation] = useState(false);
    const [irrigationCounts, setIrrigationCounts] = useState({
        sprinkler_system: 0,
        pivot: 0,
        drip_tape: 0,
        water_jet_tape: 0,
    });

    // เพิ่ม state สำหรับเก็บตำแหน่งอุปกรณ์ irrigation
    const [irrigationPositions, setIrrigationPositions] = useState<IrrigationPositions>({
        sprinklers: [],
        pivots: [],
        dripTapes: [],
        waterJets: [],
    });

    // Sprinkler Management States
    const [sprinklerMode, setSprinklerMode] = useState<'none' | 'add' | 'move' | 'delete'>('none');
    const [selectedSprinklers, setSelectedSprinklers] = useState<number[]>([]);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ lat: number; lng: number } | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<{ lat: number; lng: number } | null>(null);
    const selectionRectangleRef = useRef<google.maps.Rectangle | null>(null);

    // Require at least one generated irrigation type before proceeding
    const hasGeneratedIrrigation =
        irrigationPositions.sprinklers.length > 0 ||
        irrigationPositions.pivots.length > 0 ||
        irrigationPositions.dripTapes.length > 0 ||
        irrigationPositions.waterJets.length > 0;

    // Irrigation settings for different types
    const [irrigationSettings, setIrrigationSettings] = useState({
        sprinkler_system: {
            coverageRadius: 8, // 1-15m
            overlap: 0, // 0-50%
            flow: 10, // L/min
            pressure: 2.5, // bar
        },
        pivot: {
            coverageRadius: 165, // 80-250m
            overlap: 0, // 0-50%
            flow: 50, // L/min
            pressure: 3.0, // bar
        },
        drip_tape: {
            emitterSpacing: 20, // 10,15,20,30cm
            placement: 'along_rows', // 'along_rows' | 'staggered'
            side: 'left', // 'left' | 'right'
            flow: 0.24, // L/min per emitter (fixed in UI)
            pressure: 1.0, // bar (display only)
        },
        water_jet_tape: {
            emitterSpacing: 20, // 10,20,30cm
            placement: 'along_rows', // 'along_rows' | 'staggered'
            side: 'left', // 'left' | 'right'
            flow: 1.5, // L/min (adjustable)
            pressure: 1.5, // bar (adjustable)
        },
    });

    // Calculate total water requirement
    const totalWaterRequirement = useMemo(() => {
        // Get water requirement per plant for the primary crop
        const primaryCrop = finalSelectedCrops[0];
        const crop = getCropByValue(primaryCrop);
        const waterPerPlant = crop ? crop.waterRequirement : 0;

        // Calculate total water requirement for all plants using real count
        const totalWaterRequirement = waterPerPlant * realPlantCount;

        return totalWaterRequirement;
    }, [finalSelectedCrops, realPlantCount]);

    const handleBack = () => {
        // Update completed steps automatically
        const updatedCompletedSteps = updateCompletedSteps();

        // Store the actual parsed data in localStorage to preserve all information including irrigation data
        const allData: FieldData = {
            selectedCrops: finalSelectedCrops,
            mainArea: parsedMainArea.length > 0 ? parsedMainArea : finalMainArea,
            zones: [],
            obstacles: parsedObstacles.length > 0 ? parsedObstacles : finalObstacles,
            plantPoints: parsedPlantPoints.length > 0 ? parsedPlantPoints : finalPlantPoints,
            pipes: [],
            areaRai: parsedAreaRai !== null ? parsedAreaRai : finalAreaRai,
            perimeterMeters:
                parsedPerimeterMeters !== null ? parsedPerimeterMeters : finalPerimeterMeters,
            rotationAngle: parsedRotationAngle,
            rowSpacing:
                Object.keys(parsedRowSpacing).length > 0 ? parsedRowSpacing : finalRowSpacing,
            plantSpacing:
                Object.keys(parsedPlantSpacing).length > 0 ? parsedPlantSpacing : finalPlantSpacing,
            selectedIrrigationType,
            irrigationCounts,
            totalWaterRequirement,
            irrigationSettings,
            irrigationPositions,
            mapCenter: parsedMapCenter || finalMapCenter,
            mapZoom: parsedMapZoom || finalMapZoom,
        };
        try {
            safeSetItem('fieldCropData', allData);
        } catch {
            /* ignore storage errors */
        }

        router.get('/step1-field-area', {
            crops: crops || selectedCrops.join(','),
            currentStep: 1,
            completedSteps: updatedCompletedSteps,
        });
    };

    const steps: StepData[] = [
        {
            id: 1,
            key: 'initial-area',
            title: t('Initial Area'),
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

    const persistIrrigation = () => {
        try {
            const existingData = localStorage.getItem('fieldCropData');
            let fieldData: FieldData = existingData
                ? (JSON.parse(existingData) as FieldData)
                : {
                      selectedCrops: finalSelectedCrops,
                      mainArea: finalMainArea,
                      zones: [],
                      obstacles: finalObstacles,
                      plantPoints: finalPlantPoints,
                      pipes: [],
                      areaRai: finalAreaRai,
                      perimeterMeters: finalPerimeterMeters,
                      rotationAngle: finalRotationAngle,
                      rowSpacing: finalRowSpacing,
                      plantSpacing: finalPlantSpacing,
                      selectedIrrigationType: '',
                      irrigationCounts: {
                          sprinkler_system: 0,
                          pivot: 0,
                          drip_tape: 0,
                          water_jet_tape: 0,
                      },
                      totalWaterRequirement: 0,
                      irrigationSettings,
                      irrigationPositions,
                      mapCenter: calculatedMapCenter,
                      mapZoom: finalMapZoom,
                  };
            fieldData = {
                ...fieldData,
                selectedCrops: finalSelectedCrops,
                mainArea: finalMainArea,
                obstacles: finalObstacles,
                plantPoints: finalPlantPoints,
                areaRai: finalAreaRai,
                perimeterMeters: finalPerimeterMeters,
                rotationAngle: finalRotationAngle,
                rowSpacing: finalRowSpacing,
                plantSpacing: finalPlantSpacing,
                mapCenter: calculatedMapCenter,
                mapZoom: finalMapZoom,
                selectedIrrigationType,
                irrigationSettings,
                irrigationCounts,
                totalWaterRequirement,
                irrigationPositions,
            };
            safeSetItem('fieldCropData', fieldData);
        } catch {
            // ignore storage errors
        }
    };

    const handleStepClick = (step: StepData) => {
        // Check if all 4 steps are completed
        const parsedSteps = parseCompletedSteps(completedSteps);
        const allStepsCompleted =
            parsedSteps.length >= 4 &&
            parsedSteps.includes(1) &&
            parsedSteps.includes(2) &&
            parsedSteps.includes(3) &&
            parsedSteps.includes(4);

        // If all steps are completed, allow free navigation
        if (allStepsCompleted) {
            persistIrrigation();
            const params = {
                crops: crops || selectedCrops.join(','),
                currentStep: step.id,
                completedSteps: completedSteps,
            };
            router.get(step.route, params);
            return;
        }

        // Original logic for incomplete steps
        // Gate: must generate irrigation before moving to zones
        if (step.id === 3 && !hasGeneratedIrrigation) {
            alert(t('Please generate at least one Irrigation Type before continuing to Zones'));
            return;
        }
        // Persist current irrigation state
        persistIrrigation();
        // Update completed steps before navigating
        const updatedCompletedSteps = updateCompletedSteps();

        const params = {
            crops: crops || selectedCrops.join(','),
            currentStep: step.id,
            completedSteps: updatedCompletedSteps,
        };
        router.get(step.route, params);
    };

    // Helper function to check if current step is completed
    const isCurrentStepCompleted = () => {
        switch (currentStep) {
            case 1: // Initial Area
                return finalMainArea.length >= 3;
            case 2: // Irrigation Generate
                // Do not auto-complete on data presence; only mark as completed on Next
                return false;
            case 3: // Zone Obstacle
                // This will be handled in the zone-obstacle page
                return false;
            case 4: // Pipe Generate
                // This will be handled in the pipe-generate page
                return false;
            default:
                return false;
        }
    };

    // Helper function to update completed steps
    const updateCompletedSteps = () => {
        const existing = parseCompletedSteps(completedSteps);
        let result = existing;
        if (isCurrentStepCompleted()) {
            result = Array.from(new Set([...existing, currentStep]));
        }
        return toCompletedStepsCsv(result);
    };

    const handleNext = () => {
        // Guard: must generate at least one irrigation type before proceeding to zones
        if (!hasGeneratedIrrigation) {
            alert(t('Please generate at least one Irrigation Type before continuing to Zones'));
            return;
        }

        // บันทึกข้อมูล irrigation ลง localStorage
        try {
            const existingData = localStorage.getItem('fieldCropData');
            let fieldData: FieldData = existingData
                ? (JSON.parse(existingData) as FieldData)
                : {
                      selectedCrops: finalSelectedCrops,
                      mainArea: finalMainArea,
                      zones: [],
                      obstacles: finalObstacles,
                      plantPoints: finalPlantPoints,
                      pipes: [],
                      areaRai: finalAreaRai,
                      perimeterMeters: finalPerimeterMeters,
                      rotationAngle: finalRotationAngle,
                      rowSpacing: finalRowSpacing,
                      plantSpacing: finalPlantSpacing,
                      selectedIrrigationType: '',
                      irrigationCounts: {
                          sprinkler_system: 0,
                          pivot: 0,
                          drip_tape: 0,
                          water_jet_tape: 0,
                      },
                      totalWaterRequirement: 0,
                      irrigationSettings,
                      irrigationPositions,
                      mapCenter: calculatedMapCenter,
                      mapZoom: finalMapZoom,
                  };

            // เพิ่มข้อมูล irrigation ใหม่
            fieldData = {
                ...fieldData,
                selectedCrops: finalSelectedCrops,
                mainArea: finalMainArea,
                obstacles: finalObstacles,
                plantPoints: finalPlantPoints,
                areaRai: finalAreaRai,
                perimeterMeters: finalPerimeterMeters,
                rotationAngle: finalRotationAngle,
                rowSpacing: finalRowSpacing,
                plantSpacing: finalPlantSpacing,
                mapCenter: calculatedMapCenter,
                mapZoom: finalMapZoom,
                // Irrigation
                selectedIrrigationType,
                irrigationSettings,
                irrigationCounts,
                totalWaterRequirement,
                irrigationPositions,
            };

            safeSetItem('fieldCropData', fieldData);
        } catch (error) {
            console.error('Error saving irrigation data to localStorage:', error);
        }

        // Update completed steps automatically
        const updatedCompletedSteps = updateCompletedSteps();

        // ส่งข้อมูลผ่าน URL parameters (minimal)
        const params = {
            crops: crops || selectedCrops.join(','),
            currentStep: 3,
            // Ensure step 2 is marked completed when proceeding to zones
            completedSteps: toCompletedStepsCsv([...parseCompletedSteps(updatedCompletedSteps), 2]),
        };

        router.get('/step3-zones-obstacles', params);
    };

    // Helper function to calculate point size based on point count
    const calculatePointSize = useCallback((pointCount: number): number => {
        if (pointCount >= 5000) {
            return 6 * 0.4; // 60% reduction (40% of original size)
        } else if (pointCount >= 2000) {
            return 6 * 0.6; // 40% reduction (60% of original size)
        } else if (pointCount >= 800) {
            return 6 * 0.8; // 20% reduction (80% of original size)
        } else {
            return 6; // Original size
        }
    }, []);

    // Helper function to filter points based on zoom level and total point count
    const filterPointsByZoom = useCallback(
        (
            points: { lat: number; lng: number; cropType: string; isValid: boolean }[],
            zoom: number,
            totalPointCount: number
        ): { lat: number; lng: number; cropType: string; isValid: boolean }[] => {
            // If we have fewer than 800 points, show all points regardless of zoom
            if (totalPointCount < 800) {
                return points;
            }

            // Calculate maximum reduction factor based on total point count
            let maxReductionFactor = 1; // No reduction by default

            if (totalPointCount >= 5000) {
                maxReductionFactor = 4; // Up to 4x reduction (show 1/4 of points)
            } else if (totalPointCount >= 2000) {
                maxReductionFactor = 3; // Up to 3x reduction (show 1/3 of points)
            } else if (totalPointCount >= 800) {
                maxReductionFactor = 2; // Up to 2x reduction (show 1/2 of points)
            }

            // Calculate zoom-based reduction (5 levels: zoom 20, 19, 18, 17, 16)
            let reductionFactor = 1;

            if (zoom >= 20) {
                // Zoom 20+: show all points
                reductionFactor = 1;
            } else if (zoom >= 19) {
                // Zoom 19: 25% of max reduction
                reductionFactor = 1 + (maxReductionFactor - 1) * 0.25;
            } else if (zoom >= 18) {
                // Zoom 18: 50% of max reduction
                reductionFactor = 1 + (maxReductionFactor - 1) * 0.5;
            } else if (zoom >= 17) {
                // Zoom 17: 75% of max reduction
                reductionFactor = 1 + (maxReductionFactor - 1) * 0.75;
            } else {
                // Zoom < 17: maximum reduction
                reductionFactor = maxReductionFactor;
            }

            // If no reduction needed, return all points
            if (reductionFactor <= 1) {
                return points;
            }

            // Sample points based on reduction factor
            const step = Math.ceil(reductionFactor);
            return points.filter((_, index) => index % step === 0);
        },
        []
    );

    const handleMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        setIsMapLoaded(true);

        // Add zoom change listener
        map.addListener('zoom_changed', () => {
            const newZoom = map.getZoom() || 18;
            setParsedMapZoom(newZoom);
        });
    }, []);

    // Real-time regenerate irrigation overlays when angle changes
    useEffect(() => {
        if (!isMapLoaded) return;
        let raf: number | null = null;
        const doRegen = () => {
            // Only regenerate the currently selected type, if any data exists
            if (irrigationPositions.sprinklers.length > 0) {
                generateSprinklerSystem();
            }
            if (irrigationPositions.pivots.length > 0) {
                generatePivotSystem();
            }
        };
        // debounce via rAF to avoid flooding
        raf = requestAnimationFrame(doRegen);
        return () => {
            if (raf) cancelAnimationFrame(raf);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parsedRotationAngle]);

    // Fit map to main area when main area changes
    useEffect(() => {
        if (mapRef.current && finalMainArea.length >= 3) {
            const bounds = new google.maps.LatLngBounds();
            finalMainArea.forEach((coord) => {
                bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
            });
            mapRef.current.fitBounds(bounds);
        }
    }, [finalMainArea]);

    const handleIrrigationTypeSelect = (type: string) => {
        // Clear all existing irrigation overlays when switching types
        irrigationMarkersRef.current.forEach((marker) => marker.setMap(null));
        irrigationMarkersRef.current = [];
        irrigationCirclesRef.current.forEach((circle) => circle.setMap(null));
        irrigationCirclesRef.current = [];

        // Reset irrigation counts when switching types
        setIrrigationCounts({
            sprinkler_system: 0,
            pivot: 0,
            drip_tape: 0,
            water_jet_tape: 0,
        });

        // Clear irrigation positions when switching types
        setIrrigationPositions({
            sprinklers: [],
            pivots: [],
            dripTapes: [],
            waterJets: [],
        });

        setSelectedIrrigationType(type);
    };

    // Function for updating irrigation settings
    const handleSettingsChange = (type: string, field: string, value: number | string) => {
        setIrrigationSettings((prev) => ({
            ...prev,
            [type]: {
                ...prev[type as keyof typeof prev],
                [field]: value,
            },
        }));
    };

    // ===== SPRINKLER MANAGEMENT FUNCTIONS =====

    // Add sprinkler at position
    const addSprinkler = useCallback((position: { lat: number; lng: number }) => {
        const newSprinkler = { lat: position.lat, lng: position.lng };
        setIrrigationPositions((prev) => ({
            ...prev,
            sprinklers: [...prev.sprinklers, newSprinkler],
        }));
        setIrrigationCounts((prev) => ({ ...prev, sprinkler_system: prev.sprinkler_system + 1 }));
        console.log('Added sprinkler:', newSprinkler);
    }, []);

    // Update sprinkler position
    const updateSprinklerPosition = useCallback(
        (index: number, newPosition: { lat: number; lng: number }) => {
            setIrrigationPositions((prev) => ({
                ...prev,
                sprinklers: prev.sprinklers.map((sprinkler, i) =>
                    i === index ? { lat: newPosition.lat, lng: newPosition.lng } : sprinkler
                ),
            }));
            console.log('Updated sprinkler position:', index, newPosition);
        },
        []
    );

    // Delete sprinkler
    const deleteSprinkler = useCallback((index: number) => {
        setIrrigationPositions((prev) => ({
            ...prev,
            sprinklers: prev.sprinklers.filter((_, i) => i !== index),
        }));
        setIrrigationCounts((prev) => ({
            ...prev,
            sprinkler_system: Math.max(0, prev.sprinkler_system - 1),
        }));
        console.log('Deleted sprinkler:', index);
    }, []);

    // Handle sprinkler mode change
    const handleSprinklerModeChange = useCallback((mode: 'none' | 'add' | 'move' | 'delete') => {
        setSprinklerMode(mode);

        // Clear selection when changing modes
        if (mode !== 'delete') {
            setSelectedSprinklers([]);
            setIsSelecting(false);
            setSelectionStart(null);
            setSelectionEnd(null);
            if (selectionRectangleRef.current) {
                selectionRectangleRef.current.setMap(null);
                selectionRectangleRef.current = null;
            }
        }

        // Control map dragging and cursor based on mode
        if (mapRef.current) {
            const mapDiv = mapRef.current.getDiv();

            switch (mode) {
                case 'add':
                    mapRef.current.setOptions({
                        draggable: false,
                        scrollwheel: true,
                        disableDoubleClickZoom: true,
                        draggableCursor: 'crosshair',
                        draggingCursor: 'crosshair',
                    });
                    mapDiv.style.cursor = 'crosshair';
                    break;
                case 'move':
                    mapRef.current.setOptions({
                        draggable: false,
                        scrollwheel: true,
                        disableDoubleClickZoom: true,
                        draggableCursor: 'move',
                        draggingCursor: 'move',
                    });
                    mapDiv.style.cursor = 'move';
                    break;
                case 'delete':
                    mapRef.current.setOptions({
                        draggable: false,
                        scrollwheel: true,
                        disableDoubleClickZoom: true,
                        draggableCursor: 'pointer',
                        draggingCursor: 'pointer',
                    });
                    mapDiv.style.cursor = 'pointer';
                    break;
                default:
                    mapRef.current.setOptions({
                        draggable: true,
                        scrollwheel: true,
                        disableDoubleClickZoom: false,
                        draggableCursor: undefined,
                        draggingCursor: undefined,
                    });
                    mapDiv.style.cursor = '';
                    mapDiv.style.userSelect = '';
                    break;
            }
        }

        console.log('Sprinkler mode changed to:', mode);
    }, []);

    // Handle map click for adding sprinklers
    const handleMapClickForSprinkler = useCallback(
        (event: google.maps.MapMouseEvent) => {
            if (sprinklerMode === 'add' && event.latLng) {
                addSprinkler({
                    lat: event.latLng.lat(),
                    lng: event.latLng.lng(),
                });
            }
        },
        [sprinklerMode, addSprinkler]
    );

    // Handle selection rectangle drawing
    const handleSelectionStart = useCallback(
        (event: google.maps.MapMouseEvent) => {
            if (sprinklerMode === 'delete' && event.latLng) {
                // Prevent default map behavior
                if (event.stop) {
                    event.stop();
                }

                console.log('Selection started at:', event.latLng.lat(), event.latLng.lng());

                setIsSelecting(true);
                setSelectionStart({
                    lat: event.latLng.lat(),
                    lng: event.latLng.lng(),
                });
                setSelectionEnd(null);

                // Clear previous selection rectangle
                if (selectionRectangleRef.current) {
                    selectionRectangleRef.current.setMap(null);
                    selectionRectangleRef.current = null;
                }
            }
        },
        [sprinklerMode]
    );

    const handleSelectionMove = useCallback(
        (event: google.maps.MapMouseEvent) => {
            if (sprinklerMode === 'delete' && isSelecting && selectionStart && event.latLng) {
                const currentEnd = {
                    lat: event.latLng.lat(),
                    lng: event.latLng.lng(),
                };
                setSelectionEnd(currentEnd);

                // Update selection rectangle
                if (selectionRectangleRef.current) {
                    selectionRectangleRef.current.setMap(null);
                }

                const bounds = new google.maps.LatLngBounds();
                bounds.extend(new google.maps.LatLng(selectionStart.lat, selectionStart.lng));
                bounds.extend(new google.maps.LatLng(currentEnd.lat, currentEnd.lng));

                selectionRectangleRef.current = new google.maps.Rectangle({
                    bounds: bounds,
                    fillColor: '#3b82f6',
                    fillOpacity: 0.2,
                    strokeColor: '#1d4ed8',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    map: mapRef.current,
                    clickable: false,
                    zIndex: 3000,
                });
            }
        },
        [sprinklerMode, isSelecting, selectionStart]
    );

    const handleSelectionEnd = useCallback(() => {
        if (sprinklerMode === 'delete' && isSelecting && selectionStart && selectionEnd) {
            // Find sprinklers within selection rectangle
            const selectedIndices: number[] = [];
            const minLat = Math.min(selectionStart.lat, selectionEnd.lat);
            const maxLat = Math.max(selectionStart.lat, selectionEnd.lat);
            const minLng = Math.min(selectionStart.lng, selectionEnd.lng);
            const maxLng = Math.max(selectionStart.lng, selectionEnd.lng);

            irrigationPositions.sprinklers.forEach((sprinkler, index) => {
                if (
                    sprinkler.lat >= minLat &&
                    sprinkler.lat <= maxLat &&
                    sprinkler.lng >= minLng &&
                    sprinkler.lng <= maxLng
                ) {
                    selectedIndices.push(index);
                }
            });

            setSelectedSprinklers(selectedIndices);
            console.log('Selected sprinklers:', selectedIndices);
        }

        setIsSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);

        // Keep selection rectangle visible for a moment
        setTimeout(() => {
            if (selectionRectangleRef.current) {
                selectionRectangleRef.current.setMap(null);
                selectionRectangleRef.current = null;
            }
        }, 1000);
    }, [sprinklerMode, isSelecting, selectionStart, selectionEnd, irrigationPositions.sprinklers]);

    // Delete selected sprinklers
    const deleteSelectedSprinklers = useCallback(() => {
        if (selectedSprinklers.length > 0) {
            // Sort indices in descending order to avoid index shifting issues
            const sortedIndices = [...selectedSprinklers].sort((a, b) => b - a);

            setIrrigationPositions((prev) => {
                const newSprinklers = [...prev.sprinklers];
                sortedIndices.forEach((index) => {
                    newSprinklers.splice(index, 1);
                });
                return { ...prev, sprinklers: newSprinklers };
            });

            setIrrigationCounts((prev) => ({
                ...prev,
                sprinkler_system: Math.max(0, prev.sprinkler_system - selectedSprinklers.length),
            }));

            setSelectedSprinklers([]);
            console.log('Deleted selected sprinklers:', selectedSprinklers);
        }
    }, [selectedSprinklers]);

    // Helper function to check if point is inside polygon
    const isPointInPolygon = useCallback(
        (point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean => {
            let inside = false;
            const x = point.lat;
            const y = point.lng;

            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i].lat;
                const yi = polygon[i].lng;
                const xj = polygon[j].lat;
                const yj = polygon[j].lng;

                if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
                    inside = !inside;
                }
            }

            return inside;
        },
        []
    );

    // Helper function to check if point is inside any obstacle
    const isPointInObstacle = useCallback(
        (point: { lat: number; lng: number }): boolean => {
            return finalObstacles.some((obstacle) => {
                if (obstacle.coordinates.length < 3) return false;
                return isPointInPolygon(point, obstacle.coordinates);
            });
        },
        [finalObstacles, isPointInPolygon]
    );

    // Optimized generateSprinklerSystem function with better performance and resource management
    const generateSprinklerSystem = useCallback(async () => {
        if (!mapRef.current || finalMainArea.length < 3) return;

        setIsGeneratingIrrigation(true);

        try {
            // Clear existing irrigation overlays
            irrigationMarkersRef.current.forEach((marker) => marker.setMap(null));
            irrigationMarkersRef.current = [];
            irrigationCirclesRef.current.forEach((circle) => circle.setMap(null));
            irrigationCirclesRef.current = [];

            const radius = irrigationSettings.sprinkler_system.coverageRadius;
            const overlap = irrigationSettings.sprinkler_system.overlap / 100;
            const effectiveSpacing = radius * 2 * (1 - overlap);
            const rotationAngleRad = (finalRotationAngle * Math.PI) / 180;
            const bufferDistance = effectiveSpacing * 0.3;

            // Pre-calculate trigonometric values for better performance
            const cosA = Math.cos(-rotationAngleRad);
            const sinA = Math.sin(-rotationAngleRad);
            const cosBack = Math.cos(rotationAngleRad);
            const sinBack = Math.sin(rotationAngleRad);

            // Optimized geometry helper functions
            const computeCentroid = (points: { lat: number; lng: number }[]) => {
                if (points.length === 0) return { lat: 0, lng: 0 };
                let sumLat = 0,
                    sumLng = 0;
                for (const p of points) {
                    sumLat += p.lat;
                    sumLng += p.lng;
                }
                return { lat: sumLat / points.length, lng: sumLng / points.length };
            };

            const toLocalXY = (
                p: { lat: number; lng: number },
                origin: { lat: number; lng: number }
            ) => {
                const latFactor = 111000;
                const lngFactor = 111000 * Math.cos((origin.lat * Math.PI) / 180);
                return {
                    x: (p.lng - origin.lng) * lngFactor,
                    y: (p.lat - origin.lat) * latFactor,
                };
            };

            const toLatLngFromXY = (
                xy: { x: number; y: number },
                origin: { lat: number; lng: number }
            ) => {
                const latFactor = 111000;
                const lngFactor = 111000 * Math.cos((origin.lat * Math.PI) / 180);
                return {
                    lat: xy.y / latFactor + origin.lat,
                    lng: xy.x / lngFactor + origin.lng,
                };
            };

            // Optimized rotation function using pre-calculated values
            const rotateXY = (xy: { x: number; y: number }, useBackRotation = false) => {
                const cos = useBackRotation ? cosBack : cosA;
                const sin = useBackRotation ? sinBack : sinA;
                return {
                    x: xy.x * cos - xy.y * sin,
                    y: xy.x * sin + xy.y * cos,
                };
            };

            // Optimized point-in-polygon check
            const isPointInPolygonXY = (
                point: { x: number; y: number },
                polygon: Array<{ x: number; y: number }>
            ): boolean => {
                let inside = false;
                const { x, y } = point;
                for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                    const xi = polygon[i].x,
                        yi = polygon[i].y;
                    const xj = polygon[j].x,
                        yj = polygon[j].y;
                    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
                        inside = !inside;
                    }
                }
                return inside;
            };

            // Convert and rotate coordinates once
            const origin = computeCentroid(finalMainArea);
            const mainAreaXY = finalMainArea.map((p) => toLocalXY(p, origin));
            const obstaclesXY = finalObstacles.map((o) =>
                o.coordinates.map((p) => toLocalXY(p, origin))
            );

            const rotatedMain = mainAreaXY.map((p) => rotateXY(p));
            const rotatedObstacles = obstaclesXY.map((poly) => poly.map((p) => rotateXY(p)));

            // Calculate bounds efficiently
            const xs = rotatedMain.map((p) => p.x);
            const ys = rotatedMain.map((p) => p.y);
            const minX = Math.min(...xs),
                maxX = Math.max(...xs);
            const minY = Math.min(...ys),
                maxY = Math.max(...ys);

            // Generate grid positions more efficiently
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            const totalWidth = maxX - minX;
            const totalHeight = maxY - minY;
            const maxCols = Math.floor(totalWidth / effectiveSpacing);
            const maxRows = Math.floor(totalHeight / effectiveSpacing);

            // Generate all grid positions at once
            const allPositions: { x: number; y: number }[] = [];

            // Generate rows and columns more efficiently
            const halfCols = Math.floor(maxCols / 2);
            const halfRows = Math.floor(maxRows / 2);

            for (let row = -halfRows; row <= halfRows; row++) {
                const y = centerY + row * effectiveSpacing;
                if (y < minY || y > maxY) continue;

                for (let col = -halfCols; col <= halfCols; col++) {
                    const x = centerX + col * effectiveSpacing;
                    if (x < minX || x > maxX) continue;

                    allPositions.push({ x, y });
                }
            }

            // Process positions in batches for better performance
            const sprinklers: { lat: number; lng: number }[] = [];
            const batchSize = 100; // Process 100 positions at a time

=======
    // Optimized generateSprinklerSystem function with better performance and resource management
    const generateSprinklerSystem = useCallback(async () => {
        if (!mapRef.current || finalMainArea.length < 3) return;

        setIsGeneratingIrrigation(true);

        try {
            // Clear existing sprinkler overlays เท่านั้น (ไม่กระทบ pivot)
            // เก็บ index ของ sprinkler markers ก่อนลบ
            const sprinklerIndices: number[] = [];
            irrigationMarkersRef.current.forEach((marker, index) => {
                if (marker.getTitle()?.includes('Sprinkler')) {
                    sprinklerIndices.push(index);
                }
            });
            
            // ลบ markers และ circles ที่เกี่ยวข้องกัน
            sprinklerIndices.sort((a, b) => b - a).forEach(index => {
                // ลบ marker
                if (irrigationMarkersRef.current[index]) {
                    irrigationMarkersRef.current[index].setMap(null);
                    irrigationMarkersRef.current.splice(index, 1);
                }
                // ลบ circle ที่ตรงกับ index เดียวกัน
                if (irrigationCirclesRef.current[index]) {
                    irrigationCirclesRef.current[index].setMap(null);
                    irrigationCirclesRef.current.splice(index, 1);
                }
            });

            const sprinklerSettings = getSprinklerSettings();
            const radius = sprinklerSettings.coverageRadius || 8;
            const overlap = (sprinklerSettings.overlap || 0) / 100;
            const effectiveSpacing = radius * 2 * (1 - overlap);
            const rotationAngleRad = (parsedRotationAngle * Math.PI) / 180;
            const bufferDistance = effectiveSpacing * 0.3;

            // Pre-calculate trigonometric values for better performance
            const cosA = Math.cos(-rotationAngleRad);
            const sinA = Math.sin(-rotationAngleRad);
            const cosBack = Math.cos(rotationAngleRad);
            const sinBack = Math.sin(rotationAngleRad);

            // Optimized geometry helper functions
            const computeCentroid = (points: { lat: number; lng: number }[]) => {
                if (points.length === 0) return { lat: 0, lng: 0 };
                let sumLat = 0,
                    sumLng = 0;
                for (const p of points) {
                    sumLat += p.lat;
                    sumLng += p.lng;
                }
                return { lat: sumLat / points.length, lng: sumLng / points.length };
            };

            const toLocalXY = (
                p: { lat: number; lng: number },
                origin: { lat: number; lng: number }
            ) => {
                const latFactor = 111000;
                const lngFactor = 111000 * Math.cos((origin.lat * Math.PI) / 180);
                return {
                    x: (p.lng - origin.lng) * lngFactor,
                    y: (p.lat - origin.lat) * latFactor,
                };
            };

            const toLatLngFromXY = (
                xy: { x: number; y: number },
                origin: { lat: number; lng: number }
            ) => {
                const latFactor = 111000;
                const lngFactor = 111000 * Math.cos((origin.lat * Math.PI) / 180);
                return {
                    lat: xy.y / latFactor + origin.lat,
                    lng: xy.x / lngFactor + origin.lng,
                };
            };

            // Optimized rotation function using pre-calculated values
            const rotateXY = (xy: { x: number; y: number }, useBackRotation = false) => {
                const cos = useBackRotation ? cosBack : cosA;
                const sin = useBackRotation ? sinBack : sinA;
                return {
                    x: xy.x * cos - xy.y * sin,
                    y: xy.x * sin + xy.y * cos,
                };
            };

            // Optimized point-in-polygon check
            const isPointInPolygonXY = (
                point: { x: number; y: number },
                polygon: Array<{ x: number; y: number }>
            ): boolean => {
                let inside = false;
                const { x, y } = point;
                for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                    const xi = polygon[i].x,
                        yi = polygon[i].y;
                    const xj = polygon[j].x,
                        yj = polygon[j].y;
                    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
                        inside = !inside;
                    }
                }
                return inside;
            };

            // Convert and rotate coordinates once
            const origin = computeCentroid(finalMainArea);
            const mainAreaXY = finalMainArea.map((p) => toLocalXY(p, origin));
            const obstaclesXY = finalObstacles.map((o) =>
                o.coordinates.map((p) => toLocalXY(p, origin))
            );

            const rotatedMain = mainAreaXY.map((p) => rotateXY(p));
            const rotatedObstacles = obstaclesXY.map((poly) => poly.map((p) => rotateXY(p)));

            // Calculate bounds efficiently
            const xs = rotatedMain.map((p) => p.x);
            const ys = rotatedMain.map((p) => p.y);
            const minX = Math.min(...xs),
                maxX = Math.max(...xs);
            const minY = Math.min(...ys),
                maxY = Math.max(...ys);

            // Generate grid positions more efficiently
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            const totalWidth = maxX - minX;
            const totalHeight = maxY - minY;
            const maxCols = Math.floor(totalWidth / effectiveSpacing);
            const maxRows = Math.floor(totalHeight / effectiveSpacing);

            // Generate all grid positions at once
            const allPositions: { x: number; y: number }[] = [];

            // Generate rows and columns more efficiently
            const halfCols = Math.floor(maxCols / 2);
            const halfRows = Math.floor(maxRows / 2);

            for (let row = -halfRows; row <= halfRows; row++) {
                const y = centerY + row * effectiveSpacing;
                if (y < minY || y > maxY) continue;

                for (let col = -halfCols; col <= halfCols; col++) {
                    const x = centerX + col * effectiveSpacing;
                    if (x < minX || x > maxX) continue;

                    allPositions.push({ x, y });
                }
            }

            // Process positions in batches for better performance
            const sprinklers: { lat: number; lng: number }[] = [];
            const batchSize = 100; // Process 100 positions at a time

>>>>>>> main
            for (let i = 0; i < allPositions.length; i += batchSize) {
                // Yield to browser every batch
                await new Promise((resolve) => requestAnimationFrame(resolve));

                const batch = allPositions.slice(i, i + batchSize);

                for (const pt of batch) {
                    const insideMain = isPointInPolygonXY(pt, rotatedMain);
                    if (!insideMain) continue;

                    const insideAnyHole = rotatedObstacles.some((poly) =>
                        isPointInPolygonXY(pt, poly)
                    );
                    if (insideAnyHole) continue;

                    // Simplified distance check - only check main area edge
                    let minDistance = Infinity;
                    for (let j = 0; j < rotatedMain.length; j++) {
                        const k = (j + 1) % rotatedMain.length;
                        const e1 = rotatedMain[j],
                            e2 = rotatedMain[k];
                        const A = pt.x - e1.x,
                            B = pt.y - e1.y;
                        const C = e2.x - e1.x,
                            D = e2.y - e1.y;
                        const dot = A * C + B * D;
                        const lenSq = C * C + D * D;
                        const param = lenSq !== 0 ? Math.max(0, Math.min(1, dot / lenSq)) : 0;
                        const xx = e1.x + param * C,
                            yy = e1.y + param * D;
                        const dx = pt.x - xx,
                            dy = pt.y - yy;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        minDistance = Math.min(minDistance, distance);
                    }

                    if (minDistance >= bufferDistance) {
                        const unrotated = rotateXY(pt, true);
                        const latLng = toLatLngFromXY(unrotated, origin);
                        sprinklers.push(latLng);
                    }
                }
            }

            // Update irrigation count
            setIrrigationCounts((prev) => ({ ...prev, sprinkler_system: sprinklers.length }));
            setIrrigationPositions((prev) => ({ ...prev, sprinklers }));

<<<<<<< HEAD
            // Create markers and circles in batches for better performance
            const markerBatchSize = 50;
            for (let i = 0; i < sprinklers.length; i += markerBatchSize) {
                await new Promise((resolve) => requestAnimationFrame(resolve));

                const batch = sprinklers.slice(i, i + markerBatchSize);

                batch.forEach((pos, batchIndex) => {
                    const index = i + batchIndex;

                    // Create marker with optimized icon
                    const marker = new google.maps.Marker({
                        position: pos,
                        map: mapRef.current,
                        icon: {
                            url:
                                'data:image/svg+xml;charset=UTF-8,' +
                                encodeURIComponent(`
=======
            // Create all markers and circles at once for full area generation
            sprinklers.forEach((pos, index) => {
                // Create marker with optimized icon
                const marker = new google.maps.Marker({
                    position: pos,
                    map: mapRef.current,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
>>>>>>> main
								<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
									<circle cx="6" cy="6" r="5" fill="#3b82f6" stroke="#1d4ed8" stroke-width="1"/>
									<circle cx="6" cy="6" r="2" fill="#ffffff"/>
								</svg>
							`),
<<<<<<< HEAD
                            scaledSize: new google.maps.Size(12, 12),
                            anchor: new google.maps.Point(6, 6),
                        },
                        title: `Sprinkler ${index + 1}`,
                        optimized: true,
                        clickable: false,
                        zIndex: 2000,
                    });
                    irrigationMarkersRef.current.push(marker);

                    // Create coverage circle
                    const circle = new google.maps.Circle({
                        center: pos,
                        radius: radius,
                        fillColor: '#3b82f6',
                        fillOpacity: 0.2,
                        strokeColor: '#1d4ed8',
                        strokeOpacity: 0.6,
                        strokeWeight: 1,
                        map: mapRef.current,
                        clickable: false,
                        zIndex: 2000,
                    });
                    irrigationCirclesRef.current.push(circle);
                });
            }
        } catch (error) {
            console.error('Error generating sprinkler system:', error);
=======
                        scaledSize: new google.maps.Size(12, 12),
                        anchor: new google.maps.Point(6, 6),
                    },
                    title: `Sprinkler ${index + 1}`,
                    optimized: true,
                    clickable: false,
                    zIndex: 2000,
                });
                irrigationMarkersRef.current.push(marker);

                // Create coverage circle
                const circle = new google.maps.Circle({
                    center: pos,
                    radius: radius,
                    fillColor: '#3b82f6',
                    fillOpacity: 0.2,
                    strokeColor: '#1d4ed8',
                    strokeOpacity: 0.6,
                    strokeWeight: 1,
                    map: mapRef.current,
                    clickable: false,
                    zIndex: 2000,
                });
                irrigationCirclesRef.current.push(circle);
            });
        } catch {
            // Error generating sprinkler system
>>>>>>> main
        } finally {
            setIsGeneratingIrrigation(false);
        }
    }, [
        finalMainArea,
        finalObstacles,
<<<<<<< HEAD
        finalRotationAngle,
        irrigationSettings.sprinkler_system.coverageRadius,
        irrigationSettings.sprinkler_system.overlap,
=======
        getSprinklerSettings,
        parsedRotationAngle,
>>>>>>> main
    ]);

    // Updated generatePivotSystem function to use center-first row placement like plant points
    const generatePivotSystem = useCallback(async () => {
        if (!mapRef.current || finalMainArea.length < 3) return;

        setIsGeneratingIrrigation(true);

        try {
<<<<<<< HEAD
            // Clear existing irrigation overlays
            irrigationMarkersRef.current.forEach((marker) => marker.setMap(null));
            irrigationMarkersRef.current = [];
            irrigationCirclesRef.current.forEach((circle) => circle.setMap(null));
            irrigationCirclesRef.current = [];

            const radius = irrigationSettings.pivot.coverageRadius;
            const overlap = irrigationSettings.pivot.overlap / 100;
            const effectiveSpacing = radius * 2 * (1 - overlap); // Distance between pivot centers
            const rotationAngleRad = (finalRotationAngle * Math.PI) / 180;
=======
            // Clear existing pivot overlays เท่านั้น (ไม่กระทบ sprinkler)
            // เก็บ index ของ pivot markers ก่อนลบ
            const pivotIndices: number[] = [];
            irrigationMarkersRef.current.forEach((marker, index) => {
                if (marker.getTitle()?.includes('Pivot')) {
                    pivotIndices.push(index);
                }
            });
            
            // ลบ markers และ circles ที่เกี่ยวข้องกัน
            pivotIndices.sort((a, b) => b - a).forEach(index => {
                // ลบ marker
                if (irrigationMarkersRef.current[index]) {
                    irrigationMarkersRef.current[index].setMap(null);
                    irrigationMarkersRef.current.splice(index, 1);
                }
                // ลบ circle ที่ตรงกับ index เดียวกัน
                if (irrigationCirclesRef.current[index]) {
                    irrigationCirclesRef.current[index].setMap(null);
                    irrigationCirclesRef.current.splice(index, 1);
                }
            });

            const pivotSettings = getPivotSettings();
            const radius = pivotSettings.coverageRadius || 165;
            const overlap = (pivotSettings.overlap || 0) / 100;
            const effectiveSpacing = radius * 2 * (1 - overlap); // Distance between pivot centers
            const rotationAngleRad = (parsedRotationAngle * Math.PI) / 180;
>>>>>>> main
            const bufferDistance = effectiveSpacing * 0.3; // Buffer from edges like plant points

            // Geometry helper functions (same as plant point generation)
            const computeCentroid = (points: { lat: number; lng: number }[]) => {
                if (points.length === 0) return { lat: 0, lng: 0 };
                let sumLat = 0;
                let sumLng = 0;
                for (const p of points) {
                    sumLat += p.lat;
                    sumLng += p.lng;
                }
                return { lat: sumLat / points.length, lng: sumLng / points.length };
            };

            const toLocalXY = (
                p: { lat: number; lng: number },
                origin: { lat: number; lng: number }
            ) => {
                const latFactor = 111000;
                const lngFactor = 111000 * Math.cos((origin.lat * Math.PI) / 180);
                return {
                    x: (p.lng - origin.lng) * lngFactor,
                    y: (p.lat - origin.lat) * latFactor,
                };
            };

            const toLatLngFromXY = (
                xy: { x: number; y: number },
                origin: { lat: number; lng: number }
            ) => {
                const latFactor = 111000;
                const lngFactor = 111000 * Math.cos((origin.lat * Math.PI) / 180);
                return {
                    lat: xy.y / latFactor + origin.lat,
                    lng: xy.x / lngFactor + origin.lng,
                };
            };

            const rotateXY = (xy: { x: number; y: number }, angleRad: number) => {
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);
                return {
                    x: xy.x * cosA - xy.y * sinA,
                    y: xy.x * sinA + xy.y * cosA,
                };
            };

            const isPointInPolygonXY = (
                point: { x: number; y: number },
                polygon: Array<{ x: number; y: number }>
            ): boolean => {
                let inside = false;
                const x = point.x;
                const y = point.y;
                for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                    const xi = polygon[i].x;
                    const yi = polygon[i].y;
                    const xj = polygon[j].x;
                    const yj = polygon[j].y;
                    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
                        inside = !inside;
                    }
                }
                return inside;
            };

            const distanceToPolygonEdgeXY = (
                point: { x: number; y: number },
                polygon: Array<{ x: number; y: number }>
            ): number => {
                let minDistance = Infinity;
                for (let i = 0; i < polygon.length; i++) {
                    const j = (i + 1) % polygon.length;
                    const e1 = polygon[i];
                    const e2 = polygon[j];
                    const A = point.x - e1.x;
                    const B = point.y - e1.y;
                    const C = e2.x - e1.x;
                    const D = e2.y - e1.y;
                    const dot = A * C + B * D;
                    const lenSq = C * C + D * D;
                    let param = -1;
                    if (lenSq !== 0) param = dot / lenSq;
                    let xx, yy;
                    if (param < 0) {
                        xx = e1.x;
                        yy = e1.y;
                    } else if (param > 1) {
                        xx = e2.x;
                        yy = e2.y;
                    } else {
                        xx = e1.x + param * C;
                        yy = e1.y + param * D;
                    }
                    const dx = point.x - xx;
                    const dy = point.y - yy;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    minDistance = Math.min(minDistance, distance);
                }
                return minDistance;
            };

            // Convert main area and obstacles to local coordinates
            const origin = computeCentroid(finalMainArea);
            const mainAreaXY = finalMainArea.map((p) => toLocalXY(p, origin));
            const obstaclesXY = finalObstacles.map((o) =>
                o.coordinates.map((p) => toLocalXY(p, origin))
            );

            // Rotate main area and obstacles to align with rotation angle
            const rotatedMain = mainAreaXY.map((p) => rotateXY(p, -rotationAngleRad));
            const rotatedObstacles = obstaclesXY.map((poly) =>
                poly.map((p) => rotateXY(p, -rotationAngleRad))
            );

            // Calculate bounds of rotated main area
            const xs = rotatedMain.map((p) => p.x);
            const ys = rotatedMain.map((p) => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            // Calculate center Y coordinate for starting from the middle (like plant points)
            const centerY = (minY + maxY) / 2;

            // Calculate how many rows we can fit above and below center
            const totalHeight = maxY - minY;
            const maxRows = Math.floor(totalHeight / effectiveSpacing);
            const rowsAboveCenter = Math.floor(maxRows / 2);
            const rowsBelowCenter = maxRows - rowsAboveCenter;

            // Generate rows starting from center and expanding outward
            const allRowYs: number[] = [];

            // Add center row first
            allRowYs.push(centerY);

            // Add rows above center (going up)
            for (let i = 1; i <= rowsAboveCenter; i++) {
                const yAbove = centerY + i * effectiveSpacing;
                if (yAbove <= maxY) {
                    allRowYs.push(yAbove);
                }
            }

            // Add rows below center (going down)
            for (let i = 1; i <= rowsBelowCenter; i++) {
                const yBelow = centerY - i * effectiveSpacing;
                if (yBelow >= minY) {
                    allRowYs.push(yBelow);
                }
            }

            // Sort rows from bottom to top for consistent ordering
            allRowYs.sort((a, b) => a - b);

            // Generate pivots for each row with improved symmetrical placement
            const pivots: { lat: number; lng: number }[] = [];

            // Calculate center X coordinate for symmetrical column placement
            const centerX = (minX + maxX) / 2;

            // Calculate how many columns we can fit left and right of center
            const totalWidth = maxX - minX;
            const maxCols = Math.floor(totalWidth / effectiveSpacing);
            const colsLeftOfCenter = Math.floor(maxCols / 2);
            const colsRightOfCenter = maxCols - colsLeftOfCenter;

            // Generate columns starting from center and expanding outward
            const allColXs: number[] = [];

            // Add center column first
            allColXs.push(centerX);

            // Add columns right of center (going right)
            for (let i = 1; i <= colsRightOfCenter; i++) {
                const xRight = centerX + i * effectiveSpacing;
                if (xRight <= maxX) {
                    allColXs.push(xRight);
                }
            }

            // Add columns left of center (going left)
            for (let i = 1; i <= colsLeftOfCenter; i++) {
                const xLeft = centerX - i * effectiveSpacing;
                if (xLeft >= minX) {
                    allColXs.push(xLeft);
                }
            }

            // Sort columns from left to right for consistent ordering
            allColXs.sort((a, b) => a - b);

            for (let rowIndex = 0; rowIndex < allRowYs.length; rowIndex++) {
                const y = allRowYs[rowIndex];

                for (let colIndex = 0; colIndex < allColXs.length; colIndex++) {
                    const x = allColXs[colIndex];
                    const pt = { x, y };
                    const insideMain = isPointInPolygonXY(pt, rotatedMain);
                    const insideAnyHole = rotatedObstacles.some((poly) =>
                        isPointInPolygonXY(pt, poly)
                    );

                    if (insideMain && !insideAnyHole) {
                        // Check distance from edges (like plant points)
                        const distanceFromEdge = Math.min(
                            distanceToPolygonEdgeXY(pt, rotatedMain),
                            ...rotatedObstacles.map((poly) => distanceToPolygonEdgeXY(pt, poly))
                        );

                        if (distanceFromEdge >= bufferDistance) {
                            // Rotate back to original space
                            const unrotated = rotateXY(pt, rotationAngleRad);
                            const latLng = toLatLngFromXY(unrotated, origin);

                            pivots.push(latLng);
                        }
                    }
                }
            }

            // Update irrigation count
            setIrrigationCounts((prev) => ({ ...prev, pivot: pivots.length }));

            // Save pivot positions
            setIrrigationPositions((prev) => ({ ...prev, pivots }));

<<<<<<< HEAD
            // Create markers and circles in batches for better performance
            const markerBatchSize = 50;
            for (let i = 0; i < pivots.length; i += markerBatchSize) {
                await new Promise((resolve) => requestAnimationFrame(resolve));

                const batch = pivots.slice(i, i + markerBatchSize);

                batch.forEach((pos, batchIndex) => {
                    const index = i + batchIndex;

                    // Create marker
                    const marker = new google.maps.Marker({
                        position: pos,
                        map: mapRef.current,
                        icon: {
                            url:
                                'data:image/svg+xml;charset=UTF-8,' +
                                encodeURIComponent(`
=======
            // Create all markers and circles at once for full area generation
            pivots.forEach((pos, index) => {
                // Create marker
                const marker = new google.maps.Marker({
                    position: pos,
                    map: mapRef.current,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
>>>>>>> main
								<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
									<circle cx="6" cy="6" r="5" fill="#f97316" stroke="#ea580c" stroke-width="1"/>
									<circle cx="6" cy="6" r="2" fill="#ffffff"/>
								</svg>
							`),
<<<<<<< HEAD
                            scaledSize: new google.maps.Size(12, 12),
                            anchor: new google.maps.Point(6, 6),
                        },
                        title: `Pivot ${index + 1}`,
                        optimized: true,
                        clickable: false,
                        zIndex: 2000,
                    });
                    irrigationMarkersRef.current.push(marker);

                    // Create coverage circle
                    const circle = new google.maps.Circle({
                        center: pos,
                        radius: radius,
                        fillColor: '#f97316',
                        fillOpacity: 0.2,
                        strokeColor: '#ea580c',
                        strokeOpacity: 1.0,
                        strokeWeight: 1,
                        map: mapRef.current,
                        clickable: false,
                        zIndex: 2000,
                    });
                    irrigationCirclesRef.current.push(circle);
                });
            }
        } catch (error) {
            console.error('Error generating pivot system:', error);
=======
                        scaledSize: new google.maps.Size(12, 12),
                        anchor: new google.maps.Point(6, 6),
                    },
                    title: `Pivot ${index + 1}`,
                    optimized: true,
                    clickable: false,
                    zIndex: 2000,
                });
                irrigationMarkersRef.current.push(marker);

                // Create coverage circle
                const circle = new google.maps.Circle({
                    center: pos,
                    radius: radius,
                    fillColor: '#f97316',
                    fillOpacity: 0.2,
                    strokeColor: '#ea580c',
                    strokeOpacity: 1.0,
                    strokeWeight: 1,
                    map: mapRef.current,
                    clickable: false,
                    zIndex: 2000,
                });
                irrigationCirclesRef.current.push(circle);
            });
        } catch {
            // Error generating pivot system
>>>>>>> main
        } finally {
            setIsGeneratingIrrigation(false);
        }
    }, [
        finalMainArea,
        finalObstacles,
<<<<<<< HEAD
        finalRotationAngle,
        irrigationSettings.pivot.coverageRadius,
        irrigationSettings.pivot.overlap,
    ]);

    // Updated generateDripTape function to use center-first row placement like plant points
    const generateDripTape = useCallback(async () => {
        if (!mapRef.current || finalPlantPoints.length === 0) return;

        setIsGeneratingIrrigation(true);

        try {
            // Clear existing irrigation overlays
            irrigationMarkersRef.current.forEach((marker) => marker.setMap(null));
            irrigationMarkersRef.current = [];

            const spacing = irrigationSettings.drip_tape.emitterSpacing / 100; // Convert cm to meters
            const side = irrigationSettings.drip_tape.side;

            // Group plant points by rows (approximate)
            const rows: { lat: number; lng: number }[][] = [];
            const tolerance = spacing * 2; // Group plants within 2x spacing

            finalPlantPoints.forEach((point) => {
                let addedToRow = false;
                for (const row of rows) {
                    if (row.length > 0) {
                        const firstPlant = row[0];
                        const distance = google.maps.geometry.spherical.computeDistanceBetween(
                            new google.maps.LatLng(firstPlant.lat, firstPlant.lng),
                            new google.maps.LatLng(point.lat, point.lng)
                        );
                        if (distance < tolerance) {
                            row.push({ lat: point.lat, lng: point.lng });
                            addedToRow = true;
                            break;
                        }
                    }
                }
                if (!addedToRow) {
                    rows.push([{ lat: point.lat, lng: point.lng }]);
                }
            });

            // Sort rows by latitude to find center row
            rows.sort((a, b) => {
                const avgLatA = a.reduce((sum, p) => sum + p.lat, 0) / a.length;
                const avgLatB = b.reduce((sum, p) => sum + p.lat, 0) / b.length;
                return avgLatA - avgLatB;
            });

            // Reorder rows to start from center
            const centerIndex = Math.floor(rows.length / 2);
            const reorderedRows: { lat: number; lng: number }[][] = [];

            // Add center row first
            if (rows.length > 0) {
                reorderedRows.push(rows[centerIndex]);
            }

            // Add rows above center (going up)
            for (let i = centerIndex + 1; i < rows.length; i++) {
                reorderedRows.push(rows[i]);
            }

            // Add rows below center (going down)
            for (let i = centerIndex - 1; i >= 0; i--) {
                reorderedRows.push(rows[i]);
            }

            // Generate drip tape positions
            const dripPositions: { lat: number; lng: number }[] = [];

            reorderedRows.forEach((row) => {
                // Sort plants in row by longitude
                row.sort((a, b) => a.lng - b.lng);

                // Calculate offset based on side
                const offset = side === 'left' ? -spacing : spacing;

                // Generate drip positions along the row
                for (let i = 0; i < row.length; i++) {
                    const plant = row[i];

                    // Calculate perpendicular offset
                    const angle =
                        Math.atan2(
                            row[Math.min(i + 1, row.length - 1)].lng - row[Math.max(i - 1, 0)].lng,
                            row[Math.min(i + 1, row.length - 1)].lat - row[Math.max(i - 1, 0)].lat
                        ) +
                        Math.PI / 2;

                    const dripLat = plant.lat + (offset / 111000) * Math.cos(angle);
                    const dripLng =
                        plant.lng +
                        (offset / (111000 * Math.cos((plant.lat * Math.PI) / 180))) *
                            Math.sin(angle);

                    // Check if position is inside main area and not in any obstacle
                    if (
                        isPointInPolygon({ lat: dripLat, lng: dripLng }, finalMainArea) &&
                        !isPointInObstacle({ lat: dripLat, lng: dripLng })
                    ) {
                        dripPositions.push({ lat: dripLat, lng: dripLng });
                    }
                }
            });

            // Update irrigation count
            setIrrigationCounts((prev) => ({ ...prev, drip_tape: dripPositions.length }));

            // บันทึกตำแหน่ง drip tapes
            setIrrigationPositions((prev) => ({ ...prev, dripTapes: dripPositions }));

            // Create markers
            dripPositions.forEach((pos, index) => {
                const marker = new google.maps.Marker({
                    position: pos,
                    map: mapRef.current,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
							<svg width="8" height="8" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">
								<circle cx="4" cy="4" r="3" fill="#3b82f6" stroke="#1d4ed8" stroke-width="1"/>
							</svg>
						`),
                        scaledSize: new google.maps.Size(8, 8),
                        anchor: new google.maps.Point(4, 4),
                    },
                    title: `Drip ${index + 1}`,
                    optimized: true,
                    clickable: false,
                });
                irrigationMarkersRef.current.push(marker);
            });
        } catch (error) {
            console.error('Error generating drip tape:', error);
        } finally {
            setIsGeneratingIrrigation(false);
        }
    }, [
        finalPlantPoints,
        finalMainArea,
        irrigationSettings.drip_tape.emitterSpacing,
        irrigationSettings.drip_tape.side,
        isPointInObstacle,
        isPointInPolygon,
    ]);

    // Updated generateWaterJetTape function to use center-first row placement like plant points
    const generateWaterJetTape = useCallback(async () => {
        if (!mapRef.current || finalPlantPoints.length === 0) return;

        setIsGeneratingIrrigation(true);

        try {
            // Clear existing irrigation overlays
            irrigationMarkersRef.current.forEach((marker) => marker.setMap(null));
            irrigationMarkersRef.current = [];

            const spacing = irrigationSettings.water_jet_tape.emitterSpacing / 100; // Convert cm to meters
            const side = irrigationSettings.water_jet_tape.side;

            // Group plant points by rows (approximate)
            const rows: { lat: number; lng: number }[][] = [];
            const tolerance = spacing * 2;

            finalPlantPoints.forEach((point) => {
                let addedToRow = false;
                for (const row of rows) {
                    if (row.length > 0) {
                        const firstPlant = row[0];
                        const distance = google.maps.geometry.spherical.computeDistanceBetween(
                            new google.maps.LatLng(firstPlant.lat, firstPlant.lng),
                            new google.maps.LatLng(point.lat, point.lng)
                        );
                        if (distance < tolerance) {
                            row.push({ lat: point.lat, lng: point.lng });
                            addedToRow = true;
                            break;
                        }
                    }
                }
                if (!addedToRow) {
                    rows.push([{ lat: point.lat, lng: point.lng }]);
                }
            });

            // Sort rows by latitude to find center row
            rows.sort((a, b) => {
                const avgLatA = a.reduce((sum, p) => sum + p.lat, 0) / a.length;
                const avgLatB = b.reduce((sum, p) => sum + p.lat, 0) / b.length;
                return avgLatA - avgLatB;
            });

            // Reorder rows to start from center
            const centerIndex = Math.floor(rows.length / 2);
            const reorderedRows: { lat: number; lng: number }[][] = [];

            // Add center row first
            if (rows.length > 0) {
                reorderedRows.push(rows[centerIndex]);
            }

            // Add rows above center (going up)
            for (let i = centerIndex + 1; i < rows.length; i++) {
                reorderedRows.push(rows[i]);
            }

            // Add rows below center (going down)
            for (let i = centerIndex - 1; i >= 0; i--) {
                reorderedRows.push(rows[i]);
            }

            // Generate water jet positions
            const jetPositions: { lat: number; lng: number }[] = [];

            reorderedRows.forEach((row) => {
                // Sort plants in row by longitude
                row.sort((a, b) => a.lng - b.lng);

                // Calculate offset based on side
                const offset = side === 'left' ? -spacing : spacing;

                // Generate jet positions along the row
                for (let i = 0; i < row.length; i++) {
                    const plant = row[i];

                    // Calculate perpendicular offset
                    const angle =
                        Math.atan2(
                            row[Math.min(i + 1, row.length - 1)].lng - row[Math.max(i - 1, 0)].lng,
                            row[Math.min(i + 1, row.length - 1)].lat - row[Math.max(i - 1, 0)].lat
                        ) +
                        Math.PI / 2;

                    const jetLat = plant.lat + (offset / 111000) * Math.cos(angle);
                    const jetLng =
                        plant.lng +
                        (offset / (111000 * Math.cos((plant.lat * Math.PI) / 180))) *
                            Math.sin(angle);

                    // Check if position is inside main area and not in any obstacle
                    if (
                        isPointInPolygon({ lat: jetLat, lng: jetLng }, finalMainArea) &&
                        !isPointInObstacle({ lat: jetLat, lng: jetLng })
                    ) {
                        jetPositions.push({ lat: jetLat, lng: jetLng });
                    }
                }
            });

            // Update irrigation count
            setIrrigationCounts((prev) => ({ ...prev, water_jet_tape: jetPositions.length }));

            // บันทึกตำแหน่ง water jets
            setIrrigationPositions((prev) => ({ ...prev, waterJets: jetPositions }));

            // Create markers
            jetPositions.forEach((pos, index) => {
                const marker = new google.maps.Marker({
                    position: pos,
                    map: mapRef.current,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
							<svg width="8" height="8" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">
								<circle cx="4" cy="4" r="3" fill="#f97316" stroke="#ea580c" stroke-width="1"/>
							</svg>
						`),
                        scaledSize: new google.maps.Size(8, 8),
                        anchor: new google.maps.Point(4, 4),
                    },
                    title: `Water Jet ${index + 1}`,
                    optimized: true,
                    clickable: false,
                });
                irrigationMarkersRef.current.push(marker);
            });
        } catch (error) {
            console.error('Error generating water jet tape:', error);
        } finally {
            setIsGeneratingIrrigation(false);
        }
    }, [
        finalPlantPoints,
        finalMainArea,
        irrigationSettings.water_jet_tape.emitterSpacing,
        irrigationSettings.water_jet_tape.side,
        isPointInObstacle,
        isPointInPolygon,
    ]);

    // Function to render irrigation settings based on selected type
    const renderIrrigationSettings = () => {
        if (!selectedIrrigationType) return null;

        switch (selectedIrrigationType) {
            case 'sprinkler_system':
                return (
                    <div
                        className="rounded border border-white p-3"
                        style={{ backgroundColor: '#000005' }}
                    >
                        <h4 className="mb-3 text-sm font-medium text-white">
                            {t('Sprinkler System Settings')}
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Coverage Radius')}:{' '}
                                    {irrigationSettings.sprinkler_system.coverageRadius}m
                                </label>
                                <input
                                    type="range"
                                    min={1}
                                    max={15}
                                    step={1}
                                    value={irrigationSettings.sprinkler_system.coverageRadius}
                                    onChange={(e) =>
                                        handleSettingsChange(
                                            'sprinkler_system',
                                            'coverageRadius',
                                            parseInt(e.target.value)
                                        )
                                    }
                                    className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600"
                                    style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((irrigationSettings.sprinkler_system.coverageRadius - 1) / 14) * 100}%, #6b7280 ${((irrigationSettings.sprinkler_system.coverageRadius - 1) / 14) * 100}%, #6b7280 100%)`,
                                    }}
                                />
                                <div className="mt-1 flex justify-between text-xs text-gray-400">
                                    <span>1m</span>
                                    <span>15m</span>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Overlap')}: {irrigationSettings.sprinkler_system.overlap}%
                                </label>
                                <input
                                    type="range"
                                    min={0}
                                    max={50}
                                    step={5}
                                    value={irrigationSettings.sprinkler_system.overlap}
                                    onChange={(e) =>
                                        handleSettingsChange(
                                            'sprinkler_system',
                                            'overlap',
                                            parseInt(e.target.value)
                                        )
                                    }
                                    className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600"
                                    style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(irrigationSettings.sprinkler_system.overlap / 50) * 100}%, #6b7280 ${(irrigationSettings.sprinkler_system.overlap / 50) * 100}%, #6b7280 100%)`,
                                    }}
                                />
                                <div className="mt-1 flex justify-between text-xs text-gray-400">
                                    <span>0%</span>
                                    <span>50%</span>
                                </div>
                            </div>

                            {/* Irrigation rotation angle for sprinklers */}
                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Angle')}: {parsedRotationAngle.toFixed(1)}°
                                </label>
                                <input
                                    type="range"
                                    min={-180}
                                    max={180}
                                    step={0.5}
                                    value={parsedRotationAngle}
                                    onChange={(e) =>
                                        setParsedRotationAngle(parseFloat(e.target.value))
                                    }
                                    className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600"
                                    style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((parsedRotationAngle + 180) / 360) * 100}%, #6b7280 ${((parsedRotationAngle + 180) / 360) * 100}%, #6b7280 100%)`,
                                    }}
                                />
                                <div className="mt-1 flex justify-between text-xs text-gray-400">
                                    <span>-180°</span>
                                    <span>0°</span>
                                    <span>180°</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <button
                                        onClick={() => adjustRotationAngle(-0.5)}
                                        className="rounded border border-white bg-gray-700 px-2 py-1 text-xs text-white"
                                    >
                                        -0.5°
                                    </button>
                                    <button
                                        onClick={() => adjustRotationAngle(0.5)}
                                        className="rounded border border-white bg-gray-700 px-2 py-1 text-xs text-white"
                                    >
                                        +0.5°
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-2 block text-xs text-gray-400">
                                        {t('Flow')} (L/min)
                                    </label>
                                    <input
                                        type="number"
                                        min={5}
                                        max={30}
                                        step={1}
                                        value={irrigationSettings.sprinkler_system.flow}
                                        onChange={(e) =>
                                            handleSettingsChange(
                                                'sprinkler_system',
                                                'flow',
                                                parseInt(e.target.value) || 10
                                            )
                                        }
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                        placeholder="10"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs text-gray-400">
                                        {t('Pressure')} (bar)
                                    </label>
                                    <input
                                        type="number"
                                        min={1.5}
                                        max={4.0}
                                        step={0.1}
                                        value={irrigationSettings.sprinkler_system.pressure}
                                        onChange={(e) =>
                                            handleSettingsChange(
                                                'sprinkler_system',
                                                'pressure',
                                                parseFloat(e.target.value) || 2.5
                                            )
                                        }
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                        placeholder="2.5"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => generateSprinklerSystem()}
                                disabled={isGeneratingIrrigation}
                                className="w-full rounded bg-blue-600 px-3 py-2 text-xs text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-500"
                            >
                                {isGeneratingIrrigation
                                    ? t('Generating...')
                                    : t('Generate Sprinkler System')}
                            </button>
                            {irrigationCounts.sprinkler_system > 0 && (
                                <div className="mt-2 text-center text-xs text-blue-400">
                                    {t('Generated')}: {irrigationCounts.sprinkler_system}{' '}
                                    {t('sprinklers')}
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'pivot':
                return (
                    <div
                        className="rounded border border-white p-3"
                        style={{ backgroundColor: '#000005' }}
                    >
                        <h4 className="mb-3 text-sm font-medium text-white">
                            {t('System Pivot Settings')}
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Coverage Radius')}:{' '}
                                    {irrigationSettings.pivot.coverageRadius}m
                                </label>
                                <input
                                    type="range"
                                    min={80}
                                    max={250}
                                    step={5}
                                    value={irrigationSettings.pivot.coverageRadius}
                                    onChange={(e) =>
                                        handleSettingsChange(
                                            'pivot',
                                            'coverageRadius',
                                            parseInt(e.target.value)
                                        )
                                    }
                                    className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600"
                                    style={{
                                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${((irrigationSettings.pivot.coverageRadius - 80) / 170) * 100}%, #6b7280 ${((irrigationSettings.pivot.coverageRadius - 80) / 170) * 100}%, #6b7280 100%)`,
                                    }}
                                />
                                <div className="mt-1 flex justify-between text-xs text-gray-400">
                                    <span>80m</span>
                                    <span>250m</span>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Overlap')}: {irrigationSettings.pivot.overlap}%
                                </label>
                                <input
                                    type="range"
                                    min={0}
                                    max={50}
                                    step={5}
                                    value={irrigationSettings.pivot.overlap}
                                    onChange={(e) =>
                                        handleSettingsChange(
                                            'pivot',
                                            'overlap',
                                            parseInt(e.target.value)
                                        )
                                    }
                                    className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600"
                                    style={{
                                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${(irrigationSettings.pivot.overlap / 50) * 100}%, #6b7280 ${(irrigationSettings.pivot.overlap / 50) * 100}%, #6b7280 100%)`,
                                    }}
                                />
                                <div className="mt-1 flex justify-between text-xs text-gray-400">
                                    <span>0%</span>
                                    <span>50%</span>
                                </div>
                            </div>

                            {/* Irrigation rotation angle for pivots */}
                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Angle')}: {parsedRotationAngle.toFixed(1)}°
                                </label>
                                <input
                                    type="range"
                                    min={-180}
                                    max={180}
                                    step={0.5}
                                    value={parsedRotationAngle}
                                    onChange={(e) =>
                                        setParsedRotationAngle(parseFloat(e.target.value))
                                    }
                                    className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600"
                                    style={{
                                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${((parsedRotationAngle + 180) / 360) * 100}%, #6b7280 ${((parsedRotationAngle + 180) / 360) * 100}%, #6b7280 100%)`,
                                    }}
                                />
                                <div className="mt-1 flex justify-between text-xs text-gray-400">
                                    <span>-180°</span>
                                    <span>0°</span>
                                    <span>180°</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-2 block text-xs text-gray-400">
                                        {t('Flow')} (L/min)
                                    </label>
                                    <input
                                        type="number"
                                        min={20}
                                        max={100}
                                        step={5}
                                        value={irrigationSettings.pivot.flow}
                                        onChange={(e) =>
                                            handleSettingsChange(
                                                'pivot',
                                                'flow',
                                                parseInt(e.target.value) || 50
                                            )
                                        }
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                                        placeholder="50"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs text-gray-400">
                                        {t('Pressure')} (bar)
                                    </label>
                                    <input
                                        type="number"
                                        min={2.0}
                                        max={5.0}
                                        step={0.1}
                                        value={irrigationSettings.pivot.pressure}
                                        onChange={(e) =>
                                            handleSettingsChange(
                                                'pivot',
                                                'pressure',
                                                parseFloat(e.target.value) || 3.0
                                            )
                                        }
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                                        placeholder="3.0"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => generatePivotSystem()}
                                disabled={isGeneratingIrrigation}
                                className="w-full rounded bg-orange-600 px-3 py-2 text-xs text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-500"
                            >
                                {isGeneratingIrrigation
                                    ? t('Generating...')
                                    : t('Generate Pivot System')}
                            </button>
                            {irrigationCounts.pivot > 0 && (
                                <div className="mt-2 text-center text-xs text-orange-400">
                                    {t('Generated')}: {irrigationCounts.pivot} {t('pivots')}
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'drip_tape': {
                const dripOptions = [10, 15, 20, 30];
                return (
                    <div
                        className="rounded border border-white p-3"
                        style={{ backgroundColor: '#000005' }}
                    >
                        <h4 className="mb-3 text-sm font-medium text-white">
                            {t('Drip Tape Settings')}
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Emitter Spacing')}:{' '}
                                    {irrigationSettings.drip_tape.emitterSpacing}cm
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {dripOptions.map((option) => (
                                        <button
                                            key={option}
                                            onClick={() =>
                                                handleSettingsChange(
                                                    'drip_tape',
                                                    'emitterSpacing',
                                                    option
                                                )
                                            }
                                            className={`rounded border border-white px-3 py-2 text-xs font-medium transition-colors ${
                                                irrigationSettings.drip_tape.emitterSpacing ===
                                                option
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                        >
                                            {option}cm
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Placement')}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() =>
                                            handleSettingsChange(
                                                'drip_tape',
                                                'placement',
                                                'along_rows'
                                            )
                                        }
                                        className={`rounded border border-white px-3 py-2 text-xs font-medium transition-colors ${
                                            irrigationSettings.drip_tape.placement === 'along_rows'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    >
                                        {t('Along Rows')}
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleSettingsChange(
                                                'drip_tape',
                                                'placement',
                                                'staggered'
                                            )
                                        }
                                        className={`rounded border border-white px-3 py-2 text-xs font-medium transition-colors ${
                                            irrigationSettings.drip_tape.placement === 'staggered'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    >
                                        {t('Staggered')}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Side')}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() =>
                                            handleSettingsChange('drip_tape', 'side', 'left')
                                        }
                                        className={`rounded border border-white px-3 py-2 text-xs font-medium transition-colors ${
                                            irrigationSettings.drip_tape.side === 'left'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    >
                                        {t('Left')}
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleSettingsChange('drip_tape', 'side', 'right')
                                        }
                                        className={`rounded border border-white px-3 py-2 text-xs font-medium transition-colors ${
                                            irrigationSettings.drip_tape.side === 'right'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    >
                                        {t('Right')}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-2 block text-xs text-gray-400">
                                        {t('Flow')} (L/min)
                                    </label>
                                    <input
                                        type="number"
                                        min={0.24}
                                        max={0.24}
                                        step={0.01}
                                        value={0.24}
                                        readOnly
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-xs text-gray-400">
                                        {t('Pressure')} (bar)
                                    </label>
                                    <input
                                        type="number"
                                        min={0.5}
                                        max={2.0}
                                        step={0.1}
                                        value={irrigationSettings.drip_tape.pressure}
                                        onChange={(e) =>
                                            handleSettingsChange(
                                                'drip_tape',
                                                'pressure',
                                                parseFloat(e.target.value) || 1.0
                                            )
                                        }
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                        placeholder="1.0"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => generateDripTape()}
                                disabled={isGeneratingIrrigation}
                                className="w-full rounded bg-blue-600 px-3 py-2 text-xs text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-500"
                            >
                                {isGeneratingIrrigation
                                    ? t('Generating...')
                                    : t('Generate Drip Tape')}
                            </button>
                            {irrigationCounts.drip_tape > 0 && (
                                <div className="mt-2 text-center text-xs text-blue-400">
                                    {t('Generated')}: {irrigationCounts.drip_tape}{' '}
                                    {t('drip points')}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            case 'water_jet_tape': {
                const jetOptions = [10, 20, 30];
                return (
                    <div
                        className="rounded border border-white p-3"
                        style={{ backgroundColor: '#000005' }}
                    >
                        <h4 className="mb-3 text-sm font-medium text-white">
                            {t('Water Jet Tape Settings')}
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Jet Spacing')}:{' '}
                                    {irrigationSettings.water_jet_tape.emitterSpacing}cm
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {jetOptions.map((option) => (
                                        <button
                                            key={option}
                                            onClick={() =>
                                                handleSettingsChange(
                                                    'water_jet_tape',
                                                    'emitterSpacing',
                                                    option
                                                )
                                            }
                                            className={`rounded border border-white px-3 py-2 text-xs font-medium transition-colors ${
                                                irrigationSettings.water_jet_tape.emitterSpacing ===
                                                option
                                                    ? 'bg-orange-600 text-white'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                        >
                                            {option}cm
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Placement')}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() =>
                                            handleSettingsChange(
                                                'water_jet_tape',
                                                'placement',
                                                'along_rows'
                                            )
                                        }
                                        className={`rounded border border-white px-3 py-2 text-xs font-medium transition-colors ${
                                            irrigationSettings.water_jet_tape.placement ===
                                            'along_rows'
                                                ? 'bg-orange-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    >
                                        {t('Along Rows')}
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleSettingsChange(
                                                'water_jet_tape',
                                                'placement',
                                                'staggered'
                                            )
                                        }
                                        className={`rounded border border-white px-3 py-2 text-xs font-medium transition-colors ${
                                            irrigationSettings.water_jet_tape.placement ===
                                            'staggered'
                                                ? 'bg-orange-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    >
                                        {t('Staggered')}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Side')}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() =>
                                            handleSettingsChange('water_jet_tape', 'side', 'left')
                                        }
                                        className={`rounded border border-white px-3 py-2 text-xs font-medium transition-colors ${
                                            irrigationSettings.water_jet_tape.side === 'left'
                                                ? 'bg-orange-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    >
                                        {t('Left')}
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleSettingsChange('water_jet_tape', 'side', 'right')
                                        }
                                        className={`rounded border border-white px-3 py-2 text-xs font-medium transition-colors ${
                                            irrigationSettings.water_jet_tape.side === 'right'
                                                ? 'bg-orange-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    >
                                        {t('Right')}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-2 block text-xs text-gray-400">
                                        {t('Flow')} (L/min)
                                    </label>
                                    <input
                                        type="number"
                                        min={0.5}
                                        max={10}
                                        step={0.1}
                                        value={irrigationSettings.water_jet_tape.flow}
                                        onChange={(e) =>
                                            handleSettingsChange(
                                                'water_jet_tape',
                                                'flow',
                                                parseFloat(e.target.value) || 1.5
                                            )
                                        }
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                                        placeholder="1.5"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-xs text-gray-400">
                                        {t('Pressure')} (bar)
                                    </label>
                                    <input
                                        type="number"
                                        min={0.5}
                                        max={3.0}
                                        step={0.1}
                                        value={irrigationSettings.water_jet_tape.pressure}
                                        onChange={(e) =>
                                            handleSettingsChange(
                                                'water_jet_tape',
                                                'pressure',
                                                parseFloat(e.target.value) || 1.5
                                            )
                                        }
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                                        placeholder="1.5"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => generateWaterJetTape()}
                                disabled={isGeneratingIrrigation}
                                className="w-full rounded bg-orange-600 px-3 py-2 text-xs text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-500"
                            >
                                {isGeneratingIrrigation
                                    ? t('Generating...')
                                    : t('Generate Water Jet Tape')}
                            </button>
                            {irrigationCounts.water_jet_tape > 0 && (
                                <div className="mt-2 text-center text-xs text-orange-400">
                                    {t('Generated')}: {irrigationCounts.water_jet_tape}{' '}
                                    {t('water jets')}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            default:
                return null;
        }
    };

    // Render main area polygon
    useEffect(() => {
        if (!mapRef.current || !finalMainArea.length || !isMapLoaded) {
            return;
        }

        if (mainAreaPolygonRef.current) {
            mainAreaPolygonRef.current.setMap(null);
        }

        const polygon = new google.maps.Polygon({
            paths: [finalMainArea],
            fillColor: '#86EFAC',
            fillOpacity: 0.3,
            strokeColor: '#22C55E',
            strokeWeight: 2,
            strokeOpacity: 1,
            map: mapRef.current,
            clickable: false,
            zIndex: 1000,
        });

        mainAreaPolygonRef.current = polygon;
        dbg('Main area polygon created and added to map');
    }, [finalMainArea, isMapLoaded]);

    // Note: Zone rendering is removed from irrigation page
    // Zones should only be displayed in the zone-obstacle page (Step 3)
    // This page focuses only on irrigation system generation

    // [FIX] Simplified distance overlay creation
    const createSimpleDistanceOverlays = useCallback((obstacle: Obstacle) => {
        if (!mapRef.current) {
            dbg('Cannot create distance overlays: map not ready');
            return;
        }

        dbg('Creating simplified distance overlays for water source:', obstacle.id);

=======
        getPivotSettings,
        parsedRotationAngle,
    ]);



    // Function to render irrigation settings based on selected type
    const renderIrrigationSettings = () => {
        if (!selectedIrrigationType) return null;

        switch (selectedIrrigationType) {
            case 'sprinkler_system':
                return (
                    <div
                        className="rounded border border-white p-3"
                        style={{ backgroundColor: '#000005' }}
                    >
                        <h4 className="mb-3 text-sm font-medium text-white">
                            {t('Sprinkler System Settings')}
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Coverage Radius')}:{' '}
                                    {getSprinklerSettings().coverageRadius}m
                                </label>
                                <input
                                    type="range"
                                    min={1}
                                    max={15}
                                    step={1}
                                    value={getSprinklerSettings().coverageRadius}
                                    onChange={(e) =>
                                        handleSettingsChange(
                                            'sprinkler_system',
                                            'coverageRadius',
                                            parseInt(e.target.value)
                                        )
                                    }
                                    className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600"
                                    style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(((getSprinklerSettings()?.coverageRadius || 8) - 1) / 14) * 100}%, #6b7280 ${(((getSprinklerSettings()?.coverageRadius || 8) - 1) / 14) * 100}%, #6b7280 100%)`,
                                    }}
                                />
                                <div className="mt-1 flex justify-between text-xs text-gray-400">
                                    <span>1m</span>
                                    <span>15m</span>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Overlap')}: {getSprinklerSettings().overlap}%
                                </label>
                                <input
                                    type="range"
                                    min={0}
                                    max={50}
                                    step={5}
                                    value={getSprinklerSettings().overlap}
                                    onChange={(e) =>
                                        handleSettingsChange(
                                            'sprinkler_system',
                                            'overlap',
                                            parseInt(e.target.value)
                                        )
                                    }
                                    className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600"
                                    style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(((getSprinklerSettings()?.overlap || 0) - 0) / 50) * 100}%, #6b7280 ${(((getSprinklerSettings()?.overlap || 0) - 0) / 50) * 100}%, #6b7280 100%)`,
                                    }}
                                />
                                <div className="mt-1 flex justify-between text-xs text-gray-400">
                                    <span>0%</span>
                                    <span>50%</span>
                                </div>
                            </div>

                            {/* Irrigation rotation angle for sprinklers */}
                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Angle')}: {parsedRotationAngle.toFixed(1)}°
                                </label>
                                <input
                                    type="range"
                                    min={-180}
                                    max={180}
                                    step={0.5}
                                    value={parsedRotationAngle}
                                    onChange={(e) =>
                                        setParsedRotationAngle(parseFloat(e.target.value))
                                    }
                                    className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600"
                                    style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((parsedRotationAngle + 180) / 360) * 100}%, #6b7280 ${((parsedRotationAngle + 180) / 360) * 100}%, #6b7280 100%)`,
                                    }}
                                />
                                <div className="mt-1 flex justify-between text-xs text-gray-400">
                                    <span>-180°</span>
                                    <span>0°</span>
                                    <span>180°</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <button
                                        onClick={() => adjustRotationAngle(-0.5)}
                                        className="rounded border border-white bg-gray-700 px-2 py-1 text-xs text-white"
                                    >
                                        -0.5°
                                    </button>
                                    <button
                                        onClick={() => adjustRotationAngle(0.5)}
                                        className="rounded border border-white bg-gray-700 px-2 py-1 text-xs text-white"
                                    >
                                        +0.5°
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-2 block text-xs text-gray-400">
                                        {t('Flow')} (L/min)
                                    </label>
                                    <input
                                        type="number"
                                        min={5}
                                        max={30}
                                        step={1}
                                        value={getSprinklerSettings().flow}
                                        onChange={(e) =>
                                            handleSettingsChange(
                                                'sprinkler_system',
                                                'flow',
                                                parseInt(e.target.value) || 10
                                            )
                                        }
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                        placeholder="10"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs text-gray-400">
                                        {t('Pressure')} (bar)
                                    </label>
                                    <input
                                        type="number"
                                        min={1.5}
                                        max={4.0}
                                        step={0.1}
                                        value={getSprinklerSettings().pressure}
                                        onChange={(e) =>
                                            handleSettingsChange(
                                                'sprinkler_system',
                                                'pressure',
                                                parseFloat(e.target.value) || 2.5
                                            )
                                        }
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                        placeholder="2.5"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => generateSprinklerSystem()}
                                disabled={isGeneratingIrrigation}
                                className="w-full rounded bg-blue-600 px-3 py-2 text-xs text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-500"
                            >
                                {isGeneratingIrrigation
                                    ? t('Generating...')
                                    : t('Generate Sprinkler System')}
                            </button>
                            {irrigationCounts.sprinkler_system > 0 && (
                                <div className="mt-2 text-center text-xs text-blue-400">
                                    {t('Generated')}: {irrigationCounts.sprinkler_system}{' '}
                                    {t('sprinklers')}
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'pivot':
                return (
                    <div
                        className="rounded border border-white p-3"
                        style={{ backgroundColor: '#000005' }}
                    >
                        <h4 className="mb-3 text-sm font-medium text-white">
                            {t('System Pivot Settings')}
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Coverage Radius')}:{' '}
                                    {getPivotSettings().coverageRadius}m
                                </label>
                                <input
                                    type="range"
                                    min={80}
                                    max={250}
                                    step={5}
                                    value={getPivotSettings().coverageRadius}
                                    onChange={(e) =>
                                        handleSettingsChange(
                                            'pivot',
                                            'coverageRadius',
                                            parseInt(e.target.value)
                                        )
                                    }
                                    className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600"
                                    style={{
                                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${(((getPivotSettings()?.coverageRadius || 165) - 80) / 170) * 100}%, #6b7280 ${(((getPivotSettings()?.coverageRadius || 165) - 80) / 170) * 100}%, #6b7280 100%)`,
                                    }}
                                />
                                <div className="mt-1 flex justify-between text-xs text-gray-400">
                                    <span>80m</span>
                                    <span>250m</span>
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Overlap')}: {getPivotSettings().overlap}%
                                </label>
                                <input
                                    type="range"
                                    min={0}
                                    max={50}
                                    step={5}
                                    value={getPivotSettings().overlap}
                                    onChange={(e) =>
                                        handleSettingsChange(
                                            'pivot',
                                            'overlap',
                                            parseInt(e.target.value)
                                        )
                                    }
                                    className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600"
                                    style={{
                                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${(((getPivotSettings()?.overlap || 0) - 0) / 50) * 100}%, #6b7280 ${(((getPivotSettings()?.overlap || 0) - 0) / 50) * 100}%, #6b7280 100%)`,
                                    }}
                                />
                                <div className="mt-1 flex justify-between text-xs text-gray-400">
                                    <span>0%</span>
                                    <span>50%</span>
                                </div>
                            </div>

                            {/* Irrigation rotation angle for pivots */}
                            <div>
                                <label className="mb-2 block text-xs text-gray-400">
                                    {t('Angle')}: {parsedRotationAngle.toFixed(1)}°
                                </label>
                                <input
                                    type="range"
                                    min={-180}
                                    max={180}
                                    step={0.5}
                                    value={parsedRotationAngle}
                                    onChange={(e) =>
                                        setParsedRotationAngle(parseFloat(e.target.value))
                                    }
                                    className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-600"
                                    style={{
                                        background: `linear-gradient(to right, #f97316 0%, #f97316 ${((parsedRotationAngle + 180) / 360) * 100}%, #6b7280 ${((parsedRotationAngle + 180) / 360) * 100}%, #6b7280 100%)`,
                                    }}
                                />
                                <div className="mt-1 flex justify-between text-xs text-gray-400">
                                    <span>-180°</span>
                                    <span>0°</span>
                                    <span>180°</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-2 block text-xs text-gray-400">
                                        {t('Flow')} (L/min)
                                    </label>
                                    <input
                                        type="number"
                                        min={20}
                                        max={100}
                                        step={5}
                                        value={getPivotSettings().flow}
                                        onChange={(e) =>
                                            handleSettingsChange(
                                                'pivot',
                                                'flow',
                                                parseInt(e.target.value) || 50
                                            )
                                        }
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                                        placeholder="50"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs text-gray-400">
                                        {t('Pressure')} (bar)
                                    </label>
                                    <input
                                        type="number"
                                        min={2.0}
                                        max={5.0}
                                        step={0.1}
                                        value={getPivotSettings().pressure}
                                        onChange={(e) =>
                                            handleSettingsChange(
                                                'pivot',
                                                'pressure',
                                                parseFloat(e.target.value) || 3.0
                                            )
                                        }
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
                                        placeholder="3.0"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => generatePivotSystem()}
                                disabled={isGeneratingIrrigation}
                                className="w-full rounded bg-orange-600 px-3 py-2 text-xs text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-500"
                            >
                                {isGeneratingIrrigation
                                    ? t('Generating...')
                                    : t('Generate Pivot System')}
                            </button>
                            {irrigationCounts.pivot > 0 && (
                                <div className="mt-2 text-center text-xs text-orange-400">
                                    {t('Generated')}: {irrigationCounts.pivot} {t('pivots')}
                                </div>
                            )}
                        </div>
                    </div>
                );



            default:
                return null;
        }
    };

    // Render main area polygon
    useEffect(() => {
        if (!mapRef.current || !finalMainArea.length || !isMapLoaded) {
            return;
        }

        if (mainAreaPolygonRef.current) {
            mainAreaPolygonRef.current.setMap(null);
        }

        const polygon = new google.maps.Polygon({
            paths: [finalMainArea],
            fillColor: '#86EFAC',
            fillOpacity: 0.3,
            strokeColor: '#22C55E',
            strokeWeight: 2,
            strokeOpacity: 1,
            map: mapRef.current,
            clickable: false,
            zIndex: 1000,
        });

        mainAreaPolygonRef.current = polygon;
        dbg('Main area polygon created and added to map');
    }, [finalMainArea, isMapLoaded]);

    // Note: Zone rendering is removed from irrigation page
    // Zones should only be displayed in the zone-obstacle page (Step 3)
    // This page focuses only on irrigation system generation

    // [FIX] Simplified distance overlay creation
    const createSimpleDistanceOverlays = useCallback((obstacle: Obstacle) => {
        if (!mapRef.current) {
            dbg('Cannot create distance overlays: map not ready');
            return;
        }

        dbg('Creating simplified distance overlays for water source:', obstacle.id);

>>>>>>> main
        const overlays: { lines: google.maps.Polyline[]; labels: google.maps.Marker[] } = {
            lines: [],
            labels: [],
        };

        // Distance lines and labels are now disabled
        // The function structure is kept for potential future use
        dbg('Distance overlays disabled - no lines or labels created');

        distanceOverlaysRef.current[obstacle.id] = overlays;
        dbg('Successfully created distance overlays for obstacle:', obstacle.id);
    }, []);

    // [FIX] Improved obstacles rendering effect
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded) {
            return;
        }

        // Clear existing obstacle polygons
        obstaclePolygonsRef.current.forEach((poly) => poly.setMap(null));
        obstaclePolygonsRef.current = [];

        // Clear existing distance overlays
        Object.values(distanceOverlaysRef.current).forEach(({ lines, labels }) => {
            lines.forEach((l) => l.setMap(null));
            labels.forEach((lb) => lb.setMap(null));
        });
        distanceOverlaysRef.current = {};

        // Don't use setTimeout - render immediately for better synchronization
        if (finalObstacles.length > 0) {
            dbg('Creating obstacle polygons for:', finalObstacles.length, 'obstacles');

            finalObstacles.forEach((obstacle, index) => {
                dbg(`Processing obstacle ${index + 1}:`, {
                    id: obstacle.id,
                    type: obstacle.type,
                    coordinates: obstacle.coordinates.length,
                    firstCoord: obstacle.coordinates[0],
                    lastCoord: obstacle.coordinates[obstacle.coordinates.length - 1],
                });

                // Validate obstacle has valid coordinates
                if (!obstacle.coordinates || obstacle.coordinates.length < 3) {
<<<<<<< HEAD
                    console.warn(
                        `Skipping obstacle ${index + 1} - insufficient coordinates:`,
                        obstacle.coordinates?.length || 0
                    );
=======
                    // Skipping obstacle - insufficient coordinates
>>>>>>> main
                    return;
                }

                // Validate coordinates are valid numbers
                const validCoordinates = obstacle.coordinates.filter(
                    (coord) =>
                        typeof coord.lat === 'number' &&
                        typeof coord.lng === 'number' &&
                        !isNaN(coord.lat) &&
                        !isNaN(coord.lng) &&
                        coord.lat >= -90 &&
                        coord.lat <= 90 &&
                        coord.lng >= -180 &&
                        coord.lng <= 180
                );

                if (validCoordinates.length < 3) {
<<<<<<< HEAD
                    console.warn(
                        `Skipping obstacle ${index + 1} - invalid coordinates:`,
                        obstacle.coordinates
                    );
=======
                    // Skipping obstacle - invalid coordinates
>>>>>>> main
                    return;
                }

                const colors =
                    obstacle.type === 'water_source'
                        ? { fill: '#3b82f6', stroke: '#1d4ed8' }
                        : { fill: '#6b7280', stroke: '#374151' };

                try {
                    const poly = new google.maps.Polygon({
                        paths: [validCoordinates],
                        fillColor: colors.fill,
                        fillOpacity: 0.3,
                        strokeColor: colors.stroke,
                        strokeWeight: 2,
                        strokeOpacity: 1,
                        map: mapRef.current,
                        clickable: false,
                        zIndex: 1600,
                    });
                    obstaclePolygonsRef.current.push(poly);
                    dbg(`Successfully created polygon for obstacle ${index + 1}`);

                    // Create distance overlays for water sources
                    if (obstacle.type === 'water_source' && finalMainArea.length >= 3) {
                        dbg('Creating distance overlays for water source:', obstacle.id);
                        try {
                            createSimpleDistanceOverlays(obstacle);
<<<<<<< HEAD
                        } catch (error) {
                            console.error(
                                'Error creating distance overlays for obstacle:',
                                obstacle.id,
                                error
                            );
                        }
                    }
                } catch (error) {
                    console.error(`Error creating polygon for obstacle ${index + 1}:`, error);
=======
                        } catch {
                            // Error creating distance overlays for obstacle
                        }
                    }
                } catch {
                    // Error creating polygon for obstacle
>>>>>>> main
                }
            });

            dbg(
                `Successfully created ${obstaclePolygonsRef.current.length} obstacle polygons out of ${finalObstacles.length} obstacles`
            );
        }
    }, [finalObstacles, isMapLoaded, createSimpleDistanceOverlays, finalMainArea.length]);

    // Render plant points
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded || finalPlantPoints.length === 0) {
            return;
        }

        // Clear existing markers
        plantPointMarkersRef.current.forEach((marker) => marker.setMap(null));
        plantPointMarkersRef.current = [];

<<<<<<< HEAD
        // Filter points based on zoom level and total point count
        const filteredPoints = filterPointsByZoom(finalPlantPoints, parsedMapZoom, realPlantCount);
=======
        // Use all plant points directly
        const filteredPoints = finalPlantPoints;
>>>>>>> main

        // Calculate dynamic point size based on total point count (not filtered count)
        const pointSize = calculatePointSize(realPlantCount);
        const anchorPoint = pointSize / 2;

        // Create markers for filtered plant points
        filteredPoints.forEach((point, index) => {
            const marker = new google.maps.Marker({
                position: { lat: point.lat, lng: point.lng },
                map: mapRef.current,
                icon: {
                    url:
                        'data:image/svg+xml;charset=UTF-8,' +
                        encodeURIComponent(`
						<svg width="${pointSize}" height="${pointSize}" viewBox="0 0 ${pointSize} ${pointSize}" xmlns="http://www.w3.org/2000/svg">
							<circle cx="${anchorPoint}" cy="${anchorPoint}" r="${anchorPoint * 0.83}" fill="#22C55E" stroke="#16A34A" stroke-width="1"/>
						</svg>
					`),
                    scaledSize: new google.maps.Size(pointSize, pointSize),
                    anchor: new google.maps.Point(anchorPoint, anchorPoint),
                },
                title: `Plant ${index + 1}`,
                optimized: true,
                clickable: false,
                zIndex: 1000,
            });
            plantPointMarkersRef.current.push(marker);
        });

        dbg(
            `Created ${filteredPoints.length} plant point markers (filtered from ${finalPlantPoints.length} total)`
        );
    }, [
        finalPlantPoints,
        isMapLoaded,
        parsedPlantPoints.length,
<<<<<<< HEAD
        filterPointsByZoom,
        parsedMapZoom,
=======
        // ลบ parsedMapZoom ออกเพื่อป้องกันการเรนเดอร์ใหม่เมื่อซูม
>>>>>>> main
        realPlantCount,
        calculatePointSize,
    ]);

    // Render irrigation overlays when data is loaded from localStorage
    const renderIrrigationOverlays = useCallback(async () => {
        if (!mapRef.current || !isMapLoaded) return;

        // Clear existing irrigation overlays
        irrigationMarkersRef.current.forEach((marker) => marker.setMap(null));
        irrigationMarkersRef.current = [];
        irrigationCirclesRef.current.forEach((circle) => circle.setMap(null));
        irrigationCirclesRef.current = [];

<<<<<<< HEAD
        // Recreate sprinkler overlays with batch processing
        if (irrigationPositions.sprinklers.length > 0) {
            const radius = irrigationSettings.sprinkler_system.coverageRadius;
            const markerBatchSize = 50;

            for (let i = 0; i < irrigationPositions.sprinklers.length; i += markerBatchSize) {
                await new Promise((resolve) => requestAnimationFrame(resolve));

                const batch = irrigationPositions.sprinklers.slice(i, i + markerBatchSize);

                batch.forEach((pos, batchIndex) => {
                    const index = i + batchIndex;

                    // Check if this sprinkler is selected
                    const isSelected = selectedSprinklers.includes(index);
                    const fillColor = isSelected ? '#f59e0b' : '#3b82f6';
                    const strokeColor = isSelected ? '#d97706' : '#1d4ed8';

                    // Create marker
                    const marker = new google.maps.Marker({
                        position: pos,
                        map: mapRef.current,
                        icon: {
                            url:
                                'data:image/svg+xml;charset=UTF-8,' +
                                encodeURIComponent(`
=======
        // Recreate sprinkler overlays at once
        if (irrigationPositions.sprinklers.length > 0) {
            const radius = getSprinklerSettings().coverageRadius;

            irrigationPositions.sprinklers.forEach((pos, index) => {
                // Check if this sprinkler is selected
                const isSelected = selectedSprinklers.includes(index);
                const fillColor = isSelected ? '#f59e0b' : '#3b82f6';
                const strokeColor = isSelected ? '#d97706' : '#1d4ed8';

                // Create marker
                const marker = new google.maps.Marker({
                    position: pos,
                    map: mapRef.current,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
>>>>>>> main
								<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
									<circle cx="6" cy="6" r="5" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${isSelected ? '2' : '1'}"/>
									<circle cx="6" cy="6" r="2" fill="#ffffff"/>
								</svg>
							`),
<<<<<<< HEAD
                            scaledSize: new google.maps.Size(12, 12),
                            anchor: new google.maps.Point(6, 6),
                        },
                        title: `Sprinkler ${index + 1}${isSelected ? ' (Selected)' : ''}`,
                        optimized: true,
                        clickable: sprinklerMode === 'delete',
                        draggable: sprinklerMode === 'move',
                        zIndex: isSelected ? 2100 : 2000,
                    });

                    // Add click listener for deletion
                    if (sprinklerMode === 'delete') {
                        marker.addListener('click', (e: google.maps.MapMouseEvent) => {
                            e.stop(); // Prevent map click
                            deleteSprinkler(index);
                        });
                    }

                    // Add drag listener for moving
                    if (sprinklerMode === 'move') {
                        marker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
                            if (event.latLng) {
                                updateSprinklerPosition(index, {
                                    lat: event.latLng.lat(),
                                    lng: event.latLng.lng(),
                                });
                            }
                        });
                    }

                    // Prevent marker clicks from interfering with rectangle delete selection
                    if (sprinklerMode === 'delete') {
                        marker.addListener('mousedown', (e: google.maps.MapMouseEvent) => {
                            e.stop();
                        });
                    }
                    irrigationMarkersRef.current.push(marker);

                    // Create coverage circle
                    const circle = new google.maps.Circle({
                        center: pos,
                        radius: radius,
                        fillColor: '#3b82f6',
                        fillOpacity: 0.2,
                        strokeColor: '#1d4ed8',
                        strokeOpacity: 0.6,
                        strokeWeight: 1,
                        map: mapRef.current,
                        clickable: false,
                        zIndex: 2000,
                    });
                    irrigationCirclesRef.current.push(circle);
                });
            }
        }

        // Recreate pivot overlays with batch processing
        if (irrigationPositions.pivots.length > 0) {
            const radius = irrigationSettings.pivot.coverageRadius;
            const markerBatchSize = 50;

            for (let i = 0; i < irrigationPositions.pivots.length; i += markerBatchSize) {
                await new Promise((resolve) => requestAnimationFrame(resolve));

                const batch = irrigationPositions.pivots.slice(i, i + markerBatchSize);

                batch.forEach((pos, batchIndex) => {
                    const index = i + batchIndex;

                    // Create marker
                    const marker = new google.maps.Marker({
                        position: pos,
                        map: mapRef.current,
                        icon: {
                            url:
                                'data:image/svg+xml;charset=UTF-8,' +
                                encodeURIComponent(`
=======
                        scaledSize: new google.maps.Size(12, 12),
                        anchor: new google.maps.Point(6, 6),
                    },
                    title: `Sprinkler ${index + 1}${isSelected ? ' (Selected)' : ''}`,
                    optimized: true,
                    clickable: sprinklerMode === 'delete',
                    draggable: sprinklerMode === 'move',
                    zIndex: isSelected ? 2100 : 2000,
                });

                // Add click listener for deletion
                if (sprinklerMode === 'delete') {
                    marker.addListener('click', (e: google.maps.MapMouseEvent) => {
                        e.stop(); // Prevent map click
                        deleteSprinkler(index);
                    });
                }

                // Add drag listener for moving
                if (sprinklerMode === 'move') {
                    marker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
                        if (event.latLng) {
                            updateSprinklerPosition(index, {
                                lat: event.latLng.lat(),
                                lng: event.latLng.lng(),
                            });
                        }
                    });
                }

                // Prevent marker clicks from interfering with rectangle delete selection
                if (sprinklerMode === 'delete') {
                    marker.addListener('mousedown', (e: google.maps.MapMouseEvent) => {
                        e.stop();
                    });
                }
                irrigationMarkersRef.current.push(marker);

                // Create coverage circle
                const circle = new google.maps.Circle({
                    center: pos,
                    radius: radius,
                    fillColor: '#3b82f6',
                    fillOpacity: 0.2,
                    strokeColor: '#1d4ed8',
                    strokeOpacity: 0.6,
                    strokeWeight: 1,
                    map: mapRef.current,
                    clickable: false,
                    zIndex: 2000,
                });
                irrigationCirclesRef.current.push(circle);
            });
        }

        // Recreate pivot overlays at once
        if (irrigationPositions.pivots.length > 0) {
            const radius = getPivotSettings().coverageRadius;

            irrigationPositions.pivots.forEach((pos, index) => {
                // Create marker
                const marker = new google.maps.Marker({
                    position: pos,
                    map: mapRef.current,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
>>>>>>> main
								<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
									<circle cx="6" cy="6" r="5" fill="#f97316" stroke="#ea580c" stroke-width="1"/>
									<circle cx="6" cy="6" r="2" fill="#ffffff"/>
								</svg>
							`),
<<<<<<< HEAD
                            scaledSize: new google.maps.Size(12, 12),
                            anchor: new google.maps.Point(6, 6),
                        },
                        title: `Pivot ${index + 1}`,
                        optimized: true,
                        clickable: false,
                        zIndex: 2000,
                    });
                    irrigationMarkersRef.current.push(marker);

                    // Create coverage circle
                    const circle = new google.maps.Circle({
                        center: pos,
                        radius: radius,
                        fillColor: '#f97316',
                        fillOpacity: 0.2,
                        strokeColor: '#ea580c',
                        strokeOpacity: 0.6,
                        strokeWeight: 1,
                        map: mapRef.current,
                        clickable: false,
                        zIndex: 2000,
                    });
                    irrigationCirclesRef.current.push(circle);
                });
            }
        }

        // Recreate drip tape overlays
        if (irrigationPositions.dripTapes.length > 0) {
            irrigationPositions.dripTapes.forEach((pos, index) => {
                const marker = new google.maps.Marker({
                    position: pos,
                    map: mapRef.current,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
							<svg width="8" height="8" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">
								<circle cx="4" cy="4" r="3" fill="#3b82f6" stroke="#1d4ed8" stroke-width="1"/>
							</svg>
						`),
                        scaledSize: new google.maps.Size(8, 8),
                        anchor: new google.maps.Point(4, 4),
                    },
                    title: `Drip ${index + 1}`,
                    optimized: true,
                    clickable: false,
                });
                irrigationMarkersRef.current.push(marker);
            });
        }

        // Recreate water jet overlays
        if (irrigationPositions.waterJets.length > 0) {
            irrigationPositions.waterJets.forEach((pos, index) => {
                const marker = new google.maps.Marker({
                    position: pos,
                    map: mapRef.current,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
							<svg width="8" height="8" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">
								<circle cx="4" cy="4" r="3" fill="#f97316" stroke="#ea580c" stroke-width="1"/>
							</svg>
						`),
                        scaledSize: new google.maps.Size(8, 8),
                        anchor: new google.maps.Point(4, 4),
                    },
                    title: `Water Jet ${index + 1}`,
                    optimized: true,
                    clickable: false,
                });
                irrigationMarkersRef.current.push(marker);
            });
        }
    }, [
        isMapLoaded,
        irrigationSettings.sprinkler_system.coverageRadius,
        irrigationSettings.pivot.coverageRadius,
        irrigationPositions.dripTapes,
        irrigationPositions.pivots,
        irrigationPositions.sprinklers,
        irrigationPositions.waterJets,
        sprinklerMode,
        deleteSprinkler,
        updateSprinklerPosition,
        selectedSprinklers,
    ]);

    // Additional effect to ensure irrigation overlays are recreated when data is loaded from localStorage
    useEffect(() => {
        if (isMapLoaded && mapRef.current) {
            // Check if we have irrigation data that should be displayed
            const hasIrrigationData =
                irrigationPositions.sprinklers.length > 0 ||
                irrigationPositions.pivots.length > 0 ||
                irrigationPositions.dripTapes.length > 0 ||
                irrigationPositions.waterJets.length > 0;

            if (hasIrrigationData) {
                renderIrrigationOverlays();
            }
        }
    }, [
        isMapLoaded,
        irrigationSettings.sprinkler_system?.coverageRadius,
        irrigationSettings.pivot?.coverageRadius,
        irrigationPositions.dripTapes,
        irrigationPositions.pivots,
        irrigationPositions.sprinklers,
        irrigationPositions.waterJets,
        renderIrrigationOverlays,
    ]);

    // Map event listeners for sprinkler management
    useEffect(() => {
        if (!mapRef.current) return;

        const listeners: google.maps.MapsEventListener[] = [];
        const mapDiv = mapRef.current.getDiv();

        // Click listener for adding sprinklers
        const clickListener = mapRef.current.addListener(
            'click',
            (event: google.maps.MapMouseEvent) => {
                if (sprinklerMode === 'add' && event.latLng) {
                    handleMapClickForSprinkler(event);
                }
            }
        );
        listeners.push(clickListener);

        // Mouse down listener for rectangle selection start in delete mode
        const mouseDownListener = mapRef.current.addListener(
            'mousedown',
            (event: google.maps.MapMouseEvent) => {
                if (sprinklerMode === 'delete' && event.latLng) {
                    console.log('Mouse down detected for selection');
                    handleSelectionStart(event);
                }
            }
        );
        listeners.push(mouseDownListener);

        // Mouse move listener for selection drawing in delete mode
        const mouseMoveListener = mapRef.current.addListener(
            'mousemove',
            (event: google.maps.MapMouseEvent) => {
                if (sprinklerMode === 'delete' && isSelecting && event.latLng) {
                    handleSelectionMove(event);
                }
            }
        );
        listeners.push(mouseMoveListener);

        // Mouse up listener for selection end in delete mode
        const mouseUpListener = mapRef.current.addListener('mouseup', () => {
            if (sprinklerMode === 'delete' && isSelecting) {
                console.log('Mouse up detected, ending selection');
                handleSelectionEnd();
            }
        });
        listeners.push(mouseUpListener);

        // Additional DOM event listeners for better selection control
        const domListeners: (() => void)[] = [];

        if (sprinklerMode === 'delete') {
            // Prevent context menu during selection
            const preventContextMenu = (e: MouseEvent) => {
                if (isSelecting) {
                    e.preventDefault();
                }
            };
            mapDiv.addEventListener('contextmenu', preventContextMenu);
            domListeners.push(() => mapDiv.removeEventListener('contextmenu', preventContextMenu));

            // Prevent text selection during drag
            const preventSelectStart = (e: Event) => {
                if (isSelecting) {
                    e.preventDefault();
                }
            };
            mapDiv.addEventListener('selectstart', preventSelectStart);
            domListeners.push(() => mapDiv.removeEventListener('selectstart', preventSelectStart));

            // Prevent drag start
            const preventDragStart = (e: DragEvent) => {
                if (isSelecting) {
                    e.preventDefault();
                }
            };
            mapDiv.addEventListener('dragstart', preventDragStart);
            domListeners.push(() => mapDiv.removeEventListener('dragstart', preventDragStart));

            // Additional mouse event handling for better selection
            const handleMouseDown = (e: MouseEvent) => {
                if (sprinklerMode === 'delete') {
                    console.log('DOM mouse down event');
                    e.preventDefault();
                }
            };
            mapDiv.addEventListener('mousedown', handleMouseDown);
            domListeners.push(() => mapDiv.removeEventListener('mousedown', handleMouseDown));

            const handleMouseMove = (e: MouseEvent) => {
                if (sprinklerMode === 'delete' && isSelecting) {
                    e.preventDefault();
                }
            };
            mapDiv.addEventListener('mousemove', handleMouseMove);
            domListeners.push(() => mapDiv.removeEventListener('mousemove', handleMouseMove));

            const handleMouseUp = (e: MouseEvent) => {
                if (sprinklerMode === 'delete' && isSelecting) {
                    console.log('DOM mouse up event');
                    e.preventDefault();
                }
            };
            mapDiv.addEventListener('mouseup', handleMouseUp);
            domListeners.push(() => mapDiv.removeEventListener('mouseup', handleMouseUp));
        }

        return () => {
            listeners.forEach((listener) => google.maps.event.removeListener(listener));
            domListeners.forEach((cleanup) => cleanup());
        };
    }, [
        sprinklerMode,
        handleMapClickForSprinkler,
        handleSelectionStart,
        handleSelectionMove,
        handleSelectionEnd,
        isSelecting,
    ]);

    return (
        <>
            <Head title={t('Irrigation System')} />

            <div
                className="min-h-screen overflow-hidden text-white"
                style={{ backgroundColor: '#000005' }}
            >
                {/* Navbar */}
                <Navbar />

                <div className="h-[calc(100vh-4rem)] overflow-hidden">
                    <div className="flex h-full">
                        {/* Left Side - Control Panel */}
                        <div
                            className="flex w-80 flex-col border-r border-white"
                            style={{ backgroundColor: '#000005' }}
                        >
                            {/* Header */}
                            <div className="border-b border-white p-4">
                                <button
                                    onClick={handleBack}
                                    className="mb-3 flex items-center text-sm text-blue-400 hover:text-blue-300"
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
                                    {t('Back to Initial Area')}
                                </button>

                                <div className="mb-3">
                                    <h1 className="text-lg font-bold text-white">
                                        {steps.find((s) => s.id === currentStep)?.title}
                                    </h1>
                                </div>

                                {/* Step Navigation - Horizontal */}
                                <div className="mb-4 flex items-center justify-between">
                                    {steps.map((step, index) => {
                                        const isActive = step.id === currentStep;
                                        const isCompleted = parseInt(completedSteps) >= step.id;

                                        // Check if step has been completed based on current data
                                        const hasStepData = (() => {
                                            switch (step.id) {
                                                case 1: // Initial Area
                                                    return finalMainArea.length >= 3;
                                                case 2: // Irrigation Generate
                                                    return (
                                                        irrigationPositions.sprinklers.length > 0 ||
                                                        irrigationPositions.pivots.length > 0 ||
                                                        irrigationPositions.dripTapes.length > 0 ||
                                                        irrigationPositions.waterJets.length > 0
                                                    );
                                                default:
                                                    return false;
                                            }
                                        })();

                                        // Step is completed only if previously marked as completed; do not auto-check step 2 by data presence
                                        const stepIsCompleted =
                                            step.id === 2
                                                ? isCompleted
                                                : isCompleted || hasStepData;

                                        return (
                                            <div key={step.id} className="flex items-center">
                                                <button
                                                    onClick={() => handleStepClick(step)}
                                                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                                                        stepIsCompleted
                                                            ? 'cursor-pointer bg-green-600 text-white hover:bg-green-500'
                                                            : isActive
                                                              ? 'cursor-not-allowed bg-blue-600 text-white'
                                                              : 'cursor-pointer bg-gray-600 text-white hover:bg-gray-500'
                                                    }`}
                                                >
                                                    {stepIsCompleted ? (
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
                                                        className={`mx-2 h-0.5 w-8 ${
                                                            stepIsCompleted
                                                                ? 'bg-green-600'
                                                                : 'bg-gray-600'
                                                        }`}
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
                                    {/* Selected Crops Display */}
                                    {finalSelectedCrops.length > 0 && (
                                        <div className="rounded-lg border border-white p-4">
                                            <h3 className="mb-3 text-sm font-semibold text-white">
                                                {t('Selected Crops')}
                                            </h3>

                                            <div className="flex flex-wrap gap-2">
                                                {finalSelectedCrops.map((crop, idx) => {
                                                    const cropData = getCropByValue(crop);
                                                    return (
                                                        <span
                                                            key={idx}
                                                            className="flex items-center gap-1 rounded border border-white bg-blue-600 px-3 py-1 text-xs text-white"
                                                        >
                                                            <span className="text-sm">
                                                                {cropData?.icon || '🌱'}
                                                            </span>
                                                            <span>{cropData?.name || crop}</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Field Information Display */}
                                    {finalMainArea.length > 0 && (
                                        <div
                                            className="rounded-lg border border-white p-4"
                                            style={{ backgroundColor: '#000005' }}
                                        >
                                            <h3 className="mb-3 text-sm font-semibold text-white">
                                                {t('Field Information')}
                                            </h3>
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Area')}:</span>
                                                    <span className="text-green-400">
                                                        {finalAreaRai !== null
                                                            ? finalAreaRai.toFixed(2)
                                                            : '--'}{' '}
                                                        {t('rai')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Total Plant Points')}:</span>
                                                    <span className="text-green-400">
                                                        {realPlantCount} {t('points')}
                                                    </span>
                                                </div>
                                                {realPlantCount > 500 && (
                                                    <div className="rounded bg-yellow-900 bg-opacity-30 p-2 text-xs text-yellow-300">
                                                        ⚠️{' '}
                                                        {t(
                                                            'Map displays up to 500 points for performance. Water calculation uses all'
                                                        )}{' '}
                                                        {realPlantCount} {t('points')}
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-gray-400">
                                                    <span>ปริมาณน้ำที่ต้องใช้ทั้งหมด:</span>
                                                    <span className="text-green-400">
                                                        {totalWaterRequirement.toFixed(1)}{' '}
                                                        ลิตร/ครั้ง
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Obstacles')}:</span>
                                                    <span className="text-green-400">
                                                        {finalObstacles.length} {t('items')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Rotation Angle')}:</span>
                                                    <span className="text-green-400">
                                                        {finalRotationAngle.toFixed(0)}°
                                                    </span>
                                                </div>

                                                {/* Crop Spacing Information */}
                                                {Object.keys(finalRowSpacing).length > 0 && (
                                                    <>
                                                        <div className="mt-2 border-t border-gray-600 pt-2">
                                                            <div className="mb-2 text-xs font-semibold text-blue-300">
                                                                🌱 {t('Crop Spacing')}:
                                                            </div>
                                                            {Object.entries(finalRowSpacing).map(
                                                                ([crop, rowSpacing]) => (
                                                                    <div
                                                                        key={crop}
                                                                        className="flex justify-between text-gray-400"
                                                                    >
                                                                        <span>{crop}:</span>
                                                                        <span className="text-blue-400">
                                                                            {rowSpacing}cm /{' '}
                                                                            {finalPlantSpacing[
                                                                                crop
                                                                            ] || '--'}
                                                                            cm
                                                                        </span>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Irrigation Types */}
                                    <div
                                        className="rounded-lg border border-white p-4"
                                        style={{ backgroundColor: '#000005' }}
                                    >
                                        <h3 className="mb-3 text-sm font-semibold text-white">
                                            {t('Irrigation Types')}
                                        </h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div
                                                onClick={() =>
                                                    handleIrrigationTypeSelect('sprinkler_system')
                                                }
                                                className={`cursor-pointer rounded border border-white p-2 text-center transition-colors ${
                                                    selectedIrrigationType === 'sprinkler_system'
                                                        ? 'border-blue-400 bg-blue-600'
                                                        : 'hover:bg-gray-800'
                                                }`}
                                                style={{
                                                    backgroundColor:
                                                        selectedIrrigationType ===
                                                        'sprinkler_system'
                                                            ? '#3b82f6'
                                                            : '#000005',
                                                }}
                                            >
                                                <div className="mb-1 text-lg">🚿</div>
                                                <h4 className="text-xs font-medium text-white">
                                                    {t('Sprinkler')}
                                                </h4>
                                                <p className="text-xs text-gray-400">
                                                    {t('Wide area coverage')}
                                                </p>
                                                {irrigationCounts.sprinkler_system > 0 && (
                                                    <div className="mt-1 text-xs text-blue-300">
                                                        {irrigationCounts.sprinkler_system}{' '}
                                                        {t('generated')}
                                                    </div>
                                                )}
                                            </div>

                                            <div
                                                onClick={() => handleIrrigationTypeSelect('pivot')}
                                                className={`cursor-pointer rounded border border-white p-2 text-center transition-colors ${
                                                    selectedIrrigationType === 'pivot'
                                                        ? 'border-blue-400 bg-blue-600'
                                                        : 'hover:bg-gray-800'
                                                }`}
                                                style={{
                                                    backgroundColor:
                                                        selectedIrrigationType === 'pivot'
                                                            ? '#3b82f6'
                                                            : '#000005',
                                                }}
                                            >
                                                <div className="mb-1 text-lg">🔄</div>
                                                <h4 className="text-xs font-medium text-white">
                                                    {t('System Pivot')}
                                                </h4>
                                                <p className="text-xs text-gray-400">
                                                    {t('Rotating irrigation')}
                                                </p>
                                                {irrigationCounts.pivot > 0 && (
                                                    <div className="mt-1 text-xs text-orange-300">
                                                        {irrigationCounts.pivot} {t('generated')}
                                                    </div>
                                                )}
                                            </div>

                                            <div
                                                className="cursor-not-allowed rounded border border-gray-600 p-2 text-center opacity-50 transition-colors"
                                                style={{ backgroundColor: '#000005' }}
                                            >
                                                <div className="mb-1 text-lg">🌊</div>
                                                <h4 className="text-xs font-medium text-gray-500">
                                                    {t('Water Jet Tape')}
                                                </h4>
                                                <p className="text-xs text-gray-600">
                                                    {t('Precise water jets')}
                                                </p>
                                                <div className="mt-1 text-xs text-gray-600">
                                                    {t('Disabled')}
                                                </div>
                                            </div>

                                            <div
                                                className="cursor-not-allowed rounded border border-gray-600 p-2 text-center opacity-50 transition-colors"
                                                style={{ backgroundColor: '#000005' }}
                                            >
                                                <div className="mb-1 text-lg">💧</div>
                                                <h4 className="text-xs font-medium text-gray-500">
                                                    {t('Drip Tape')}
                                                </h4>
                                                <p className="text-xs text-gray-600">
                                                    {t('Water efficient dripping')}
                                                </p>
                                                <div className="mt-1 text-xs text-gray-600">
                                                    {t('Disabled')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Irrigation Settings - Show only when type is selected */}
                                    {selectedIrrigationType && (
                                        <div
                                            className="rounded-lg border border-white p-4"
                                            style={{ backgroundColor: '#000005' }}
                                        >
                                            <h3 className="mb-3 text-sm font-semibold text-white">
                                                {t('Irrigation Settings')}
                                            </h3>
                                            {renderIrrigationSettings()}
                                        </div>
                                    )}
                                </div>
                            </div>

=======
                        scaledSize: new google.maps.Size(12, 12),
                        anchor: new google.maps.Point(6, 6),
                    },
                    title: `Pivot ${index + 1}`,
                    optimized: true,
                    clickable: false,
                    zIndex: 2000,
                });
                irrigationMarkersRef.current.push(marker);

                // Create coverage circle
                const circle = new google.maps.Circle({
                    center: pos,
                    radius: radius,
                    fillColor: '#f97316',
                    fillOpacity: 0.2,
                    strokeColor: '#ea580c',
                    strokeOpacity: 0.6,
                    strokeWeight: 1,
                    map: mapRef.current,
                    clickable: false,
                    zIndex: 2000,
                });
                irrigationCirclesRef.current.push(circle);
            });
        }

    }, [
        isMapLoaded,
        getSprinklerSettings,
        getPivotSettings,
        irrigationPositions.pivots,
        irrigationPositions.sprinklers,
        sprinklerMode,
        deleteSprinkler,
        updateSprinklerPosition,
        selectedSprinklers,
    ]);

    // Additional effect to ensure irrigation overlays are recreated when data is loaded from localStorage
    useEffect(() => {
        if (isMapLoaded && mapRef.current && !isAngleRegenerating) {
            // Check if we have irrigation data that should be displayed
            const hasIrrigationData =
                irrigationPositions.sprinklers.length > 0 ||
                irrigationPositions.pivots.length > 0;

            if (hasIrrigationData) {
                renderIrrigationOverlays();
            }
        }
    }, [
        isMapLoaded,
        irrigationPositions.pivots.length,
        irrigationPositions.sprinklers.length,
        renderIrrigationOverlays,
        isAngleRegenerating,
    ]);

    // Map event listeners for sprinkler management
    useEffect(() => {
        if (!mapRef.current) return;

        const listeners: google.maps.MapsEventListener[] = [];

        // Click listener for sprinkler operations
        const clickListener = mapRef.current.addListener(
            'click',
            (event: google.maps.MapMouseEvent) => {
                if (sprinklerMode === 'add' || sprinklerMode === 'delete' || sprinklerMode === 'move') {
                    handleMapClickForSprinkler(event);
                }
            }
        );
        listeners.push(clickListener);

        // Click listener for moving selected sprinklers
        const moveClickListener = mapRef.current.addListener(
            'click',
            (event: google.maps.MapMouseEvent) => {
                if (sprinklerMode === 'move') {
                    handleMoveSprinkler(event);
                }
            }
        );
        listeners.push(moveClickListener);

        // Clean up listeners when component unmounts or mode changes
        return () => {
            listeners.forEach((listener) => google.maps.event.removeListener(listener));
        };
    }, [
        sprinklerMode,
        handleMapClickForSprinkler,
        handleMoveSprinkler,
    ]);

    return (
        <>
            <Head title={t('Irrigation System')} />

            <div
                className="min-h-screen overflow-hidden text-white"
                style={{ backgroundColor: '#000005' }}
            >
                {/* Navbar */}
                <Navbar />

                <div className="h-[calc(100vh-4rem)] overflow-hidden">
                    <div className="flex h-full">
                        {/* Left Side - Control Panel */}
                        <div
                            className="flex w-80 flex-col border-r border-white"
                            style={{ backgroundColor: '#000005' }}
                        >
                            {/* Header */}
                            <div className="border-b border-white p-4">
                                <button
                                    onClick={handleBack}
                                    className="mb-3 flex items-center text-sm text-blue-400 hover:text-blue-300"
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
                                    {t('Back to Initial Area')}
                                </button>

                                <div className="mb-3">
                                    <h1 className="text-lg font-bold text-white">
                                        {steps.find((s) => s.id === currentStep)?.title}
                                    </h1>
                                </div>

                                {/* Step Navigation - Horizontal */}
                                <div className="mb-4 flex items-center justify-between">
                                    {steps.map((step, index) => {
                                        const isActive = step.id === currentStep;
                                        const isCompleted = parseInt(completedSteps) >= step.id;

                                        // Check if step has been completed based on current data
                                        const hasStepData = (() => {
                                            switch (step.id) {
                                                case 1: // Initial Area
                                                    return finalMainArea.length >= 3;
                                                case 2: // Irrigation Generate
                                                    return (
                                                        irrigationPositions.sprinklers.length > 0 ||
                                                        irrigationPositions.pivots.length > 0
                                                    );
                                                default:
                                                    return false;
                                            }
                                        })();

                                        // Step is completed only if previously marked as completed; do not auto-check step 2 by data presence
                                        const stepIsCompleted =
                                            step.id === 2
                                                ? isCompleted
                                                : isCompleted || hasStepData;

                                        return (
                                            <div key={step.id} className="flex items-center">
                                                <button
                                                    onClick={() => handleStepClick(step)}
                                                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                                                        stepIsCompleted
                                                            ? 'cursor-pointer bg-green-600 text-white hover:bg-green-500'
                                                            : isActive
                                                              ? 'cursor-not-allowed bg-blue-600 text-white'
                                                              : 'cursor-pointer bg-gray-600 text-white hover:bg-gray-500'
                                                    }`}
                                                >
                                                    {stepIsCompleted ? (
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
                                                        className={`mx-2 h-0.5 w-8 ${
                                                            stepIsCompleted
                                                                ? 'bg-green-600'
                                                                : 'bg-gray-600'
                                                        }`}
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
                                    {/* Selected Crops Display */}
                                    {finalSelectedCrops.length > 0 && (
                                        <div className="rounded-lg border border-white p-4">
                                            <h3 className="mb-3 text-sm font-semibold text-white">
                                                {t('Selected Crops')}
                                            </h3>

                                            <div className="flex flex-wrap gap-2">
                                                {finalSelectedCrops.map((crop, idx) => {
                                                    const cropData = getCropByValue(crop);
                                                    return (
                                                        <span
                                                            key={idx}
                                                            className="flex items-center gap-1 rounded border border-white bg-blue-600 px-3 py-1 text-xs text-white"
                                                        >
                                                            <span className="text-sm">
                                                                {cropData?.icon || '🌱'}
                                                            </span>
                                                            <span>{cropData?.name || crop}</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Field Information Display */}
                                    {finalMainArea.length > 0 && (
                                        <div
                                            className="rounded-lg border border-white p-4"
                                            style={{ backgroundColor: '#000005' }}
                                        >
                                            <h3 className="mb-3 text-sm font-semibold text-white">
                                                {t('Field Information')}
                                            </h3>
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Area')}:</span>
                                                    <span className="text-green-400">
                                                        {finalAreaRai !== null
                                                            ? finalAreaRai.toFixed(2)
                                                            : '--'}{' '}
                                                        {t('rai')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Total Plant Points')}:</span>
                                                    <span className="text-green-400">
                                                        {realPlantCount} {t('points')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Total water requirement')}:</span>
                                                    <span className="text-green-400">
                                                        {totalWaterRequirement.toFixed(1)}{' '}
                                                        {t('liters per irrigation')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Obstacles')}:</span>
                                                    <span className="text-green-400">
                                                        {finalObstacles.length} {t('items')}
                                                    </span>
                                                </div>

                                                {/* Crop Spacing Information */}
                                                {Object.keys(finalRowSpacing).length > 0 && (
                                                    <>
                                                        <div className="mt-2 border-t border-gray-600 pt-2">
                                                            <div className="mb-2 text-xs font-semibold text-blue-300">
                                                                🌱 {t('Crop Spacing')}:
                                                            </div>
                                                            {Object.entries(finalRowSpacing).map(
                                                                ([crop, rowSpacing]) => (
                                                                    <div
                                                                        key={crop}
                                                                        className="flex justify-between text-gray-400"
                                                                    >
                                                                        <span>{crop}:</span>
                                                                        <span className="text-blue-400">
                                                                            {rowSpacing}cm /{' '}
                                                                            {finalPlantSpacing[
                                                                                crop
                                                                            ] || '--'}
                                                                            cm
                                                                        </span>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Irrigation Types */}
                                    <div
                                        className="rounded-lg border border-white p-4"
                                        style={{ backgroundColor: '#000005' }}
                                    >
                                        <h3 className="mb-3 text-sm font-semibold text-white">
                                            {t('Irrigation Types')}
                                        </h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div
                                                onClick={() =>
                                                    handleIrrigationTypeSelect('sprinkler_system')
                                                }
                                                className={`cursor-pointer rounded border border-white p-2 text-center transition-colors ${
                                                    selectedIrrigationType === 'sprinkler_system'
                                                        ? 'border-blue-400 bg-blue-600'
                                                        : 'hover:bg-gray-800'
                                                }`}
                                                style={{
                                                    backgroundColor:
                                                        selectedIrrigationType ===
                                                        'sprinkler_system'
                                                            ? '#3b82f6'
                                                            : '#000005',
                                                }}
                                            >
                                                <div className="mb-1 text-lg">🚿</div>
                                                <h4 className="text-xs font-medium text-white">
                                                    {t('Sprinkler')}
                                                </h4>
                                                <p className="text-xs text-gray-400">
                                                    {t('Wide area coverage')}
                                                </p>
                                                {irrigationCounts.sprinkler_system > 0 && (
                                                    <div className="mt-1 text-xs text-blue-300">
                                                        {irrigationCounts.sprinkler_system}{' '}
                                                        {t('generated')}
                                                    </div>
                                                )}
                                            </div>

                                            <div
                                                onClick={() => handleIrrigationTypeSelect('pivot')}
                                                className={`cursor-pointer rounded border border-white p-2 text-center transition-colors ${
                                                    selectedIrrigationType === 'pivot'
                                                        ? 'border-blue-400 bg-blue-600'
                                                        : 'hover:bg-gray-800'
                                                }`}
                                                style={{
                                                    backgroundColor:
                                                        selectedIrrigationType === 'pivot'
                                                            ? '#3b82f6'
                                                            : '#000005',
                                                }}
                                            >
                                                <div className="mb-1 text-lg">🔄</div>
                                                <h4 className="text-xs font-medium text-white">
                                                    {t('System Pivot')}
                                                </h4>
                                                <p className="text-xs text-gray-400">
                                                    {t('Rotating irrigation')}
                                                </p>
                                                {irrigationCounts.pivot > 0 && (
                                                    <div className="mt-1 text-xs text-orange-300">
                                                        {irrigationCounts.pivot} {t('generated')}
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    </div>

                                    {/* Irrigation Settings - Show only when type is selected */}
                                    {selectedIrrigationType && (
                                        <div
                                            className="rounded-lg border border-white p-4"
                                            style={{ backgroundColor: '#000005' }}
                                        >
                                            <h3 className="mb-3 text-sm font-semibold text-white">
                                                {t('Irrigation Settings')}
                                            </h3>
                                            {renderIrrigationSettings()}
                                        </div>
                                    )}
                                </div>
                            </div>

>>>>>>> main
                            {/* Bottom Action Buttons */}
                            <div className="border-t border-white p-4">
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleBack}
                                        className="flex-1 rounded border border-white bg-gray-600 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-500"
                                    >
                                        {t('Back')}
                                    </button>

                                    <button
                                        onClick={() => {
                                            // Clear irrigation settings but keep field data
                                            setSelectedIrrigationType('');
                                            setIrrigationSettings({
                                                sprinkler_system: {
                                                    coverageRadius: 8,
                                                    overlap: 0,
                                                    flow: 10,
                                                    pressure: 2.5,
                                                },
                                                pivot: {
                                                    coverageRadius: 165,
                                                    overlap: 0,
                                                    flow: 50,
                                                    pressure: 3.0,
                                                },
<<<<<<< HEAD
                                                drip_tape: {
                                                    emitterSpacing: 20,
                                                    placement: 'along_rows',
                                                    side: 'left',
                                                    flow: 0.24,
                                                    pressure: 1.0,
                                                },
                                                water_jet_tape: {
                                                    emitterSpacing: 20,
                                                    placement: 'along_rows',
                                                    side: 'left',
                                                    flow: 1.5,
                                                    pressure: 1.5,
                                                },
=======
>>>>>>> main
                                            });

                                            // Clear irrigation counts
                                            setIrrigationCounts({
                                                sprinkler_system: 0,
                                                pivot: 0,
<<<<<<< HEAD
                                                drip_tape: 0,
                                                water_jet_tape: 0,
=======
>>>>>>> main
                                            });

                                            // Clear irrigation positions
                                            setIrrigationPositions({
                                                sprinklers: [],
                                                pivots: [],
<<<<<<< HEAD
                                                dripTapes: [],
                                                waterJets: [],
=======
>>>>>>> main
                                            });

                                            // Clear irrigation overlays
                                            irrigationMarkersRef.current.forEach((marker) =>
                                                marker.setMap(null)
                                            );
                                            irrigationMarkersRef.current = [];
                                            irrigationCirclesRef.current.forEach((circle) =>
                                                circle.setMap(null)
                                            );
                                            irrigationCirclesRef.current = [];
                                        }}
                                        className="flex-1 rounded border border-white bg-orange-600 px-4 py-2 text-sm text-white transition-colors hover:bg-orange-500"
                                    >
                                        {t('Reset')}
                                    </button>

                                    <button
                                        onClick={handleNext}
                                        className="flex-1 rounded border border-white bg-green-600 px-4 py-2 text-sm text-white transition-colors hover:bg-green-700"
                                        disabled={!hasGeneratedIrrigation}
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
                                {!isMapLoaded && (
                                    <div className="flex h-full items-center justify-center">
                                        <div className="text-center text-white">
                                            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
                                            <p className="text-sm">{t('Loading Map...')}</p>
                                        </div>
                                    </div>
                                )}
                                <HorticultureMapComponent
                                    center={[calculatedMapCenter.lat, calculatedMapCenter.lng]}
                                    zoom={finalMapZoom}
                                    onMapLoad={handleMapLoad}
                                    mapOptions={{ maxZoom: 22, fullscreenControl: true }}
                                />
                                <div className="absolute right-16 top-2.5 z-10 rounded-lg border border-white bg-black bg-opacity-80 p-3 text-xs">
                                    <div className="flex gap-2 text-white">
                                        <span>Lat: {calculatedMapCenter.lat.toFixed(4)}</span>
                                        <span>Lng: {calculatedMapCenter.lng.toFixed(4)}</span>
                                    </div>
                                    {/* Removed mode overlay to avoid container growth */}
                                </div>

                                {/* Sprinkler Management Controls */}
                                <div className="absolute left-4 top-2.5 z-10 rounded-lg border border-white bg-black bg-opacity-80 p-3">
                                    <div className="mb-2 text-xs font-semibold text-white">
                                        🚿 {t('Sprinkler Management')}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() =>
                                                handleSprinklerModeChange(
                                                    sprinklerMode === 'add' ? 'none' : 'add'
                                                )
                                            }
                                            className={`rounded border border-white px-3 py-1 text-xs font-medium transition-colors ${
                                                sprinklerMode === 'add'
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                        >
                                            ➕{' '}
                                            {sprinklerMode === 'add'
                                                ? t('Cancel Add')
                                                : t('Add Sprinkler')}
                                        </button>

                                        {/* Removed Select Multiple button; rectangle selection is available in Delete mode */}

                                        <button
                                            onClick={() =>
                                                handleSprinklerModeChange(
                                                    sprinklerMode === 'move' ? 'none' : 'move'
                                                )
                                            }
                                            className={`rounded border border-white px-3 py-1 text-xs font-medium transition-colors ${
                                                sprinklerMode === 'move'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                            disabled={irrigationPositions.sprinklers.length === 0}
                                        >
                                            🔄{' '}
                                            {sprinklerMode === 'move'
                                                ? t('Cancel Move')
                                                : t('Move Sprinkler')}
                                        </button>

                                        <button
                                            onClick={() =>
                                                handleSprinklerModeChange(
                                                    sprinklerMode === 'delete' ? 'none' : 'delete'
                                                )
                                            }
                                            className={`rounded border border-white px-3 py-1 text-xs font-medium transition-colors ${
                                                sprinklerMode === 'delete'
                                                    ? 'bg-red-600 text-white'
                                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                            disabled={irrigationPositions.sprinklers.length === 0}
                                        >
                                            🗑️{' '}
                                            {sprinklerMode === 'delete'
                                                ? t('Cancel Delete')
                                                : t('Delete Sprinkler')}
                                        </button>

                                        {/* Selection Actions */}
                                        {selectedSprinklers.length > 0 && (
                                            <div className="mt-2 border-t border-gray-600 pt-2">
                                                <div className="mb-2 text-xs text-orange-300">
                                                    {t('Selected')}: {selectedSprinklers.length}{' '}
                                                    {t('sprinklers')}
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={deleteSelectedSprinklers}
                                                        className="flex-1 rounded border border-white bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                                                    >
                                                        🗑️ {t('Delete Selected')}
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedSprinklers([])}
                                                        className="rounded border border-white bg-gray-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-gray-700"
                                                    >
                                                        ✖️
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {irrigationPositions.sprinklers.length > 0 && (
                                            <div className="mt-1 text-xs text-blue-300">
                                                {t('Total Sprinklers')}:{' '}
                                                {irrigationPositions.sprinklers.length}
                                            </div>
                                        )}

                                        {sprinklerMode !== 'none' && (
                                            <div className="mt-1 rounded bg-yellow-900 bg-opacity-30 p-2 text-xs text-yellow-300">
                                                {sprinklerMode === 'add' &&
                                                    `💡 ${t('Click on map to add sprinkler')}`}
                                                {sprinklerMode === 'move' &&
                                                    `💡 ${t('Drag sprinkler to move')}`}
                                                {sprinklerMode === 'delete' &&
                                                    `💡 ${t('Click to delete or drag to box-select and delete')}`}
                                            </div>
                                        )}
                                    </div>
                                </div>

<<<<<<< HEAD
                                <div className="pointer-events-none absolute bottom-4 right-20 z-10">
                                    <div className="mb-1 rounded border border-white bg-black bg-opacity-70 px-2 py-1 text-xs text-white">
                                        {t('Zoom Level')}: {parsedMapZoom}
                                    </div>
                                    {finalPlantPoints.length > 0 && (
                                        <div className="mb-1 rounded border border-white bg-black bg-opacity-70 px-2 py-1 text-xs text-white">
                                            {t('Points')}:{' '}
                                            {finalPlantPoints.length.toLocaleString()} /{' '}
                                            {realPlantCount.toLocaleString()}
                                            {realPlantCount > finalPlantPoints.length && (
                                                <span className="ml-1 text-yellow-300">
                                                    (
                                                    {Math.round(
                                                        (1 -
                                                            finalPlantPoints.length /
                                                                realPlantCount) *
                                                            100
                                                    )}
                                                    % {t('reduced')})
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {finalPlantPoints.length > 0 && realPlantCount >= 800 && (
                                        <div className="mb-1 rounded border border-blue-500 bg-blue-900 bg-opacity-70 px-2 py-1 text-xs text-white">
                                            {parsedMapZoom >= 20 && (
                                                <span className="text-green-300">
                                                    {t('All points visible')}
                                                </span>
                                            )}
                                            {parsedMapZoom >= 19 && parsedMapZoom < 20 && (
                                                <span className="text-yellow-300">
                                                    {t('25% reduction')}
                                                </span>
                                            )}
                                            {parsedMapZoom >= 18 && parsedMapZoom < 19 && (
                                                <span className="text-orange-300">
                                                    {t('50% reduction')}
                                                </span>
                                            )}
                                            {parsedMapZoom >= 17 && parsedMapZoom < 18 && (
                                                <span className="text-red-300">
                                                    {t('75% reduction')}
                                                </span>
                                            )}
                                            {parsedMapZoom < 17 && (
                                                <span className="text-red-500">
                                                    {t('Maximum reduction')}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {finalPlantPoints.length > 0 && (
                                        <div className="rounded border border-green-500 bg-green-900 bg-opacity-70 px-2 py-1 text-xs text-white">
                                            <div>
                                                {finalPlantPoints.length} {t('points')}{' '}
                                                {t('visible')}
                                            </div>
                                            {realPlantCount > finalPlantPoints.length && (
                                                <div className="text-xs text-yellow-200">
                                                    {t('Performance optimized')}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
=======
>>>>>>> main
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
