/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Coordinate {
    lat: number;
    lng: number;
}

interface PlantGroupCache {
    plantsHash: string;
    rowGroups: PlantLocation[][];
    columnGroups: PlantLocation[][];
}

let plantGroupCache: PlantGroupCache | null = null;

const createPlantsHash = (plants: PlantLocation[]): string => {
    return plants
        .map(
            (plant) =>
                `${plant.id}:${plant.position.lat.toFixed(8)}:${plant.position.lng.toFixed(8)}:${plant.rotationAngle || 0}`
        )
        .join('|');
};

export const clearPlantGroupingCache = (): void => {
    plantGroupCache = null;
};

export const findLineIntersection = (
    line1Start: Coordinate,
    line1End: Coordinate,
    line2Start: Coordinate,
    line2End: Coordinate
): Coordinate | null => {
    if (!line1Start || !line1End || !line2Start || !line2End) {
        return null;
    }

    const x1 = line1Start.lng,
        y1 = line1Start.lat;
    const x2 = line1End.lng,
        y2 = line1End.lat;
    const x3 = line2Start.lng,
        y3 = line2Start.lat;
    const x4 = line2End.lng,
        y4 = line2End.lat;

    if (
        !isFinite(x1) ||
        !isFinite(y1) ||
        !isFinite(x2) ||
        !isFinite(y2) ||
        !isFinite(x3) ||
        !isFinite(y3) ||
        !isFinite(x4) ||
        !isFinite(y4)
    ) {
        return null;
    }

    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

    if (Math.abs(denominator) < 1e-10) {
        return null; 
    }

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        const intersectionLat = y1 + t * (y2 - y1);
        const intersectionLng = x1 + t * (x2 - x1);

        if (isFinite(intersectionLat) && isFinite(intersectionLng)) {
            return {
                lat: intersectionLat,
                lng: intersectionLng,
            };
        }
    }

    return null; 
};

export const findLateralSubMainIntersection = (
    lateralStart: Coordinate,
    lateralEnd: Coordinate,
    subMainPipes: SubMainPipe[]
): {
    intersectionPoint: Coordinate;
    subMainPipeId: string;
    segmentIndex: number;
} | null => {
    for (const subMainPipe of subMainPipes) {
        if (!subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
            continue;
        }

        for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
            const segmentStart = subMainPipe.coordinates[i];
            const segmentEnd = subMainPipe.coordinates[i + 1];

            const intersection = findLineIntersection(
                lateralStart,
                lateralEnd,
                segmentStart,
                segmentEnd
            );

            if (intersection) {
                return {
                    intersectionPoint: intersection,
                    subMainPipeId: subMainPipe.id,
                    segmentIndex: i,
                };
            }
        }
    }

    return null;
};

export const findLateralToSubMainIntersections = (
    lateralPipes: any[],
    subMainPipes: any[],
    zones?: any[],
    irrigationZones?: any[]
): {
    lateralPipeId: string;
    subMainPipeId: string;
    intersectionPoint: Coordinate;
    segmentIndex: number;
}[] => {
    const intersections: {
        lateralPipeId: string;
        subMainPipeId: string;
        intersectionPoint: Coordinate;
        segmentIndex: number;
    }[] = [];

    const findPipeZone = (pipe: any): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        const pointsToCheck: Coordinate[] = [];
        const coords = pipe.coordinates;

        pointsToCheck.push(coords[0]);

        if (coords.length > 2) {
            const midIndex = Math.floor(coords.length / 2);
            pointsToCheck.push(coords[midIndex]);
        }

        if (coords.length > 1) {
            pointsToCheck.push(coords[coords.length - 1]);
        }

        if (irrigationZones) {
            for (const zone of irrigationZones) {
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        return zone.id;
                    }
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        return zone.id;
                    }
                }
            }
        }

        return null;
    };

    for (const lateralPipe of lateralPipes) {
        if (!lateralPipe.coordinates || lateralPipe.coordinates.length < 2) {
            continue;
        }

        const lateralZone = findPipeZone(lateralPipe);

        for (const subMainPipe of subMainPipes) {
            if (!subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
                continue;
            }

            const subMainZone = findPipeZone(subMainPipe);

            if (lateralZone && subMainZone && lateralZone !== subMainZone) {
                continue;
            }

            const lateralGroupId = (lateralPipe as any).groupId;
            const subMainGroupId = (subMainPipe as any).groupId;

            if (lateralGroupId && subMainGroupId && lateralGroupId === subMainGroupId) {
                continue; 
            }

            for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                const segmentStart = subMainPipe.coordinates[i];
                const segmentEnd = subMainPipe.coordinates[i + 1];

                const intersection = findLineIntersection(
                    lateralPipe.coordinates[0],
                    lateralPipe.coordinates[lateralPipe.coordinates.length - 1],
                    segmentStart,
                    segmentEnd
                );

                if (intersection) {
                    const distanceToStart = calculateDistanceBetweenPoints(
                        intersection,
                        lateralPipe.coordinates[0]
                    );
                    const distanceToEnd = calculateDistanceBetweenPoints(
                        intersection,
                        lateralPipe.coordinates[lateralPipe.coordinates.length - 1]
                    );
                    const lateralLength = calculateDistanceBetweenPoints(
                        lateralPipe.coordinates[0],
                        lateralPipe.coordinates[lateralPipe.coordinates.length - 1]
                    );

                    const isInMiddle =
                        distanceToStart > 5 &&
                        distanceToEnd > 5 &&
                        distanceToStart < lateralLength - 5 &&
                        distanceToEnd < lateralLength - 5;

                    if (isInMiddle) {
                        intersections.push({
                            lateralPipeId: lateralPipe.id,
                            subMainPipeId: subMainPipe.id,
                            intersectionPoint: {
                                lat: parseFloat(intersection.lat.toFixed(8)),
                                lng: parseFloat(intersection.lng.toFixed(8)),
                            },
                            segmentIndex: i,
                        });
                    }
                }
            }
        }
    }

    return intersections;
};

export const calculateLateralPipeSegmentStats = (
    lateralStart: Coordinate,
    lateralEnd: Coordinate,
    intersectionPoint: Coordinate,
    plants: PlantLocation[]
): {
    segment1: {
        length: number;
        plants: PlantLocation[];
        waterNeed: number;
    };
    segment2: {
        length: number;
        plants: PlantLocation[];
        waterNeed: number;
    };
    total: {
        length: number;
        plants: PlantLocation[];
        waterNeed: number;
    };
} => {
    const segment1Length = calculateDistanceBetweenPoints(lateralStart, intersectionPoint);
    const segment2Length = calculateDistanceBetweenPoints(intersectionPoint, lateralEnd);
    const totalLength = calculateDistanceBetweenPoints(lateralStart, lateralEnd);

    const segment1Plants: PlantLocation[] = [];
    const segment2Plants: PlantLocation[] = [];

    const distanceFromStartToIntersection = segment1Length;

    plants.forEach((plant) => {
        const closestPoint = findClosestPointOnLineSegment(
            plant.position,
            lateralStart,
            lateralEnd
        );
        const distanceFromStart = calculateDistanceBetweenPoints(lateralStart, closestPoint);

        if (distanceFromStart <= distanceFromStartToIntersection + 1) {
           
            segment1Plants.push(plant);
        } else {
            segment2Plants.push(plant);
        }
    });

    const segment1WaterNeed = segment1Plants.reduce(
        (sum, plant) => sum + plant.plantData.waterNeed,
        0
    );
    const segment2WaterNeed = segment2Plants.reduce(
        (sum, plant) => sum + plant.plantData.waterNeed,
        0
    );
    const totalWaterNeed = segment1WaterNeed + segment2WaterNeed;

    return {
        segment1: {
            length: segment1Length,
            plants: segment1Plants,
            waterNeed: segment1WaterNeed,
        },
        segment2: {
            length: segment2Length,
            plants: segment2Plants,
            waterNeed: segment2WaterNeed,
        },
        total: {
            length: totalLength,
            plants: plants,
            waterNeed: totalWaterNeed,
        },
    };
};

export const findMainToSubMainConnections = (
    mainPipes: any[],
    subMainPipes: any[],
    zones?: any[],
    irrigationZones?: any[]
): {
    mainPipeId: string;
    subMainPipeId: string;
    connectionPoint: Coordinate;
}[] => {
    const connections: {
        mainPipeId: string;
        subMainPipeId: string;
        connectionPoint: Coordinate;
    }[] = [];

    if (!mainPipes || !subMainPipes || mainPipes.length === 0 || subMainPipes.length === 0) {
        return connections;
    }

    const findPipeZone = (pipe: any): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        const endPoint = pipe.coordinates[pipe.coordinates.length - 1];

        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (isPointInPolygon(endPoint, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (isPointInPolygon(endPoint, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        return null;
    };

    for (const subMainPipe of subMainPipes) {
        if (!subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
            continue;
        }

        const subMainStart = subMainPipe.coordinates[0];
        const subMainZone = findPipeZone(subMainPipe);

        let closestMainPipe: any = null;
        let closestDistance = Infinity;
        let closestMainEnd: Coordinate | null = null;

        for (const mainPipe of mainPipes) {
            if (!mainPipe.coordinates || mainPipe.coordinates.length < 2) {
                continue;
            }

            const mainEnd = mainPipe.coordinates[mainPipe.coordinates.length - 1];
            const mainZone = findPipeZone(mainPipe);

            if (mainZone && subMainZone && mainZone !== subMainZone) {
                continue; 
            }

            const distanceToSubMainStart = calculateDistanceBetweenPoints(mainEnd, subMainStart);

            if (distanceToSubMainStart < closestDistance) {
                closestDistance = distanceToSubMainStart;
                closestMainPipe = mainPipe;
                closestMainEnd = mainEnd;
            }
        }

        if (closestMainPipe && closestMainEnd) {
           
            for (let i = 1; i < subMainPipe.coordinates.length; i++) {
                
                const subMainPoint = subMainPipe.coordinates[i];
                const distanceToSubMainPoint = calculateDistanceBetweenPoints(
                    closestMainEnd,
                    subMainPoint
                );

                const subMainStart = subMainPipe.coordinates[0];
                const subMainEnd = subMainPipe.coordinates[subMainPipe.coordinates.length - 1];
                const distanceToSubMainStart = calculateDistanceBetweenPoints(
                    closestMainEnd,
                    subMainStart
                );
                const distanceToSubMainEnd = calculateDistanceBetweenPoints(
                    closestMainEnd,
                    subMainEnd
                );
                const isEndToEndConnection =
                    distanceToSubMainStart <= 1.0 || distanceToSubMainEnd <= 1.0;

                if (distanceToSubMainPoint > 1.0 && !isEndToEndConnection) {
                    connections.push({
                        mainPipeId: closestMainPipe.id,
                        subMainPipeId: subMainPipe.id,
                        connectionPoint: {
                            lat: parseFloat(closestMainEnd.lat.toFixed(8)),
                            lng: parseFloat(closestMainEnd.lng.toFixed(8)),
                        },
                    });

                    break; 
                }
            }
        }
    }

    return connections;
};

export const findEndToEndConnections = (
    mainPipes: any[],
    subMainPipes: any[],
    zones?: any[],
    irrigationZones?: any[]
): {
    mainPipeId: string;
    subMainPipeId: string;
    connectionPoint: Coordinate;
}[] => {
    const connections: {
        mainPipeId: string;
        subMainPipeId: string;
        connectionPoint: Coordinate;
    }[] = [];

    if (!mainPipes || !subMainPipes || mainPipes.length === 0 || subMainPipes.length === 0) {
        return connections;
    }

    const findPipeZone = (pipe: any): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        const endPoint = pipe.coordinates[pipe.coordinates.length - 1];

        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (isPointInPolygon(endPoint, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (isPointInPolygon(endPoint, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        return null;
    };

    for (const mainPipe of mainPipes) {
        if (!mainPipe.coordinates || mainPipe.coordinates.length < 2) {
            continue;
        }

        const mainEnd = mainPipe.coordinates[mainPipe.coordinates.length - 1];
        const mainZone = findPipeZone(mainPipe);

        for (const subMainPipe of subMainPipes) {
            if (!subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
                continue;
            }

            const subMainStart = subMainPipe.coordinates[0];
            const subMainZone = findPipeZone(subMainPipe);

            if (mainZone && subMainZone && mainZone !== subMainZone) {
                continue;
            }

            const distance = calculateDistanceBetweenPoints(mainEnd, subMainStart);

            if (distance <= 1.0) {
                const connectionPoint = {
                    lat: mainEnd.lat,
                    lng: mainEnd.lng,
                };

                connections.push({
                    mainPipeId: mainPipe.id,
                    subMainPipeId: subMainPipe.id,
                    connectionPoint: connectionPoint,
                });
            }
        }
    }

    return connections;
};



const isPointInPolygon = (point: Coordinate, polygon: Coordinate[]): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (
            polygon[i].lat > point.lat !== polygon[j].lat > point.lat &&
            point.lng <
                ((polygon[j].lng - polygon[i].lng) * (point.lat - polygon[i].lat)) /
                    (polygon[j].lat - polygon[i].lat) +
                    polygon[i].lng
        ) {
            inside = !inside;
        }
    }
    return inside;
};

export const findSubMainToLateralStartConnections = (
    subMainPipes: any[],
    lateralPipes: any[],
    zones?: any[], 
    irrigationZones?: any[], 
    snapThreshold: number = 10
): {
    subMainPipeId: string;
    lateralPipeId: string;
    connectionPoint: Coordinate;
}[] => {
    const connections: {
        subMainPipeId: string;
        lateralPipeId: string;
        connectionPoint: Coordinate;
    }[] = [];

    const connectionKeys = new Set<string>();

    const findPipeZone = (pipe: any): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        const pointsToCheck: Coordinate[] = [];
        const coords = pipe.coordinates;

        pointsToCheck.push(coords[0]);

        if (coords.length > 2) {
            const midIndex = Math.floor(coords.length / 2);
            pointsToCheck.push(coords[midIndex]);
        }

        if (coords.length > 1) {
            pointsToCheck.push(coords[coords.length - 1]);
        }

        if (irrigationZones) {
            for (const zone of irrigationZones) {
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        return zone.id;
                    }
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        return zone.id;
                    }
                }
            }
        }

        return null;
    };

    for (const lateralPipe of lateralPipes) {
        if (!lateralPipe.coordinates || lateralPipe.coordinates.length < 2) {
            continue;
        }

        const lateralStart = lateralPipe.coordinates[0];
        const lateralZone = findPipeZone(lateralPipe);

        for (const subMainPipe of subMainPipes) {
            if (!subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
                continue;
            }

            const subMainZone = findPipeZone(subMainPipe);

            if (lateralZone && subMainZone && lateralZone !== subMainZone) {
                continue; 
            }

            const lateralGroupId = (lateralPipe as any).groupId;
            const subMainGroupId = (subMainPipe as any).groupId;

            if (lateralGroupId && subMainGroupId && lateralGroupId === subMainGroupId) {
                continue; 
            }

            const closestPoint = findClosestConnectionPoint(lateralStart, subMainPipe);

            if (closestPoint) {
                const distance = calculateDistanceBetweenPoints(lateralStart, closestPoint);

                const adjustedThreshold = Math.min(snapThreshold, 10);

                if (distance <= adjustedThreshold) {
                    const connectionKey = `${subMainPipe.id}-${lateralPipe.id}-${lateralGroupId || 'none'}-${subMainGroupId || 'none'}`;

                    if (!connectionKeys.has(connectionKey)) {
                        connectionKeys.add(connectionKey);
                        connections.push({
                            subMainPipeId: subMainPipe.id,
                            lateralPipeId: lateralPipe.id,
                            connectionPoint: {
                                lat: parseFloat(closestPoint.lat.toFixed(8)),
                                lng: parseFloat(closestPoint.lng.toFixed(8)),
                            },
                        });
                    }
                }
            }
        }
    }

    return connections;
};

export const findSubMainToMainIntersections = (
    subMainPipes: any[],
    mainPipes: any[],
    zones?: any[], 
    irrigationZones?: any[] 
): {
    subMainPipeId: string;
    mainPipeId: string;
    intersectionPoint: Coordinate;
    subMainSegmentIndex: number;
    mainSegmentIndex: number;
}[] => {
    const intersections: {
        subMainPipeId: string;
        mainPipeId: string;
        intersectionPoint: Coordinate;
        subMainSegmentIndex: number;
        mainSegmentIndex: number;
    }[] = [];

    const intersectionKeys = new Set<string>();

    const findPipeZone = (pipe: any): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        const endPoint = pipe.coordinates[pipe.coordinates.length - 1];

        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (isPointInPolygon(endPoint, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (isPointInPolygon(endPoint, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        return null;
    };

    for (const subMainPipe of subMainPipes) {
        if (!subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
            continue;
        }

        const subMainZone = findPipeZone(subMainPipe);

        for (const mainPipe of mainPipes) {
            if (!mainPipe.coordinates || mainPipe.coordinates.length < 2) {
                continue;
            }

            const mainZone = findPipeZone(mainPipe);

            if (subMainZone && mainZone && subMainZone !== mainZone) {
                continue; 
            }

            const subMainStart = subMainPipe.coordinates[0];
            const subMainEnd = subMainPipe.coordinates[subMainPipe.coordinates.length - 1];
            const mainStart = mainPipe.coordinates[0];
            const mainEnd = mainPipe.coordinates[mainPipe.coordinates.length - 1];

            const distanceToMainStart = calculateDistanceBetweenPoints(subMainStart, mainStart);
            const distanceToMainEnd = calculateDistanceBetweenPoints(subMainStart, mainEnd);
            const distanceToMainStartFromEnd = calculateDistanceBetweenPoints(
                subMainEnd,
                mainStart
            );
            const distanceToMainEndFromEnd = calculateDistanceBetweenPoints(subMainEnd, mainEnd);

            if (
                distanceToMainStart < 25 ||
                distanceToMainEnd < 25 ||
                distanceToMainStartFromEnd < 25 ||
                distanceToMainEndFromEnd < 25
            ) {
                continue; 
            }

            for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                const subMainStart = subMainPipe.coordinates[i];
                const subMainEnd = subMainPipe.coordinates[i + 1];

                for (let j = 0; j < mainPipe.coordinates.length - 1; j++) {
                    const mainStart = mainPipe.coordinates[j];
                    const mainEnd = mainPipe.coordinates[j + 1];

                    const intersection = findLineIntersection(
                        subMainStart,
                        subMainEnd,
                        mainStart,
                        mainEnd
                    );

                    if (intersection) {
                        const intersectionKey = `${subMainPipe.id}-${mainPipe.id}-${i}-${j}`;

                        if (!intersectionKeys.has(intersectionKey)) {
                            intersectionKeys.add(intersectionKey);
                            intersections.push({
                                subMainPipeId: subMainPipe.id,
                                mainPipeId: mainPipe.id,
                                intersectionPoint: intersection,
                                subMainSegmentIndex: i,
                                mainSegmentIndex: j,
                            });
                        }
                    }
                }
            }
        }
    }

    return intersections;
};

export const findMidConnections = (
    sourcePipes: any[],
    targetPipes: any[],
    snapThreshold: number = 15, 
    zones?: any[],
    irrigationZones?: any[]
): {
    sourcePipeId: string;
    targetPipeId: string;
    connectionPoint: Coordinate;
    sourceEndIndex: number; 
    targetSegmentIndex: number;
}[] => {
    const connections: {
        sourcePipeId: string;
        targetPipeId: string;
        connectionPoint: Coordinate;
        sourceEndIndex: number;
        targetSegmentIndex: number;
    }[] = [];

    const connectionKeys = new Set<string>();

    const findPipeZone = (pipe: any): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        const endPoint = pipe.coordinates[pipe.coordinates.length - 1];

        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (isPointInPolygon(endPoint, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (isPointInPolygon(endPoint, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        return null;
    };

    const endToEndConnections = findEndToEndConnections(
        targetPipes,
        sourcePipes,
        zones,
        irrigationZones
    );
    const mainToSubMainConnections = findMainToSubMainConnections(
        targetPipes,
        sourcePipes,
        zones,
        irrigationZones
    );

    const existingConnections = new Set<string>();
    endToEndConnections.forEach((conn) => {
        existingConnections.add(`${conn.mainPipeId}-${conn.subMainPipeId}`);
    });
    mainToSubMainConnections.forEach((conn) => {
        existingConnections.add(`${conn.mainPipeId}-${conn.subMainPipeId}`);
    });

    for (const sourcePipe of sourcePipes) {
        if (!sourcePipe.coordinates || sourcePipe.coordinates.length < 2) {
            continue;
        }

        const sourceZone = findPipeZone(sourcePipe);

        const endpoints = [
            { point: sourcePipe.coordinates[0], index: 0 },
            {
                point: sourcePipe.coordinates[sourcePipe.coordinates.length - 1],
                index: sourcePipe.coordinates.length - 1,
            },
        ];

        for (const endpoint of endpoints) {
            for (const targetPipe of targetPipes) {
                if (
                    !targetPipe.coordinates ||
                    targetPipe.coordinates.length < 2 ||
                    targetPipe.id === sourcePipe.id
                ) {
                    continue;
                }

                const targetZone = findPipeZone(targetPipe);

                if (sourceZone && targetZone && sourceZone !== targetZone) {
                    continue; 
                }

                const connectionKey = `${targetPipe.id}-${sourcePipe.id}`;
                if (existingConnections.has(connectionKey)) {
                    const isExistingEndToEnd = endToEndConnections.some(
                        (conn) =>
                            conn.mainPipeId === targetPipe.id &&
                            conn.subMainPipeId === sourcePipe.id
                    );
                    if (isExistingEndToEnd) {
                        continue; 
                    }
                }

                for (let i = 0; i < targetPipe.coordinates.length - 1; i++) {
                    const segmentStart = targetPipe.coordinates[i];
                    const segmentEnd = targetPipe.coordinates[i + 1];

                    const closestPoint = findClosestPointOnLineSegment(
                        endpoint.point,
                        segmentStart,
                        segmentEnd
                    );
                    const distance = calculateDistanceBetweenPoints(endpoint.point, closestPoint);

                    if (distance <= snapThreshold) {    
                        const isEndToEndConnection =
                            calculateDistanceBetweenPoints(endpoint.point, segmentStart) <= 1.0 ||
                            calculateDistanceBetweenPoints(endpoint.point, segmentEnd) <= 1.0;

                        const distanceFromStart = calculateDistanceBetweenPoints(
                            closestPoint,
                            segmentStart
                        );
                        const distanceFromEnd = calculateDistanceBetweenPoints(
                            closestPoint,
                            segmentEnd
                        );
                        const isWithinSegment =
                            distanceFromStart >
                                0.00000000000000000000000000000000000000000000000000000000000000000000000001 &&
                            distanceFromEnd >
                                0.00000000000000000000000000000000000000000000000000000000000000000000000001; 

                        const isActualMidConnection =
                            !isEndToEndConnection && isWithinSegment && distance > 1.0;

                        if (isActualMidConnection) {
                            const connectionKey = `${sourcePipe.id}-${targetPipe.id}-${endpoint.index}-${i}`;

                            if (!connectionKeys.has(connectionKey)) {
                                connectionKeys.add(connectionKey);
                                connections.push({
                                    sourcePipeId: sourcePipe.id,
                                    targetPipeId: targetPipe.id,
                                    connectionPoint: closestPoint,
                                    sourceEndIndex: endpoint.index,
                                    targetSegmentIndex: i,
                                });
                            }
                        } else {
                            continue;
                        }
                    }
                }
            }
        }
    }

    return connections;
};

export interface PlantLocation {
    id: string;
    position: Coordinate;
    plantData: {
        id: number;
        name: string;
        plantSpacing: number;
        rowSpacing: number;
        waterNeed: number;
    };
    rotationAngle?: number;
}

export interface SubMainPipe {
    id: string;
    coordinates: Coordinate[];
}

export const calculateDistanceBetweenPoints = (point1: Coordinate, point2: Coordinate): number => {
    const R = 6371000; 
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;

    const lat1Rad = (point1.lat * Math.PI) / 180;
    const lat2Rad = (point2.lat * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.max(0, R * c); 
};

export const findClosestPointOnLineSegment = (
    point: Coordinate,
    lineStart: Coordinate,
    lineEnd: Coordinate
): Coordinate => {
    if (!point || !lineStart || !lineEnd) {
        return lineStart || { lat: 0, lng: 0 };
    }

    if (
        !isFinite(point.lat) ||
        !isFinite(point.lng) ||
        !isFinite(lineStart.lat) ||
        !isFinite(lineStart.lng) ||
        !isFinite(lineEnd.lat) ||
        !isFinite(lineEnd.lng)
    ) {
        return lineStart;
    }

    const A = point.lat - lineStart.lat;
    const B = point.lng - lineStart.lng;
    const C = lineEnd.lat - lineStart.lat;
    const D = lineEnd.lng - lineStart.lng;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq < 1e-12) {
        return { lat: lineStart.lat, lng: lineStart.lng };
    }

    let param = dot / lenSq;
    param = Math.max(0, Math.min(1, param));

    const result = {
        lat: lineStart.lat + param * C,
        lng: lineStart.lng + param * D,
    };

    if (!isFinite(result.lat) || !isFinite(result.lng)) {
        return { lat: lineStart.lat, lng: lineStart.lng };
    }

    return result;
};

export const isPointOnSubMainPipe = (
    point: Coordinate,
    subMainPipe: SubMainPipe,
    threshold: number = 5
): boolean => {
    if (!subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
        return false;
    }

    const adjustedThreshold = threshold * 1.2; 
    const startPoint = subMainPipe.coordinates[0];
    const endPoint = subMainPipe.coordinates[subMainPipe.coordinates.length - 1];

    const distanceToStart = calculateDistanceBetweenPoints(point, startPoint);
    if (distanceToStart <= adjustedThreshold) {
        return true;
    }

    const distanceToEnd = calculateDistanceBetweenPoints(point, endPoint);
    if (distanceToEnd <= adjustedThreshold) {
        return true;
    }

    for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
        const start = subMainPipe.coordinates[i];
        const end = subMainPipe.coordinates[i + 1];

        const closestPoint = findClosestPointOnLineSegment(point, start, end);
        const distance = calculateDistanceBetweenPoints(point, closestPoint);

        if (distance <= adjustedThreshold) {
            return true;
        }
    }

    return false;
};

export const findClosestConnectionPoint = (
    point: Coordinate,
    subMainPipe: SubMainPipe
): Coordinate | null => {
    if (!subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
        return null;
    }

    let closestPoint: Coordinate | null = null;
    let minDistance = Infinity;

    for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
        const segmentStart = subMainPipe.coordinates[i];
        const segmentEnd = subMainPipe.coordinates[i + 1];

        const pointOnSegment = findClosestPointOnLineSegment(point, segmentStart, segmentEnd);
        const distance = calculateDistanceBetweenPoints(point, pointOnSegment);

        const segmentLength = calculateDistanceBetweenPoints(segmentStart, segmentEnd);
        const distanceFromStart = calculateDistanceBetweenPoints(segmentStart, pointOnSegment);
        const distanceFromEnd = calculateDistanceBetweenPoints(segmentEnd, pointOnSegment);

        const isWithinSegment =
            distanceFromStart < segmentLength - 0.001 && distanceFromEnd < segmentLength - 0.001;
        const adjustedDistance = isWithinSegment ? distance * 0.8 : distance; 

        if (adjustedDistance < minDistance) {
            minDistance = adjustedDistance;
            closestPoint = {
                lat: parseFloat(pointOnSegment.lat.toFixed(8)), 
                lng: parseFloat(pointOnSegment.lng.toFixed(8)),
            };
        }
    }

    const startPoint = subMainPipe.coordinates[0];
    const endPoint = subMainPipe.coordinates[subMainPipe.coordinates.length - 1];

    const distanceToStart = calculateDistanceBetweenPoints(point, startPoint);
    const distanceToEnd = calculateDistanceBetweenPoints(point, endPoint);

    if (distanceToStart <= 2.0 && distanceToStart < minDistance) {
        closestPoint = { lat: startPoint.lat, lng: startPoint.lng };
        minDistance = distanceToStart;
    }

    if (distanceToEnd <= 2.0 && distanceToEnd < minDistance) {
        closestPoint = { lat: endPoint.lat, lng: endPoint.lng };
        minDistance = distanceToEnd;
    }

    return closestPoint;
};

export const groupPlantsByRows = (plants: PlantLocation[]): PlantLocation[][] => {
    if (plants.length === 0) return [];

    const currentHash = createPlantsHash(plants);
    if (plantGroupCache && plantGroupCache.plantsHash === currentHash) {
        return plantGroupCache.rowGroups;
    }

    try {

    const groups: PlantLocation[][] = [];
    const tolerance = 0.000005; 

    const rotationInfo = hasRotation(plants);

    let plantsToGroup: { plant: PlantLocation; transformedPosition: Coordinate }[] = [];

    if (rotationInfo.hasRotation) {
        plantsToGroup = plants.map((plant) => ({
            plant,
            transformedPosition: transformToRotatedCoordinate(
                plant.position,
                rotationInfo.center,
                rotationInfo.rotationAngle
            ),
        }));
    } else {
        plantsToGroup = plants.map((plant) => ({
            plant,
            transformedPosition: plant.position,
        }));
    }

    const plantsByLat = [...plantsToGroup].sort(
        (a, b) => a.transformedPosition.lat - b.transformedPosition.lat
    );

    for (const plantData of plantsByLat) {
        let addedToGroup = false;

        for (const group of groups) {
            const avgLat =
                group.reduce((sum, p) => {
                    const transformedPos = rotationInfo.hasRotation
                        ? transformToRotatedCoordinate(
                              p.position,
                              rotationInfo.center,
                              rotationInfo.rotationAngle
                          )
                        : p.position;
                    return sum + transformedPos.lat;
                }, 0) / group.length;

            if (Math.abs(plantData.transformedPosition.lat - avgLat) <= tolerance) {
                group.push(plantData.plant);
                addedToGroup = true;
                break;
            }
        }

        if (!addedToGroup) {
            groups.push([plantData.plant]);
        }
    }

    const filteredGroups = groups
        .filter((group) => group.length >= 2)
        .map((group) =>
            group.sort((a, b) => {
                const aTransformed = rotationInfo.hasRotation
                    ? transformToRotatedCoordinate(
                          a.position,
                          rotationInfo.center,
                          rotationInfo.rotationAngle
                      )
                    : a.position;
                const bTransformed = rotationInfo.hasRotation
                    ? transformToRotatedCoordinate(
                          b.position,
                          rotationInfo.center,
                          rotationInfo.rotationAngle
                      )
                    : b.position;
                return aTransformed.lng - bTransformed.lng;
            })
        );

    if (!plantGroupCache || plantGroupCache.plantsHash !== currentHash) {
        plantGroupCache = {
            plantsHash: currentHash,
            rowGroups: filteredGroups,
            columnGroups:
                plantGroupCache?.plantsHash === currentHash ? plantGroupCache.columnGroups : [],
        };
    } else {
        plantGroupCache.rowGroups = filteredGroups;
    }

    return filteredGroups;
    } catch (error) {
        console.warn('Error in groupPlantsByRows:', error);
        return [];
    }
};

export const groupPlantsByColumns = (plants: PlantLocation[]): PlantLocation[][] => {
    if (plants.length === 0) return [];

    const currentHash = createPlantsHash(plants);
    if (
        plantGroupCache &&
        plantGroupCache.plantsHash === currentHash &&
        plantGroupCache.columnGroups.length > 0
    ) {
        return plantGroupCache.columnGroups;
    }

    const groups: PlantLocation[][] = [];
        const tolerance = 0.000005; 

    const rotationInfo = hasRotation(plants);

    let plantsToGroup: { plant: PlantLocation; transformedPosition: Coordinate }[] = [];

    if (rotationInfo.hasRotation) {
        plantsToGroup = plants.map((plant) => ({
            plant,
            transformedPosition: transformToRotatedCoordinate(
                plant.position,
                rotationInfo.center,
                rotationInfo.rotationAngle
            ),
        }));
    } else {
        plantsToGroup = plants.map((plant) => ({
            plant,
            transformedPosition: plant.position,
        }));
    }

    const plantsByLng = [...plantsToGroup].sort(
        (a, b) => a.transformedPosition.lng - b.transformedPosition.lng
    );

    for (const plantData of plantsByLng) {
        let addedToGroup = false;

        for (const group of groups) {
            const avgLng =
                group.reduce((sum, p) => {
                    const transformedPos = rotationInfo.hasRotation
                        ? transformToRotatedCoordinate(
                              p.position,
                              rotationInfo.center,
                              rotationInfo.rotationAngle
                          )
                        : p.position;
                    return sum + transformedPos.lng;
                }, 0) / group.length;

            if (Math.abs(plantData.transformedPosition.lng - avgLng) <= tolerance) {
                group.push(plantData.plant);
                addedToGroup = true;
                break;
            }
        }

        if (!addedToGroup) {
            groups.push([plantData.plant]);
        }
    }

    const filteredGroups = groups
        .filter((group) => group.length >= 2)
        .map((group) =>
            group.sort((a, b) => {
                const aTransformed = rotationInfo.hasRotation
                    ? transformToRotatedCoordinate(
                          a.position,
                          rotationInfo.center,
                          rotationInfo.rotationAngle
                      )
                    : a.position;
                const bTransformed = rotationInfo.hasRotation
                    ? transformToRotatedCoordinate(
                          b.position,
                          rotationInfo.center,
                          rotationInfo.rotationAngle
                      )
                    : b.position;
                return aTransformed.lat - bTransformed.lat;
            })
        );

    if (!plantGroupCache || plantGroupCache.plantsHash !== currentHash) {
        plantGroupCache = {
            plantsHash: currentHash,
            rowGroups: plantGroupCache?.plantsHash === currentHash ? plantGroupCache.rowGroups : [],
            columnGroups: filteredGroups,
        };
    } else {
        plantGroupCache.columnGroups = filteredGroups;
    }

    return filteredGroups;
};

export const findPlantsInLateralPath = (
    startPoint: Coordinate,
    endPoint: Coordinate,
    plants: PlantLocation[],
    placementMode: 'over_plants' | 'between_plants',
    snapThreshold: number = 5
): PlantLocation[] => {
    if (placementMode === 'over_plants') {
        return findPlantsInOverPlantsMode(startPoint, endPoint, plants, snapThreshold);
    } else {
        return findPlantsInBetweenPlantsMode(startPoint, endPoint, plants, snapThreshold);
    }
};

export const findPlantsInOverPlantsMode = (
    startPoint: Coordinate,
    endPoint: Coordinate,
    plants: PlantLocation[],
    snapThreshold: number = 5
): PlantLocation[] => {
    if (!startPoint || !endPoint || !plants || plants.length === 0) {
        return [];
    }

    const result = computeOverPlantsMode(startPoint, endPoint, plants, snapThreshold, 'rows');
    return result.selectedPlants;
};

export const findPlantsInBetweenPlantsMode = (
    startPoint: Coordinate,
    endPoint: Coordinate,
    plants: PlantLocation[],
    snapThreshold: number = 5
): PlantLocation[] => {
    if (!startPoint || !endPoint || !plants || plants.length === 0) {
        return [];
    }

    const result = computeBetweenPlantsMode(startPoint, endPoint, plants, snapThreshold, 'rows');
    return result.selectedPlants;
};

const normalizeVector = (v: { lat: number; lng: number }): { lat: number; lng: number } => {
    const len = Math.sqrt(v.lat * v.lat + v.lng * v.lng) || 1;
    return { lat: v.lat / len, lng: v.lng / len };
};




export const transformToRotatedCoordinate = (
    point: Coordinate,
    center: Coordinate,
    rotationAngle: number
): Coordinate => {
    const angleRadians = (rotationAngle * Math.PI) / 180;
    const cos = Math.cos(-angleRadians); 
    const sin = Math.sin(-angleRadians);

    const dx = point.lat - center.lat;
    const dy = point.lng - center.lng;

    const rotatedLat = center.lat + dx * cos - dy * sin;
    const rotatedLng = center.lng + dx * sin + dy * cos;

    return { lat: rotatedLat, lng: rotatedLng };
};

const getPlantGroupCenter = (plants: PlantLocation[]): Coordinate => {
    if (plants.length === 0) return { lat: 0, lng: 0 };

    const totalLat = plants.reduce((sum, plant) => sum + plant.position.lat, 0);
    const totalLng = plants.reduce((sum, plant) => sum + plant.position.lng, 0);

    return {
        lat: totalLat / plants.length,
        lng: totalLng / plants.length,
    };
};

export const hasRotation = (
    plants: PlantLocation[]
): { hasRotation: boolean; rotationAngle: number; center: Coordinate } => {
    if (plants.length === 0) {
        return { hasRotation: false, rotationAngle: 0, center: { lat: 0, lng: 0 } };
    }

    const plantWithRotation = plants.find((plant) => plant.rotationAngle !== undefined);
    const rotationAngle = plantWithRotation ? plantWithRotation.rotationAngle || 0 : 0;
    const center = getPlantGroupCenter(plants);

    return {
        hasRotation: Math.abs(rotationAngle) > 0.01, 
        rotationAngle,
        center,
    };
};

const getDragOrientation = (
    start: Coordinate,
    end: Coordinate,
    plants?: PlantLocation[]
): 'rows' | 'columns' => {
    let dLat = Math.abs(end.lat - start.lat);
    let dLng = Math.abs(end.lng - start.lng);

    if (plants && plants.length > 0) {
        const rotationInfo = hasRotation(plants);

        if (rotationInfo.hasRotation) {
            const transformedStart = transformToRotatedCoordinate(
                start,
                rotationInfo.center,
                rotationInfo.rotationAngle
            );
            const transformedEnd = transformToRotatedCoordinate(
                end,
                rotationInfo.center,
                rotationInfo.rotationAngle
            );

            dLat = Math.abs(transformedEnd.lat - transformedStart.lat);
            dLng = Math.abs(transformedEnd.lng - transformedStart.lng);
        }

        if (plants.length > 10 && plants.length <= 1000) {
            try {
                const rows = groupPlantsByRows(plants);
                const cols = groupPlantsByColumns(plants);

                if (Array.isArray(rows) && Array.isArray(cols)) {
                    const avgRowSize =
                        rows.length > 0
                            ? rows
                                  .filter((row) => Array.isArray(row))
                                  .reduce((sum, row) => sum + row.length, 0) / rows.length
                            : 0;
                    const avgColSize =
                        cols.length > 0
                            ? cols
                                  .filter((col) => Array.isArray(col))
                                  .reduce((sum, col) => sum + col.length, 0) / cols.length
                            : 0;

                    const rowClearness = avgRowSize * rows.length;
                    const colClearness = avgColSize * cols.length;

                    const maxClearness = Math.max(rowClearness, colClearness);
                    if (maxClearness > 0.1) {
                        const layoutDifference =
                            Math.abs(rowClearness - colClearness) / maxClearness;
                        if (isFinite(layoutDifference) && layoutDifference > 0.3) {
                            // 30% difference threshold
                            return rowClearness > colClearness ? 'rows' : 'columns';
                        }
                    }
                }
            } catch (error) {
                console.error(error);
            }
        }
    }

    const totalDistance = dLat + dLng;
    const adaptiveThreshold = totalDistance > 0.0001 ? 0.15 : 0.08; 

    if (dLat > dLng * (1 + adaptiveThreshold)) {
        return 'columns'; 
    } else if (dLng > dLat * (1 + adaptiveThreshold)) {
        return 'rows'; 
    } else {
        const ratio = dLat / dLng;

        if (Math.abs(ratio - 1) < 0.03) {
            return dLat > dLng ? 'columns' : 'rows';
        }

        return ratio > 1 ? 'columns' : 'rows';
    }
};


const directionFromPlantsLine = (plants: PlantLocation[]): { lat: number; lng: number } => {
    if (!plants || plants.length < 2) return { lat: 0, lng: 1 };

    const rotationInfo = hasRotation(plants);

    let sortedPlants: PlantLocation[];

    if (rotationInfo.hasRotation) {
        const plantsWithTransformed = plants.map((plant) => ({
            plant,
            transformedPosition: transformToRotatedCoordinate(
                plant.position,
                rotationInfo.center,
                rotationInfo.rotationAngle
            ),
        }));

        sortedPlants = plantsWithTransformed
            .sort((a, b) => a.transformedPosition.lng - b.transformedPosition.lng)
            .map((item) => item.plant);
    } else {
        sortedPlants = [...plants].sort((a, b) => a.position.lng - b.position.lng);
    }

    const first = sortedPlants[0].position;
    const last = sortedPlants[sortedPlants.length - 1].position;
    return normalizeVector({ lat: last.lat - first.lat, lng: last.lng - first.lng });
};

const directionFromPlantsColumn = (plants: PlantLocation[]): { lat: number; lng: number } => {
    if (!plants || plants.length < 2) return { lat: 1, lng: 0 };

    const rotationInfo = hasRotation(plants);

    let sortedPlants: PlantLocation[];

    if (rotationInfo.hasRotation) {
        const plantsWithTransformed = plants.map((plant) => ({
            plant,
            transformedPosition: transformToRotatedCoordinate(
                plant.position,
                rotationInfo.center,
                rotationInfo.rotationAngle
            ),
        }));

        sortedPlants = plantsWithTransformed
            .sort((a, b) => a.transformedPosition.lat - b.transformedPosition.lat)
            .map((item) => item.plant);
    } else {
        sortedPlants = [...plants].sort((a, b) => a.position.lat - b.position.lat);
    }

    const first = sortedPlants[0].position;
    const last = sortedPlants[sortedPlants.length - 1].position;
    return normalizeVector({ lat: last.lat - first.lat, lng: last.lng - first.lng });
};

const calculateAdaptiveSnapThreshold = (
    baseThreshold: number,
    plants: PlantLocation[],
    pipeDistance: number
): number => {
    if (!plants || plants.length === 0 || !isFinite(baseThreshold) || !isFinite(pipeDistance)) {
        return Math.max(3, baseThreshold * 0.8); 
    }

    let totalSpacing = 0;
    let spacingCount = 0;
    const maxSampleSize = Math.min(plants.length, 15); 
    const stride = Math.max(1, Math.floor(plants.length / maxSampleSize));

    for (let i = 0; i < plants.length - stride; i += stride) {
        if (!plants[i]?.position || !plants[i + stride]?.position) continue;

        const pos1 = plants[i].position;
        const pos2 = plants[i + stride].position;

        if (
            !isFinite(pos1.lat) ||
            !isFinite(pos1.lng) ||
            !isFinite(pos2.lat) ||
            !isFinite(pos2.lng)
        ) {
            continue;
        }

        const distance = calculateDistanceBetweenPoints(pos1, pos2);
        if (distance > 0 && distance < 50 && isFinite(distance)) {
            totalSpacing += distance;
            spacingCount++;
        }
    }

    let avgSpacing = baseThreshold;
    if (spacingCount > 0 && totalSpacing > 0) {
        avgSpacing = totalSpacing / spacingCount;
    }

    let adaptiveThreshold = baseThreshold;

    if (avgSpacing < 5.0) {
        adaptiveThreshold = Math.min(avgSpacing * 0.4, baseThreshold * 0.6); 
    }
    else if (avgSpacing <= 15.0) {
        adaptiveThreshold = Math.min(avgSpacing * 0.5, baseThreshold * 0.8);
    }
    else {
        adaptiveThreshold = Math.min(avgSpacing * 0.6, baseThreshold * 1.0);
    }

    if (isFinite(pipeDistance)) {
        if (pipeDistance < 10) {
            adaptiveThreshold = adaptiveThreshold * 0.8;
        } else if (pipeDistance > 30) {
            adaptiveThreshold = adaptiveThreshold * 1.1;
        }
    }

    const result = Math.max(1.0, Math.min(baseThreshold * 0.8, adaptiveThreshold));
    return isFinite(result) ? result : Math.max(1.0, baseThreshold * 0.8);
};

export const computeAlignedLateral = (
    startPoint: Coordinate,
    rawEndPoint: Coordinate,
    plants: PlantLocation[],
    placementMode: 'over_plants' | 'between_plants',
    snapThreshold: number = 20
): { alignedEnd: Coordinate; selectedPlants: PlantLocation[]; snappedStart: Coordinate } => {
    if (!startPoint || !rawEndPoint) {
        return {
            alignedEnd: rawEndPoint,
            selectedPlants: [],
            snappedStart: startPoint || rawEndPoint,
        };
    }

    if (!plants || plants.length === 0) {
        return { alignedEnd: rawEndPoint, selectedPlants: [], snappedStart: startPoint };
    }

    try {
        const pipeDistance = calculateDistanceBetweenPoints(startPoint, rawEndPoint);
        const adaptiveThreshold = calculateAdaptiveSnapThreshold(snapThreshold, plants, pipeDistance);

        const direction = getDragOrientation(startPoint, rawEndPoint, plants);

        if (placementMode === 'over_plants') {
            return computeOverPlantsMode(startPoint, rawEndPoint, plants, adaptiveThreshold, direction);
        } else {
            return computeBetweenPlantsMode(
                startPoint,
                rawEndPoint,
                plants,
                adaptiveThreshold,
                direction
            );
        }
    } catch (error) {
        console.warn('Error in computeAlignedLateral:', error);
        return { alignedEnd: rawEndPoint, selectedPlants: [], snappedStart: startPoint };
    }
};

export const computeAlignedLateralFromMainPipe = (
    snappedStartPoint: Coordinate, 
    rawEndPoint: Coordinate,
    plants: PlantLocation[],
    placementMode: 'over_plants' | 'between_plants',
    snapThreshold: number = 20
): { alignedEnd: Coordinate; selectedPlants: PlantLocation[]; snappedStart: Coordinate } => {
    if (!snappedStartPoint || !rawEndPoint) {
        return {
            alignedEnd: rawEndPoint,
            selectedPlants: [],
            snappedStart: snappedStartPoint || rawEndPoint,
        };
    }

    if (!plants || plants.length === 0) {
        return { alignedEnd: rawEndPoint, selectedPlants: [], snappedStart: snappedStartPoint };
    }

    const pipeDistance = calculateDistanceBetweenPoints(snappedStartPoint, rawEndPoint);
    const adaptiveThreshold = calculateAdaptiveSnapThreshold(snapThreshold, plants, pipeDistance);

    const direction = getDragOrientation(snappedStartPoint, rawEndPoint, plants);

    if (placementMode === 'over_plants') {
        return computeOverPlantsModeFromMainPipe(
            snappedStartPoint,
            rawEndPoint,
            plants,
            adaptiveThreshold, 
            direction
        );
    } else {
        return computeBetweenPlantsModeFromMainPipe(
            snappedStartPoint,
            rawEndPoint,
            plants,
            adaptiveThreshold, 
            direction
        );
    }
};

export const computeOverPlantsMode = (
    initialStartPoint: Coordinate,
    rawEndPoint: Coordinate,
    plants: PlantLocation[],
    snapThreshold: number,
    direction: 'rows' | 'columns'
): { alignedEnd: Coordinate; selectedPlants: PlantLocation[]; snappedStart: Coordinate } => {
    const rows = groupPlantsByRows(plants);
    const cols = groupPlantsByColumns(plants);

    const findClosestPlantToStart = (
        group: PlantLocation[]
    ): { plant: PlantLocation; distance: number } | null => {
        if (group.length === 0) return null;
        let closest: { plant: PlantLocation; distance: number } | null = null;
        group.forEach((p) => {
            const dist = calculateDistanceBetweenPoints(initialStartPoint, p.position);
            if (!closest || dist < closest.distance) {
                closest = { plant: p, distance: dist };
            }
        });
        return closest;
    };

    interface OverPlantsAlignment {
        type: 'row' | 'col';
        plants: PlantLocation[];
        firstPlantDistance: number; 
        firstPlant: PlantLocation; 
        centerLine: { start: Coordinate; end: Coordinate };
    }

    let bestAlignment: OverPlantsAlignment | null = null;

    const targetGroups = direction === 'rows' ? rows : cols;
    const groupType = direction === 'rows' ? 'row' : 'col';

    targetGroups.forEach((group) => {
        if (group.length < 2) return;

        const closestToStart = findClosestPlantToStart(group);
        if (!closestToStart) return;

        const adjustedSnapThreshold = snapThreshold * 1.5;

        if (
            closestToStart.distance <= adjustedSnapThreshold &&
            (!bestAlignment || closestToStart.distance < bestAlignment.firstPlantDistance)
        ) {
            let fullCenterLine: { start: Coordinate; end: Coordinate };

            const rotationInfo = hasRotation(plants);

            if (rotationInfo.hasRotation) {
                if (direction === 'rows') {
                    const rowDirection = directionFromPlantsLine(group);
                    const centerPoint = {
                        lat: group.reduce((sum, p) => sum + p.position.lat, 0) / group.length,
                        lng: group.reduce((sum, p) => sum + p.position.lng, 0) / group.length,
                    };

                    const lineLength = 100; 
                    fullCenterLine = {
                        start: {
                            lat: centerPoint.lat - (rowDirection.lat * lineLength) / 111320,
                            lng:
                                centerPoint.lng -
                                (rowDirection.lng * lineLength) /
                                    (111320 * Math.cos((centerPoint.lat * Math.PI) / 180)),
                        },
                        end: {
                            lat: centerPoint.lat + (rowDirection.lat * lineLength) / 111320,
                            lng:
                                centerPoint.lng +
                                (rowDirection.lng * lineLength) /
                                    (111320 * Math.cos((centerPoint.lat * Math.PI) / 180)),
                        },
                    };
                } else {
                    const colDirection = directionFromPlantsColumn(group);
                    const centerPoint = {
                        lat: group.reduce((sum, p) => sum + p.position.lat, 0) / group.length,
                        lng: group.reduce((sum, p) => sum + p.position.lng, 0) / group.length,
                    };

                    const lineLength = 100; 
                    fullCenterLine = {
                        start: {
                            lat: centerPoint.lat - (colDirection.lat * lineLength) / 111320,
                            lng:
                                centerPoint.lng -
                                (colDirection.lng * lineLength) /
                                    (111320 * Math.cos((centerPoint.lat * Math.PI) / 180)),
                        },
                        end: {
                            lat: centerPoint.lat + (colDirection.lat * lineLength) / 111320,
                            lng:
                                centerPoint.lng +
                                (colDirection.lng * lineLength) /
                                    (111320 * Math.cos((centerPoint.lat * Math.PI) / 180)),
                        },
                    };
                }
            } else {
                if (direction === 'rows') {
                    const sortedByLng = [...group].sort((a, b) => a.position.lng - b.position.lng);
                    fullCenterLine = {
                        start: sortedByLng[0].position,
                        end: sortedByLng[sortedByLng.length - 1].position,
                    };
                } else {
                    const sortedByLat = [...group].sort((a, b) => a.position.lat - b.position.lat);
                    const avgLng = group.reduce((sum, p) => sum + p.position.lng, 0) / group.length;
                    fullCenterLine = {
                        start: { lat: sortedByLat[0].position.lat, lng: avgLng },
                        end: { lat: sortedByLat[sortedByLat.length - 1].position.lat, lng: avgLng },
                    };
                }
            }

            bestAlignment = {
                type: groupType,
                plants: group,
                firstPlantDistance: closestToStart.distance,
                firstPlant: closestToStart.plant,
                centerLine: fullCenterLine,
            };
        }
    });

    if (!bestAlignment) {
        return { alignedEnd: rawEndPoint, selectedPlants: [], snappedStart: initialStartPoint };
    }

    const alignment = bestAlignment as OverPlantsAlignment;
    const projectedStart = findClosestPointOnLineSegment(
        initialStartPoint,
        alignment.centerLine.start,
        alignment.centerLine.end
    );
    const distanceToProjection = calculateDistanceBetweenPoints(initialStartPoint, projectedStart);

    const snappedStart = distanceToProjection <= snapThreshold ? projectedStart : initialStartPoint;

    const alignedEnd = findClosestPointOnLineSegment(
        rawEndPoint,
        alignment.centerLine.start,
        alignment.centerLine.end
    );

    const rotationInfo = hasRotation(plants);

    const selectedPlants = alignment.plants.filter((plant) => {
        const plantProjected = findClosestPointOnLineSegment(
            plant.position,
            alignment.centerLine.start,
            alignment.centerLine.end
        );


        let isInRange = false;

        if (rotationInfo.hasRotation) {
            const distanceFromStart = calculateDistanceBetweenPoints(plantProjected, snappedStart);
            const distanceFromEnd = calculateDistanceBetweenPoints(plantProjected, alignedEnd);
            const pipeLength = calculateDistanceBetweenPoints(snappedStart, alignedEnd);

            const tolerance = Math.max(2.0, pipeLength * 0.05); 
            isInRange = distanceFromStart + distanceFromEnd <= pipeLength + tolerance;
        } else {
            if (alignment.type === 'row') {
                const minLng = Math.min(snappedStart.lng, alignedEnd.lng);
                const maxLng = Math.max(snappedStart.lng, alignedEnd.lng);
                const buffer = Math.min(0.00001, (maxLng - minLng) * 0.01); 
                isInRange =
                    plantProjected.lng >= minLng - buffer && plantProjected.lng <= maxLng + buffer;
            } else {
                const minLat = Math.min(snappedStart.lat, alignedEnd.lat);
                const maxLat = Math.max(snappedStart.lat, alignedEnd.lat);
                const buffer = Math.min(0.00001, (maxLat - minLat) * 0.01); 
                isInRange =
                    plantProjected.lat >= minLat - buffer && plantProjected.lat <= maxLat + buffer;
            }
        }

        const distanceToLine = calculateDistanceBetweenPoints(plant.position, plantProjected);

        let plantSpacing = 5.0; 
        if (alignment.plants.length >= 2) {
            let totalSpacing = 0;
            let count = 0;
            for (let i = 0; i < alignment.plants.length - 1; i++) {
                const spacing = calculateDistanceBetweenPoints(
                    alignment.plants[i].position,
                    alignment.plants[i + 1].position
                );
                if (spacing > 0 && spacing < 50) {
                    totalSpacing += spacing;
                    count++;
                }
            }
            if (count > 0) {
                plantSpacing = totalSpacing / count;
            }
        }

        let adaptiveTolerance;
        if (plantSpacing < 3.0) {
            adaptiveTolerance = Math.max(0.5, plantSpacing * 0.25);
        } else if (plantSpacing < 8.0) {
            adaptiveTolerance = Math.max(1.0, plantSpacing * 0.3);
        } else {
            adaptiveTolerance = Math.max(1.5, Math.min(3.0, plantSpacing * 0.4));
        }

        const result = isInRange && distanceToLine <= adaptiveTolerance;

        return result;
    });

    return { alignedEnd, selectedPlants, snappedStart };
};

export const computeBetweenPlantsMode = (
    initialStartPoint: Coordinate,
    rawEndPoint: Coordinate,
    plants: PlantLocation[],
    snapThreshold: number,
    direction: 'rows' | 'columns'
): { alignedEnd: Coordinate; selectedPlants: PlantLocation[]; snappedStart: Coordinate } => {
    console.log('🌱 computeBetweenPlantsMode called:', {
        initialStartPoint,
        rawEndPoint,
        plantsCount: plants.length,
        snapThreshold,
        direction
    });
    
    const rows = groupPlantsByRows(plants);
    const cols = groupPlantsByColumns(plants);
    
    console.log('📊 Plant groups:', {
        rowsCount: rows.length,
        colsCount: cols.length,
        rowsLengths: rows.map(r => r.length),
        colsLengths: cols.map(c => c.length)
    });

    const findClosestPlantToStartInPair = (
        group1: PlantLocation[],
        group2: PlantLocation[]
    ): { plant: PlantLocation; distance: number } | null => {
        const allPlants = [...group1, ...group2];
        if (allPlants.length === 0) return null;

        let closest: { plant: PlantLocation; distance: number } | null = null;
        allPlants.forEach((p) => {
            const dist = calculateDistanceBetweenPoints(initialStartPoint, p.position);
            if (!closest || dist < closest.distance) {
                closest = { plant: p, distance: dist };
            }
        });
        return closest;
    };

    const targetGroups = direction === 'rows' ? rows : cols;
    const groupType = direction === 'rows' ? 'between_rows' : 'between_cols';

    interface BetweenPlantsAlignment {
        type: 'between_rows' | 'between_cols';
        row1: PlantLocation[];
        row2: PlantLocation[];
        firstPlantDistance: number; 
        firstPlant: PlantLocation; 
        centerLine: { start: Coordinate; end: Coordinate };
    }

    let bestAlignment: BetweenPlantsAlignment | null = null;

    for (let i = 0; i < targetGroups.length - 1; i++) {
        const group1 = targetGroups[i];
        const group2 = targetGroups[i + 1];

        if (group1.length < 2 || group2.length < 2) continue;

        const group1CenterCheck = getPlantGroupCenter(group1);
        const group2CenterCheck = getPlantGroupCenter(group2);
        const distanceBetweenGroupsCheck = calculateDistanceBetweenPoints(
            group1CenterCheck,
            group2CenterCheck
        );

        if (distanceBetweenGroupsCheck > 15.0) {
            continue;
        }

        const closestToStart = findClosestPlantToStartInPair(group1, group2);
        if (!closestToStart) continue;

        const adjustedSnapThreshold = snapThreshold * 2; 

        const group1CenterCalc = {
            lat: group1.reduce((sum, p) => sum + p.position.lat, 0) / group1.length,
            lng: group1.reduce((sum, p) => sum + p.position.lng, 0) / group1.length,
        };
        const group2CenterCalc = {
            lat: group2.reduce((sum, p) => sum + p.position.lat, 0) / group2.length,
            lng: group2.reduce((sum, p) => sum + p.position.lng, 0) / group2.length,
        };
        const distanceBetweenGroupsCalc = calculateDistanceBetweenPoints(
            group1CenterCalc,
            group2CenterCalc
        );


        const minGroupDistance = 1.0; 
        const maxGroupDistance = 20.0; 

        const isSuitablePair =
            closestToStart.distance <= adjustedSnapThreshold * 1.5 && // เพิ่ม tolerance
            distanceBetweenGroupsCalc >= minGroupDistance * 0.5 && // ลด minimum distance
            distanceBetweenGroupsCalc <= maxGroupDistance * 1.5; // เพิ่ม maximum distance

        let centerLineStart: Coordinate;
        let centerLineEnd: Coordinate;

        const rotationInfo = hasRotation(plants);

        if (rotationInfo.hasRotation) {
            const allPlantsInPair = [...group1, ...group2];
            const centerPoint = {
                lat:
                    allPlantsInPair.reduce((sum, p) => sum + p.position.lat, 0) /
                    allPlantsInPair.length,
                lng:
                    allPlantsInPair.reduce((sum, p) => sum + p.position.lng, 0) /
                    allPlantsInPair.length,
            };

            let lineDirection: { lat: number; lng: number };
            if (groupType === 'between_rows') {
                lineDirection = directionFromPlantsLine(allPlantsInPair);
            } else {
                lineDirection = directionFromPlantsColumn(allPlantsInPair);
            }

            const lineLength = 100; 
            centerLineStart = {
                lat: centerPoint.lat - (lineDirection.lat * lineLength) / 111320,
                lng:
                    centerPoint.lng -
                    (lineDirection.lng * lineLength) /
                        (111320 * Math.cos((centerPoint.lat * Math.PI) / 180)),
            };
            centerLineEnd = {
                lat: centerPoint.lat + (lineDirection.lat * lineLength) / 111320,
                lng:
                    centerPoint.lng +
                    (lineDirection.lng * lineLength) /
                        (111320 * Math.cos((centerPoint.lat * Math.PI) / 180)),
            };
        } else {
            centerLineStart = {
                lat: (group1[0].position.lat + group2[0].position.lat) / 2,
                lng: (group1[0].position.lng + group2[0].position.lng) / 2,
            };
            centerLineEnd = {
                lat:
                    (group1[group1.length - 1].position.lat +
                        group2[group2.length - 1].position.lat) /
                    2,
                lng:
                    (group1[group1.length - 1].position.lng +
                        group2[group2.length - 1].position.lng) /
                    2,
            };
        }
        const closestPointOnCenterLine = findClosestPointOnLineSegment(
            initialStartPoint,
            centerLineStart,
            centerLineEnd
        );
        const distanceToCenterLine = calculateDistanceBetweenPoints(
            initialStartPoint,
            closestPointOnCenterLine
        );

        const isOptimalDistance =
            distanceBetweenGroupsCalc >= 1.0 && distanceBetweenGroupsCalc <= 25.0; // เพิ่ม range

        const isBetterChoice =
            !bestAlignment ||
            distanceToCenterLine < bestAlignment.firstPlantDistance * 0.8 || // เพิ่ม tolerance
            (distanceToCenterLine <= bestAlignment.firstPlantDistance * 1.2 && isOptimalDistance); // เพิ่ม tolerance

        const isCloseToCenterLine = distanceToCenterLine <= adjustedSnapThreshold * 1.2; // เพิ่ม tolerance 

        const isGoodPair = isSuitablePair && isBetterChoice && isCloseToCenterLine;

        if (isGoodPair) {
            let fullCenterLine: { start: Coordinate; end: Coordinate };

            if (direction === 'rows') {
                const sorted1ByLng = [...group1].sort((a, b) => a.position.lng - b.position.lng);
                const sorted2ByLng = [...group2].sort((a, b) => a.position.lng - b.position.lng);

                const start1 = sorted1ByLng[0].position;
                const end1 = sorted1ByLng[sorted1ByLng.length - 1].position;
                const start2 = sorted2ByLng[0].position;
                const end2 = sorted2ByLng[sorted2ByLng.length - 1].position;

                const centerStart = {
                    lat: (start1.lat + start2.lat) / 2,
                    lng: (start1.lng + start2.lng) / 2,
                };
                const centerEnd = {
                    lat: (end1.lat + end2.lat) / 2,
                    lng: (end1.lng + end2.lng) / 2,
                };

                fullCenterLine = { start: centerStart, end: centerEnd };
            } else {
                const sorted1ByLat = [...group1].sort((a, b) => a.position.lat - b.position.lat);
                const sorted2ByLat = [...group2].sort((a, b) => a.position.lat - b.position.lat);

                const avgLng1 = group1.reduce((sum, p) => sum + p.position.lng, 0) / group1.length;
                const avgLng2 = group2.reduce((sum, p) => sum + p.position.lng, 0) / group2.length;
                const avgLng = (avgLng1 + avgLng2) / 2;

                const centerStart = {
                    lat: (sorted1ByLat[0].position.lat + sorted2ByLat[0].position.lat) / 2,
                    lng: avgLng,
                };
                const centerEnd = {
                    lat:
                        (sorted1ByLat[sorted1ByLat.length - 1].position.lat +
                            sorted2ByLat[sorted2ByLat.length - 1].position.lat) /
                        2,
                    lng: avgLng,
                };

                fullCenterLine = { start: centerStart, end: centerEnd };
            }

            bestAlignment = {
                type: groupType,
                row1: group1,
                row2: group2,
                firstPlantDistance: closestToStart.distance,
                firstPlant: closestToStart.plant,
                centerLine: fullCenterLine,
            };
        }
    }

    if (!bestAlignment) {
        console.log('⚠️ No best alignment found, using fallback');
        const allPlants = [...plants];
        const directPlants = allPlants.filter((plant) => {
            const closestPoint = findClosestPointOnLineSegment(
                plant.position,
                initialStartPoint,
                rawEndPoint
            );
            const distance = calculateDistanceBetweenPoints(plant.position, closestPoint);

            return distance <= 25.0; // เพิ่ม tolerance สำหรับ fallback
        });
        
        console.log('🔄 Fallback plants found:', directPlants.length);
        
        // ถ้ายังไม่พบต้นไม้ ให้ใช้ต้นไม้ที่ใกล้ที่สุด
        if (directPlants.length === 0 && allPlants.length > 0) {
            console.log('🆘 Using closest plant fallback');
            const closestPlant = allPlants.reduce((closest, plant) => {
                const distance = calculateDistanceBetweenPoints(plant.position, initialStartPoint);
                const closestDistance = calculateDistanceBetweenPoints(closest.position, initialStartPoint);
                return distance < closestDistance ? plant : closest;
            });
            return {
                alignedEnd: rawEndPoint,
                selectedPlants: [closestPlant],
                snappedStart: initialStartPoint,
            };
        }
        
        return {
            alignedEnd: rawEndPoint,
            selectedPlants: directPlants,
            snappedStart: initialStartPoint,
        };
    }

    const projectedStart = findClosestPointOnLineSegment(
        initialStartPoint,
        bestAlignment.centerLine.start,
        bestAlignment.centerLine.end
    );
    const distanceToProjection = calculateDistanceBetweenPoints(initialStartPoint, projectedStart);

    const snappedStart = distanceToProjection <= snapThreshold ? projectedStart : initialStartPoint;


    const alignedEnd = findClosestPointOnLineSegment(
        rawEndPoint,
        bestAlignment.centerLine.start,
        bestAlignment.centerLine.end
    );

    const allPlantsInPair = [...bestAlignment.row1, ...bestAlignment.row2];

    const calculatePlantSpacing = (plants: PlantLocation[]): number => {
        if (plants.length < 2) return 5.0; 
        let totalDistance = 0;
        let count = 0;
        for (let i = 0; i < plants.length - 1; i++) {
            const distance = calculateDistanceBetweenPoints(
                plants[i].position,
                plants[i + 1].position
            );
            totalDistance += distance;
            count++;
        }
        return totalDistance / count;
    };

    const row1Spacing = calculatePlantSpacing(bestAlignment.row1);
    const row2Spacing = calculatePlantSpacing(bestAlignment.row2);
    const avgPlantSpacing = (row1Spacing + row2Spacing) / 2;

    const rotationInfo = hasRotation(plants);

    const selectedPlants = allPlantsInPair.filter((plant) => {
        const plantProjected = findClosestPointOnLineSegment(
            plant.position,
            bestAlignment.centerLine.start,
            bestAlignment.centerLine.end
        );

        const distanceToStart = calculateDistanceBetweenPoints(plantProjected, snappedStart);
        const distanceToEnd = calculateDistanceBetweenPoints(plantProjected, alignedEnd);
        const lateralLength = calculateDistanceBetweenPoints(snappedStart, alignedEnd);

        const pipeLengthTolerance = Math.max(3.0, avgPlantSpacing * 0.6); // เพิ่ม tolerance

        const isWithinPipeLength =
            distanceToStart + distanceToEnd <= lateralLength + pipeLengthTolerance;

        let isInRange = false;

        if (rotationInfo.hasRotation) {
            const tolerance = Math.max(3.0, lateralLength * 0.08); // เพิ่ม tolerance
            isInRange = distanceToStart + distanceToEnd <= lateralLength + tolerance;
        } else {
            if (bestAlignment.type === 'between_rows') {
                const minLng = Math.min(snappedStart.lng, alignedEnd.lng);
                const maxLng = Math.max(snappedStart.lng, alignedEnd.lng);
                const lngTolerance = Math.max(0.000003, avgPlantSpacing * 0.000005); // ลด tolerance
                isInRange =
                    plantProjected.lng >= minLng - lngTolerance && // เปลี่ยนเป็น - เพื่อให้กว้างขึ้น
                    plantProjected.lng <= maxLng + lngTolerance; // เปลี่ยนเป็น + เพื่อให้กว้างขึ้น
            } else {
                const minLat = Math.min(snappedStart.lat, alignedEnd.lat);
                const maxLat = Math.max(snappedStart.lat, alignedEnd.lat);
                const latTolerance = Math.max(0.000003, avgPlantSpacing * 0.000005); // ลด tolerance
                isInRange =
                    plantProjected.lat >= minLat - latTolerance && // เปลี่ยนเป็น - เพื่อให้กว้างขึ้น
                    plantProjected.lat <= maxLat + latTolerance; // เปลี่ยนเป็น + เพื่อให้กว้างขึ้น
            }
        }

        let isBetweenPlantPairs = false;
        if (bestAlignment.type === 'between_rows') {
            const row1LatAvg =
                bestAlignment.row1.reduce((sum, p) => sum + p.position.lat, 0) /
                bestAlignment.row1.length;
            const row2LatAvg =
                bestAlignment.row2.reduce((sum, p) => sum + p.position.lat, 0) /
                bestAlignment.row2.length;
            const minRowLat = Math.min(row1LatAvg, row2LatAvg);
            const maxRowLat = Math.max(row1LatAvg, row2LatAvg);
            isBetweenPlantPairs =
                plant.position.lat >= minRowLat && plant.position.lat <= maxRowLat;
        } else {
            const col1LngAvg =
                bestAlignment.row1.reduce((sum, p) => sum + p.position.lng, 0) /
                bestAlignment.row1.length;
            const col2LngAvg =
                bestAlignment.row2.reduce((sum, p) => sum + p.position.lng, 0) /
                bestAlignment.row2.length;
            const minColLng = Math.min(col1LngAvg, col2LngAvg);
            const maxColLng = Math.max(col1LngAvg, col2LngAvg);
            isBetweenPlantPairs =
                plant.position.lng >= minColLng && plant.position.lng <= maxColLng;
        }

        const distanceToLine = calculateDistanceBetweenPoints(plant.position, plantProjected);

        let distanceTolerance;
        if (avgPlantSpacing < 3.0) {
            distanceTolerance = Math.max(1.2, avgPlantSpacing * 0.3); // เพิ่ม tolerance
        } else if (avgPlantSpacing < 8.0) {
            distanceTolerance = Math.max(1.8, avgPlantSpacing * 0.35); // เพิ่ม tolerance
        } else {
            distanceTolerance = Math.max(2.0, Math.min(4.0, avgPlantSpacing * 0.4)); // เพิ่ม tolerance
        }
        const result =
            isInRange &&
            isWithinPipeLength &&
            distanceToLine <= distanceTolerance &&
            isBetweenPlantPairs;

        return result;
    });

    if (selectedPlants.length === 0 && allPlantsInPair.length > 0) {
        const fallbackPlants = allPlantsInPair.filter((plant) => {
            const lateralStart = snappedStart;
            const lateralEnd = alignedEnd;
            const closestPoint = findClosestPointOnLineSegment(
                plant.position,
                lateralStart,
                lateralEnd
            );
            const distance = calculateDistanceBetweenPoints(plant.position, closestPoint);

            let fallbackTolerance;
            if (avgPlantSpacing < 3.0) {
                fallbackTolerance = 2.5; // เพิ่ม tolerance
            } else if (avgPlantSpacing < 8.0) {
                fallbackTolerance = 4.0; // เพิ่ม tolerance
            } else {
                fallbackTolerance = 6.0; // เพิ่ม tolerance
            }
            return distance <= fallbackTolerance;
        });

        if (fallbackPlants.length > 0) {
            console.log('🔄 Using fallback plants:', fallbackPlants.length);
            return { alignedEnd, selectedPlants: fallbackPlants, snappedStart };
        }
    }

    console.log('✅ computeBetweenPlantsMode result:', {
        alignedEnd,
        selectedPlantsCount: selectedPlants.length,
        snappedStart
    });
    
    return { alignedEnd, selectedPlants, snappedStart };
};

export const calculateTotalWaterNeed = (plants: PlantLocation[]): number => {
    return plants.reduce((total, plant) => total + plant.plantData.waterNeed, 0);
};

export const generateLateralPipeId = (): string => {
    return `lateral_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const validateLateralPipeCoordinates = (coordinates: Coordinate[]): boolean => {
    if (!coordinates || coordinates.length < 2) {
        return false;
    }
    
    for (const coord of coordinates) {
        if (
            typeof coord.lat !== 'number' ||
            typeof coord.lng !== 'number' ||
            !isFinite(coord.lat) ||
            !isFinite(coord.lng) ||
            coord.lat < -90 ||
            coord.lat > 90 ||
            coord.lng < -180 ||
            coord.lng > 180
        ) {
            return false;
        }
    }
    
    return true;
};

export const optimizeLateralPipePath = (
    coordinates: Coordinate[],
    minDistance: number = 1
): Coordinate[] => {
    if (!validateLateralPipeCoordinates(coordinates)) {
        return coordinates;
    }
    
    if (coordinates.length <= 2) {
        return coordinates;
    }
    
    const optimized: Coordinate[] = [coordinates[0]];
    
    for (let i = 1; i < coordinates.length - 1; i++) {
        const current = coordinates[i];
        const prev = optimized[optimized.length - 1];
        
        const distance = calculateDistanceBetweenPoints(prev, current);
        
        if (distance >= minDistance) {
            optimized.push(current);
        }
    }
    
    const lastPoint = coordinates[coordinates.length - 1];
    const lastOptimized = optimized[optimized.length - 1];
    
    if (calculateDistanceBetweenPoints(lastOptimized, lastPoint) >= minDistance) {
        optimized.push(lastPoint);
    } else if (optimized.length > 1) {
        optimized[optimized.length - 1] = lastPoint;
    }
    
    return optimized;
};

export const generateEmitterLines = (
    lateralPipeId: string,
    lateralStart: Coordinate,
    lateralEnd: Coordinate,
    plants: PlantLocation[],
    emitterDiameter: number = 4,
    placementMode?: 'over_plants' | 'between_plants'
): any[] => {
    if (placementMode !== 'between_plants') {
        return []; 
    }

    const emitterLines: any[] = [];

    plants.forEach((plant, index) => {
       
        const closestPointOnLateral = findClosestPointOnLineSegment(
            plant.position,
            lateralStart,
            lateralEnd
        );

        const distance = calculateDistanceBetweenPoints(closestPointOnLateral, plant.position);
        
        if (distance <= 20) {
            const emitterLine = {
                id: `emitter_${lateralPipeId}_${index}`,
                lateralPipeId: lateralPipeId,
                plantId: plant.id,
                coordinates: [closestPointOnLateral, plant.position],
                length: distance,
                diameter: emitterDiameter,
                emitterType: 'drip',
            };

            emitterLines.push(emitterLine);
        }
    });

    return emitterLines;
};

export const generateEmitterLinesForBetweenPlantsMode = (
    lateralPipeId: string,
    lateralStart: Coordinate,
    lateralEnd: Coordinate,
    selectedPlants: PlantLocation[], 
    emitterDiameter: number = 4
): any[] => {

    const emitterLines: any[] = [];

    selectedPlants.forEach((plant) => {
        const closestPointOnLateral = findClosestPointOnLineSegment(
            plant.position,
            lateralStart,
            lateralEnd
        );

        const distance = calculateDistanceBetweenPoints(closestPointOnLateral, plant.position);

        const calculatePlantSpacing = (): number => {
            if (selectedPlants.length < 2) return 5.0;
            let totalDistance = 0;
            let count = 0;
            for (let i = 0; i < selectedPlants.length - 1; i++) {
                const dist = calculateDistanceBetweenPoints(
                    selectedPlants[i].position,
                    selectedPlants[i + 1].position
                );
                totalDistance += dist;
                count++;
            }
            return totalDistance / count;
        };

        const avgSpacing = calculatePlantSpacing();
        const adaptiveMaxDistance = Math.max(8.0, avgSpacing * 0.8); 

        if (distance <= adaptiveMaxDistance) {
            const emitterLine = {
                id: `emitter_${lateralPipeId}_${plant.id}`,
                lateralPipeId: lateralPipeId,
                plantId: plant.id,
                coordinates: [
                    { lat: closestPointOnLateral.lat, lng: closestPointOnLateral.lng }, 
                    { lat: plant.position.lat, lng: plant.position.lng }, 
                ],
                length: distance,
                diameter: emitterDiameter,
                emitterType: 'drip',
                isVisible: true,
                isActive: true,
                connectionPoint: { lat: closestPointOnLateral.lat, lng: closestPointOnLateral.lng },
            };

            emitterLines.push(emitterLine);
        }
    });

    return emitterLines;
};

export const generateEmitterLinesForMultiSegment = (
    lateralPipeId: string,
    lateralCoordinates: Coordinate[], 
    selectedPlants: PlantLocation[],
    emitterDiameter: number = 4
): any[] => {
    const emitterLines: any[] = [];

    selectedPlants.forEach((plant) => { 
        let closestPoint: Coordinate | null = null;
        let minDistance = Infinity;

        for (let i = 0; i < lateralCoordinates.length - 1; i++) {
            const segmentStart = lateralCoordinates[i];
            const segmentEnd = lateralCoordinates[i + 1];

            const closestOnSegment = findClosestPointOnLineSegment(
                plant.position,
                segmentStart,
                segmentEnd
            );

            const distance = calculateDistanceBetweenPoints(closestOnSegment, plant.position);

            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = closestOnSegment;
            }
        }

        if (closestPoint && minDistance <= 10.0) {
            const emitterLine = {
                id: `emitter_${lateralPipeId}_${plant.id}`,
                lateralPipeId: lateralPipeId,
                plantId: plant.id,
                coordinates: [closestPoint, plant.position],
                length: minDistance,
                diameter: emitterDiameter,
                emitterType: 'drip',
                isVisible: true,
                isActive: true,
                connectionPoint: closestPoint,
            };

            emitterLines.push(emitterLine);
        }
    });

    return emitterLines;
};

export const accumulatePlantsFromAllSegments = (
    allWaypoints: Coordinate[], 
    plants: PlantLocation[],
    placementMode: 'over_plants' | 'between_plants',
    snapThreshold: number = 20
): PlantLocation[] => {
    if (!allWaypoints || allWaypoints.length < 2) {
        return [];
    }

    const startPoint = allWaypoints[0];
    const waypoints = allWaypoints.slice(1, -1); 
    const currentPoint = allWaypoints[allWaypoints.length - 1];

    const result = computeMultiSegmentAlignment(
        startPoint,
        waypoints,
        currentPoint,
        plants,
        placementMode,
        snapThreshold
    );

    return result.allSelectedPlants;
};

export const computeMultiSegmentAlignment = (
    startPoint: Coordinate,
    waypoints: Coordinate[],
    currentPoint: Coordinate,
    plants: PlantLocation[],
    placementMode: 'over_plants' | 'between_plants',
    snapThreshold: number = 20
): {
    allSelectedPlants: PlantLocation[];
    totalWaterNeed: number;
    alignedEndPoint: Coordinate;
    segmentResults: Array<{
        startPoint: Coordinate;
        endPoint: Coordinate;
        selectedPlants: PlantLocation[];
        alignedEnd: Coordinate;
    }>;
} => {
    const allWaypoints = [startPoint, ...waypoints, currentPoint];
    const segmentResults: Array<{
        startPoint: Coordinate;
        endPoint: Coordinate;
        selectedPlants: PlantLocation[];
        alignedEnd: Coordinate;
    }> = [];

    let lastAlignedEnd = startPoint;
    const allSelectedPlants: PlantLocation[] = [];
    const processedPlantIds = new Set<string>();
    const waypointProximityThreshold = snapThreshold * 1.5; 

   
    for (let i = 0; i < allWaypoints.length - 1; i++) {
        const segmentStart = i === 0 ? startPoint : lastAlignedEnd;
        const segmentEnd = allWaypoints[i + 1];

        const segmentResult = computeAlignedLateral(
            segmentStart,
            segmentEnd,
            plants,
            placementMode,
            snapThreshold
        );

        const filteredSegmentPlants: PlantLocation[] = [];

        segmentResult.selectedPlants.forEach((plant) => {
            let shouldAddPlant = true;

            for (let j = 0; j < waypoints.length; j++) {
                const waypoint = waypoints[j];
                const distanceToWaypoint = calculateDistanceBetweenPoints(plant.position, waypoint);

                if (distanceToWaypoint <= waypointProximityThreshold) {

                    if (i !== j) {
                        shouldAddPlant = false;
                        break;
                    } else {
                        shouldAddPlant = true;
                    }
                }
            }

            if (shouldAddPlant && !processedPlantIds.has(plant.id)) {
                filteredSegmentPlants.push(plant);
                allSelectedPlants.push(plant);
                processedPlantIds.add(plant.id);
            }
        });

        segmentResults.push({
            startPoint: segmentStart,
            endPoint: segmentEnd,
            selectedPlants: filteredSegmentPlants,
            alignedEnd: segmentResult.alignedEnd,
        });

        lastAlignedEnd = segmentResult.alignedEnd;
    }

    const totalWaterNeed = calculateTotalWaterNeed(allSelectedPlants);

    return {
        allSelectedPlants,
        totalWaterNeed,
        alignedEndPoint: lastAlignedEnd,
        segmentResults,
    };
};


const computeOverPlantsModeFromMainPipe = (
    snappedStartPoint: Coordinate,
    rawEndPoint: Coordinate,
    plants: PlantLocation[],
    snapThreshold: number,
    direction: 'rows' | 'columns'
): { alignedEnd: Coordinate; selectedPlants: PlantLocation[]; snappedStart: Coordinate } => {
    return computeOverPlantsMode(snappedStartPoint, rawEndPoint, plants, snapThreshold, direction);
};

const computeBetweenPlantsModeFromMainPipe = (
    snappedStartPoint: Coordinate,
    rawEndPoint: Coordinate,
    plants: PlantLocation[],
    snapThreshold: number,
    direction: 'rows' | 'columns'
): { alignedEnd: Coordinate; selectedPlants: PlantLocation[]; snappedStart: Coordinate } => {
    return computeBetweenPlantsMode(
        snappedStartPoint,
        rawEndPoint,
        plants,
        snapThreshold,
        direction
    );
};
