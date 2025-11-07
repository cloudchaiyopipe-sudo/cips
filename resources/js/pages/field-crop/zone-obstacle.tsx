import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import { useLanguage } from '../../contexts/LanguageContext';
import Navbar from '../../components/Navbar';
import HorticultureMapComponent from '../../components/horticulture/HorticultureMapComponent';
import * as turf from '@turf/turf';
import type * as GeoJSON from 'geojson';
import { parseCompletedSteps, toCompletedStepsCsv } from '../../utils/stepUtils';
import { getCropByValue } from './choose-crop';
import { getTranslatedCropByValue } from './choose-crop';
import { createVoronoiZones as createVoronoiZonesFromUtils } from '../../utils/autoZoneUtils';
import type { PlantLocation } from '../../utils/irrigationZoneUtils';
import {
    FieldCropPageProps,
    FieldData,
    Coordinate,
    Zone,
    FIELD_STYLING,
    MAP_CONFIG,
} from '../../types/fieldCropTypes';
import { useFieldData } from '../../hooks/useFieldData';

// ==================== CONSTANTS ====================
// 🎨 ใช้สีชุดเดียวกับ ZONE_COLORS ใน horticultureUtils.ts
// 🌈 5 โซนแรกใช้สีที่แตกต่างกันมากที่สุด
const ZONE_COLORS = [
    '#FF6B6B',
    '#9B59B6',
    '#F39C12',
    '#1ABC9C',
    '#3498DB',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E9',
    '#F8C471',
    '#82E0AA',
    '#F1948A',
    '#AED6F1',
    '#D2B4DE',
    '#F9E79F',
    '#A9DFBF',
    '#FAD7A0',
    '#D5A6BD',
    '#B2DFDB',
];

// Using standardized constants from fieldCropTypes.ts

const ALGORITHM_CONFIG = {
    MAX_ITERATIONS: 30,
    CONVERGENCE_THRESHOLD: 0.00001,
    DEFAULT_FLOW_RATES: {
        sprinkler: 10,
        pivot: 50,
    },
    ZONE_LIMITS: {
        MIN_ZONES: 1,
        MAX_ZONES: 20,
        MAX_POLYGON_POINTS: 200,
    },
};

// Using standardized MAP_CONFIG from fieldCropTypes.ts

// ==================== TYPES ====================
// Using standardized FieldCropPageProps interface

// Using standardized types from fieldCropTypes.ts

interface CombinedPoint {
    id: string;
    lat: number;
    lng: number;
    type: 'plant' | 'sprinkler';
    cropType?: string;
    weight: number;
}

interface StepData {
    id: number;
    key: string;
    title: string;
    description: string;
    route: string;
}

interface ZoneStats {
    totalZones: number;
    averageWater: number;
    waterDeviation: number;
    mostUnevenZone: string;
    mostEvenZone: string;
    targetWaterPerZone?: number;
    balanceScore?: number | null;
    balanceStatus?: string | null;
}

interface MapState {
    center: Coordinate;
    zoom: number;
}

interface ZoneEditingState {
    isDrawing: boolean;
    currentEdit: string | null;
    lastEdited: string | null;
}

// Note: MapRefs interface is not needed as we use individual refs directly

// ==================== UTILITY FUNCTIONS ====================

const getNextZoneColor = (existingZones: Zone[]): string => {
    const usedColors = existingZones.map((zone) => zone.color);
    const availableColors = ZONE_COLORS.filter((color) => !usedColors.includes(color));
    return availableColors.length > 0
        ? availableColors[0]
        : ZONE_COLORS[existingZones.length % ZONE_COLORS.length];
};

const calculateDistance = (point1: Coordinate, point2: Coordinate): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((point1.lat * Math.PI) / 180) *
            Math.cos((point2.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const isPointInPolygon = (point: Coordinate, polygon: Coordinate[]): boolean => {
    if (polygon.length < 3) return true;

    let inside = false;
    const x = point.lng;
    const y = point.lat;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng;
        const yi = polygon[i].lat;
        const xj = polygon[j].lng;
        const yj = polygon[j].lat;

        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }

    return inside;
};

const isPointInOrOnPolygon = (point: Coordinate, polygon: Coordinate[]): boolean => {
    if (polygon.length < 3) return true;

    // First check if point is inside the polygon
    if (isPointInPolygon(point, polygon)) {
        return true;
    }

    // Check if point is close to any edge of the polygon (with larger tolerance for irrigation points)
    const tolerance = 0.0001; // Increased tolerance for better coverage

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng;
        const yi = polygon[i].lat;
        const xj = polygon[j].lng;
        const yj = polygon[j].lat;

        const A = point.lng - xi;
        const B = point.lat - yi;
        const C = xj - xi;
        const D = yj - yi;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        if (lenSq === 0) continue;

        const param = dot / lenSq;

        let xx, yy;
        if (param < 0) {
            xx = xi;
            yy = yi;
        } else if (param > 1) {
            xx = xj;
            yy = yj;
        } else {
            xx = xi + param * C;
            yy = yi + param * D;
        }

        const dx = point.lng - xx;
        const dy = point.lat - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= tolerance) {
            return true;
        }
    }

    return false;
};

const computeConvexHull = (points: Coordinate[]): Coordinate[] => {
    if (points.length < 3) return points;

    let bottomMost = points[0];
    for (const point of points) {
        if (
            point.lat < bottomMost.lat ||
            (point.lat === bottomMost.lat && point.lng < bottomMost.lng)
        ) {
            bottomMost = point;
        }
    }

    const sortedPoints = points
        .filter((p) => p !== bottomMost)
        .sort((a, b) => {
            const angleA = Math.atan2(a.lat - bottomMost.lat, a.lng - bottomMost.lng);
            const angleB = Math.atan2(b.lat - bottomMost.lat, b.lng - bottomMost.lng);
            return angleA - angleB;
        });

    const hull = [bottomMost];

    for (const point of sortedPoints) {
        while (hull.length > 1) {
            const last = hull[hull.length - 1];
            const secondLast = hull[hull.length - 2];

            const cross =
                (last.lng - secondLast.lng) * (point.lat - secondLast.lat) -
                (last.lat - secondLast.lat) * (point.lng - secondLast.lng);

            if (cross > 0) break;
            hull.pop();
        }
        hull.push(point);
    }

    return hull;
};

const getObstacleColors = (type: string) => {
    const obstacleType = type as keyof typeof FIELD_STYLING.OBSTACLES;
    if (
        obstacleType in FIELD_STYLING.OBSTACLES &&
        typeof FIELD_STYLING.OBSTACLES[obstacleType] === 'object'
    ) {
        return FIELD_STYLING.OBSTACLES[obstacleType] as { fill: string; stroke: string };
    }
    return FIELD_STYLING.OBSTACLES.default;
};

// ==================== CUSTOM HOOKS ====================
// Note: useMapRefs hook is not needed as we use individual refs directly

// ==================== MAIN COMPONENT ====================
export default function ZoneObstacle(props: FieldCropPageProps) {
    const { t, language } = useLanguage();

    // Use standardized field data management
    const { fieldData, updateFieldData } = useFieldData(props);

    // ==================== STATE ====================
    const [desiredZoneCount, setDesiredZoneCount] = useState<number>(4);
    const [isGeneratingZones, setIsGeneratingZones] = useState<boolean>(false);
    const [zoneGenerationMethod, setZoneGenerationMethod] = useState<'convexHull' | 'voronoi'>(
        'voronoi'
    );
    const [zoneStats, setZoneStats] = useState<ZoneStats | null>(null);
    const [pointReductionMessage, setPointReductionMessage] = useState<string | null>(null);

    // Note: mapZoom state is not needed as we use fieldData.mapZoom

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

    // Grouped editing state
    const [zoneEditingState, setZoneEditingState] = useState<ZoneEditingState>({
        isDrawing: false,
        currentEdit: null,
        lastEdited: null,
    });

    // ==================== REFS ====================
    const mapRef = useRef<google.maps.Map | null>(null);
    const mainPolygonRef = useRef<google.maps.Polygon | null>(null);
    const zonePolygonsRef = useRef<Map<string, google.maps.Polygon>>(new Map());
    const obstaclePolygonsRef = useRef<google.maps.Polygon[]>([]);
    const plantPointMarkersRef = useRef<google.maps.Marker[]>([]);
    const irrigationMarkersRef = useRef<google.maps.Marker[]>([]);
    const irrigationCirclesRef = useRef<google.maps.Circle[]>([]);
    const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
    const suppressUpdatesRef = useRef<boolean>(false);
    // Note: useMapRefs hook is not needed as we use individual refs directly

    // On browser reload, keep zones to persist user-created zones
    useEffect(() => {
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
        if (isReload) {
            try {
                const str = localStorage.getItem('fieldCropData');
                if (str) {
                    // keep zones as-is on reload
                    const data = JSON.parse(str) as FieldData;
                    localStorage.setItem('fieldCropData', JSON.stringify(data));
                }
            } catch {
                // Failed to sanitize fieldCropData on reload
            }
            // no-op: keep existing state
        }
    }, []);

    // ==================== COMPUTED VALUES ====================
    const currentStep = props.currentStep || 3;
    const completedSteps = props.completedSteps || '';

    const defaultWaterPerZone = useMemo(() => {
        if (fieldData.totalWaterRequirement === 0) return 0;
        return fieldData.totalWaterRequirement / Math.max(desiredZoneCount, 1);
    }, [fieldData.totalWaterRequirement, desiredZoneCount]);

    const actualTotalWaterFromZones = useMemo(() => {
        return fieldData.zones.reduce((sum, zone) => sum + (zone.waterRequirement || 0), 0);
    }, [fieldData.zones]);

    const recalculatedTotalWater = useMemo(() => {
        const totalPlants = fieldData.realPlantCount || fieldData.plantPoints.length;
        if (totalPlants === 0) return 0;
        return fieldData.totalWaterRequirement;
    }, [fieldData.plantPoints.length, fieldData.realPlantCount, fieldData.totalWaterRequirement]);

    // Centralized map state using MapState interface
    const mapState: MapState = useMemo(
        () => ({
            center: fieldData.mapCenter,
            zoom: fieldData.mapZoom,
        }),
        [fieldData.mapCenter, fieldData.mapZoom]
    );

    // ==================== HELPER FUNCTIONS ====================
    const calculateZoneIrrigationInfo = useCallback(
        (coordinates: Coordinate[]) => {
            const sprinklersInZone = fieldData.irrigationPositions.sprinklers.filter((sprinkler) =>
                isPointInOrOnPolygon(sprinkler, coordinates)
            );
            const pivotsInZone = fieldData.irrigationPositions.pivots.filter((pivot) =>
                isPointInOrOnPolygon(pivot, coordinates)
            );

            const flowPerSprinkler =
                (fieldData.irrigationSettings?.sprinkler_system?.flow as number) ||
                ALGORITHM_CONFIG.DEFAULT_FLOW_RATES.sprinkler;
            const flowPerPivot =
                (fieldData.irrigationSettings?.pivot?.flow as number) ||
                ALGORITHM_CONFIG.DEFAULT_FLOW_RATES.pivot;

            const totalFlow =
                sprinklersInZone.length * flowPerSprinkler + pivotsInZone.length * flowPerPivot;

            return {
                sprinklerCount: sprinklersInZone.length,
                pivotCount: pivotsInZone.length,
                totalEquipmentCount: sprinklersInZone.length + pivotsInZone.length,
                flowPerSprinkler,
                flowPerPivot,
                totalFlow,
            };
        },
        [fieldData.irrigationPositions, fieldData.irrigationSettings]
    );

    const calculateZoneWaterInfo = useCallback(
        (coordinates: Coordinate[]) => {
            // Use realPlantCount for accurate zone calculations
            const totalPlants = fieldData.realPlantCount || fieldData.plantPoints.length;
            const totalWaterReq = fieldData.totalWaterRequirement || 0;

            if (totalPlants === 0 || totalWaterReq === 0) {
                return {
                    waterRequirement: 0,
                    plantCount: 0,
                    waterStatus: 'normal' as const,
                    waterMessage: '',
                };
            }

            // Calculate zone area as percentage of total main area
            const mainAreaSize = google.maps.geometry?.spherical
                ? google.maps.geometry.spherical.computeArea(
                      fieldData.mainArea.map((p) => new google.maps.LatLng(p.lat, p.lng))
                  )
                : 0;
            const zoneAreaSize = google.maps.geometry?.spherical
                ? google.maps.geometry.spherical.computeArea(
                      coordinates.map((p) => new google.maps.LatLng(p.lat, p.lng))
                  )
                : 0;

            const areaRatio = mainAreaSize > 0 ? zoneAreaSize / mainAreaSize : 0;

            // Estimate plants and water requirement based on area ratio
            const estimatedPlantsInZone = Math.round(totalPlants * areaRatio);
            const estimatedWaterRequirement = totalWaterReq * areaRatio;

            return {
                waterRequirement: estimatedWaterRequirement,
                plantCount: estimatedPlantsInZone,
                waterStatus: 'normal' as const,
                waterMessage: '',
            };
        },
        [
            fieldData.plantPoints,
            fieldData.realPlantCount,
            fieldData.totalWaterRequirement,
            fieldData.mainArea,
        ]
    );

    const createCombinedPoints = useCallback((): CombinedPoint[] => {
        const combinedPoints: CombinedPoint[] = [];

        // Only use irrigation equipment for zone generation
        const flowPerSprinkler =
            (fieldData.irrigationSettings?.sprinkler_system?.flow as number) ||
            ALGORITHM_CONFIG.DEFAULT_FLOW_RATES.sprinkler;
        const flowPerPivot =
            (fieldData.irrigationSettings?.pivot?.flow as number) ||
            ALGORITHM_CONFIG.DEFAULT_FLOW_RATES.pivot;

        // Calculate total irrigation flow for scaling
        const totalIrrigationFlow =
            fieldData.irrigationPositions.sprinklers.length * flowPerSprinkler +
            fieldData.irrigationPositions.pivots.length * flowPerPivot;

        // Use normalized weights based on flow rates
        const baseWeight = totalIrrigationFlow > 0 ? 1.0 : 1.0;

        // Define weights for each irrigation type based on their flow rates
        const IRRIGATION_WEIGHTS = {
            sprinkler: baseWeight * (flowPerSprinkler / 10), // Normalize to base weight
            pivot: baseWeight * (flowPerPivot / 50), // Normalize to base weight
        };

        // Add sprinklers
        fieldData.irrigationPositions.sprinklers.forEach((sprinkler, index) => {
            combinedPoints.push({
                id: `sprinkler-${index}`,
                lat: sprinkler.lat,
                lng: sprinkler.lng,
                type: 'sprinkler',
                weight: IRRIGATION_WEIGHTS.sprinkler,
            });
        });

        // Add pivots
        fieldData.irrigationPositions.pivots.forEach((pivot, index) => {
            combinedPoints.push({
                id: `pivot-${index}`,
                lat: pivot.lat,
                lng: pivot.lng,
                type: 'sprinkler', // Use same type for zone generation
                weight: IRRIGATION_WEIGHTS.pivot,
            });
        });

        return combinedPoints;
    }, [fieldData.irrigationPositions, fieldData.irrigationSettings]);

    const checkPolygonOverlap = useCallback(
        (coords1: Coordinate[], coords2: Coordinate[]): boolean => {
            try {
                if (coords1.length < 3 || coords2.length < 3) return false;

                const poly1Coords = [
                    ...coords1.map((c) => [c.lng, c.lat] as [number, number]),
                    [coords1[0].lng, coords1[0].lat],
                ];
                const poly2Coords = [
                    ...coords2.map((c) => [c.lng, c.lat] as [number, number]),
                    [coords2[0].lng, coords2[0].lat],
                ];

                const polygon1 = turf.polygon([poly1Coords]);
                const polygon2 = turf.polygon([poly2Coords]);

                const intersection = turf.intersect(polygon1, polygon2);
                return intersection !== null;
            } catch {
                // Error checking polygon overlap
                return false;
            }
        },
        []
    );

    const cutOverlapFromZones = useCallback(
        (editedZoneId: string, editedCoordinates: Coordinate[], allZones: Zone[]): Zone[] => {
            try {
                if (editedCoordinates.length < 3) {
                    return allZones;
                }
                const editedPoly = turf.polygon([
                    [
                        ...editedCoordinates.map((c) => [c.lng, c.lat] as [number, number]),
                        [editedCoordinates[0].lng, editedCoordinates[0].lat],
                    ],
                ]);

                return allZones
                    .map((zone) => {
                        if (zone.id === editedZoneId) {
                            return zone;
                        }

                        if (checkPolygonOverlap(zone.coordinates, editedCoordinates)) {
                            try {
                                const zonePoly = turf.polygon([
                                    [
                                        ...zone.coordinates.map(
                                            (c) => [c.lng, c.lat] as [number, number]
                                        ),
                                        [zone.coordinates[0].lng, zone.coordinates[0].lat],
                                    ],
                                ]);

                                const difference = turf.difference(zonePoly, editedPoly);

                                if (difference && difference.geometry) {
                                    let newCoordinates: Coordinate[] = [];
                                    const geometry = difference.geometry as GeoJSON.Geometry;

                                    if (geometry.type === 'Polygon') {
                                        const coords = geometry.coordinates[0] as [
                                            number,
                                            number,
                                        ][];
                                        newCoordinates = coords
                                            .slice(0, -1)
                                            .map((coord) => ({ lat: coord[1], lng: coord[0] }));
                                    } else if (geometry.type === 'MultiPolygon') {
                                        const polygons = geometry.coordinates;
                                        let largestPolygon: GeoJSON.Position[] = [];
                                        let largestArea = 0;

                                        polygons.forEach((polyCoords) => {
                                            try {
                                                const area = turf.area(turf.polygon(polyCoords));
                                                if (area > largestArea) {
                                                    largestArea = area;
                                                    largestPolygon = polyCoords[0];
                                                }
                                            } catch {
                                                // Error calculating polygon area
                                            }
                                        });
                                        newCoordinates = largestPolygon
                                            .slice(0, -1)
                                            .map((coord) => ({
                                                lat: coord[1] as number,
                                                lng: coord[0] as number,
                                            }));
                                    }

                                    if (newCoordinates.length >= 3) {
                                        const simplifiedCoords = newCoordinates;
                                        const waterInfo = calculateZoneWaterInfo(newCoordinates);
                                        return {
                                            ...zone,
                                            coordinates: simplifiedCoords,
                                            name: `${zone.name.split('(')[0].trim()} (${waterInfo.waterRequirement.toFixed(1)} ${t('liters per irrigation')})`,
                                            ...waterInfo,
                                        };
                                    } else {
                                        return null;
                                    }
                                } else {
                                    return null;
                                }
                            } catch {
                                // Error processing overlap for zone
                                return zone;
                            }
                        }
                        return zone;
                    })
                    .filter((zone): zone is Zone => zone !== null);
            } catch {
                // Error in cutOverlapFromZones
                return allZones;
            }
        },
        [checkPolygonOverlap, calculateZoneWaterInfo, t]
    );

    // ==================== ZONE GENERATION ALGORITHMS ====================
    const performKMeansClustering = useCallback(
        (points: CombinedPoint[], k: number) => {
            if (points.length === 0 || k <= 0) return [];
            if (points.length <= k) {
                return points.map((point) => [point]);
            }

            const pointWeights = points.map((point) => point.weight);
            const totalWeight = pointWeights.reduce((sum, weight) => sum + weight, 0);

            const validPoints = points.filter((p) => isPointInOrOnPolygon(p, fieldData.mainArea));
            if (validPoints.length === 0) return [points];

            const validWeights = validPoints.map((p) => p.weight);
            const totalValidWeight = validWeights.reduce((sum, weight) => sum + weight, 0);

            // Initialize centroids
            const centroids: Coordinate[] = [];

            // First centroid - weighted random selection
            let random = Math.random() * totalValidWeight;
            let firstIndex = 0;
            for (let i = 0; i < validWeights.length; i++) {
                random -= validWeights[i];
                if (random <= 0) {
                    firstIndex = i;
                    break;
                }
            }
            centroids.push({ lat: validPoints[firstIndex].lat, lng: validPoints[firstIndex].lng });

            // Remaining centroids using k-means++
            for (let i = 1; i < k; i++) {
                const distances: number[] = validPoints.map((point, index) => {
                    const minDistToCentroids = Math.min(
                        ...centroids.map((centroid) => calculateDistance(point, centroid))
                    );
                    const waterWeight = validWeights[index] / totalValidWeight;
                    return minDistToCentroids * minDistToCentroids * waterWeight;
                });

                const totalDistance = distances.reduce((sum, dist) => sum + dist, 0);
                if (totalDistance === 0) break;

                random = Math.random() * totalDistance;

                for (let j = 0; j < validPoints.length; j++) {
                    random -= distances[j];
                    if (random <= 0) {
                        centroids.push({ lat: validPoints[j].lat, lng: validPoints[j].lng });
                        break;
                    }
                }
            }

            const actualK = centroids.length;
            let clusters: CombinedPoint[][] = Array(actualK)
                .fill(null)
                .map(() => []);

            // K-means iterations
            for (let iteration = 0; iteration < ALGORITHM_CONFIG.MAX_ITERATIONS; iteration++) {
                clusters = Array(actualK)
                    .fill(null)
                    .map(() => []);

                // Assign points to clusters with improved scoring for irrigation points
                for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
                    const point = points[pointIndex];
                    let bestScore = -Infinity;
                    let bestCluster = 0;

                    for (let i = 0; i < centroids.length; i++) {
                        const distance = calculateDistance(point, centroids[i]);
                        const waterWeight = pointWeights[pointIndex] / totalWeight;

                        // Different multipliers for different irrigation types to balance zone generation
                        let weightMultiplier = 1.0;
                        if (point.id.includes('pivot')) {
                            weightMultiplier = 1.2; // Moderate multiplier for pivots
                        } else if (point.id.includes('sprinkler')) {
                            weightMultiplier = 1.0; // Standard multiplier for sprinklers
                        }

                        const score = (waterWeight * weightMultiplier) / (distance + 0.0001);

                        if (score > bestScore) {
                            bestScore = score;
                            bestCluster = i;
                        }
                    }

                    clusters[bestCluster].push(point);
                }

                // Update centroids
                const prevCentroids = [...centroids];
                for (let i = 0; i < actualK; i++) {
                    if (clusters[i].length > 0) {
                        let totalWeightedLat = 0;
                        let totalWeightedLng = 0;
                        let clusterTotalWeight = 0;

                        for (const point of clusters[i]) {
                            const weight = point.weight;
                            totalWeightedLat += point.lat * weight;
                            totalWeightedLng += point.lng * weight;
                            clusterTotalWeight += weight;
                        }

                        if (clusterTotalWeight > 0) {
                            centroids[i] = {
                                lat: totalWeightedLat / clusterTotalWeight,
                                lng: totalWeightedLng / clusterTotalWeight,
                            };
                        }
                    }
                }

                // Check for convergence
                const converged = centroids.every(
                    (centroid, i) =>
                        calculateDistance(centroid, prevCentroids[i]) <
                        ALGORITHM_CONFIG.CONVERGENCE_THRESHOLD
                );

                if (converged) break;
            }

            return clusters.filter((cluster) => cluster.length > 0);
        },
        [fieldData.mainArea]
    );

    // Voronoi-based zone generation is now available as an alternative to convex hull

    const createConvexHullZones = useCallback(
        (clusters: CombinedPoint[][]): Zone[] => {
            return clusters.map((cluster, index) => {
                const coords = cluster.map((p) => ({ lat: p.lat, lng: p.lng }));
                let hull = computeConvexHull(coords);

                // Expand the hull slightly to ensure better coverage of irrigation points
                if (hull.length >= 3) {
                    const center = {
                        lat: hull.reduce((sum, p) => sum + p.lat, 0) / hull.length,
                        lng: hull.reduce((sum, p) => sum + p.lng, 0) / hull.length,
                    };

                    // Expand each point outward by a small factor
                    const expansionFactor = 1.1; // 10% expansion
                    hull = hull.map((point) => ({
                        lat: center.lat + (point.lat - center.lat) * expansionFactor,
                        lng: center.lng + (point.lng - center.lng) * expansionFactor,
                    }));
                }

                const waterInfo = calculateZoneWaterInfo(hull);

                return {
                    id: `convex-zone-${Date.now()}-${index}`,
                    name: `${t('Zone')} ${index + 1} (${waterInfo.waterRequirement.toFixed(1)} ${t('liters per irrigation')})`,
                    coordinates: hull,
                    color: ZONE_COLORS[index % ZONE_COLORS.length],
                    cropType: fieldData.selectedCrops[0],
                    ...waterInfo,
                };
            });
        },
        [fieldData.selectedCrops, calculateZoneWaterInfo, t]
    );

    const createVoronoiZones = useCallback(
        (clusters: CombinedPoint[][]): Zone[] => {
            if (clusters.length === 0) return [];

            // Convert clusters to PlantLocation format for Voronoi algorithm
            const plantLocations = clusters.flat().map((point, index) => ({
                id: `plant-${index}`,
                position: { lat: point.lat, lng: point.lng },
                plantData: {
                    id: index + 1,
                    name: fieldData.selectedCrops[0],
                    plantSpacing: 1, // Default spacing
                    rowSpacing: 1, // Default spacing
                    waterNeed: point.weight || 0, // Use weight as water need
                },
            }));

            // Group plants back into clusters for Voronoi processing
            const clusterGroups: PlantLocation[][] = [];
            let plantIndex = 0;
            clusters.forEach((cluster) => {
                const clusterPlants: PlantLocation[] = [];
                for (let i = 0; i < cluster.length; i++) {
                    clusterPlants.push(plantLocations[plantIndex]);
                    plantIndex++;
                }
                clusterGroups.push(clusterPlants);
            });

            // Use the Voronoi algorithm from autoZoneUtils
            const voronoiZones = createVoronoiZonesFromUtils(
                clusterGroups,
                fieldData.mainArea,
                ZONE_COLORS
            );

            // Convert back to Zone format
            return voronoiZones.map((zone, index) => {
                const waterInfo = calculateZoneWaterInfo(zone.coordinates);

                return {
                    id: `voronoi-zone-${Date.now()}-${index}`,
                    name: `${t('Zone')} ${index + 1} (${waterInfo.waterRequirement.toFixed(1)} ${t('liters per irrigation')})`,
                    coordinates: zone.coordinates,
                    color: zone.color,
                    cropType: fieldData.selectedCrops[0],
                    ...waterInfo,
                };
            });
        },
        [fieldData.selectedCrops, fieldData.mainArea, calculateZoneWaterInfo, t]
    );

    const calculateZoneStats = useCallback(
        (zones: Zone[], targetWaterPerZone?: number): ZoneStats | null => {
            if (zones.length === 0) return null;

            const waterAmounts = zones.map((zone) => zone.waterRequirement || 0);
            const totalZoneWater = waterAmounts.reduce((sum, amount) => sum + amount, 0);
            const averageWater = totalZoneWater / zones.length;

            const variance =
                waterAmounts.reduce((sum, amount) => sum + Math.pow(amount - averageWater, 2), 0) /
                zones.length;
            const waterDeviation = Math.sqrt(variance);

            const maxWaterZone = zones.reduce((max, zone) =>
                (zone.waterRequirement || 0) > (max.waterRequirement || 0) ? zone : max
            );
            const minWaterZone = zones.reduce((min, zone) =>
                (zone.waterRequirement || 0) < (min.waterRequirement || 0) ? zone : min
            );

            let balanceScore: number | null = null;
            let balanceStatus: string | null = null;

            if (targetWaterPerZone && targetWaterPerZone > 0) {
                const deviations = waterAmounts.map((amount) =>
                    Math.abs(amount - targetWaterPerZone)
                );
                const averageDeviation =
                    deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
                balanceScore = ((targetWaterPerZone - averageDeviation) / targetWaterPerZone) * 100;

                if (balanceScore >= 80) {
                    balanceStatus = t('Excellent');
                } else if (balanceScore >= 60) {
                    balanceStatus = t('Good');
                } else if (balanceScore >= 40) {
                    balanceStatus = t('Fair');
                } else {
                    balanceStatus = t('Poor');
                }
            }

            return {
                totalZones: zones.length,
                averageWater,
                waterDeviation,
                mostUnevenZone: maxWaterZone.name || t('Unknown'),
                mostEvenZone: minWaterZone.name || t('Unknown'),
                targetWaterPerZone,
                balanceScore,
                balanceStatus,
            };
        },
        [t]
    );

    // Memoize expensive calculations
    const memoizedZoneStats = useMemo(() => {
        if (fieldData.zones.length === 0) return null;
        return calculateZoneStats(fieldData.zones, defaultWaterPerZone);
    }, [fieldData.zones, defaultWaterPerZone, calculateZoneStats]);

    const memoizedCombinedPoints = useMemo(() => {
        return createCombinedPoints();
    }, [createCombinedPoints]);

    // ==================== SAVE STATE ====================
    // Note: saveState is no longer needed as updateFieldData automatically saves to localStorage

    // ==================== ZONE GENERATION FUNCTIONS ====================
    const generateSmartAutoZones = useCallback(async () => {
        const combinedPoints = memoizedCombinedPoints;
        if (combinedPoints.length === 0) {
            alert(t('No irrigation equipment available for zone generation'));
            return;
        }

        if (desiredZoneCount <= 0 || desiredZoneCount > ALGORITHM_CONFIG.ZONE_LIMITS.MAX_ZONES) {
            alert(
                t(
                    `Please enter a valid number of zones (${ALGORITHM_CONFIG.ZONE_LIMITS.MIN_ZONES}-${ALGORITHM_CONFIG.ZONE_LIMITS.MAX_ZONES})`
                )
            );
            return;
        }

        setIsGeneratingZones(true);

        try {
            const targetWaterPerZone = fieldData.totalWaterRequirement / desiredZoneCount;
            const clusters = performKMeansClustering(combinedPoints, desiredZoneCount);

            if (!clusters || clusters.length === 0) {
                throw new Error('K-means clustering failed to produce valid clusters');
            }

            const newZones: Zone[] =
                zoneGenerationMethod === 'voronoi'
                    ? createVoronoiZones(clusters)
                    : createConvexHullZones(clusters);

            if (!newZones || newZones.length === 0) {
                throw new Error(t('No zones were generated successfully'));
            }

            updateFieldData({ zones: newZones });

            const stats = calculateZoneStats(newZones, targetWaterPerZone);
            setZoneStats(stats);

            // Zone generation completed

            // Note: saveState is no longer needed as updateFieldData automatically saves to localStorage
        } catch {
            // Error generating smart zones
            alert(t('Error generating zones. Please try again.'));
        } finally {
            setIsGeneratingZones(false);
        }
    }, [
        fieldData.totalWaterRequirement,
        desiredZoneCount,
        performKMeansClustering,
        createConvexHullZones,
        createVoronoiZones,
        calculateZoneStats,
        memoizedCombinedPoints,
        zoneGenerationMethod,
        updateFieldData,
        t,
    ]); // Use memoizedCombinedPoints instead of createCombinedPoints

    const generateAutoZones = useCallback(() => {
        if (fieldData.mainArea.length < 3) return;

        const bounds = {
            minLat: Math.min(...fieldData.mainArea.map((p) => p.lat)),
            maxLat: Math.max(...fieldData.mainArea.map((p) => p.lat)),
            minLng: Math.min(...fieldData.mainArea.map((p) => p.lng)),
            maxLng: Math.max(...fieldData.mainArea.map((p) => p.lng)),
        };

        const centerLat = (bounds.minLat + bounds.maxLat) / 2;
        const centerLng = (bounds.minLng + bounds.maxLng) / 2;

        const simpleZoneCoordinates = [
            [
                { lat: bounds.minLat, lng: bounds.minLng },
                { lat: centerLat, lng: bounds.minLng },
                { lat: centerLat, lng: centerLng },
                { lat: bounds.minLat, lng: centerLng },
            ],
            [
                { lat: centerLat, lng: bounds.minLng },
                { lat: bounds.maxLat, lng: bounds.minLng },
                { lat: bounds.maxLat, lng: centerLng },
                { lat: centerLat, lng: centerLng },
            ],
            [
                { lat: bounds.minLat, lng: centerLng },
                { lat: centerLat, lng: centerLng },
                { lat: centerLat, lng: bounds.maxLng },
                { lat: bounds.minLat, lng: bounds.maxLng },
            ],
            [
                { lat: centerLat, lng: centerLng },
                { lat: bounds.maxLat, lng: centerLng },
                { lat: bounds.maxLat, lng: bounds.maxLng },
                { lat: centerLat, lng: bounds.maxLng },
            ],
        ];

        const autoZones = simpleZoneCoordinates.map((coordinates, index) => {
            const waterInfo = calculateZoneWaterInfo(coordinates);

            return {
                id: `auto-${index + 1}`,
                name: `Zone ${index + 1}`,
                coordinates,
                color: ZONE_COLORS[index],
                cropType: fieldData.selectedCrops[0],
                ...waterInfo,
            };
        });

        updateFieldData({ zones: autoZones });

        const targetWaterPerZone = fieldData.totalWaterRequirement / 4;
        const stats = calculateZoneStats(autoZones, targetWaterPerZone);
        setZoneStats(stats);

        // Auto zone generation completed

        // Note: saveState is no longer needed as updateFieldData automatically saves to localStorage
    }, [
        fieldData.mainArea,
        fieldData.selectedCrops,
        fieldData.totalWaterRequirement,
        calculateZoneWaterInfo,
        calculateZoneStats,
        updateFieldData,
    ]); // Keep all dependencies as they are needed for auto zone generation

    // ==================== MAP FUNCTIONS ====================
    const clearMapObjects = useCallback(() => {
        obstaclePolygonsRef.current.forEach((polygon) => polygon.setMap(null));
        obstaclePolygonsRef.current = [];

        // Plant point markers are handled separately to prevent flickering
        // plantPointMarkersRef.current.forEach(marker => marker.setMap(null));

        irrigationMarkersRef.current.forEach((marker) => marker.setMap(null));
        irrigationMarkersRef.current = [];
        irrigationCirclesRef.current.forEach((circle) => circle.setMap(null));
        irrigationCirclesRef.current = [];

        if (mainPolygonRef.current) {
            mainPolygonRef.current.setMap(null);
            mainPolygonRef.current = null;
        }
    }, []);

    const createIrrigationMarkers = useCallback(
        (map: google.maps.Map) => {
            const totalIrrigationCount =
                fieldData.irrigationPositions.sprinklers.length +
                fieldData.irrigationPositions.pivots.length;

            if (irrigationMarkersRef.current.length !== totalIrrigationCount) {
                irrigationMarkersRef.current.forEach((marker) => marker.setMap(null));
                irrigationMarkersRef.current = [];
                irrigationCirclesRef.current.forEach((circle) => circle.setMap(null));
                irrigationCirclesRef.current = [];

                // Create sprinkler markers
                fieldData.irrigationPositions.sprinklers.forEach((pos, index) => {
                    const marker = new google.maps.Marker({
                        position: pos,
                        map: map,
                        icon: {
                            url:
                                'data:image/svg+xml;charset=UTF-8,' +
                                encodeURIComponent(`
							<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
								<circle cx="6" cy="6" r="5" fill="#3b82f6" stroke="#1d4ed8" stroke-width="1"/>
								<circle cx="6" cy="6" r="2" fill="#ffffff"/>
							</svg>
						`),
                            scaledSize: new google.maps.Size(12, 12),
                            anchor: new google.maps.Point(6, 6),
                        },
                        title: `Sprinkler ${index + 1}`,
                        optimized: true,
                        clickable: false,
                        zIndex: 1700, // Above zones (1500) and obstacles (1600)
                    });
                    irrigationMarkersRef.current.push(marker);

                    if (fieldData.irrigationSettings?.sprinkler_system?.coverageRadius) {
                        const circle = new google.maps.Circle({
                            center: pos,
                            radius: fieldData.irrigationSettings.sprinkler_system.coverageRadius,
                            fillColor: '#3b82f6',
                            fillOpacity: 0.2,
                            strokeColor: '#1d4ed8',
                            strokeOpacity: 0.6,
                            strokeWeight: 1,
                            map: map,
                            clickable: false,
                            zIndex: 1700, // Above zones (1500) and obstacles (1600)
                        });
                        irrigationCirclesRef.current.push(circle);
                    }
                });

                // Create pivot markers
                fieldData.irrigationPositions.pivots.forEach((pos, index) => {
                    const marker = new google.maps.Marker({
                        position: pos,
                        map: map,
                        icon: {
                            url:
                                'data:image/svg+xml;charset=UTF-8,' +
                                encodeURIComponent(`
							<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
								<circle cx="6" cy="6" r="5" fill="#f97316" stroke="#ea580c" stroke-width="1"/>
								<circle cx="6" cy="6" r="2" fill="#ffffff"/>
							</svg>
						`),
                            scaledSize: new google.maps.Size(12, 12),
                            anchor: new google.maps.Point(6, 6),
                        },
                        title: `Pivot ${index + 1}`,
                        optimized: true,
                        clickable: false,
                        zIndex: 1700, // Above zones (1500) and obstacles (1600)
                    });
                    irrigationMarkersRef.current.push(marker);

                    if (fieldData.irrigationSettings?.pivot?.coverageRadius) {
                        const circle = new google.maps.Circle({
                            center: pos,
                            radius: fieldData.irrigationSettings.pivot.coverageRadius,
                            fillColor: '#f97316',
                            fillOpacity: 0.2,
                            strokeColor: '#ea580c',
                            strokeOpacity: 1.0,
                            strokeWeight: 1,
                            map: map,
                            clickable: false,
                            zIndex: 1700, // Above zones (1500) and obstacles (1600)
                        });
                        irrigationCirclesRef.current.push(circle);
                    }
                });
            }
        },
        [fieldData.irrigationPositions, fieldData.irrigationSettings]
    );

    const updateZoneFromPolygon = useCallback(
        (zoneId: string, polygon: google.maps.Polygon) => {
            if (suppressUpdatesRef.current) return;
            if (zoneEditingState.currentEdit === zoneId) return;

            const path = polygon.getPath();
            const newCoordinates: Coordinate[] = [];
            for (let i = 0; i < path.getLength(); i++) {
                const latLng = path.getAt(i);
                newCoordinates.push({ lat: latLng.lat(), lng: latLng.lng() });
            }

            const originalZone = fieldData.zones.find((zone) => zone.id === zoneId);
            if (!originalZone) return;

            const processedZones = cutOverlapFromZones(zoneId, newCoordinates, fieldData.zones);

            const removedCount = fieldData.zones.length - processedZones.length;
            let modifiedCount = 0;
            processedZones.forEach((newZone) => {
                if (newZone.id === zoneId) return;
                const oldZone = fieldData.zones.find((z) => z.id === newZone.id);
                if (oldZone && oldZone.coordinates.length !== newZone.coordinates.length) {
                    modifiedCount++;
                }
            });
            if (removedCount > 0) {
                setPointReductionMessage(`${removedCount} โซนถูกลบเนื่องจากถูกทับซ้อนทั้งหมด`);
                setTimeout(() => setPointReductionMessage(null), 4000);
            } else if (modifiedCount > 0) {
                setPointReductionMessage(`${modifiedCount} โซนถูกปรับรูปทรงเพื่อลบส่วนที่ทับซ้อน`);
                setTimeout(() => setPointReductionMessage(null), 4000);
            }

            const finalZones = processedZones.map((zone) => {
                if (zone.id === zoneId) {
                    const waterInfo = calculateZoneWaterInfo(newCoordinates);
                    const zoneIndex = fieldData.zones.findIndex((z) => z.id === zoneId);
                    return {
                        ...zone,
                        coordinates: newCoordinates,
                        name: `${t('Zone')} ${zoneIndex + 1} (${waterInfo.waterRequirement.toFixed(1)} ${t('liters per irrigation')})`,
                        ...waterInfo,
                    };
                }
                return zone;
            });

            try {
                const finalIds = new Set(finalZones.map((z) => z.id));
                fieldData.zones.forEach((z) => {
                    if (!finalIds.has(z.id)) {
                        const poly = zonePolygonsRef.current.get(z.id);
                        if (poly) {
                            poly.setMap(null);
                            zonePolygonsRef.current.delete(z.id);
                        }
                    }
                });
                finalZones.forEach((z) => {
                    const poly = zonePolygonsRef.current.get(z.id);
                    if (poly) {
                        const path = poly.getPath();
                        let changed = path.getLength() !== z.coordinates.length;
                        if (!changed) {
                            for (let i = 0; i < path.getLength(); i++) {
                                const p = path.getAt(i);
                                const c = z.coordinates[i];
                                if (
                                    Math.abs(p.lat() - c.lat) > 1e-6 ||
                                    Math.abs(p.lng() - c.lng) > 1e-6
                                ) {
                                    changed = true;
                                    break;
                                }
                            }
                        }
                        if (changed) {
                            suppressUpdatesRef.current = true;
                            poly.setPath(z.coordinates);
                            suppressUpdatesRef.current = false;
                        }
                    }
                });
            } catch {
                // Failed to update zone polygon visuals
            }

            const stats = calculateZoneStats(finalZones, defaultWaterPerZone);
            setZoneStats(stats);

            updateFieldData({ zones: finalZones });
        },
        [
            calculateZoneWaterInfo,
            defaultWaterPerZone,
            calculateZoneStats,
            fieldData.zones,
            cutOverlapFromZones,
            zoneEditingState.currentEdit,
            updateFieldData,
            t,
        ]
    ); // Keep all dependencies as they are needed for zone updates

    const updateMapVisuals = useCallback(
        (map: google.maps.Map, forceUpdate: boolean = false) => {
            const shouldUpdate =
                forceUpdate ||
                !mainPolygonRef.current ||
                obstaclePolygonsRef.current.length !== fieldData.obstacles.length ||
                plantPointMarkersRef.current.length !== fieldData.plantPoints.length;

            if (shouldUpdate) {
                clearMapObjects();

                // Create main area polygon
                if (fieldData.mainArea.length >= 3) {
                    const poly = new google.maps.Polygon({
                        paths: [fieldData.mainArea],
                        fillColor: FIELD_STYLING.MAIN_AREA.fillColor,
                        fillOpacity: FIELD_STYLING.MAIN_AREA.fillOpacity,
                        strokeColor: FIELD_STYLING.MAIN_AREA.strokeColor,
                        strokeWeight: FIELD_STYLING.MAIN_AREA.strokeWeight,
                        strokeOpacity: FIELD_STYLING.MAIN_AREA.strokeOpacity,
                        map: map,
                        clickable: false,
                        zIndex: FIELD_STYLING.MAIN_AREA.zIndex,
                    });
                    mainPolygonRef.current = poly;
                }

                // Plant point markers are now handled separately in useEffect to prevent flickering

                createIrrigationMarkers(map);

                // Create obstacle polygons
                fieldData.obstacles.forEach((obstacle) => {
                    const colors = getObstacleColors(obstacle.type);
                    const poly = new google.maps.Polygon({
                        paths: [obstacle.coordinates],
                        fillColor: colors.fill,
                        fillOpacity: FIELD_STYLING.OBSTACLES.fillOpacity,
                        strokeColor: colors.stroke,
                        strokeWeight: FIELD_STYLING.OBSTACLES.strokeWeight,
                        strokeOpacity: FIELD_STYLING.OBSTACLES.strokeOpacity,
                        map: map,
                        clickable: true,
                        zIndex: FIELD_STYLING.OBSTACLES.zIndex, // Above zones (1500)
                    });
                    obstaclePolygonsRef.current.push(poly);
                });
            }

            // Handle zone polygons separately to avoid conflicts
            const existingZoneIds = new Set(fieldData.zones.map((zone) => zone.id));
            zonePolygonsRef.current.forEach((polygon, zoneId) => {
                if (!existingZoneIds.has(zoneId)) {
                    polygon.setMap(null);
                    zonePolygonsRef.current.delete(zoneId);
                }
            });

            // Create or update zone polygons
            fieldData.zones.forEach((zone) => {
                const existingPolygon = zonePolygonsRef.current.get(zone.id);

                if (existingPolygon) {
                    existingPolygon.setOptions({
                        fillColor: zone.color,
                        fillOpacity: FIELD_STYLING.ZONES.fillOpacity,
                        strokeColor: zone.color,
                        strokeWeight: FIELD_STYLING.ZONES.strokeWeight,
                        strokeOpacity: FIELD_STYLING.ZONES.strokeOpacity,
                        editable: zoneEditingState.currentEdit === zone.id,
                    });

                    const currentPath = existingPolygon.getPath();
                    const currentCoords: Coordinate[] = [];
                    for (let i = 0; i < currentPath.getLength(); i++) {
                        const latLng = currentPath.getAt(i);
                        currentCoords.push({ lat: latLng.lat(), lng: latLng.lng() });
                    }

                    const coordsChanged =
                        currentCoords.length !== zone.coordinates.length ||
                        currentCoords.some(
                            (coord, i) =>
                                zone.coordinates[i] &&
                                (Math.abs(coord.lat - zone.coordinates[i].lat) > 0.00001 ||
                                    Math.abs(coord.lng - zone.coordinates[i].lng) > 0.00001)
                        );

                    if (coordsChanged) {
                        suppressUpdatesRef.current = true;
                        existingPolygon.setPath(zone.coordinates);
                        suppressUpdatesRef.current = false;
                    }
                } else {
                    const poly = new google.maps.Polygon({
                        paths: [zone.coordinates],
                        fillColor: zone.color,
                        fillOpacity: FIELD_STYLING.ZONES.fillOpacity,
                        strokeColor: zone.color,
                        strokeWeight: FIELD_STYLING.ZONES.strokeWeight,
                        strokeOpacity: FIELD_STYLING.ZONES.strokeOpacity,
                        map: map,
                        clickable: true,
                        zIndex: FIELD_STYLING.ZONES.zIndex,
                        editable: zoneEditingState.currentEdit === zone.id,
                    });

                    zonePolygonsRef.current.set(zone.id, poly);

                    const path = poly.getPath();
                    path.addListener('set_at', () => updateZoneFromPolygon(zone.id, poly));
                    path.addListener('insert_at', () => updateZoneFromPolygon(zone.id, poly));
                    path.addListener('remove_at', () => updateZoneFromPolygon(zone.id, poly));

                    poly.addListener('dblclick', (e) => {
                        e.stop();
                        startEditZone(zone.id);
                    });
                }
            });
        },
        [
            fieldData.mainArea,
            fieldData.obstacles,
            fieldData.zones,
            fieldData.plantPoints,
            zoneEditingState.currentEdit,
            clearMapObjects,
            createIrrigationMarkers,
            updateZoneFromPolygon,
        ]
    ); // Remove mapZoom and other unnecessary dependencies to prevent flickering

    // Update map visuals when plant points change
    useEffect(() => {
        if (mapRef.current) {
            updateMapVisuals(mapRef.current, true);
        }
    }, [fieldData.plantPoints, updateMapVisuals]);

    // Update plant points only when zoom changes (to prevent irrigation marker flickering)
    useEffect(() => {
        if (mapRef.current && fieldData.plantPoints.length > 0) {
            // Clear existing plant point markers
            plantPointMarkersRef.current.forEach((marker) => marker.setMap(null));
            plantPointMarkersRef.current = [];

            // Use all plant points directly
            const filteredPoints = fieldData.plantPoints;

            // Calculate dynamic point size based on total point count (not filtered count)
            const pointSize = calculatePointSize(fieldData.plantPoints.length);
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

            // Create new plant point markers
            filteredPoints.forEach((point) => {
                const marker = new google.maps.Marker({
                    position: { lat: point.lat, lng: point.lng },
                    map: mapRef.current,
                    icon: plantIcon,
                    title: `Plant: ${point.cropType}`,
                    optimized: true,
                    clickable: false,
                    zIndex: 400,
                });
                plantPointMarkersRef.current.push(marker);
            });
        }
    }, [fieldData.mapZoom, fieldData.plantPoints, calculatePointSize]);

    const handleMapLoad = useCallback(
        (loadedMap: google.maps.Map) => {
            mapRef.current = loadedMap;

            loadedMap.addListener('zoom_changed', () => {
                const newZoom = loadedMap.getZoom() || MAP_CONFIG.DEFAULT_ZOOM;
                updateFieldData({ mapZoom: newZoom });
            });

            loadedMap.addListener('center_changed', () => {
                const newCenter = loadedMap.getCenter();
                if (newCenter) {
                    const center = { lat: newCenter.lat(), lng: newCenter.lng() };
                    updateFieldData({ mapCenter: center });
                }
            });

            // Only fit bounds if we don't have a valid saved map position
            const hasValidMapPosition =
                fieldData.mapCenter &&
                fieldData.mapCenter.lat !== MAP_CONFIG.DEFAULT_CENTER.lat &&
                fieldData.mapCenter.lng !== MAP_CONFIG.DEFAULT_CENTER.lng &&
                fieldData.mapZoom !== MAP_CONFIG.DEFAULT_ZOOM;

            if (fieldData.mainArea.length >= 3 && !hasValidMapPosition) {
                const bounds = new google.maps.LatLngBounds();
                fieldData.mainArea.forEach((p) =>
                    bounds.extend(new google.maps.LatLng(p.lat, p.lng))
                );
                loadedMap.fitBounds(bounds);
            } else if (hasValidMapPosition) {
                // Use saved map position
                loadedMap.setCenter(fieldData.mapCenter);
                loadedMap.setZoom(fieldData.mapZoom);
            }

            const drawingManager = new google.maps.drawing.DrawingManager({
                drawingMode: null,
                drawingControl: false,
                polygonOptions: {
                    fillColor: '#FF6B6B',
                    fillOpacity: 0.3,
                    strokeColor: '#FF6B6B',
                    strokeWeight: 2,
                    strokeOpacity: 1,
                    editable: false,
                    draggable: false,
                    clickable: false,
                },
            });
            drawingManager.setMap(loadedMap);
            drawingManagerRef.current = drawingManager;

            drawingManager.addListener('polygoncomplete', (polygon: google.maps.Polygon) => {
                const path = polygon.getPath();
                const coordinates: Coordinate[] = [];
                for (let i = 0; i < path.getLength(); i++) {
                    const latLng = path.getAt(i);
                    coordinates.push({ lat: latLng.lat(), lng: latLng.lng() });
                }

                const currentDrawingMode = drawingManager.getDrawingMode();
                const isCurrentlyDrawing =
                    currentDrawingMode === google.maps.drawing.OverlayType.POLYGON;

                if (zoneEditingState.isDrawing || isCurrentlyDrawing) {
                    const mainAreaBounds = new google.maps.LatLngBounds();
                    fieldData.mainArea.forEach((p) => mainAreaBounds.extend(p));

                    const isValid = coordinates.every((coord) => mainAreaBounds.contains(coord));

                    if (!isValid) {
                        alert(t('Zone must be drawn within the main field area'));
                        polygon.setMap(null);
                        setZoneEditingState((prev) => ({ ...prev, isDrawing: false }));
                        drawingManager.setDrawingMode(null);
                        return;
                    }

                    const waterInfo = calculateZoneWaterInfo(coordinates);
                    const irrigationInfo = calculateZoneIrrigationInfo(coordinates);
                    const zoneIndex = fieldData.zones.length;
                    const previewColor =
                        (polygon.get('fillColor') as string) ||
                        (polygon.get('strokeColor') as string) ||
                        ((
                            drawingManager.get('polygonOptions') as
                                | google.maps.PolygonOptions
                                | undefined
                        )?.fillColor as string) ||
                        getNextZoneColor(fieldData.zones);

                    const newZone: Zone = {
                        id: `manual-zone-${Date.now()}`,
                        name: `${t('Zone')} ${zoneIndex + 1} (${waterInfo.waterRequirement.toFixed(1)} ${t('liters per irrigation')})`,
                        coordinates,
                        color: previewColor,
                        cropType: fieldData.selectedCrops[0],
                        ...waterInfo,
                    };

                    polygon.setMap(null);

                    const updatedZones = [...fieldData.zones, newZone];
                    updateFieldData({ zones: updatedZones });
                    setTimeout(() => {
                        const stats = calculateZoneStats(updatedZones, defaultWaterPerZone);
                        setZoneStats(stats);
                    }, 0);

                    setZoneEditingState((prev) => ({ ...prev, isDrawing: false }));
                    drawingManager.setDrawingMode(null);

                    const equipmentMessage =
                        irrigationInfo.totalEquipmentCount > 0
                            ? `\n🚿 Sprinklers: ${irrigationInfo.sprinklerCount} units\n🔄 Pivots: ${irrigationInfo.pivotCount} units\n💦 Total Flow: ${irrigationInfo.totalFlow} L/min`
                            : '\n💿 No irrigation equipment in this zone';
                    const message = `Zone created successfully! Water requirement: ${waterInfo.waterRequirement.toFixed(1)} ${t('liters per irrigation')}${equipmentMessage}`;
                    alert(message);
                } else {
                    polygon.setMap(null);
                }
            });

            setTimeout(() => updateMapVisuals(loadedMap, true), 100);
        },
        [
            fieldData.mainArea,
            fieldData.selectedCrops,
            fieldData.zones,
            fieldData.mapCenter,
            fieldData.mapZoom,
            zoneEditingState.isDrawing,
            calculateZoneWaterInfo,
            calculateZoneIrrigationInfo,
            calculateZoneStats,
            defaultWaterPerZone,
            updateFieldData,
            t,
            updateMapVisuals,
        ]
    ); // Add necessary dependencies

    // ==================== EFFECTS ====================
    // Note: saveState is no longer needed as updateFieldData automatically saves to localStorage

    useEffect(() => {
        if (mapRef.current) {
            updateMapVisuals(mapRef.current, false);
        }
    }, [fieldData.zones, fieldData.selectedCrops, zoneEditingState.currentEdit, updateMapVisuals]); // Remove calculateZoneIrrigationInfo

    useEffect(() => {
        zonePolygonsRef.current.forEach((poly, zoneId) => {
            const isEditable = zoneEditingState.currentEdit === zoneId;
            poly.setEditable(isEditable);

            if (isEditable) {
                poly.setOptions({ strokeWeight: 3, strokeOpacity: 1.0, fillOpacity: 0.5 });
            } else {
                poly.setOptions({ strokeWeight: 2, strokeOpacity: 1.0, fillOpacity: 0.5 });
            }
        });

        if (zoneEditingState.currentEdit) {
            setZoneEditingState((prev) => ({ ...prev, lastEdited: prev.currentEdit }));
        } else if (zoneEditingState.lastEdited) {
            const editedId = zoneEditingState.lastEdited;
            const editedPoly = zonePolygonsRef.current.get(editedId);
            if (editedPoly) {
                updateZoneFromPolygon(editedId, editedPoly);
                setTimeout(() => {
                    if (mapRef.current) {
                        updateMapVisuals(mapRef.current, true);
                    }
                }, 0);
            }
            setZoneEditingState((prev) => ({ ...prev, lastEdited: null }));
        }
    }, [
        zoneEditingState.currentEdit,
        zoneEditingState.lastEdited,
        updateZoneFromPolygon,
        updateMapVisuals,
    ]); // Add updateMapVisuals back

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (zoneEditingState.isDrawing) {
                    cancelDrawingZone();
                }
                if (zoneEditingState.currentEdit) {
                    setZoneEditingState((prev) => ({ ...prev, currentEdit: null }));
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [zoneEditingState.isDrawing, zoneEditingState.currentEdit]);

    useEffect(() => {
        if (memoizedZoneStats) {
            setZoneStats(memoizedZoneStats);
        }
    }, [memoizedZoneStats]); // Use memoized value

    // ==================== EVENT HANDLERS ====================
    const startDrawingZone = () => {
        if (typeof google === 'undefined' || !google.maps || !google.maps.drawing) {
            alert(t('Drawing library not loaded. Please refresh the page.'));
            return;
        }

        if (!mapRef.current || !drawingManagerRef.current) {
            alert(t('Map not loaded. Please wait for the map to load.'));
            return;
        }

        if (fieldData.mainArea.length < 3) {
            alert(t('Please define the main field area first'));
            return;
        }

        setZoneEditingState((prev) => ({ ...prev, isDrawing: true, currentEdit: null }));

        const zoneColor = getNextZoneColor(fieldData.zones);
        drawingManagerRef.current.setOptions({
            polygonOptions: {
                fillColor: zoneColor,
                fillOpacity: 0.3,
                strokeColor: zoneColor,
                strokeWeight: 2,
                strokeOpacity: 1,
                editable: false,
                draggable: false,
                clickable: false,
            },
        });
        drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    };

    const clearZones = () => {
        zonePolygonsRef.current.forEach((polygon) => polygon.setMap(null));
        zonePolygonsRef.current.clear();
        updateFieldData({ zones: [] });
        setZoneStats(null);
        setZoneEditingState((prev) => ({ ...prev, currentEdit: null }));
        if (drawingManagerRef.current) {
            drawingManagerRef.current.setDrawingMode(null);
        }
        setZoneEditingState((prev) => ({ ...prev, isDrawing: false }));
    };

    const deleteZone = (zoneId: string) => {
        const polygon = zonePolygonsRef.current.get(zoneId);
        if (polygon) {
            polygon.setMap(null);
            zonePolygonsRef.current.delete(zoneId);
        }
        const updatedZones = fieldData.zones.filter((z) => z.id !== zoneId);
        updateFieldData({ zones: updatedZones });
        setTimeout(() => {
            const stats = calculateZoneStats(updatedZones, defaultWaterPerZone);
            setZoneStats(stats);
        }, 0);
        if (zoneEditingState.currentEdit === zoneId) {
            setZoneEditingState((prev) => ({ ...prev, currentEdit: null }));
        }
    };

    const startEditZone = (zoneId: string) => {
        setZoneEditingState((prev) => ({
            ...prev,
            currentEdit: prev.currentEdit === zoneId ? null : zoneId,
            isDrawing: false,
        }));
        if (drawingManagerRef.current) {
            drawingManagerRef.current.setDrawingMode(null);
        }
    };

    const handleZoneCropChange = (zoneId: string, cropValue: string) => {
        const updatedZones = fieldData.zones.map((z) =>
            z.id === zoneId ? { ...z, cropType: cropValue } : z
        );
        updateFieldData({ zones: updatedZones });
    };

    const cancelDrawingZone = () => {
        if (drawingManagerRef.current) {
            drawingManagerRef.current.setDrawingMode(null);
        }
        setZoneEditingState((prev) => ({ ...prev, isDrawing: false }));
    };

    const handleBack = () => {
        // Note: saveState is no longer needed as updateFieldData automatically saves to localStorage
        const params = {
            crops: fieldData.selectedCrops.join(','),
            currentStep: 2,
            completedSteps: toCompletedStepsCsv(parseCompletedSteps(completedSteps)),
        };
        router.get('/step2-irrigation-system', params);
    };

    const handleContinue = () => {
        // Note: saveState is no longer needed as updateFieldData automatically saves to localStorage
        const hasValidZone = fieldData.zones.some(
            (zone) =>
                zone.coordinates.length >= 3 &&
                zone.coordinates.every((coord) => isPointInOrOnPolygon(coord, fieldData.mainArea))
        );
        if (!hasValidZone) {
            alert(t('Please create at least one zone within the main area'));
            return;
        }
        const updatedCompleted = toCompletedStepsCsv([...parseCompletedSteps(completedSteps), 3]);
        const params = {
            crops: fieldData.selectedCrops.join(','),
            currentStep: 4,
            completedSteps: updatedCompleted,
        };
        router.get('/step4-pipe-system', params);
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

    // Helper function to check if current step is completed
    const isCurrentStepCompleted = () => {
        switch (currentStep) {
            case 1: // Initial Area
                return fieldData.mainArea.length >= 3;
            case 2: // Irrigation Generate
                return (
                    fieldData.irrigationPositions.sprinklers.length > 0 ||
                    fieldData.irrigationPositions.pivots.length > 0
                );
            case 3: // Zone Obstacle
                return fieldData.zones.some(
                    (zone) =>
                        zone.coordinates.length >= 3 &&
                        zone.coordinates.every((coord) =>
                            isPointInOrOnPolygon(coord, fieldData.mainArea)
                        )
                );
            case 4: // Pipe Generate
                return fieldData.pipes.length > 0;
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

    const handleStepClick = (step: StepData) => {
        // Note: saveState is no longer needed as updateFieldData automatically saves to localStorage

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
            const params = {
                crops: fieldData.selectedCrops.join(','),
                currentStep: step.id,
                completedSteps: completedSteps,
                mapCenter: JSON.stringify(fieldData.mapCenter),
                mapZoom: fieldData.mapZoom.toString(),
            };
            router.get(step.route, params);
            return;
        }

        // Original logic for incomplete steps
        if (step.id === 4) {
            const hasValidZone = fieldData.zones.some(
                (zone) =>
                    zone.coordinates.length >= 3 &&
                    zone.coordinates.every((coord) =>
                        isPointInOrOnPolygon(coord, fieldData.mainArea)
                    )
            );
            if (!hasValidZone) {
                alert(t('Please create at least one zone within the main area'));
                return;
            }
            const updatedCompleted = toCompletedStepsCsv([
                ...parseCompletedSteps(completedSteps),
                3,
            ]);
            const params = {
                crops: fieldData.selectedCrops.join(','),
                currentStep: step.id,
                completedSteps: updatedCompleted,
                mapCenter: JSON.stringify(fieldData.mapCenter),
                mapZoom: fieldData.mapZoom.toString(),
            };
            router.get(step.route, params);
            return;
        }
        // Update completed steps before navigating
        const updatedCompletedSteps = updateCompletedSteps();

        const params = {
            crops: fieldData.selectedCrops.join(','),
            currentStep: step.id,
            completedSteps: updatedCompletedSteps,
            mapCenter: JSON.stringify(fieldData.mapCenter),
            mapZoom: fieldData.mapZoom.toString(),
        };
        router.get(step.route, params);
    };

    // ==================== RENDER ====================
    return (
        <>
            <Head title={t('Zone Obstacle')} />

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
                                    {t('Back to Irrigation System')}
                                </button>

                                <div className="mb-3">
                                    <h1 className="text-lg font-bold text-white">
                                        {steps.find((s) => s.id === currentStep)?.title}
                                    </h1>
                                </div>

                                {/* Step Navigation */}
                                <div className="mb-4 flex items-center justify-between">
                                    {steps.map((step, index) => {
                                        const isActive = step.id === currentStep;
                                        const parsedSteps = parseCompletedSteps(completedSteps);
                                        const isCompleted =
                                            parsedSteps.includes(step.id) ||
                                            Math.max(0, ...parsedSteps) >= step.id;

                                        return (
                                            <div key={step.id} className="flex items-center">
                                                <button
                                                    onClick={() => handleStepClick(step)}
                                                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                                                        isCompleted
                                                            ? 'cursor-pointer bg-green-600 text-white hover:bg-green-500'
                                                            : isActive
                                                              ? 'cursor-not-allowed bg-blue-600 text-white'
                                                              : 'cursor-pointer bg-gray-600 text-white hover:bg-gray-500'
                                                    }`}
                                                >
                                                    {isCompleted ? (
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
                                                            isCompleted
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
                                <div className="space-y-6 p-4" style={{ willChange: 'auto' }}>
                                    {/* Selected Crops Display */}
                                    {fieldData.selectedCrops.length > 0 && (
                                        <div className="rounded-lg border border-white p-4">
                                            <h3 className="mb-3 text-sm font-semibold text-white">
                                                {t('Selected Crops')}
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {fieldData.selectedCrops.map((crop, idx) => {
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

                                    {/* Smart Zone Generation */}
                                    <div className="rounded-lg border border-white p-4">
                                        <h3 className="mb-3 text-sm font-semibold text-white">
                                            🎯 {t('Smart Zone Generation')}
                                        </h3>
                                        <div className="space-y-3">
                                            {/* Zone Generation Method */}
                                            <div>
                                                <label className="mb-2 block text-xs text-gray-300">
                                                    {t('Zone Generation Method')}:
                                                </label>
                                                <div className="flex gap-4 rounded-md bg-gray-700 p-1">
                                                    <button
                                                        onClick={() =>
                                                            setZoneGenerationMethod('voronoi')
                                                        }
                                                        className={`flex-1 rounded py-1 text-xs ${zoneGenerationMethod === 'voronoi' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-300'}`}
                                                    >
                                                        {t('Voronoi')}
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setZoneGenerationMethod('convexHull')
                                                        }
                                                        className={`flex-1 rounded py-1 text-xs ${zoneGenerationMethod === 'convexHull' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-300'}`}
                                                    >
                                                        {t('Convex Hull')}
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="mb-1 block text-xs text-gray-300">
                                                    {t('Number of Zones')}:
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    value={desiredZoneCount}
                                                    onChange={(e) =>
                                                        setDesiredZoneCount(
                                                            parseInt(e.target.value) || 1
                                                        )
                                                    }
                                                    className="w-full rounded border border-gray-500 bg-gray-700 px-2 py-1 text-xs text-white"
                                                    placeholder={t('Enter number of zones')}
                                                />
                                            </div>

                                            {fieldData.totalWaterRequirement > 0 &&
                                                (fieldData.irrigationPositions.sprinklers.length >
                                                    0 ||
                                                    fieldData.irrigationPositions.pivots.length >
                                                        0) && (
                                                    <div className="rounded bg-gray-700 p-2 text-xs">
                                                        <div className="mb-1 text-gray-300">
                                                            {t('Calculation Preview')}:
                                                        </div>
                                                        <div className="text-blue-300">
                                                            {t('Water per zone')}:{' '}
                                                            {(
                                                                fieldData.totalWaterRequirement /
                                                                desiredZoneCount
                                                            ).toFixed(1)}{' '}
                                                            {t('liters per irrigation')}
                                                        </div>
                                                        <div className="text-green-300">
                                                            {t('Plants per zone')}: ~
                                                            {Math.ceil(
                                                                (fieldData.realPlantCount ||
                                                                    fieldData.plantPoints.length) /
                                                                    desiredZoneCount
                                                            )}{' '}
                                                            {t('points')}
                                                        </div>
                                                        {fieldData.irrigationPositions.sprinklers
                                                            .length > 0 && (
                                                            <div className="text-orange-300">
                                                                {t('Sprinklers per zone')}: ~
                                                                {Math.ceil(
                                                                    fieldData.irrigationPositions
                                                                        .sprinklers.length /
                                                                        desiredZoneCount
                                                                )}{' '}
                                                                {t('units')}
                                                            </div>
                                                        )}
                                                        {fieldData.irrigationPositions.pivots
                                                            .length > 0 && (
                                                            <div className="text-orange-300">
                                                                {t('Pivots per zone')}: ~
                                                                {Math.ceil(
                                                                    fieldData.irrigationPositions
                                                                        .pivots.length /
                                                                        desiredZoneCount
                                                                )}{' '}
                                                                {t('units')}
                                                            </div>
                                                        )}
                                                        <div className="mt-2 border-t border-gray-600 pt-2">
                                                            <div className="text-xs text-yellow-300">
                                                                💡 {t('Zone Generation Based On')}:
                                                            </div>
                                                            <div className="mt-1 text-xs text-gray-400">
                                                                🚿 {t('Sprinklers')} | 🔄{' '}
                                                                {t('Pivots')}
                                                            </div>
                                                            <div className="mt-1 text-xs text-blue-300">
                                                                {t(
                                                                    'Zones are generated based on irrigation equipment positions only'
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                            <button
                                                onClick={generateSmartAutoZones}
                                                disabled={
                                                    isGeneratingZones ||
                                                    (fieldData.irrigationPositions.sprinklers
                                                        .length === 0 &&
                                                        fieldData.irrigationPositions.pivots
                                                            .length === 0)
                                                }
                                                className="w-full rounded border border-white bg-blue-600 px-3 py-2 text-xs text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isGeneratingZones
                                                    ? t('Generating Smart Zones...')
                                                    : t('Generate Smart Zones')}
                                            </button>

                                            <button
                                                onClick={generateAutoZones}
                                                className="w-full rounded border border-white bg-green-600 px-3 py-2 text-xs text-white transition-colors hover:bg-green-700"
                                            >
                                                {t('Generate Simple Auto Zones')}
                                            </button>

                                            <button
                                                onClick={startDrawingZone}
                                                className="w-full rounded border border-white bg-purple-600 px-3 py-2 text-xs text-white transition-colors hover:bg-purple-700"
                                                disabled={zoneEditingState.isDrawing}
                                            >
                                                {zoneEditingState.isDrawing
                                                    ? t('Click on map to draw zone...')
                                                    : t('Draw Manual Zone')}
                                            </button>

                                            {zoneEditingState.isDrawing && (
                                                <button
                                                    onClick={cancelDrawingZone}
                                                    className="w-full rounded border border-white bg-red-600 px-3 py-2 text-xs text-white transition-colors hover:bg-red-700"
                                                >
                                                    {t('Cancel Drawing')}
                                                </button>
                                            )}

                                            <button
                                                onClick={clearZones}
                                                className="w-full rounded border border-white bg-red-600 px-3 py-2 text-xs text-white transition-colors hover:bg-red-700"
                                            >
                                                {t('Clear All Zones')}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Zone Statistics */}
                                    {zoneStats && fieldData.zones.length > 0 && (
                                        <div className="rounded-lg border border-white p-4">
                                            <h3 className="mb-3 text-sm font-semibold text-white">
                                                📊 {t('Zone Statistics')}
                                            </h3>
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Total Zones')}:</span>
                                                    <span className="text-blue-400">
                                                        {zoneStats.totalZones}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Average Water')}:</span>
                                                    <span className="text-blue-400">
                                                        {zoneStats.averageWater.toFixed(1)}{' '}
                                                        {t('liters per irrigation')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Water Deviation')}:</span>
                                                    <span className="text-yellow-400">
                                                        {zoneStats.waterDeviation.toFixed(1)}{' '}
                                                        {t('liters per irrigation')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Most Uneven Zone')}:</span>
                                                    <span className="text-red-400">
                                                        {zoneStats.mostUnevenZone}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-gray-400">
                                                    <span>{t('Most Even Zone')}:</span>
                                                    <span className="text-green-400">
                                                        {zoneStats.mostEvenZone}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Zone List */}
                                    <div className="rounded-lg border border-white p-4">
                                        <h3 className="mb-3 text-sm font-semibold text-white">
                                            {t('Zones')} ({fieldData.zones.length})
                                        </h3>
                                        <div className="max-h-60 space-y-3 overflow-y-auto">
                                            {fieldData.zones.length === 0 ? (
                                                <div className="py-4 text-center text-xs text-gray-400">
                                                    {t('No zones created yet')}
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="rounded border border-gray-500 bg-gray-700 p-3">
                                                        <div className="mb-2 text-xs font-semibold text-blue-300">
                                                            📊 {t('Total Summary')}:
                                                        </div>
                                                        <div className="space-y-1 text-xs">
                                                            <div className="text-gray-300">
                                                                {t('Total Plants')}:{' '}
                                                                {fieldData.realPlantCount ||
                                                                    fieldData.zones.reduce(
                                                                        (sum, zone) =>
                                                                            sum +
                                                                            (zone.plantCount || 0),
                                                                        0
                                                                    )}
                                                            </div>
                                                            <div className="text-gray-300">
                                                                {t('Total Water')}:{' '}
                                                                {actualTotalWaterFromZones.toFixed(
                                                                    1
                                                                )}{' '}
                                                                {t('liters per irrigation')}
                                                            </div>
                                                            <div className="text-gray-300">
                                                                {t('Total Equipment')}:{' '}
                                                                {fieldData.zones.reduce(
                                                                    (sum, zone) => {
                                                                        const irrigationInfo =
                                                                            calculateZoneIrrigationInfo(
                                                                                zone.coordinates
                                                                            );
                                                                        return (
                                                                            sum +
                                                                            irrigationInfo.totalEquipmentCount
                                                                        );
                                                                    },
                                                                    0
                                                                )}
                                                            </div>
                                                            <div className="text-gray-300">
                                                                {t('Total Flow')}:{' '}
                                                                {fieldData.zones.reduce(
                                                                    (sum, zone) => {
                                                                        const irrigationInfo =
                                                                            calculateZoneIrrigationInfo(
                                                                                zone.coordinates
                                                                            );
                                                                        return (
                                                                            sum +
                                                                            irrigationInfo.totalFlow
                                                                        );
                                                                    },
                                                                    0
                                                                )}{' '}
                                                                {t('L/min')}
                                                            </div>
                                                        </div>
                                                        {recalculatedTotalWater > 0 && (
                                                            <div className="mt-2 border-t border-gray-600 pt-2">
                                                                <div className="text-xs text-blue-400">
                                                                    {t('Actual Water Need')}:{' '}
                                                                    {recalculatedTotalWater.toFixed(
                                                                        1
                                                                    )}{' '}
                                                                    {t('liters per irrigation')}
                                                                </div>
                                                                {Math.abs(
                                                                    actualTotalWaterFromZones -
                                                                        recalculatedTotalWater
                                                                ) > 0.1 && (
                                                                    <div className="mt-1 text-xs text-yellow-400">
                                                                        ⚠️{' '}
                                                                        {t(
                                                                            'Zone water differs from actual water need'
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {fieldData.zones.map((zone, index) => (
                                                        <div
                                                            key={zone.id}
                                                            className={`rounded border bg-gray-600 p-3 ${
                                                                zoneEditingState.currentEdit ===
                                                                zone.id
                                                                    ? 'border-blue-400'
                                                                    : zone.waterStatus === 'warning'
                                                                      ? 'border-yellow-400'
                                                                      : 'border-white'
                                                            }`}
                                                        >
                                                            <div className="mb-2 flex items-start justify-between">
                                                                <div className="flex items-center space-x-2">
                                                                    <div
                                                                        className="h-4 w-4 flex-shrink-0 rounded border border-white"
                                                                        style={{
                                                                            backgroundColor:
                                                                                zone.color,
                                                                        }}
                                                                    ></div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-semibold text-white">
                                                                            {t('Zone')} {index + 1}
                                                                        </span>
                                                                        <span className="text-xs text-gray-300">
                                                                            {(() => {
                                                                                const cropKey =
                                                                                    zone.cropType ||
                                                                                    fieldData
                                                                                        .selectedCrops[0];
                                                                                const translated =
                                                                                    getTranslatedCropByValue(
                                                                                        cropKey,
                                                                                        language ||
                                                                                            'en'
                                                                                    );
                                                                                return (
                                                                                    translated?.name ||
                                                                                    cropKey
                                                                                );
                                                                            })()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex space-x-1">
                                                                    <button
                                                                        onClick={() =>
                                                                            startEditZone(zone.id)
                                                                        }
                                                                        className={`rounded px-1 py-0.5 text-sm ${
                                                                            zoneEditingState.currentEdit ===
                                                                            zone.id
                                                                                ? 'bg-blue-600 text-white'
                                                                                : 'text-blue-400 hover:text-blue-300'
                                                                        }`}
                                                                        title={
                                                                            zoneEditingState.currentEdit ===
                                                                            zone.id
                                                                                ? t('Stop editing')
                                                                                : t(
                                                                                      'Edit zone shape on map'
                                                                                  )
                                                                        }
                                                                    >
                                                                        {zoneEditingState.currentEdit ===
                                                                        zone.id
                                                                            ? '✓'
                                                                            : '✏️'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() =>
                                                                            deleteZone(zone.id)
                                                                        }
                                                                        className="flex-shrink-0 text-sm text-red-400 hover:text-red-300"
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {zone.waterStatus === 'warning' &&
                                                                zone.waterMessage && (
                                                                    <div className="mb-2 rounded border border-yellow-400 bg-yellow-900 bg-opacity-50 p-2">
                                                                        <div className="text-xs font-semibold text-yellow-300">
                                                                            ⚠️ {t('Water Warning')}:
                                                                        </div>
                                                                        <div className="text-xs text-yellow-200">
                                                                            {zone.waterMessage}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                            <div className="space-y-1 text-xs">
                                                                {fieldData.selectedCrops.length >
                                                                    0 && (
                                                                    <div className="mb-1 flex items-center justify-between">
                                                                        <span className="text-gray-300">
                                                                            🌾{' '}
                                                                            {t('Crop in this zone')}
                                                                            :
                                                                        </span>
                                                                        <select
                                                                            value={
                                                                                zone.cropType ||
                                                                                fieldData
                                                                                    .selectedCrops[0]
                                                                            }
                                                                            onChange={(e) =>
                                                                                handleZoneCropChange(
                                                                                    zone.id,
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            className="ml-2 rounded border border-gray-500 bg-gray-700 px-2 py-1 text-xs text-white"
                                                                        >
                                                                            {fieldData.selectedCrops.map(
                                                                                (c) => {
                                                                                    const translated =
                                                                                        getTranslatedCropByValue(
                                                                                            c,
                                                                                            language ||
                                                                                                'en'
                                                                                        );
                                                                                    return (
                                                                                        <option
                                                                                            key={c}
                                                                                            value={
                                                                                                c
                                                                                            }
                                                                                        >
                                                                                            {translated?.name ||
                                                                                                c}
                                                                                        </option>
                                                                                    );
                                                                                }
                                                                            )}
                                                                        </select>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-gray-300">
                                                                        🌱 {t('Total Plants')}:
                                                                    </span>
                                                                    <span className="font-semibold text-green-400">
                                                                        {zone.plantCount || 0}{' '}
                                                                        {t('points')}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-gray-300">
                                                                        💧 {t('Water Need')}:
                                                                    </span>
                                                                    <span
                                                                        className={`font-semibold ${
                                                                            zone.waterStatus ===
                                                                            'warning'
                                                                                ? 'text-yellow-400'
                                                                                : 'text-blue-400'
                                                                        }`}
                                                                    >
                                                                        {(
                                                                            zone.waterRequirement ||
                                                                            0
                                                                        ).toFixed(1)}{' '}
                                                                        {t('liters per irrigation')}
                                                                    </span>
                                                                </div>

                                                                {(() => {
                                                                    const irrigationInfo =
                                                                        calculateZoneIrrigationInfo(
                                                                            zone.coordinates
                                                                        );
                                                                    return (
                                                                        <>
                                                                            {irrigationInfo.sprinklerCount >
                                                                                0 && (
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-gray-300">
                                                                                        🚿{' '}
                                                                                        {t(
                                                                                            'Sprinklers'
                                                                                        )}
                                                                                        :
                                                                                    </span>
                                                                                    <span className="font-semibold text-blue-400">
                                                                                        {
                                                                                            irrigationInfo.sprinklerCount
                                                                                        }{' '}
                                                                                        {t('units')}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {irrigationInfo.pivotCount >
                                                                                0 && (
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-gray-300">
                                                                                        🔄{' '}
                                                                                        {t(
                                                                                            'Pivots'
                                                                                        )}
                                                                                        :
                                                                                    </span>
                                                                                    <span className="font-semibold text-orange-400">
                                                                                        {
                                                                                            irrigationInfo.pivotCount
                                                                                        }{' '}
                                                                                        {t('units')}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {irrigationInfo.totalEquipmentCount >
                                                                                0 && (
                                                                                <>
                                                                                    <div className="flex items-center justify-between">
                                                                                        <span className="text-gray-300">
                                                                                            💦{' '}
                                                                                            {t(
                                                                                                'Total Flow'
                                                                                            )}
                                                                                            :
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {
                                                                                                irrigationInfo.totalFlow
                                                                                            }{' '}
                                                                                            {t(
                                                                                                'L/min'
                                                                                            )}
                                                                                        </span>
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                        </>
                                                                    );
                                                                })()}
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-gray-300">
                                                                        🎯 {t('vs Target')}:
                                                                    </span>
                                                                    <span
                                                                        className={`text-xs text-gray-300`}
                                                                    >
                                                                        {(
                                                                            (zone.waterRequirement ||
                                                                                0) -
                                                                            defaultWaterPerZone
                                                                        ).toFixed(1)}{' '}
                                                                        {t('liters per irrigation')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Drawing Instructions */}
                                    {zoneEditingState.isDrawing && (
                                        <div className="rounded border border-purple-400 bg-purple-900 bg-opacity-50 p-3">
                                            <div className="mb-2 text-xs font-semibold text-purple-300">
                                                🖊️ {t('Drawing Mode Active')}:
                                            </div>
                                            <div className="space-y-1 text-xs text-purple-200">
                                                <div>
                                                    • {t('Click on the map to start drawing')}
                                                </div>
                                                <div>
                                                    • {t('Click multiple points to create polygon')}
                                                </div>
                                                <div>• {t('Double-click to finish zone')}</div>
                                                <div>• {t('Zone must be within main area')}</div>
                                                <div>
                                                    • {t('Press ESC or click Cancel to stop')}
                                                </div>
                                                <div
                                                    className="mt-2 flex items-center space-x-2 rounded p-2"
                                                    style={{
                                                        backgroundColor:
                                                            getNextZoneColor(fieldData.zones) +
                                                            '40',
                                                    }}
                                                >
                                                    <div
                                                        className="h-3 w-3 rounded border"
                                                        style={{
                                                            backgroundColor: getNextZoneColor(
                                                                fieldData.zones
                                                            ),
                                                        }}
                                                    ></div>
                                                    <span className="text-xs text-purple-100">
                                                        {t('Next zone color')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Edit Instructions Panel */}
                                    {zoneEditingState.currentEdit && (
                                        <div className="rounded border border-blue-400 bg-blue-900 bg-opacity-50 p-3">
                                            <div className="mb-2 text-xs font-semibold text-blue-300">
                                                ✏️ {t('Edit Mode Active')}:
                                            </div>
                                            <div className="space-y-1 text-xs text-blue-200">
                                                <div>
                                                    •{' '}
                                                    {t(
                                                        'Drag corners on the map to reshape the zone'
                                                    )}
                                                </div>
                                                <div>
                                                    •{' '}
                                                    {t(
                                                        'When zone overlaps another, overlap will be cut automatically'
                                                    )}
                                                </div>
                                                <div>
                                                    •{' '}
                                                    {t(
                                                        'Overlapped zones will be reshaped or removed if fully covered'
                                                    )}
                                                </div>
                                                <div>
                                                    •{' '}
                                                    {t(
                                                        "Click another zone's edit button to switch"
                                                    )}
                                                </div>
                                                <div>
                                                    • {t('Click ✓ or press ESC to finish editing')}
                                                </div>
                                                <div>
                                                    •{' '}
                                                    {t(
                                                        'Water info updates automatically as you edit'
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Notification Panel */}
                                    {pointReductionMessage && (
                                        <div className="rounded border border-green-400 bg-green-900 bg-opacity-50 p-3">
                                            <div className="mb-2 text-xs font-semibold text-green-300">
                                                🔧 {t('Auto Update')}:
                                            </div>
                                            <div className="text-xs text-green-200">
                                                {pointReductionMessage}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

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
                                            updateFieldData({ zones: [] });
                                            setZoneStats(null);
                                            setZoneEditingState((prev) => ({
                                                ...prev,
                                                currentEdit: null,
                                            }));
                                        }}
                                        className="flex-1 rounded border border-white bg-orange-600 px-4 py-2 text-sm text-white transition-colors hover:bg-orange-500"
                                    >
                                        {t('Reset')}
                                    </button>

                                    <button
                                        onClick={handleContinue}
                                        className="flex-1 rounded border border-white bg-green-600 px-4 py-2 text-sm text-white transition-colors hover:bg-green-700"
                                    >
                                        {t('Next')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right Side - Map */}
                        <div className="relative flex-1">
                            <div
                                className="absolute inset-0 border border-white"
                                style={{ backgroundColor: '#000005' }}
                            >
                                <HorticultureMapComponent
                                    onMapLoad={handleMapLoad}
                                    center={[mapState.center.lat, mapState.center.lng]}
                                    zoom={mapState.zoom}
                                    mapOptions={{
                                        maxZoom: 22,
                                        disableDefaultUI: false,
                                        zoomControl: true,
                                        mapTypeControl: false,
                                        scaleControl: false,
                                        streetViewControl: false,
                                        rotateControl: false,
                                        fullscreenControl: true,
                                    }}
                                />
                                <div className="absolute right-16 top-2.5 z-10 rounded-lg border border-white bg-black bg-opacity-80 p-3 text-xs">
                                    <div className="flex gap-2 text-white">
                                        <span>Lat: {fieldData.mapCenter.lat.toFixed(4)}</span>
                                        <span>Lng: {fieldData.mapCenter.lng.toFixed(4)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
