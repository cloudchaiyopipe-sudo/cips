/* eslint-disable @typescript-eslint/no-unused-vars */
import { Coordinate, PlantLocation, IrrigationZone } from './irrigationZoneUtils';
import { getPolygonCenter } from './horticultureUtils';

class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    next(): number {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }

    compareFunction(): number {
        return this.next() - 0.5;
    }
}

export interface AutoZoneConfig {
    numberOfZones: number;
    balanceWaterNeed: boolean;
    balancePlantCount: boolean; 
    debugMode: boolean;
    paddingMeters: number;
    useVoronoi: boolean;
    randomSeed?: number; 
}

export interface AutoZoneResult {
    zones: IrrigationZone[];
    debugInfo: AutoZoneDebugInfo;
    success: boolean;
    error?: string;
    validation?: {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    };
}

export interface AutoZoneDebugInfo {
    totalPlants: number;
    totalWaterNeed: number;
    averageWaterNeedPerZone: number;
    actualWaterNeedPerZone: number[];
    waterNeedVariance: number;
    waterNeedStandardDeviation: number;
    waterBalanceEfficiency: number; 
    maxWaterNeedDeviation: number;
    minWaterNeedDeviation: number;
    waterNeedDeviationPercent: number; 
    convexHullPoints: Coordinate[][];
    plantAssignments: { [plantId: string]: string }; 
    timeTaken: number;
    waterBalanceDetails: {
        zoneIndex: number;
        waterNeed: number;
        deviation: number;
        deviationPercent: number;
        plantCount: number;
    }[];
}

export const generateZoneColors = (count: number, randomSeed?: number): string[] => {
    const colors = [
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

    const availableColors = [...colors];
    if (randomSeed !== undefined) {
        const seededRandom = new SeededRandom(randomSeed + 1000); 
        availableColors.sort(() => seededRandom.compareFunction());
    }

    const result: string[] = [];
    for (let i = 0; i < count; i++) {
        if (i < availableColors.length) {
            result.push(availableColors[i]);
        } else {
            let hue = (i * 137.508) % 360; 
            if (randomSeed !== undefined) {
                const seededRandom = new SeededRandom(randomSeed + 2000 + i);
                hue = seededRandom.next() * 360;
            }
            result.push(`hsl(${hue}, 70%, 60%)`);
        }
    }
    return result;
};

export const convexHull = (points: Coordinate[]): Coordinate[] => {
    if (points.length < 3) return points;

    let start = 0;
    for (let i = 1; i < points.length; i++) {
        if (
            points[i].lat < points[start].lat ||
            (points[i].lat === points[start].lat && points[i].lng < points[start].lng)
        ) {
            start = i;
        }
    }

    const startPoint = points[start];
    const sortedPoints = points
        .filter((_, i) => i !== start)
        .sort((a, b) => {
            const angleA = Math.atan2(a.lat - startPoint.lat, a.lng - startPoint.lng);
            const angleB = Math.atan2(b.lat - startPoint.lat, b.lng - startPoint.lng);

            if (angleA === angleB) {
                const distA =
                    Math.pow(a.lat - startPoint.lat, 2) + Math.pow(a.lng - startPoint.lng, 2);
                const distB =
                    Math.pow(b.lat - startPoint.lat, 2) + Math.pow(b.lng - startPoint.lng, 2);
                return distA - distB;
            }
            return angleA - angleB;
        });

    const hull = [startPoint];

    for (const point of sortedPoints) {
        while (
            hull.length > 1 &&
            crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0
        ) {
            hull.pop();
        }
        hull.push(point);
    }

    return hull;
};

const crossProduct = (o: Coordinate, a: Coordinate, b: Coordinate): number => {
    return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
};

export const isPointInPolygon = (point: Coordinate, polygon: Coordinate[]): boolean => {
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

export const kMeansCluster = (
    plants: PlantLocation[],
    k: number,
    maxIterations: number = 100,
    balanceWaterNeed: boolean = false,
    randomSeed?: number
): PlantLocation[][] => {
    if (plants.length === 0 || k <= 0) return [];
    if (k >= plants.length) return plants.map((plant) => [plant]);

    if (balanceWaterNeed) {
        return waterNeedAwareCluster(plants, k, maxIterations, randomSeed);
    }

    const centroids: Coordinate[] = [];
    const seededRandom = randomSeed !== undefined ? new SeededRandom(randomSeed) : null;

    const shuffled = [...plants].sort(() =>
        seededRandom ? seededRandom.compareFunction() : Math.random() - 0.5
    );

    if (seededRandom) {
        const firstIndex = Math.floor(seededRandom.next() * shuffled.length);
        centroids.push({ ...shuffled[firstIndex].position });

        for (let i = 1; i < k && i < shuffled.length; i++) {
            const distances = shuffled.map((plant) => {
                const minDist = Math.min(
                    ...centroids.map((centroid) => calculateDistance(plant.position, centroid))
                );
                return minDist * minDist; 
            });

            const totalDistance = distances.reduce((sum, d) => sum + d, 0);
            const randomValue = seededRandom.next() * totalDistance;

            let cumulativeDistance = 0;
            let selectedIndex = 0;
            for (let j = 0; j < distances.length; j++) {
                cumulativeDistance += distances[j];
                if (cumulativeDistance >= randomValue) {
                    selectedIndex = j;
                    break;
                }
            }

            centroids.push({ ...shuffled[selectedIndex].position });
        }
    } else {
        for (let i = 0; i < k; i++) {
            centroids.push({ ...shuffled[i].position });
        }
    }

    let clusters: PlantLocation[][] = Array(k)
        .fill(null)
        .map(() => []);
    let iteration = 0;

    while (iteration < maxIterations) {
        clusters = Array(k)
            .fill(null)
            .map(() => []);

        for (const plant of plants) {
            let minDistance = Infinity;
            let closestCentroid = 0;

            for (let i = 0; i < centroids.length; i++) {
                const distance = calculateDistance(plant.position, centroids[i]);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCentroid = i;
                }
            }

            clusters[closestCentroid].push(plant);
        }

        let converged = true;
        for (let i = 0; i < k; i++) {
            if (clusters[i].length === 0) continue;

            const newCentroid = {
                lat:
                    clusters[i].reduce((sum, plant) => sum + plant.position.lat, 0) /
                    clusters[i].length,
                lng:
                    clusters[i].reduce((sum, plant) => sum + plant.position.lng, 0) /
                    clusters[i].length,
            };

            if (calculateDistance(centroids[i], newCentroid) > 0.0001) {
                converged = false;
            }

            centroids[i] = newCentroid;
        }

        if (converged) break;
        iteration++;
    }

    return clusters.filter((cluster) => cluster.length > 0);
};

export const waterNeedAwareCluster = (
    plants: PlantLocation[],
    k: number,
    maxIterations: number = 100,
    randomSeed?: number
): PlantLocation[][] => {
    const totalWaterNeed = plants.reduce((sum, plant) => sum + plant.plantData.waterNeed, 0);
    const targetWaterNeedPerZone = totalWaterNeed / k;

    return perfectWaterBalanceCluster(plants, k, targetWaterNeedPerZone, maxIterations, randomSeed);
};

export const plantCountBalancedCluster = (
    plants: PlantLocation[],
    k: number,
    maxIterations: number = 100,
    randomSeed?: number
): PlantLocation[][] => {
    if (plants.length === 0 || k <= 0) return [];
    if (k >= plants.length) return plants.map((plant) => [plant]);

    const seededRandom = randomSeed !== undefined ? new SeededRandom(randomSeed) : null;
    const targetPlantsPerZone = Math.floor(plants.length / k);
    const extraPlants = plants.length % k; 

    const targetSizes: number[] = [];
    for (let i = 0; i < k; i++) {
        targetSizes.push(targetPlantsPerZone + (i < extraPlants ? 1 : 0));
    }

    const initialCentroids: Coordinate[] = [];
    const usedPlants = new Set<number>();

    const firstIndex = seededRandom
        ? Math.floor(seededRandom.next() * plants.length)
        : Math.floor(Math.random() * plants.length);
    initialCentroids.push(plants[firstIndex].position);
    usedPlants.add(firstIndex);

    for (let i = 1; i < k; i++) {
        let maxDistance = -1;
        let bestIndex = -1;

        for (let j = 0; j < plants.length; j++) {
            if (usedPlants.has(j)) continue;

            let minDistanceToExisting = Infinity;
            for (const centroid of initialCentroids) {
                const distance = calculateDistance(plants[j].position, centroid);
                minDistanceToExisting = Math.min(minDistanceToExisting, distance);
            }

            if (minDistanceToExisting > maxDistance) {
                maxDistance = minDistanceToExisting;
                bestIndex = j;
            }
        }

        if (bestIndex !== -1) {
            initialCentroids.push(plants[bestIndex].position);
            usedPlants.add(bestIndex);
        }
    }

    const clusters: PlantLocation[][] = Array(k)
        .fill(null)
        .map(() => []);

    plants.forEach((plant) => {
        let closestCentroidIndex = 0;
        let minDistance = calculateDistance(plant.position, initialCentroids[0]);

        for (let i = 1; i < initialCentroids.length; i++) {
            const distance = calculateDistance(plant.position, initialCentroids[i]);
            if (distance < minDistance) {
                minDistance = distance;
                closestCentroidIndex = i;
            }
        }

        clusters[closestCentroidIndex].push(plant);
    });

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        const centroids: Coordinate[] = clusters.map((cluster) => {
            if (cluster.length === 0) return { lat: 0, lng: 0 };
            return {
                lat: cluster.reduce((sum, plant) => sum + plant.position.lat, 0) / cluster.length,
                lng: cluster.reduce((sum, plant) => sum + plant.position.lng, 0) / cluster.length,
            };
        });

        let hasChanged = false;

        for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++) {
            const cluster = clusters[clusterIndex];

            for (let plantIndex = cluster.length - 1; plantIndex >= 0; plantIndex--) {
                const plant = cluster[plantIndex];

                let bestClusterIndex = clusterIndex;
                let minDistance = calculateDistance(plant.position, centroids[clusterIndex]);

                for (let otherIndex = 0; otherIndex < clusters.length; otherIndex++) {
                    if (otherIndex === clusterIndex) continue;

                    const distance = calculateDistance(plant.position, centroids[otherIndex]);

                    if (distance < minDistance) {
                        const canMoveFrom =
                            clusters[clusterIndex].length > targetSizes[clusterIndex];
                        const canMoveTo = clusters[otherIndex].length < targetSizes[otherIndex];

                        if (canMoveFrom || canMoveTo) {
                            minDistance = distance;
                            bestClusterIndex = otherIndex;
                        }
                    }
                }

                if (bestClusterIndex !== clusterIndex) {
                    const movedPlant = cluster.splice(plantIndex, 1)[0];
                    clusters[bestClusterIndex].push(movedPlant);
                    hasChanged = true;
                }
            }
        }

        if (!hasChanged) break;
    }

    for (let iteration = 0; iteration < 10; iteration++) {
        let hasAdjusted = false;

        for (let i = 0; i < clusters.length; i++) {
            if (clusters[i].length > targetSizes[i]) {
                for (let j = 0; j < clusters.length; j++) {
                    if (i !== j && clusters[j].length < targetSizes[j]) {
                        const centroidI = {
                            lat:
                                clusters[i].reduce((sum, plant) => sum + plant.position.lat, 0) /
                                clusters[i].length,
                            lng:
                                clusters[i].reduce((sum, plant) => sum + plant.position.lng, 0) /
                                clusters[i].length,
                        };

                        let farthestIndex = 0;
                        let maxDistance = 0;

                        clusters[i].forEach((plant, index) => {
                            const distance = calculateDistance(plant.position, centroidI);
                            if (distance > maxDistance) {
                                maxDistance = distance;
                                farthestIndex = index;
                            }
                        });

                        const movedPlant = clusters[i].splice(farthestIndex, 1)[0];
                        clusters[j].push(movedPlant);
                        hasAdjusted = true;
                        break;
                    }
                }
            }
            if (hasAdjusted) break;
        }

        if (!hasAdjusted) break;
    }

    return clusters.filter((cluster) => cluster.length > 0);
};

const perfectWaterBalanceCluster = (
    plants: PlantLocation[],
    k: number,
    targetWaterNeed: number,
    maxIterations: number = 100,
    randomSeed?: number
): PlantLocation[][] => {
    const seededRandom = randomSeed !== undefined ? new SeededRandom(randomSeed) : null;
    const tolerance = targetWaterNeed * 0.01; 

    const clusters: PlantLocation[][] = Array(k)
        .fill(null)
        .map(() => []);
    const clusterWaterNeeds: number[] = Array(k).fill(0);

    const sortedPlants = [...plants].sort((a, b) => {
        const waterDiff = b.plantData.waterNeed - a.plantData.waterNeed;
        if (Math.abs(waterDiff) < 0.001) {
            return seededRandom ? seededRandom.compareFunction() : Math.random() - 0.5;
        }
        return waterDiff;
    });

    sortedPlants.forEach((plant) => {
        let bestClusterIndex = 0;
        let minWaterNeed = clusterWaterNeeds[0];

        for (let i = 1; i < k; i++) {
            if (clusterWaterNeeds[i] < minWaterNeed) {
                minWaterNeed = clusterWaterNeeds[i];
                bestClusterIndex = i;
            }
        }

        clusters[bestClusterIndex].push(plant);
        clusterWaterNeeds[bestClusterIndex] += plant.plantData.waterNeed;
    });

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        let improved = false;

        const maxDeviation = Math.max(
            ...clusterWaterNeeds.map((need) => Math.abs(need - targetWaterNeed))
        );
        if (maxDeviation <= tolerance) {
            break; 
        }

        for (let i = 0; i < k && !improved; i++) {
            for (let j = i + 1; j < k && !improved; j++) {
                const clusterI = clusters[i];
                const clusterJ = clusters[j];
                const waterI = clusterWaterNeeds[i];
                const waterJ = clusterWaterNeeds[j];

                if (
                    Math.abs(waterI - targetWaterNeed) <= tolerance &&
                    Math.abs(waterJ - targetWaterNeed) <= tolerance
                ) {
                    continue;
                }

                for (let pi = 0; pi < clusterI.length && !improved; pi++) {
                    for (let pj = 0; pj < clusterJ.length && !improved; pj++) {
                        const plantI = clusterI[pi];
                        const plantJ = clusterJ[pj];

                        const newWaterI =
                            waterI - plantI.plantData.waterNeed + plantJ.plantData.waterNeed;
                        const newWaterJ =
                            waterJ - plantJ.plantData.waterNeed + plantI.plantData.waterNeed;

                        const currentDeviation =
                            Math.abs(waterI - targetWaterNeed) + Math.abs(waterJ - targetWaterNeed);
                        const newDeviation =
                            Math.abs(newWaterI - targetWaterNeed) +
                            Math.abs(newWaterJ - targetWaterNeed);

                        if (newDeviation < currentDeviation) {
                            clusterI[pi] = plantJ;
                            clusterJ[pj] = plantI;
                            clusterWaterNeeds[i] = newWaterI;
                            clusterWaterNeeds[j] = newWaterJ;
                            improved = true;
                        }
                    }
                }

                if (!improved) {
                    for (let pi = 0; pi < clusterI.length && !improved; pi++) {
                        const plant = clusterI[pi];
                        const newWaterI = waterI - plant.plantData.waterNeed;
                        const newWaterJ = waterJ + plant.plantData.waterNeed;

                        const currentDeviation =
                            Math.abs(waterI - targetWaterNeed) + Math.abs(waterJ - targetWaterNeed);
                        const newDeviation =
                            Math.abs(newWaterI - targetWaterNeed) +
                            Math.abs(newWaterJ - targetWaterNeed);

                        if (newDeviation < currentDeviation) {
                            clusterI.splice(pi, 1);
                            clusterJ.push(plant);
                            clusterWaterNeeds[i] = newWaterI;
                            clusterWaterNeeds[j] = newWaterJ;
                            improved = true;
                        }
                    }
                }
            }
        }

        if (!improved) break;
    }

    return clusters.filter((cluster) => cluster.length > 0);
};

export const calculateDistance = (coord1: Coordinate, coord2: Coordinate): number => {
    const R = 6371000; 
    const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((coord1.lat * Math.PI) / 180) *
            Math.cos((coord2.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const balanceWaterNeeds = (
    clusters: PlantLocation[][],
    targetWaterNeedPerZone: number,
    tolerance: number = 0.1
): PlantLocation[][] => {
    const balancedClusters = clusters.map((cluster) => [...cluster]);

    const getClusterWaterNeed = (cluster: PlantLocation[]): number => {
        return cluster.reduce((sum, plant) => sum + plant.plantData.waterNeed, 0);
    };

    let improved = true;
    let iterations = 0;
    const maxIterations = 100;

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        for (let i = 0; i < balancedClusters.length; i++) {
            for (let j = i + 1; j < balancedClusters.length; j++) {
                const waterNeedI = getClusterWaterNeed(balancedClusters[i]);
                const waterNeedJ = getClusterWaterNeed(balancedClusters[j]);

                if (
                    Math.abs(waterNeedI - targetWaterNeedPerZone) <=
                        targetWaterNeedPerZone * tolerance &&
                    Math.abs(waterNeedJ - targetWaterNeedPerZone) <=
                        targetWaterNeedPerZone * tolerance
                ) {
                    continue;
                }

                for (let pi = 0; pi < balancedClusters[i].length; pi++) {
                    for (let pj = 0; pj < balancedClusters[j].length; pj++) {
                        const plantI = balancedClusters[i][pi];
                        const plantJ = balancedClusters[j][pj];

                        const newWaterNeedI =
                            waterNeedI - plantI.plantData.waterNeed + plantJ.plantData.waterNeed;
                        const newWaterNeedJ =
                            waterNeedJ - plantJ.plantData.waterNeed + plantI.plantData.waterNeed;

                        const currentVariance =
                            Math.pow(waterNeedI - targetWaterNeedPerZone, 2) +
                            Math.pow(waterNeedJ - targetWaterNeedPerZone, 2);
                        const newVariance =
                            Math.pow(newWaterNeedI - targetWaterNeedPerZone, 2) +
                            Math.pow(newWaterNeedJ - targetWaterNeedPerZone, 2);

                        if (newVariance < currentVariance) {
                            balancedClusters[i][pi] = plantJ;
                            balancedClusters[j][pj] = plantI;
                            improved = true;
                        }
                    }
                }
            }
        }
    }

    return balancedClusters;
};

export const enhancedBalanceWaterNeeds = (
    clusters: PlantLocation[][],
    targetWaterNeedPerZone: number,
    tolerance: number = 0.05 
): PlantLocation[][] => {
    const balancedClusters = clusters.map((cluster) => [...cluster]);

    const adaptiveTolerance = Math.min(0.12, tolerance + (clusters.length - 2) * 0.015); 

    const getClusterWaterNeed = (cluster: PlantLocation[]): number => {
        return cluster.reduce((sum, plant) => sum + plant.plantData.waterNeed, 0);
    };

    const getMaxDeviation = (clusters: PlantLocation[][]): number => {
        const waterNeeds = clusters.map(getClusterWaterNeed);
        return Math.max(...waterNeeds.map((need) => Math.abs(need - targetWaterNeedPerZone)));
    };

    let improved = true;
    let iterations = 0;
    const maxIterations = Math.min(1500, clusters.length * 250); 
    let currentMaxDeviation = getMaxDeviation(balancedClusters);
    const strictTolerance = targetWaterNeedPerZone * adaptiveTolerance;

    while (improved && iterations < maxIterations && currentMaxDeviation > strictTolerance) {
        improved = false;
        iterations++;

        const clusterWaterNeeds = balancedClusters.map((cluster, index) => ({
            index,
            waterNeed: getClusterWaterNeed(cluster),
            deviation: Math.abs(getClusterWaterNeed(cluster) - targetWaterNeedPerZone),
            cluster,
        }));

        clusterWaterNeeds.sort((a, b) => b.deviation - a.deviation);

        const mostUnbalanced = clusterWaterNeeds[0];

        let bestTarget: (typeof clusterWaterNeeds)[0] | null = null;
        let bestBalanceScore = -1;

        for (const candidate of clusterWaterNeeds) {
            if (candidate.index === mostUnbalanced.index) continue;

            const waterDiff = Math.abs(mostUnbalanced.waterNeed - candidate.waterNeed);

            const potentialImprovement = waterDiff / 2; 
            const combinedDeviation = mostUnbalanced.deviation + candidate.deviation;

            const balanceScore =
                combinedDeviation * 2 -
                Math.abs(potentialImprovement - targetWaterNeedPerZone * 0.05);

            if (balanceScore > bestBalanceScore) {
                bestBalanceScore = balanceScore;
                bestTarget = candidate;
            }
        }

        if (!bestTarget) continue;

        improved = tryEnhancedPrecisionBalancing(
            balancedClusters,
            mostUnbalanced,
            bestTarget,
            targetWaterNeedPerZone,
            strictTolerance
        );

        if (!improved && iterations % 50 === 0) {
            improved = tryAggressiveRebalancing(
                balancedClusters,
                targetWaterNeedPerZone,
                strictTolerance
            );
        }

        if (improved) {
            currentMaxDeviation = getMaxDeviation(balancedClusters);
        }
    }

    return balancedClusters;
};

const getClusterCenter = (cluster: PlantLocation[]): Coordinate => {
    if (cluster.length === 0) return { lat: 0, lng: 0 };

    const totalLat = cluster.reduce((sum, plant) => sum + plant.position.lat, 0);
    const totalLng = cluster.reduce((sum, plant) => sum + plant.position.lng, 0);

    return {
        lat: totalLat / cluster.length,
        lng: totalLng / cluster.length,
    };
};

const tryEnhancedPrecisionBalancing = (
    clusters: PlantLocation[][],
    mostUnbalanced: { index: number; waterNeed: number; deviation: number },
    target: { index: number; waterNeed: number; deviation: number },
    targetWater: number,
    tolerance: number
): boolean => {
    const clusterA = clusters[mostUnbalanced.index];
    const clusterB = clusters[target.index];

    if (clusterA.length === 0 || clusterB.length === 0) return false;

    const centerA = getClusterCenter(clusterA);
    const centerB = getClusterCenter(clusterB);

    const waterNeedA = mostUnbalanced.waterNeed;
    const waterNeedB = target.waterNeed;
    const idealExchange = (waterNeedA - waterNeedB) / 2;

    if (Math.abs(idealExchange) < tolerance / 4) return false;

    const sourceCluster = waterNeedA > waterNeedB ? clusterA : clusterB;
    const destCluster = waterNeedA > waterNeedB ? clusterB : clusterA;
    const sourceCenter = waterNeedA > waterNeedB ? centerA : centerB;
    const destCenter = waterNeedA > waterNeedB ? centerB : centerA;

    let bestPlant: PlantLocation | null = null;
    let bestScore = -1;

    sourceCluster.forEach((plant) => {
        const plantWater = plant.plantData.waterNeed;

        const newDeviationSource = Math.abs(mostUnbalanced.waterNeed - plantWater - targetWater);
        const newDeviationTarget = Math.abs(target.waterNeed + plantWater - targetWater);
        const currentDeviation = mostUnbalanced.deviation + target.deviation;
        const newDeviation = newDeviationSource + newDeviationTarget;
        const balanceImprovement = currentDeviation - newDeviation;

        if (balanceImprovement > 0) {
            const distanceToSource = calculateDistance(plant.position, sourceCenter);
            const distanceToDestination = calculateDistance(plant.position, destCenter);

            const geographicBonus = Math.max(0, (distanceToSource - distanceToDestination) / 1000); 

            const totalScore = balanceImprovement + geographicBonus * 0.1; 

            if (totalScore > bestScore) {
                bestPlant = plant;
                bestScore = totalScore;
            }
        }
    });

    if (bestPlant && bestScore > 0.005) {
        const plantIndex = sourceCluster.findIndex((p) => p.id === bestPlant!.id);
        if (plantIndex !== -1) {
            sourceCluster.splice(plantIndex, 1);
            destCluster.push(bestPlant);
            return true;
        }
    }

    return false;
};

const tryAggressiveRebalancing = (
    clusters: PlantLocation[][],
    targetWater: number,
    _tolerance: number
): boolean => {
    const getClusterWaterNeed = (cluster: PlantLocation[]): number => {
        return cluster.reduce((sum, plant) => sum + plant.plantData.waterNeed, 0);
    };

    let bestImprovement = 0;
    let bestMove: { from: number; to: number; plantIndex: number } | null = null;

    for (let i = 0; i < clusters.length; i++) {
        for (let j = 0; j < clusters.length; j++) {
            if (i === j) continue;

            const waterI = getClusterWaterNeed(clusters[i]);
            const waterJ = getClusterWaterNeed(clusters[j]);

            clusters[i].forEach((plant, plantIndex) => {
                const newWaterI = waterI - plant.plantData.waterNeed;
                const newWaterJ = waterJ + plant.plantData.waterNeed;

                const currentDeviation =
                    Math.abs(waterI - targetWater) + Math.abs(waterJ - targetWater);
                const newDeviation =
                    Math.abs(newWaterI - targetWater) + Math.abs(newWaterJ - targetWater);
                const improvement = currentDeviation - newDeviation;

                if (improvement > bestImprovement) {
                    bestImprovement = improvement;
                    bestMove = { from: i, to: j, plantIndex };
                }
            });
        }
    }

    if (bestMove && bestImprovement > 0.001) {
        const moveData = bestMove as { from: number; to: number; plantIndex: number };
        const plant = clusters[moveData.from].splice(moveData.plantIndex, 1)[0];
        clusters[moveData.to].push(plant);
        return true;
    }

    return false;
};

export const findPlantsInPolygon = (
    plants: PlantLocation[],
    polygon: Coordinate[]
): PlantLocation[] => {
    if (polygon.length < 3) return [];

    return plants.filter((plant) => {
        return isPointInPolygon(plant.position, polygon);
    });
};

export const createVoronoiZones = (
    clusters: PlantLocation[][],
    mainArea: Coordinate[],
    colors: string[],
    preserveClusterPlants: boolean = false 
): IrrigationZone[] => {
    const zones: IrrigationZone[] = [];

    if (clusters.length === 0) return zones;

    if (preserveClusterPlants) {
        const centroids = clusters
            .map((cluster) => {
                if (cluster.length === 0) return null;

                const basicCentroid = {
                    lat:
                        cluster.reduce((sum, plant) => sum + plant.position.lat, 0) /
                        cluster.length,
                    lng:
                        cluster.reduce((sum, plant) => sum + plant.position.lng, 0) /
                        cluster.length,
                };

                const mainAreaCenter = {
                    lat: mainArea.reduce((sum, coord) => sum + coord.lat, 0) / mainArea.length,
                    lng: mainArea.reduce((sum, coord) => sum + coord.lng, 0) / mainArea.length,
                };

                const direction = {
                    lat: basicCentroid.lat - mainAreaCenter.lat,
                    lng: basicCentroid.lng - mainAreaCenter.lng,
                };

                const distanceFromCenter = Math.sqrt(
                    direction.lat * direction.lat + direction.lng * direction.lng
                );
                const minDistanceFromCenter = 0.0001; 

                if (distanceFromCenter < minDistanceFromCenter && distanceFromCenter > 0) {
                    const scale = minDistanceFromCenter / distanceFromCenter;
                    return {
                        lat: mainAreaCenter.lat + direction.lat * scale,
                        lng: mainAreaCenter.lng + direction.lng * scale,
                    };
                }

                return basicCentroid;
            })
            .filter((centroid) => centroid !== null) as Coordinate[];

        const voronoiZones = createTrueVoronoiZones(centroids, mainArea);

        clusters.forEach((cluster, index) => {
            if (cluster.length === 0 || index >= voronoiZones.length) return;

            const zoneCoordinates = voronoiZones[index];

            if (zoneCoordinates.length < 3) {
                const plantPositions = cluster.map((plant) => plant.position);
                const fallbackZone = convexHull(plantPositions);

                if (fallbackZone.length >= 3) {
                    const totalWaterNeed = cluster.reduce(
                        (sum, plant) => sum + plant.plantData.waterNeed,
                        0
                    );

                    const zone: IrrigationZone = {
                        id: `auto-zone-${index + 1}`,
                        name: `โซน ${index + 1}`,
                        coordinates: fallbackZone,
                        plants: cluster, 
                        totalWaterNeed,
                        color: colors[index] || '#888888',
                        layoutIndex: index,
                    };
                    zones.push(zone);
                }
                return;
            }

            const totalWaterNeed = cluster.reduce(
                (sum, plant) => sum + plant.plantData.waterNeed,
                0
            );

            const zone: IrrigationZone = {
                id: `auto-zone-${index + 1}`,
                name: `โซน ${index + 1}`,
                coordinates: zoneCoordinates,
                plants: cluster, 
                totalWaterNeed,
                color: colors[index] || '#888888',
                layoutIndex: index,
            };

            zones.push(zone);
        });

        return zones;
    }

    const centroids = clusters
        .map((cluster) => {
            if (cluster.length === 0) return null;

            const totalWater = cluster.reduce((sum, plant) => sum + plant.plantData.waterNeed, 0);
            if (totalWater === 0) {
                return {
                    lat:
                        cluster.reduce((sum, plant) => sum + plant.position.lat, 0) /
                        cluster.length,
                    lng:
                        cluster.reduce((sum, plant) => sum + plant.position.lng, 0) /
                        cluster.length,
                };
            }

            const weightedLat =
                cluster.reduce(
                    (sum, plant) => sum + plant.position.lat * plant.plantData.waterNeed,
                    0
                ) / totalWater;
            const weightedLng =
                cluster.reduce(
                    (sum, plant) => sum + plant.position.lng * plant.plantData.waterNeed,
                    0
                ) / totalWater;

            return { lat: weightedLat, lng: weightedLng };
        })
        .filter((centroid) => centroid !== null) as Coordinate[];

    const voronoiZones = createTrueVoronoiZones(centroids, mainArea);

    clusters.forEach((cluster, index) => {
        if (cluster.length === 0 || index >= voronoiZones.length) return;

        const zoneCoordinates = voronoiZones[index];

        if (zoneCoordinates.length < 3) {
           
            const plantPositions = cluster.map((plant) => plant.position);
            const fallbackZone = createFallbackZone(plantPositions, mainArea, 10); 

            if (fallbackZone.length >= 3) {
                let fallbackPlants: PlantLocation[];
                let fallbackWaterNeed: number;

                if (preserveClusterPlants) {
                   
                    fallbackPlants = cluster;
                    fallbackWaterNeed = cluster.reduce(
                        (sum, plant) => sum + plant.plantData.waterNeed,
                        0
                    );
                } else {
                    const allPlants = clusters.flat();
                    fallbackPlants = findPlantsInPolygon(allPlants, fallbackZone);
                    fallbackWaterNeed = fallbackPlants.reduce(
                        (sum, plant) => sum + plant.plantData.waterNeed,
                        0
                    );
                }

                const zone: IrrigationZone = {
                    id: `auto-zone-${index + 1}`,
                    name: `โซน ${index + 1}`,
                    coordinates: fallbackZone,
                    plants: fallbackPlants,
                    totalWaterNeed: fallbackWaterNeed,
                    color: colors[index] || '#888888',
                    layoutIndex: index,
                };
                zones.push(zone);
            }
            return;
        }

        let finalPlants: PlantLocation[];
        let totalWaterNeed: number;

        if (preserveClusterPlants) {
            finalPlants = cluster;
            totalWaterNeed = cluster.reduce((sum, plant) => sum + plant.plantData.waterNeed, 0);
        } else {
            const allPlants = clusters.flat();
            finalPlants = findPlantsInPolygon(allPlants, zoneCoordinates);
            totalWaterNeed = finalPlants.reduce((sum, plant) => sum + plant.plantData.waterNeed, 0);
        }

        const zone: IrrigationZone = {
            id: `auto-zone-${index + 1}`,
            name: `โซน ${index + 1}`,
            coordinates: zoneCoordinates,
            plants: finalPlants,
            totalWaterNeed,
            color: colors[index] || '#888888',
            layoutIndex: index,
        };

        zones.push(zone);
    });

    return zones;
};

const createTrueVoronoiZones = (
    centroids: Coordinate[],
    mainArea: Coordinate[]
): Coordinate[][] => {
    if (centroids.length === 0) return [];
    if (centroids.length === 1) return [mainArea];

    const zones: Coordinate[][] = [];

    centroids.forEach((centroid, index) => {
        let voronoiCell = [...mainArea]; 

        centroids.forEach((otherCentroid, otherIndex) => {
            if (index === otherIndex) return;

            const midpoint = {
                lat: (centroid.lat + otherCentroid.lat) / 2,
                lng: (centroid.lng + otherCentroid.lng) / 2,
            };

            const direction = {
                lat: otherCentroid.lat - centroid.lat,
                lng: otherCentroid.lng - centroid.lng,
            };

            const perpendicular = {
                lat: -direction.lng,
                lng: direction.lat,
            };

            const length = Math.sqrt(
                perpendicular.lat * perpendicular.lat + perpendicular.lng * perpendicular.lng
            );
            if (length > 0) {
                perpendicular.lat /= length;
                perpendicular.lng /= length;
            }

            const extent = 0.1; 
            const bisectorLine = [
                {
                    lat: midpoint.lat - perpendicular.lat * extent,
                    lng: midpoint.lng - perpendicular.lng * extent,
                },
                {
                    lat: midpoint.lat + perpendicular.lat * extent,
                    lng: midpoint.lng + perpendicular.lng * extent,
                },
            ];

            voronoiCell = clipPolygonAgainstLine(voronoiCell, bisectorLine, centroid);
        });

        zones.push(voronoiCell);
    });

    return zones;
};

const clipPolygonAgainstLine = (
    polygon: Coordinate[],
    line: Coordinate[],
    referencePoint: Coordinate
): Coordinate[] => {
    if (polygon.length < 3 || line.length < 2) return polygon;

    const clippedPolygon: Coordinate[] = [];

    if (polygon.length === 0) return clippedPolygon;

    let s = polygon[polygon.length - 1];

    for (const e of polygon) {
        const sOnCorrectSide = isPointOnCorrectSideOfLine(s, line, referencePoint);
        const eOnCorrectSide = isPointOnCorrectSideOfLine(e, line, referencePoint);

        if (eOnCorrectSide) {
            if (!sOnCorrectSide) {
                const intersection = findLineIntersection(s, e, line[0], line[1]);
                if (intersection) {
                    clippedPolygon.push(intersection);
                }
            }
            clippedPolygon.push(e);
        } else if (sOnCorrectSide) {
            const intersection = findLineIntersection(s, e, line[0], line[1]);
            if (intersection) {
                clippedPolygon.push(intersection);
            }
        }

        s = e;
    }

    return clippedPolygon;
};

const isPointOnCorrectSideOfLine = (
    point: Coordinate,
    line: Coordinate[],
    referencePoint: Coordinate
): boolean => {
    if (line.length < 2) return true;

    const lineVector = {
        lat: line[1].lat - line[0].lat,
        lng: line[1].lng - line[0].lng,
    };

    const pointVector = {
        lat: point.lat - line[0].lat,
        lng: point.lng - line[0].lng,
    };

    const referenceVector = {
        lat: referencePoint.lat - line[0].lat,
        lng: referencePoint.lng - line[0].lng,
    };

    const pointCross = lineVector.lat * pointVector.lng - lineVector.lng * pointVector.lat;
    const referenceCross =
        lineVector.lat * referenceVector.lng - lineVector.lng * referenceVector.lat;

    return pointCross * referenceCross >= 0;
};

const findLineIntersection = (
    p1: Coordinate,
    p2: Coordinate,
    p3: Coordinate,
    p4: Coordinate
): Coordinate | null => {
    const x1 = p1.lng,
        y1 = p1.lat;
    const x2 = p2.lng,
        y2 = p2.lat;
    const x3 = p3.lng,
        y3 = p3.lat;
    const x4 = p4.lng,
        y4 = p4.lat;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

    return {
        lng: x1 + t * (x2 - x1),
        lat: y1 + t * (y2 - y1),
    };
};

const createFallbackZone = (
    plantPositions: Coordinate[],
    mainArea: Coordinate[],
    bufferMeters: number
): Coordinate[] => {
    if (plantPositions.length === 0) return [];

    let hull = convexHull(plantPositions);

    if (bufferMeters > 0) {
        hull = addPolygonPadding(hull, bufferMeters);
    }

    hull = clipPolygonToMainArea(hull, mainArea);

    return hull;
};

export const createZonesFromClusters = (
    clusters: PlantLocation[][],
    mainArea: Coordinate[],
    colors: string[],
    paddingMeters: number = 2,
    useVoronoi: boolean = true,
    preserveClusterPlants: boolean = false 
): IrrigationZone[] => {
    if (useVoronoi) {
        return createVoronoiZones(clusters, mainArea, colors, preserveClusterPlants);
    }

    const zones: IrrigationZone[] = [];

    const allPlants = clusters.flat();

    clusters.forEach((cluster, index) => {
        if (cluster.length === 0) return;

        const plantPositions = cluster.map((plant) => plant.position);
        let zoneCoordinates = convexHull(plantPositions);

        zoneCoordinates = addPolygonPadding(zoneCoordinates, paddingMeters, mainArea);

        if (zoneCoordinates.length < 3) {
            console.warn(
                `⚠️ Zone ${index + 1} has insufficient points after clipping, skipping...`
            );
            return;
        }

        let finalPlants: PlantLocation[];
        let totalWaterNeed: number;

        if (preserveClusterPlants) {
            finalPlants = cluster;
            totalWaterNeed = cluster.reduce((sum, plant) => sum + plant.plantData.waterNeed, 0);
        } else {
            finalPlants = findPlantsInPolygon(allPlants, zoneCoordinates);
            totalWaterNeed = finalPlants.reduce((sum, plant) => sum + plant.plantData.waterNeed, 0);
        }

        const zone: IrrigationZone = {
            id: `auto-zone-${index + 1}`,
            name: `โซน ${index + 1}`,
            coordinates: zoneCoordinates,
            plants: finalPlants,
            totalWaterNeed,
            color: colors[index] || '#888888',
            layoutIndex: index,
        };

        zones.push(zone);
    });

    return zones;
};

export const addPolygonPadding = (
    polygon: Coordinate[],
    paddingMeters: number,
    mainArea?: Coordinate[]
): Coordinate[] => {
    if (polygon.length < 3 || paddingMeters <= 0) return polygon;

    const latMidpoint = polygon.reduce((sum, p) => sum + p.lat, 0) / polygon.length;
    const metersPerDegLat = 111320; 
    const metersPerDegLng = 111320 * Math.cos((latMidpoint * Math.PI) / 180); 

    const paddingDegreesLat = paddingMeters / metersPerDegLat;
    const paddingDegreesLng = paddingMeters / metersPerDegLng;

    const expandedPolygon = createOffsetPolygon(polygon, paddingDegreesLat, paddingDegreesLng);

    if (mainArea && mainArea.length >= 3) {
        const clippedPolygon = clipPolygonToMainArea(expandedPolygon, mainArea);

        if (
            clippedPolygon.length < 3 ||
            calculatePolygonArea(clippedPolygon) < calculatePolygonArea(polygon) * 0.5
        ) {
            console.warn(`⚠️ Padding would exceed main area bounds, using conservative approach`);
            return createConservativePadding(polygon, mainArea, paddingMeters);
        }

        return clippedPolygon;
    }

    return expandedPolygon;
};

const createOffsetPolygon = (
    polygon: Coordinate[],
    paddingLat: number,
    paddingLng: number
): Coordinate[] => {
    if (polygon.length < 3) return polygon;

    const offsetPoints: Coordinate[] = [];
    const n = polygon.length;

    for (let i = 0; i < n; i++) {
        const prev = polygon[(i - 1 + n) % n];
        const curr = polygon[i];
        const next = polygon[(i + 1) % n];

        const edge1 = { lat: curr.lat - prev.lat, lng: curr.lng - prev.lng };
        const edge2 = { lat: next.lat - curr.lat, lng: next.lng - curr.lng };

        const normal1 = { lat: -edge1.lng, lng: edge1.lat };
        const normal2 = { lat: -edge2.lng, lng: edge2.lat };

        const len1 = Math.sqrt(normal1.lat * normal1.lat + normal1.lng * normal1.lng);
        const len2 = Math.sqrt(normal2.lat * normal2.lat + normal2.lng * normal2.lng);

        if (len1 > 0) {
            normal1.lat /= len1;
            normal1.lng /= len1;
        }
        if (len2 > 0) {
            normal2.lat /= len2;
            normal2.lng /= len2;
        }

        const avgNormal = {
            lat: (normal1.lat + normal2.lat) / 2,
            lng: (normal1.lng + normal2.lng) / 2,
        };

        const avgLen = Math.sqrt(avgNormal.lat * avgNormal.lat + avgNormal.lng * avgNormal.lng);
        if (avgLen > 0) {
            avgNormal.lat /= avgLen;
            avgNormal.lng /= avgLen;
        }

        const offsetPoint = {
            lat: curr.lat + avgNormal.lat * paddingLat,
            lng: curr.lng + avgNormal.lng * paddingLng,
        };

        offsetPoints.push(offsetPoint);
    }

    return offsetPoints;
};

const createConservativePadding = (
    polygon: Coordinate[],
    mainArea: Coordinate[],
    paddingMeters: number
): Coordinate[] => {
    const maxIterations = 10;
    let currentPadding = paddingMeters;
    let result = polygon;

    for (let i = 0; i < maxIterations && currentPadding > 0.1; i++) {
        const testPadding = addPolygonPadding(polygon, currentPadding);
        const clipped = clipPolygonToMainArea(testPadding, mainArea);

        if (
            clipped.length >= 3 &&
            calculatePolygonArea(clipped) >= calculatePolygonArea(polygon) * 1.1
        ) {
            result = clipped;
            break;
        }

            currentPadding *= 0.5; 
    }

    return result;
};

const calculatePolygonArea = (polygon: Coordinate[]): number => {
    if (polygon.length < 3) return 0;

    let area = 0;
    const n = polygon.length;

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += polygon[i].lat * polygon[j].lng;
        area -= polygon[j].lat * polygon[i].lng;
    }

    return Math.abs(area) / 2;
};

export const clipPolygonToMainArea = (
    polygon: Coordinate[],
    mainArea: Coordinate[]
): Coordinate[] => {
    if (polygon.length === 0 || mainArea.length === 0) return [];
    if (mainArea.length < 3) return [];

    let clippedPolygon = [...polygon];

    for (let i = 0; i < mainArea.length; i++) {
        const clipVertex1 = mainArea[i];
        const clipVertex2 = mainArea[(i + 1) % mainArea.length];

        const inputList = clippedPolygon;
        clippedPolygon = [];

        if (inputList.length === 0) break;

        let s = inputList[inputList.length - 1];

        for (const e of inputList) {
            if (isInsideEdge(e, clipVertex1, clipVertex2)) {
                if (!isInsideEdge(s, clipVertex1, clipVertex2)) {
                    const intersection = getLineIntersection(s, e, clipVertex1, clipVertex2);
                    if (intersection) {
                        clippedPolygon.push(intersection);
                    }
                }
                clippedPolygon.push(e);
            } else if (isInsideEdge(s, clipVertex1, clipVertex2)) {
                const intersection = getLineIntersection(s, e, clipVertex1, clipVertex2);
                if (intersection) {
                    clippedPolygon.push(intersection);
                }
            }
            s = e;
        }
    }

    const validatedPolygon = clippedPolygon.filter((point) => isPointInPolygon(point, mainArea));

    if (validatedPolygon.length < 3) {
        console.warn(
            `⚠️ Clipping resulted in insufficient points (${validatedPolygon.length}), returning empty polygon`
        );

        const intersection = findPolygonIntersection(polygon, mainArea);
        if (intersection.length >= 3) {
            return intersection;
        }

        console.error(`❌ No valid intersection found between polygon and main area`);
        return [];
    }

    return validatedPolygon;
};

const findPolygonIntersection = (poly1: Coordinate[], poly2: Coordinate[]): Coordinate[] => {
    if (poly1.length < 3 || poly2.length < 3) return [];

    const intersectionPoints: Coordinate[] = [];

    poly1.forEach((vertex) => {
        if (isPointInPolygon(vertex, poly2)) {
            intersectionPoints.push(vertex);
        }
    });

    poly2.forEach((vertex) => {
        if (isPointInPolygon(vertex, poly1)) {
            intersectionPoints.push(vertex);
        }
    });

    for (let i = 0; i < poly1.length; i++) {
        const p1Start = poly1[i];
        const p1End = poly1[(i + 1) % poly1.length];

        for (let j = 0; j < poly2.length; j++) {
            const p2Start = poly2[j];
            const p2End = poly2[(j + 1) % poly2.length];

            const intersection = getLineIntersection(p1Start, p1End, p2Start, p2End);
            if (intersection) {
                if (
                    isPointOnLineSegment(intersection, p1Start, p1End) &&
                    isPointOnLineSegment(intersection, p2Start, p2End)
                ) {
                    intersectionPoints.push(intersection);
                }
            }
        }
    }

    const uniquePoints = removeDuplicatePoints(intersectionPoints);

    if (uniquePoints.length < 3) return [];

    return convexHull(uniquePoints);
};

const isPointOnLineSegment = (point: Coordinate, start: Coordinate, end: Coordinate): boolean => {
    const epsilon = 1e-10;

    const crossProduct =
        (point.lat - start.lat) * (end.lng - start.lng) -
        (point.lng - start.lng) * (end.lat - start.lat);

    if (Math.abs(crossProduct) > epsilon) return false;

    const dotProduct =
        (point.lat - start.lat) * (end.lat - start.lat) +
        (point.lng - start.lng) * (end.lng - start.lng);
    const squaredLength =
        (end.lat - start.lat) * (end.lat - start.lat) +
        (end.lng - start.lng) * (end.lng - start.lng);

    return dotProduct >= 0 && dotProduct <= squaredLength;
};

const removeDuplicatePoints = (points: Coordinate[]): Coordinate[] => {
    const epsilon = 1e-8; 
    const unique: Coordinate[] = [];

    points.forEach((point) => {
        const isDuplicate = unique.some(
            (existing) =>
                Math.abs(existing.lat - point.lat) < epsilon &&
                Math.abs(existing.lng - point.lng) < epsilon
        );

        if (!isDuplicate) {
            unique.push(point);
        }
    });

    return unique;
};

const isInsideEdge = (point: Coordinate, edgeStart: Coordinate, edgeEnd: Coordinate): boolean => {
    return (
        (edgeEnd.lng - edgeStart.lng) * (point.lat - edgeStart.lat) -
            (edgeEnd.lat - edgeStart.lat) * (point.lng - edgeStart.lng) >=
        0
    );
};

const getLineIntersection = (
    p1: Coordinate,
    p2: Coordinate,
    p3: Coordinate,
    p4: Coordinate
): Coordinate | null => {
    const x1 = p1.lng,
        y1 = p1.lat;
    const x2 = p2.lng,
        y2 = p2.lat;
    const x3 = p3.lng,
        y3 = p3.lat;
    const x4 = p4.lng,
        y4 = p4.lat;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null; 

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

    return {
        lng: x1 + t * (x2 - x1),
        lat: y1 + t * (y2 - y1),
    };
};

export const createAutomaticZones = (
    plants: PlantLocation[],
    mainArea: Coordinate[],
    config: AutoZoneConfig
): AutoZoneResult => {
    const startTime = Date.now();

    const debugInfo: AutoZoneDebugInfo = {
        totalPlants: plants.length,
        totalWaterNeed: 0,
        averageWaterNeedPerZone: 0,
        actualWaterNeedPerZone: [],
        waterNeedVariance: 0,
        waterNeedStandardDeviation: 0,
        waterBalanceEfficiency: 0,
        maxWaterNeedDeviation: 0,
        minWaterNeedDeviation: 0,
        waterNeedDeviationPercent: 0,
        convexHullPoints: [],
        plantAssignments: {},
        timeTaken: 0,
        waterBalanceDetails: [],
    };

    try {
        if (plants.length === 0) {
            throw new Error('ไม่มีต้นไม้ในพื้นที่');
        }

        if (config.numberOfZones <= 0 || config.numberOfZones > plants.length) {
            throw new Error('จำนวนโซนไม่ถูกต้อง');
        }

        debugInfo.totalWaterNeed = plants.reduce(
            (sum, plant) => sum + plant.plantData.waterNeed,
            0
        );
        debugInfo.averageWaterNeedPerZone = debugInfo.totalWaterNeed / config.numberOfZones;

        let clusters: PlantLocation[][];
        if (config.balancePlantCount) {
            clusters = plantCountBalancedCluster(
                plants,
                config.numberOfZones,
                100,
                config.randomSeed
            );
        } else if (config.balanceWaterNeed) {
            clusters = kMeansCluster(plants, config.numberOfZones, 100, true, config.randomSeed);

            clusters = enhancedBalanceWaterNeeds(clusters, debugInfo.averageWaterNeedPerZone);
        } else {
            clusters = kMeansCluster(plants, config.numberOfZones, 100, false, config.randomSeed);
        }

        const colors = generateZoneColors(config.numberOfZones);

        const preserveClusterPlants = config.balancePlantCount;
        let zones = createZonesFromClusters(
            clusters,
            mainArea,
            colors,
            config.paddingMeters,
            config.useVoronoi,
            preserveClusterPlants
        );

        if (config.balancePlantCount && config.debugMode) {
            clusters.forEach((cluster, index) => {
                const centroid =
                    cluster.length > 0
                        ? {
                              lat:
                                  cluster.reduce((sum, plant) => sum + plant.position.lat, 0) /
                                  cluster.length,
                              lng:
                                  cluster.reduce((sum, plant) => sum + plant.position.lng, 0) /
                                  cluster.length,
                          }
                        : null;
            });
            zones.forEach((zone, index) => {
            });

            const plantCounts = zones.map((zone) => zone.plants.length);
            const minCount = Math.min(...plantCounts);
            const maxCount = Math.max(...plantCounts);
        }

        const validZones = zones.filter((zone) => zone.coordinates && zone.coordinates.length >= 3);
        if (validZones.length < zones.length) {
            console.warn(`⚠️ Filtered out ${zones.length - validZones.length} invalid zones`);
            zones = validZones;
        }

        if (zones.length === 0) {
            throw new Error('ไม่สามารถสร้างโซนที่ถูกต้องได้ กรุณาตรวจสอบข้อมูลต้นไม้และพื้นที่');
        }

        const validation = validateZones(zones, mainArea);

        if (validation.errors.length > 0) {
            console.warn('⚠️ Zone validation warnings:', validation.errors);
        }
        if (validation.warnings.length > 0) {
            console.warn('⚠️ Zone validation warnings:', validation.warnings);
        }

        if (validation.errors.some((error) => error.includes('พื้นที่ทับซ้อนกัน'))) {
            zones = fixZoneOverlaps(zones, mainArea);

            const revalidation = validateZones(zones, mainArea);
            if (config.debugMode) {
                if (revalidation.errors.length > 0) {
                    console.warn('❌ Still has errors:', revalidation.errors);
                }
            }
        }

        debugInfo.actualWaterNeedPerZone = zones.map((zone) => zone.totalWaterNeed);
        debugInfo.convexHullPoints = zones.map((zone) => zone.coordinates);

        const mean = debugInfo.averageWaterNeedPerZone;
        debugInfo.waterNeedVariance =
            debugInfo.actualWaterNeedPerZone.reduce(
                (sum, waterNeed) => sum + Math.pow(waterNeed - mean, 2),
                0
            ) / zones.length;
        debugInfo.waterNeedStandardDeviation = Math.sqrt(debugInfo.waterNeedVariance);

        const deviations = debugInfo.actualWaterNeedPerZone.map((waterNeed) =>
            Math.abs(waterNeed - mean)
        );
        debugInfo.maxWaterNeedDeviation = Math.max(...deviations);
        debugInfo.minWaterNeedDeviation = Math.min(...deviations);
        debugInfo.waterNeedDeviationPercent = (debugInfo.maxWaterNeedDeviation / mean) * 100;

        const maxPossibleDeviation = mean; 
        debugInfo.waterBalanceEfficiency = Math.max(
            0,
            100 * (1 - debugInfo.maxWaterNeedDeviation / maxPossibleDeviation)
        );

        debugInfo.waterBalanceDetails = zones.map((zone, index) => ({
            zoneIndex: index + 1,
            waterNeed: zone.totalWaterNeed,
            deviation: Math.abs(zone.totalWaterNeed - mean),
            deviationPercent: (Math.abs(zone.totalWaterNeed - mean) / mean) * 100,
            plantCount: zone.plants.length,
        }));

        zones.forEach((zone) => {
            zone.plants.forEach((plant) => {
                debugInfo.plantAssignments[plant.id] = zone.id;
            });
        });

        debugInfo.timeTaken = Date.now() - startTime;

        return {
            zones,
            debugInfo,
            success: true,
            validation,
        };
    } catch (error) {
        debugInfo.timeTaken = Date.now() - startTime;

        return {
            zones: [],
            debugInfo,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};

export const validateZones = (
    zones: IrrigationZone[],
    mainArea: Coordinate[]
): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
} => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (zones.length === 0) {
        errors.push('ไม่มีโซนให้ตรวจสอบ');
        return { isValid: false, errors, warnings };
    }

    
    const waterBalanceValidation = validateWaterBalance(zones);
    errors.push(...waterBalanceValidation.errors);
    warnings.push(...waterBalanceValidation.warnings);

    
    const overlapValidation = validateZoneOverlaps(zones);
    errors.push(...overlapValidation.errors);
    warnings.push(...overlapValidation.warnings);

    
    const boundaryValidation = validateZoneBoundaries(zones, mainArea);
    errors.push(...boundaryValidation.errors);
    warnings.push(...boundaryValidation.warnings);

    
    const geometryValidation = validateZoneGeometry(zones);
    errors.push(...geometryValidation.errors);
    warnings.push(...geometryValidation.warnings);

    
    const plantValidation = validatePlantAssignment(zones);
    errors.push(...plantValidation.errors);
    warnings.push(...plantValidation.warnings);

    const isValid = errors.length === 0;

    return { isValid, errors, warnings };
};


const validateWaterBalance = (
    zones: IrrigationZone[]
): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (zones.length <= 1) return { errors, warnings };

    const waterNeeds = zones.map((zone) => zone.totalWaterNeed);
    const avgWaterNeed = waterNeeds.reduce((sum, need) => sum + need, 0) / zones.length;
    const tolerance = avgWaterNeed * 0.01; 

    zones.forEach((zone, index) => {
        const deviation = Math.abs(zone.totalWaterNeed - avgWaterNeed);
        const deviationPercent = (deviation / avgWaterNeed) * 100;

        if (deviation > tolerance) {
            errors.push(
                `โซน ${index + 1} มีความต้องการน้ำเบี่ยงเบนเกินกำหนด: ${zone.totalWaterNeed.toFixed(2)} ลิตร (เบี่ยงเบน ${deviationPercent.toFixed(2)}%)`
            );
        } else if (deviation > tolerance * 0.5) {
            warnings.push(
                `โซน ${index + 1} มีความต้องการน้ำเบี่ยงเบนเล็กน้อย: ${deviationPercent.toFixed(2)}%`
            );
        }
    });

    return { errors, warnings };
};


const validateZoneOverlaps = (
    zones: IrrigationZone[]
): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < zones.length; i++) {
        for (let j = i + 1; j < zones.length; j++) {
            const zone1 = zones[i];
            const zone2 = zones[j];

            
            const sharedPlants = zone1.plants.filter((plant1) =>
                zone2.plants.some((plant2) => plant1.id === plant2.id)
            );

            if (sharedPlants.length > 0) {
                errors.push(
                    `โซน ${i + 1} และโซน ${j + 1} มีต้นไม้ร่วมกัน ${sharedPlants.length} ต้น - ต้องไม่มีการทับซ้อนเลย`
                );
            }

            
            const hasPolygonOverlap = checkPolygonIntersection(
                zone1.coordinates,
                zone2.coordinates
            );
            if (hasPolygonOverlap) {
                errors.push(
                    `โซน ${i + 1} และโซน ${j + 1} มีพื้นที่ทับซ้อนกัน - ต้องแยกจากกันอย่างสมบูรณ์`
                );
            }

            
            const zone1InZone2 = zone1.coordinates.some((coord) =>
                isPointInPolygon(coord, zone2.coordinates)
            );
            const zone2InZone1 = zone2.coordinates.some((coord) =>
                isPointInPolygon(coord, zone1.coordinates)
            );

            if (zone1InZone2 || zone2InZone1) {
                warnings.push(`โซน ${i + 1} และโซน ${j + 1} มีจุดบางจุดอยู่ในพื้นที่ของกันและกัน`);
            }
        }
    }

    return { errors, warnings };
};


const validateZoneBoundaries = (
    zones: IrrigationZone[],
    mainArea: Coordinate[]
): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (mainArea.length < 3) {
        errors.push('พื้นที่หลักไม่ถูกต้อง');
        return { errors, warnings };
    }

    zones.forEach((zone, index) => {
        
        if (!zone.coordinates || zone.coordinates.length < 3) {
            errors.push(`โซน ${index + 1} ไม่มีพิกัดที่ถูกต้อง`);
            return;
        }


        const outsidePoints = zone.coordinates.filter(
            (coord) => !isPointInPolygon(coord, mainArea)
        );

            
        if (outsidePoints.length > 0) {
            const outsidePercentage = (outsidePoints.length / zone.coordinates.length) * 100;

            if (outsidePercentage > 50) {
                    
                errors.push(
                    `โซน ${index + 1} มี ${outsidePoints.length} จุด (${outsidePercentage.toFixed(1)}%) อยู่นอกพื้นที่หลัก`
                );
            } else if (outsidePercentage > 10) {
                    
                warnings.push(
                    `โซน ${index + 1} มี ${outsidePoints.length} จุด (${outsidePercentage.toFixed(1)}%) อยู่นอกพื้นที่หลัก`
                );
            }
        }

            
        const zoneArea = calculatePolygonArea(zone.coordinates);
        const mainAreaSize = calculatePolygonArea(mainArea);

        if (zoneArea > mainAreaSize * 1.1) {
                
            errors.push(`โซน ${index + 1} มีพื้นที่เกินขนาดพื้นที่หลักมากเกินไป`);
        } else if (zoneArea > mainAreaSize) {
                
            warnings.push(`โซน ${index + 1} มีพื้นที่เกินขนาดพื้นที่หลักเล็กน้อย`);
        }
    });

    return { errors, warnings };
};

    
const validateZoneGeometry = (
    zones: IrrigationZone[]
): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    zones.forEach((zone, index) => {
            
        if (zone.coordinates.length < 3) {
            errors.push(
                `โซน ${index + 1} มีจุดไม่เพียงพอสำหรับสร้างรูปหลายเหลี่ยม (${zone.coordinates.length} จุด)`
            );
        }

            
        const uniquePoints = removeDuplicatePoints(zone.coordinates);
        if (uniquePoints.length !== zone.coordinates.length) {
            warnings.push(`โซน ${index + 1} มีจุดซ้ำกัน`);
        }

            
        const area = calculatePolygonArea(zone.coordinates);
        if (area < 1e-10) {
            errors.push(`โซน ${index + 1} มีพื้นที่เกือบเป็นศูนย์`);
        }

            
        if (hasPolygonSelfIntersection(zone.coordinates)) {
            errors.push(`โซน ${index + 1} มีเส้นขอบตัดกันเอง`);
        }
    });

    return { errors, warnings };
};

    
const validatePlantAssignment = (
    zones: IrrigationZone[]
): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const allPlantIds = new Set<string>();

    zones.forEach((zone, index) => {
        if (zone.plants.length === 0) {
            warnings.push(`โซน ${index + 1} ไม่มีต้นไม้`);
        }

        zone.plants.forEach((plant) => {
            if (allPlantIds.has(plant.id)) {
                errors.push(`ต้นไม้ ID ${plant.id} ถูกกำหนดให้มากกว่า 1 โซน`);
            } else {
                allPlantIds.add(plant.id);
            }
        });

        zone.plants.forEach((plant) => {
            if (!isPointInPolygon(plant.position, zone.coordinates)) {
                warnings.push(`ต้นไม้ ${plant.id} ในโซน ${index + 1} อยู่นอกขอบเขตโซน`);
            }
        });
    });

    return { errors, warnings };
};

export const checkPolygonIntersection = (poly1: Coordinate[], poly2: Coordinate[]): boolean => {
   
    for (let i = 0; i < poly1.length; i++) {
        const p1Start = poly1[i];
        const p1End = poly1[(i + 1) % poly1.length];

        for (let j = 0; j < poly2.length; j++) {
            const p2Start = poly2[j];
            const p2End = poly2[(j + 1) % poly2.length];

            if (doLineSegmentsIntersect(p1Start, p1End, p2Start, p2End)) {
                return true;
            }
        }
    }

    return false;
};


const doLineSegmentsIntersect = (
    p1: Coordinate,
    q1: Coordinate,
    p2: Coordinate,
    q2: Coordinate
): boolean => {
    const orientation = (p: Coordinate, q: Coordinate, r: Coordinate): number => {
        const val = (q.lng - p.lng) * (r.lat - q.lat) - (q.lat - p.lat) * (r.lng - q.lng);
        if (Math.abs(val) < 1e-10) return 0; 
        return val > 0 ? 1 : 2; 
    };

    const onSegment = (p: Coordinate, q: Coordinate, r: Coordinate): boolean => {
        return (
            q.lng <= Math.max(p.lng, r.lng) &&
            q.lng >= Math.min(p.lng, r.lng) &&
            q.lat <= Math.max(p.lat, r.lat) &&
            q.lat >= Math.min(p.lat, r.lat)
        );
    };

    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);

    
    if (o1 !== o2 && o3 !== o4) return true;

    
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;

    return false;
};


const hasPolygonSelfIntersection = (polygon: Coordinate[]): boolean => {
    const n = polygon.length;
    if (n < 4) return false;

    for (let i = 0; i < n; i++) {
        const line1Start = polygon[i];
        const line1End = polygon[(i + 1) % n];

        for (let j = i + 2; j < n; j++) {
            
            if (j === (i - 1 + n) % n || j === (i + 1) % n) continue;

            const line2Start = polygon[j];
            const line2End = polygon[(j + 1) % n];

            if (doLineSegmentsIntersect(line1Start, line1End, line2Start, line2End)) {
                return true;
            }
        }
    }

    return false;
};


const fixZoneOverlaps = (zones: IrrigationZone[], mainArea: Coordinate[]): IrrigationZone[] => {
    const fixedZones = zones.map((zone) => ({ ...zone }));

    
    for (let i = 0; i < fixedZones.length; i++) {
        for (let j = i + 1; j < fixedZones.length; j++) {
            const zone1 = fixedZones[i];
            const zone2 = fixedZones[j];

            
            if (checkPolygonIntersection(zone1.coordinates, zone2.coordinates)) {
                
                const bufferDistance = 0.00001; 
                
                fixedZones[i].coordinates = shrinkPolygon(zone1.coordinates, bufferDistance);
                
                fixedZones[j].coordinates = shrinkPolygon(zone2.coordinates, bufferDistance);

                fixedZones[i].coordinates = clipPolygonToMainArea(
                    fixedZones[i].coordinates,
                    mainArea
                );
                fixedZones[j].coordinates = clipPolygonToMainArea(
                    fixedZones[j].coordinates,
                    mainArea
                );

                
                const allPlants = [...zone1.plants, ...zone2.plants];
                const zone1Center = getPolygonCenter(fixedZones[i].coordinates);
                const zone2Center = getPolygonCenter(fixedZones[j].coordinates);

                fixedZones[i].plants = [];
                fixedZones[j].plants = [];

                allPlants.forEach((plant) => {
                    const distToZone1 = calculateDistance(plant.position, zone1Center);
                    const distToZone2 = calculateDistance(plant.position, zone2Center);

                    if (distToZone1 < distToZone2) {
                        fixedZones[i].plants.push(plant);
                    } else {
                        fixedZones[j].plants.push(plant);
                    }
                });

                
                fixedZones[i].totalWaterNeed = fixedZones[i].plants.reduce(
                    (sum, plant) => sum + plant.plantData.waterNeed,
                    0
                );
                fixedZones[j].totalWaterNeed = fixedZones[j].plants.reduce(
                    (sum, plant) => sum + plant.plantData.waterNeed,
                    0
                );
            }
        }
    }

    return fixedZones;
};


const shrinkPolygon = (polygon: Coordinate[], distance: number): Coordinate[] => {
    if (polygon.length < 3) return polygon;

    const centroid = getPolygonCenter(polygon);

    return polygon.map((vertex) => {
        const direction = {
            lat: vertex.lat - centroid.lat,
            lng: vertex.lng - centroid.lng,
        };

        const length = Math.sqrt(direction.lat * direction.lat + direction.lng * direction.lng);
        if (length === 0) return vertex;

        const normalized = {
            lat: direction.lat / length,
            lng: direction.lng / length,
        };

        return {
            lat: vertex.lat - normalized.lat * distance,
            lng: vertex.lng - normalized.lng * distance,
        };
    });
};
