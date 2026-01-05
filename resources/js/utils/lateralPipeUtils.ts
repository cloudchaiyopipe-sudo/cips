/* eslint-disable @typescript-eslint/no-unused-vars */
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

    const findPipeZone = (pipe: any, pipeType: 'lateral' | 'submain'): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        // Use explicit zoneId if available
        if (pipe.zoneId) {
            return pipe.zoneId;
        }

        const coords = pipe.coordinates;
        let pointsToCheck: Coordinate[] = [];

        // IMPORTANT: For sub-main pipes, only check the ENDPOINT (where the pipe ends)
        // For lateral pipes, check PLANTS or multiple points to find the correct zone
        if (pipeType === 'submain') {
            // Sub-main pipe belongs to the zone where it ENDS
            pointsToCheck = [coords[coords.length - 1]];
        } else {
            // Lateral pipe: Check plants first, then check multiple points along the pipe
            // This handles cases where the connection point is outside/on the edge of the zone
            if (pipe.plants && pipe.plants.length > 0) {
                // Use plant positions (most reliable for lateral pipes)
                pointsToCheck = pipe.plants.map((p: any) => p.position);
            } else {
                // Fallback: check multiple points along the lateral pipe
                pointsToCheck = [coords[0]];
                if (coords.length > 2) {
                    const midIndex = Math.floor(coords.length / 2);
                    pointsToCheck.push(coords[midIndex]);
                }
                if (coords.length > 1) {
                    pointsToCheck.push(coords[coords.length - 1]);
                }
            }
        }

        // Check irrigationZones first
        if (irrigationZones) {
            for (const zone of irrigationZones) {
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        return zone.id;
                    }
                }
            }
        }

        // Then check regular zones
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

        const lateralZone = findPipeZone(lateralPipe, 'lateral');

        for (const subMainPipe of subMainPipes) {
            if (!subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
                continue;
            }

            const subMainZone = findPipeZone(subMainPipe, 'submain');

            // CRITICAL: Only create intersection point if pipes are in the SAME zone
            // If sub-main pipe just passes through another zone, don't create connection
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

    const findPipeZone = (pipe: any, checkPoint?: Coordinate): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        // ตรวจสอบหลายจุดของท่อเพื่อหาว่าท่ออยู่ในโซนไหน
        // ตรวจสอบจุดเริ่มต้น, จุดสิ้นสุด, จุดกึ่งกลาง, และจุดที่ต้องการตรวจสอบ (ถ้ามี)
        const pointsToCheck: Coordinate[] = [
            pipe.coordinates[0], // จุดเริ่มต้น
            pipe.coordinates[pipe.coordinates.length - 1], // จุดสิ้นสุด
        ];

        // เพิ่มจุดกึ่งกลางถ้ามีหลายจุด
        if (pipe.coordinates.length > 2) {
            const midIndex = Math.floor(pipe.coordinates.length / 2);
            pointsToCheck.push(pipe.coordinates[midIndex]);
        }

        // เพิ่มจุดที่ต้องการตรวจสอบ (เช่น connection point)
        if (checkPoint) {
            pointsToCheck.push(checkPoint);
        }

        // ตรวจสอบว่าท่ออยู่ในโซนไหน โดยต้องตรวจสอบว่าจุดส่วนใหญ่อยู่ในโซนเดียวกัน
        const zoneCounts = new Map<string, number>();

        if (irrigationZones) {
            for (const zone of irrigationZones) {
                let count = 0;
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        count++;
                    }
                }
                if (count > 0) {
                    zoneCounts.set(zone.id, count);
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                let count = 0;
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        count++;
                    }
                }
                if (count > 0) {
                    const existingCount = zoneCounts.get(zone.id) || 0;
                    zoneCounts.set(zone.id, existingCount + count);
                }
            }
        }

        // หาโซนที่มีจุดมากที่สุด (ต้องมีอย่างน้อย 2 จุดหรือมากกว่า 50% ของจุดที่ตรวจสอบ)
        let maxCount = 0;
        let selectedZone: string | null = null;
        const minRequiredPoints = Math.max(2, Math.ceil(pointsToCheck.length * 0.5));

        for (const [zoneId, count] of zoneCounts.entries()) {
            if (count >= minRequiredPoints && count > maxCount) {
                maxCount = count;
                selectedZone = zoneId;
            }
        }

        return selectedZone;
    };

    // ฟังก์ชันตรวจสอบว่าจุดอยู่ในโซนไหน (สำหรับจุดเดียว)
    const findPipeZoneForPoint = (point: Coordinate): string | null => {
        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (isPointInPolygon(point, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (isPointInPolygon(point, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        return null;
    };

    // ฟังก์ชันตรวจสอบว่าจุดอยู่ในโซนเดียวกันหรือไม่
    const isPointInSameZone = (point: Coordinate, zoneId: string): boolean => {
        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (zone.id === zoneId && isPointInPolygon(point, zone.coordinates)) {
                    return true;
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (zone.id === zoneId && isPointInPolygon(point, zone.coordinates)) {
                    return true;
                }
            }
        }

        return false;
    };

    // เก็บ connection ที่มีอยู่แล้ว: mainPipeId -> subMainPipeId
    // เพื่อให้ท่อเมน 1 เส้นเชื่อมกับท่อ submain 1 เส้นได้เพียงจุดเดียวเท่านั้น
    const mainPipeConnections = new Map<string, string>(); // mainPipeId -> subMainPipeId
    const subMainPipeConnections = new Map<string, string>(); // subMainPipeId -> mainPipeId

    // รวบรวม candidate connections ทั้งหมด (เรียงตามความสำคัญ: ปลายท่อ main ก่อน)
    interface CandidateConnection {
        mainPipeId: string;
        subMainPipeId: string;
        connectionPoint: Coordinate;
        distance: number;
        isMainEnd: boolean; // true = ปลายท่อ main, false = จุดอื่น
        priority: number; // 1 = สูงสุด (ปลายท่อ main), 2 = ต่ำกว่า
    }

    const candidateConnections: CandidateConnection[] = [];

    for (const subMainPipe of subMainPipes) {
        if (!subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
            continue;
        }

        const subMainStart = subMainPipe.coordinates[0];
        const subMainZone = findPipeZone(subMainPipe);

        if (!subMainZone) {
            continue;
        }

        for (const mainPipe of mainPipes) {
            if (!mainPipe.coordinates || mainPipe.coordinates.length < 2) {
                continue;
            }

            const mainEnd = mainPipe.coordinates[mainPipe.coordinates.length - 1];
            const mainEndZone = findPipeZoneForPoint(mainEnd);

            if (!mainEndZone || !subMainZone || mainEndZone !== subMainZone) {
                continue;
            }

            if (!isPointInSameZone(mainEnd, subMainZone)) {
                continue;
            }
            if (!isPointInSameZone(subMainStart, subMainZone)) {
                continue;
            }

            const subMainStartZone = findPipeZoneForPoint(subMainStart);
            if (
                !subMainStartZone ||
                subMainStartZone !== subMainZone ||
                subMainStartZone !== mainEndZone
            ) {
                continue;
            }

            // ตรวจสอบ end-to-end connection (ปลายท่อเมนกับจุดเริ่มต้นท่อเมนรอง)
            const distanceToSubMainStart = calculateDistanceBetweenPoints(mainEnd, subMainStart);
            if (distanceToSubMainStart <= 1.0) {
                candidateConnections.push({
                    mainPipeId: mainPipe.id,
                    subMainPipeId: subMainPipe.id,
                    connectionPoint: {
                        lat: parseFloat(mainEnd.lat.toFixed(8)),
                        lng: parseFloat(mainEnd.lng.toFixed(8)),
                    },
                    distance: distanceToSubMainStart,
                    isMainEnd: true,
                    priority: 1, // สูงสุด - ปลายท่อ main
                });
            }
        }
    }

    // เรียงตาม priority (1 = สูงสุด) แล้วตาม distance (น้อยกว่า = ดีกว่า)
    candidateConnections.sort((a, b) => {
        if (a.priority !== b.priority) {
            return a.priority - b.priority; // priority ต่ำกว่า = สูงกว่า
        }
        return a.distance - b.distance; // distance น้อยกว่า = ดีกว่า
    });

    // เลือก connection ที่ดีที่สุด โดยให้ท่อเมน 1 เส้นเชื่อมกับท่อ submain 1 เส้นได้เพียงจุดเดียว
    for (const candidate of candidateConnections) {
        // ตรวจสอบว่าท่อเมนนี้เชื่อมต่อแล้วหรือยัง
        if (mainPipeConnections.has(candidate.mainPipeId)) {
            continue; // ท่อเมนนี้เชื่อมต่อแล้ว ให้ข้าม
        }

        // ตรวจสอบว่าท่อเมนรองนี้เชื่อมต่อแล้วหรือยัง
        if (subMainPipeConnections.has(candidate.subMainPipeId)) {
            continue; // ท่อเมนรองนี้เชื่อมต่อแล้ว ให้ข้าม
        }

        // ตรวจสอบอีกครั้งว่าจุดเชื่อมต่ออยู่ในโซนเดียวกันจริงๆ
        const finalMainEndZone = findPipeZoneForPoint(candidate.connectionPoint);
        const subMainStart = subMainPipes.find((p) => p.id === candidate.subMainPipeId)
            ?.coordinates[0];
        if (!subMainStart) continue;

        const finalSubMainStartZone = findPipeZoneForPoint(subMainStart);

        if (
            !finalMainEndZone ||
            !finalSubMainStartZone ||
            finalMainEndZone !== finalSubMainStartZone
        ) {
            continue;
        }
        if (
            !isPointInSameZone(candidate.connectionPoint, finalMainEndZone) ||
            !isPointInSameZone(subMainStart, finalSubMainStartZone)
        ) {
            continue;
        }

        // บันทึก connection
        connections.push({
            mainPipeId: candidate.mainPipeId,
            subMainPipeId: candidate.subMainPipeId,
            connectionPoint: candidate.connectionPoint,
        });

        // บันทึกว่าท่อเมนและท่อเมนรองนี้เชื่อมต่อแล้ว
        mainPipeConnections.set(candidate.mainPipeId, candidate.subMainPipeId);
        subMainPipeConnections.set(candidate.subMainPipeId, candidate.mainPipeId);
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

    const findPipeZone = (pipe: any, checkPoint?: Coordinate): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        // ตรวจสอบหลายจุดของท่อเพื่อหาว่าท่ออยู่ในโซนไหน
        // ตรวจสอบจุดเริ่มต้น, จุดสิ้นสุด, จุดกึ่งกลาง, และจุดที่ต้องการตรวจสอบ (ถ้ามี)
        const pointsToCheck: Coordinate[] = [
            pipe.coordinates[0], // จุดเริ่มต้น
            pipe.coordinates[pipe.coordinates.length - 1], // จุดสิ้นสุด
        ];

        // เพิ่มจุดกึ่งกลางถ้ามีหลายจุด
        if (pipe.coordinates.length > 2) {
            const midIndex = Math.floor(pipe.coordinates.length / 2);
            pointsToCheck.push(pipe.coordinates[midIndex]);
        }

        // เพิ่มจุดที่ต้องการตรวจสอบ (เช่น connection point)
        if (checkPoint) {
            pointsToCheck.push(checkPoint);
        }

        // ตรวจสอบว่าท่ออยู่ในโซนไหน โดยต้องตรวจสอบว่าจุดส่วนใหญ่อยู่ในโซนเดียวกัน
        const zoneCounts = new Map<string, number>();

        if (irrigationZones) {
            for (const zone of irrigationZones) {
                let count = 0;
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        count++;
                    }
                }
                if (count > 0) {
                    zoneCounts.set(zone.id, count);
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                let count = 0;
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        count++;
                    }
                }
                if (count > 0) {
                    const existingCount = zoneCounts.get(zone.id) || 0;
                    zoneCounts.set(zone.id, existingCount + count);
                }
            }
        }

        // หาโซนที่มีจุดมากที่สุด (ต้องมีอย่างน้อย 2 จุดหรือมากกว่า 50% ของจุดที่ตรวจสอบ)
        let maxCount = 0;
        let selectedZone: string | null = null;
        const minRequiredPoints = Math.max(2, Math.ceil(pointsToCheck.length * 0.5));

        for (const [zoneId, count] of zoneCounts.entries()) {
            if (count >= minRequiredPoints && count > maxCount) {
                maxCount = count;
                selectedZone = zoneId;
            }
        }

        return selectedZone;
    };

    // ฟังก์ชันตรวจสอบว่าจุดอยู่ในโซนไหน (สำหรับจุดเดียว)
    const findPipeZoneForPoint = (point: Coordinate): string | null => {
        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (isPointInPolygon(point, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (isPointInPolygon(point, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        return null;
    };

    // ฟังก์ชันตรวจสอบว่าจุดอยู่ในโซนเดียวกันหรือไม่
    const isPointInSameZone = (point: Coordinate, zoneId: string): boolean => {
        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (zone.id === zoneId && isPointInPolygon(point, zone.coordinates)) {
                    return true;
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (zone.id === zoneId && isPointInPolygon(point, zone.coordinates)) {
                    return true;
                }
            }
        }

        return false;
    };

    // เก็บ connection ที่มีอยู่แล้วในแต่ละโซน เพื่อป้องกันการเชื่อมต่อซ้ำ
    const zoneConnections = new Map<string, Set<string>>(); // zoneId -> Set<subMainPipeId>

    for (const mainPipe of mainPipes) {
        if (!mainPipe.coordinates || mainPipe.coordinates.length < 2) {
            continue;
        }

        const mainEnd = mainPipe.coordinates[mainPipe.coordinates.length - 1];

        // ตรวจสอบโซนของจุดปลายท่อเมนก่อน (ไม่ใช่โซนของทั้งท่อ)
        const mainEndZone = findPipeZoneForPoint(mainEnd);
        const mainZone = findPipeZone(mainPipe, mainEnd); // ตรวจสอบโซนของท่อเมนโดยใช้จุดปลายท่อ

        // ถ้าไม่พบโซนของจุดปลายท่อเมน ให้ข้าม
        if (!mainEndZone) {
            continue;
        }

        for (const subMainPipe of subMainPipes) {
            if (!subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
                continue;
            }

            const subMainStart = subMainPipe.coordinates[0];

            // ตรวจสอบโซนของจุดเริ่มต้นท่อเมนรองก่อน (ไม่ใช่โซนของทั้งท่อ)
            const subMainStartZone = findPipeZoneForPoint(subMainStart);
            const subMainZone = findPipeZone(subMainPipe, subMainStart); // ตรวจสอบโซนของท่อเมนรองโดยใช้จุดเริ่มต้น

            // ข้อกำหนด 1: ท่อเมนห้ามไปเชื่อมกับท่อเมนรองของโซนอื่น
            // ต้องตรวจสอบว่าโซนของจุดปลายท่อเมนและโซนของจุดเริ่มต้นท่อเมนรองต้องตรงกัน
            if (!subMainStartZone || mainEndZone !== subMainStartZone) {
                continue;
            }

            // ตรวจสอบเพิ่มเติม: ตรวจสอบว่าจุดเชื่อมต่อ (mainEnd และ subMainStart) อยู่ในโซนเดียวกันจริงๆ
            // เพื่อป้องกันกรณีที่ท่ออยู่ใกล้ขอบโซน - ต้องตรวจสอบทั้งสองจุด
            if (!isPointInSameZone(mainEnd, mainEndZone)) {
                continue;
            }
            if (!isPointInSameZone(subMainStart, subMainStartZone)) {
                continue;
            }

            // ตรวจสอบอีกครั้ง: ต้องแน่ใจว่าทั้งสองจุดอยู่ในโซนเดียวกันจริงๆ
            if (mainEndZone !== subMainStartZone) {
                continue;
            }

            // ตรวจสอบว่าท่อเมนรองนี้เชื่อมต่อกับท่อเมนแล้วหรือยัง
            if (zoneConnections.has(mainEndZone)) {
                const connectedSubMains = zoneConnections.get(mainEndZone);
                if (connectedSubMains && connectedSubMains.has(subMainPipe.id)) {
                    // ท่อเมนรองนี้เชื่อมต่อแล้วในโซนนี้ ให้ข้าม
                    continue;
                }
            }

            // ข้อกำหนด 2: ในโซนเดียวท่อเมนรองต้องเชื่อมกับท่อเมนเพียงจุดเดียวเท่านั้น คือจุดของปลายท่อเมน
            const distance = calculateDistanceBetweenPoints(mainEnd, subMainStart);

            if (distance <= 1.0) {
                // ตรวจสอบอีกครั้งว่าจุดเชื่อมต่ออยู่ในโซนเดียวกันจริงๆ
                if (
                    !isPointInSameZone(mainEnd, mainEndZone) ||
                    !isPointInSameZone(subMainStart, subMainStartZone)
                ) {
                    continue;
                }
                if (mainEndZone !== subMainStartZone) {
                    continue;
                }

                const connectionPoint = {
                    lat: mainEnd.lat,
                    lng: mainEnd.lng,
                };

                connections.push({
                    mainPipeId: mainPipe.id,
                    subMainPipeId: subMainPipe.id,
                    connectionPoint: connectionPoint,
                });

                // บันทึกว่าท่อเมนรองนี้เชื่อมต่อแล้วในโซนนี้
                if (!zoneConnections.has(mainEndZone)) {
                    zoneConnections.set(mainEndZone, new Set());
                }
                zoneConnections.get(mainEndZone)?.add(subMainPipe.id);
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

    // ตรวจสอบ connections ที่มีอยู่แล้วเพื่อไม่ให้ซ้ำ
    const endToEndConnections = findEndToEndConnections(
        mainPipes,
        subMainPipes,
        zones,
        irrigationZones
    );
    const mainToSubMainConnections = findMainToSubMainConnections(
        mainPipes,
        subMainPipes,
        zones,
        irrigationZones
    );
    const mainToSubMainMidConnections = findMainToSubMainMidConnections(
        mainPipes,
        subMainPipes,
        20,
        zones,
        irrigationZones
    );

    // เก็บ connection ที่มีอยู่แล้ว: mainPipeId -> subMainPipeId
    // เพื่อให้ท่อเมน 1 เส้นเชื่อมกับท่อ submain 1 เส้นได้เพียงจุดเดียวเท่านั้น
    const mainPipeConnections = new Map<string, string>(); // mainPipeId -> subMainPipeId
    const subMainPipeConnections = new Map<string, string>(); // subMainPipeId -> mainPipeId

    endToEndConnections.forEach((conn) => {
        mainPipeConnections.set(conn.mainPipeId, conn.subMainPipeId);
        subMainPipeConnections.set(conn.subMainPipeId, conn.mainPipeId);
    });
    mainToSubMainConnections.forEach((conn) => {
        mainPipeConnections.set(conn.mainPipeId, conn.subMainPipeId);
        subMainPipeConnections.set(conn.subMainPipeId, conn.mainPipeId);
    });
    mainToSubMainMidConnections.forEach((conn) => {
        mainPipeConnections.set(conn.mainPipeId, conn.subMainPipeId);
        subMainPipeConnections.set(conn.subMainPipeId, conn.mainPipeId);
    });

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

            // ตรวจสอบว่าท่อเมนและท่อเมนรองนี้เชื่อมต่อแล้วหรือยัง
            // ถ้าเชื่อมต่อแล้ว (ที่ปลายท่อ main) ให้ข้าม intersection
            if (
                mainPipeConnections.has(mainPipe.id) &&
                mainPipeConnections.get(mainPipe.id) === subMainPipe.id
            ) {
                continue; // มี connection ที่ปลายท่อ main อยู่แล้ว ให้ข้าม intersection
            }
            if (
                subMainPipeConnections.has(subMainPipe.id) &&
                subMainPipeConnections.get(subMainPipe.id) === mainPipe.id
            ) {
                continue; // มี connection อยู่แล้ว ให้ข้าม intersection
            }

            // ไม่ต้องตรวจสอบ hasPotentialEndConnection ที่นี่แล้ว
            // เพราะการตรวจสอบ mainPipeConnections ด้านบนจะจัดการให้แล้ว
            // และการตรวจสอบเพิ่มเติมจะทำใน HorticulturePlannerPage.tsx

            for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                const subMainStart = subMainPipe.coordinates[i];
                const subMainEnd = subMainPipe.coordinates[i + 1];

                for (let j = 0; j < mainPipe.coordinates.length - 1; j++) {
                    const mainStart = mainPipe.coordinates[j];
                    const mainEnd = mainPipe.coordinates[j + 1];

                    // ข้ามถ้าเป็นจุดปลายท่อเมน (ให้ความสำคัญกับ connection ที่ปลายท่อ main ก่อน)
                    const isMainEnd = j === mainPipe.coordinates.length - 2;
                    if (isMainEnd) {
                        continue; // ข้าม intersection ที่ปลายท่อ main (ให้ใช้ connection แทน)
                    }

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

    const findPipeZone = (pipe: any, checkPoint?: Coordinate): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        // ตรวจสอบหลายจุดของท่อเพื่อหาว่าท่ออยู่ในโซนไหน
        // ตรวจสอบจุดเริ่มต้น, จุดสิ้นสุด, จุดกึ่งกลาง, และจุดที่ต้องการตรวจสอบ (ถ้ามี)
        const pointsToCheck: Coordinate[] = [
            pipe.coordinates[0], // จุดเริ่มต้น
            pipe.coordinates[pipe.coordinates.length - 1], // จุดสิ้นสุด
        ];

        // เพิ่มจุดกึ่งกลางถ้ามีหลายจุด
        if (pipe.coordinates.length > 2) {
            const midIndex = Math.floor(pipe.coordinates.length / 2);
            pointsToCheck.push(pipe.coordinates[midIndex]);
        }

        // เพิ่มจุดที่ต้องการตรวจสอบ (เช่น connection point)
        if (checkPoint) {
            pointsToCheck.push(checkPoint);
        }

        // ตรวจสอบว่าท่ออยู่ในโซนไหน โดยต้องตรวจสอบว่าจุดส่วนใหญ่อยู่ในโซนเดียวกัน
        const zoneCounts = new Map<string, number>();

        if (irrigationZones) {
            for (const zone of irrigationZones) {
                let count = 0;
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        count++;
                    }
                }
                if (count > 0) {
                    zoneCounts.set(zone.id, count);
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                let count = 0;
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        count++;
                    }
                }
                if (count > 0) {
                    const existingCount = zoneCounts.get(zone.id) || 0;
                    zoneCounts.set(zone.id, existingCount + count);
                }
            }
        }

        // หาโซนที่มีจุดมากที่สุด (ต้องมีอย่างน้อย 2 จุดหรือมากกว่า 50% ของจุดที่ตรวจสอบ)
        let maxCount = 0;
        let selectedZone: string | null = null;
        const minRequiredPoints = Math.max(2, Math.ceil(pointsToCheck.length * 0.5));

        for (const [zoneId, count] of zoneCounts.entries()) {
            if (count >= minRequiredPoints && count > maxCount) {
                maxCount = count;
                selectedZone = zoneId;
            }
        }

        return selectedZone;
    };

    // ฟังก์ชันตรวจสอบว่าจุดอยู่ในโซนเดียวกันหรือไม่
    const isPointInSameZone = (point: Coordinate, zoneId: string): boolean => {
        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (zone.id === zoneId && isPointInPolygon(point, zone.coordinates)) {
                    return true;
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (zone.id === zoneId && isPointInPolygon(point, zone.coordinates)) {
                    return true;
                }
            }
        }

        return false;
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

    // ข้อกำหนด 2: ในโซนเดียวท่อเมนรองต้องเชื่อมกับท่อเมนเพียงจุดเดียวเท่านั้น คือจุดของปลายท่อเมน
    // ดังนั้นต้องห้ามการเชื่อมต่อ submain-to-main ที่จุดกลาง (mid connections)
    // ตรวจสอบว่า sourcePipes เป็น submain และ targetPipes เป็น main หรือไม่
    // ถ้าใช่ ให้ return empty array ทันที

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

                const targetPipeEnd = targetPipe.coordinates[targetPipe.coordinates.length - 1];
                const targetZone = findPipeZone(targetPipe, targetPipeEnd);

                // ข้อกำหนด 1: ท่อเมนห้ามไปเชื่อมกับท่อเมนรองของโซนอื่น
                if (sourceZone && targetZone && sourceZone !== targetZone) {
                    continue;
                }

                // ตรวจสอบเพิ่มเติม: ตรวจสอบว่าจุดเชื่อมต่ออยู่ในโซนเดียวกันจริงๆ
                // เพื่อป้องกันกรณีที่ท่ออยู่ใกล้ขอบโซน
                if (sourceZone && targetZone && sourceZone === targetZone) {
                    if (
                        !isPointInSameZone(endpoint.point, sourceZone) ||
                        !isPointInSameZone(targetPipeEnd, sourceZone)
                    ) {
                        continue;
                    }
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

                // ข้อกำหนด 2: ห้ามการเชื่อมต่อ submain-to-main ที่จุดกลาง
                // ตรวจสอบว่า targetPipe เป็น main pipe และ sourcePipe เป็น submain pipe หรือไม่
                // โดยตรวจสอบจาก zone หรือ type ของ pipe
                // ถ้าเป็น submain-to-main connection ที่จุดกลาง ให้ข้าม
                // ใช้ targetPipeEnd ที่ประกาศไว้แล้วที่บรรทัด 1068
                const isTargetPipeEnd =
                    calculateDistanceBetweenPoints(endpoint.point, targetPipeEnd) <= 1.0;

                // ถ้าไม่ใช่การเชื่อมต่อที่ปลายท่อเมน (target pipe end) ให้ข้าม
                // เพราะข้อกำหนดระบุว่าต้องเชื่อมต่อที่ปลายท่อเมนเท่านั้น
                if (!isTargetPipeEnd) {
                    continue;
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

                        // ข้อกำหนด 2: ห้ามการเชื่อมต่อ submain-to-main ที่จุดกลาง
                        // ถ้าเป็น mid connection ให้ข้าม
                        if (isActualMidConnection) {
                            continue;
                        }

                        // อนุญาตเฉพาะ end-to-end connections
                        if (isEndToEndConnection) {
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
                        }
                    }
                }
            }
        }
    }

    return connections;
};

/**
 * หาจุดเชื่อมต่อปลายท่อเมนกับกลางท่อเมนรอง (main-to-submain-mid)
 * ปลายท่อเมนเชื่อมกับจุดกลางของ segment ท่อเมนรอง
 */
export const findMainToSubMainMidConnections = (
    mainPipes: any[],
    subMainPipes: any[],
    snapThreshold: number = 20,
    zones?: any[],
    irrigationZones?: any[]
): {
    mainPipeId: string;
    subMainPipeId: string;
    connectionPoint: Coordinate;
    subMainSegmentIndex: number;
}[] => {
    const connections: {
        mainPipeId: string;
        subMainPipeId: string;
        connectionPoint: Coordinate;
        subMainSegmentIndex: number;
    }[] = [];

    if (!mainPipes || !subMainPipes || mainPipes.length === 0 || subMainPipes.length === 0) {
        return connections;
    }

    const findPipeZone = (pipe: any, checkPoint?: Coordinate): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        const pointsToCheck: Coordinate[] = [
            pipe.coordinates[0],
            pipe.coordinates[pipe.coordinates.length - 1],
        ];

        if (pipe.coordinates.length > 2) {
            const midIndex = Math.floor(pipe.coordinates.length / 2);
            pointsToCheck.push(pipe.coordinates[midIndex]);
        }

        if (checkPoint) {
            pointsToCheck.push(checkPoint);
        }

        const zoneCounts = new Map<string, number>();

        if (irrigationZones) {
            for (const zone of irrigationZones) {
                let count = 0;
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        count++;
                    }
                }
                if (count > 0) {
                    zoneCounts.set(zone.id, count);
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                let count = 0;
                for (const point of pointsToCheck) {
                    if (isPointInPolygon(point, zone.coordinates)) {
                        count++;
                    }
                }
                if (count > 0) {
                    const existingCount = zoneCounts.get(zone.id) || 0;
                    zoneCounts.set(zone.id, existingCount + count);
                }
            }
        }

        let maxCount = 0;
        let selectedZone: string | null = null;
        const minRequiredPoints = Math.max(2, Math.ceil(pointsToCheck.length * 0.5));

        for (const [zoneId, count] of zoneCounts.entries()) {
            if (count >= minRequiredPoints && count > maxCount) {
                maxCount = count;
                selectedZone = zoneId;
            }
        }

        return selectedZone;
    };

    const findPipeZoneForPoint = (point: Coordinate): string | null => {
        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (isPointInPolygon(point, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (isPointInPolygon(point, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        return null;
    };

    const isPointInSameZone = (point: Coordinate, zoneId: string): boolean => {
        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (zone.id === zoneId && isPointInPolygon(point, zone.coordinates)) {
                    return true;
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (zone.id === zoneId && isPointInPolygon(point, zone.coordinates)) {
                    return true;
                }
            }
        }

        return false;
    };

    // ตรวจสอบ end-to-end connections เพื่อไม่ให้ซ้ำ
    const endToEndConnections = findEndToEndConnections(
        mainPipes,
        subMainPipes,
        zones,
        irrigationZones
    );
    const mainToSubMainConnections = findMainToSubMainConnections(
        mainPipes,
        subMainPipes,
        zones,
        irrigationZones
    );

    // เก็บ connection ที่มีอยู่แล้ว: mainPipeId -> subMainPipeId
    // เพื่อให้ท่อเมน 1 เส้นเชื่อมกับท่อ submain 1 เส้นได้เพียงจุดเดียวเท่านั้น
    const mainPipeConnections = new Map<string, string>(); // mainPipeId -> subMainPipeId
    const subMainPipeConnections = new Map<string, string>(); // subMainPipeId -> mainPipeId

    endToEndConnections.forEach((conn) => {
        mainPipeConnections.set(conn.mainPipeId, conn.subMainPipeId);
        subMainPipeConnections.set(conn.subMainPipeId, conn.mainPipeId);
    });
    mainToSubMainConnections.forEach((conn) => {
        mainPipeConnections.set(conn.mainPipeId, conn.subMainPipeId);
        subMainPipeConnections.set(conn.subMainPipeId, conn.mainPipeId);
    });

    // รวบรวม candidate connections ทั้งหมด (เรียงตามความสำคัญ: ปลายท่อ main ก่อน)
    // หมายเหตุ: จะรวบรวมทุก candidate ก่อน แล้วค่อยกรองในภายหลัง
    interface CandidateMidConnection {
        mainPipeId: string;
        subMainPipeId: string;
        connectionPoint: Coordinate;
        distance: number;
        subMainSegmentIndex: number;
        priority: number; // 1 = สูงสุด (ปลายท่อ main), 2 = ต่ำกว่า
    }

    const candidateMidConnections: CandidateMidConnection[] = [];

    for (const mainPipe of mainPipes) {
        if (!mainPipe.coordinates || mainPipe.coordinates.length < 2) {
            continue;
        }

        // หมายเหตุ: ไม่ต้องตรวจสอบว่าท่อเมนเชื่อมต่อแล้วหรือยัง
        // เพราะจะกรองในภายหลังตาม priority (ให้ความสำคัญกับจุดสีแดงก่อน)

        const mainEnd = mainPipe.coordinates[mainPipe.coordinates.length - 1];
        const mainEndZone = findPipeZoneForPoint(mainEnd);
        const mainZone = findPipeZone(mainPipe, mainEnd);

        for (const subMainPipe of subMainPipes) {
            if (!subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
                continue;
            }

            // หมายเหตุ: ไม่ต้องตรวจสอบว่าท่อเมนรองเชื่อมต่อแล้วหรือยัง
            // เพราะจะกรองในภายหลังตาม priority (ให้ความสำคัญกับจุดสีแดงก่อน)

            const subMainZone = findPipeZone(subMainPipe);

            // ต้องอยู่ในโซนเดียวกัน (แต่ถ้าไม่มี zone ก็ให้ผ่าน)
            if (mainEndZone && subMainZone && mainEndZone !== subMainZone) {
                continue;
            }

            // ตรวจสอบทุก segment ของท่อเมนรอง
            for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                const segmentStart = subMainPipe.coordinates[i];
                const segmentEnd = subMainPipe.coordinates[i + 1];

                const isSubMainStart = i === 0;
                const isSubMainEnd = i === subMainPipe.coordinates.length - 2;
                const isOnlySegment = subMainPipe.coordinates.length === 2; // ท่อมีแค่ 2 จุด (1 segment)

                // ข้ามถ้าเป็นจุดเริ่มต้นหรือจุดสิ้นสุดของท่อเมนรอง (ยกเว้นถ้าเป็น segment เดียว)
                if (!isOnlySegment && (isSubMainStart || isSubMainEnd)) {
                    continue;
                }

                const closestPoint = findClosestPointOnLineSegment(
                    mainEnd,
                    segmentStart,
                    segmentEnd
                );
                const distance = calculateDistanceBetweenPoints(mainEnd, closestPoint);

                if (distance <= snapThreshold) {
                    // ตรวจสอบว่าจุดเชื่อมต่ออยู่ใน segment จริงๆ (ไม่ใช่ที่ปลาย segment)
                    const distanceFromStart = calculateDistanceBetweenPoints(
                        closestPoint,
                        segmentStart
                    );
                    const distanceFromEnd = calculateDistanceBetweenPoints(
                        closestPoint,
                        segmentEnd
                    );

                    // ถ้าเป็น segment เดียว ให้ใช้ threshold ที่น้อยกว่า (0.3 เมตร)
                    // ถ้าไม่ใช่ ให้ใช้ threshold 0.5 เมตร
                    const minDistanceFromEnds = isOnlySegment ? 0.3 : 0.5;
                    if (
                        distanceFromStart < minDistanceFromEnds ||
                        distanceFromEnd < minDistanceFromEnds
                    ) {
                        continue;
                    }

                    // ตรวจสอบ zone (ถ้ามี zone ทั้งสอง)
                    // ถ้ามี zone ทั้งสอง ต้องอยู่ใน zone เดียวกัน
                    if (subMainZone && mainEndZone) {
                        if (subMainZone !== mainEndZone) {
                            continue;
                        }
                        if (!isPointInSameZone(closestPoint, subMainZone)) {
                            continue;
                        }
                        if (!isPointInSameZone(mainEnd, mainEndZone)) {
                            continue;
                        }
                    }
                    // ถ้ามี zone แค่ตัวเดียว ให้ตรวจสอบว่าจุดนั้นอยู่ใน zone หรือไม่
                    else if (subMainZone && !isPointInSameZone(closestPoint, subMainZone)) {
                        continue;
                    } else if (mainEndZone && !isPointInSameZone(mainEnd, mainEndZone)) {
                        continue;
                    }

                    candidateMidConnections.push({
                        mainPipeId: mainPipe.id,
                        subMainPipeId: subMainPipe.id,
                        connectionPoint: {
                            lat: parseFloat(closestPoint.lat.toFixed(8)),
                            lng: parseFloat(closestPoint.lng.toFixed(8)),
                        },
                        distance: distance,
                        subMainSegmentIndex: i,
                        priority: 1, // สูงสุด - ปลายท่อ main
                    });
                }
            }
        }
    }

    // เรียงตาม priority (1 = สูงสุด) แล้วตาม distance (น้อยกว่า = ดีกว่า)
    candidateMidConnections.sort((a, b) => {
        if (a.priority !== b.priority) {
            return a.priority - b.priority; // priority ต่ำกว่า = สูงกว่า
        }
        return a.distance - b.distance; // distance น้อยกว่า = ดีกว่า
    });

    // เลือก connection ที่ดีที่สุด โดยให้ท่อเมน 1 เส้นเชื่อมกับท่อ submain 1 เส้นได้เพียงจุดเดียว
    // หมายเหตุ: จะกรองในภายหลังตาม priority (ให้ความสำคัญกับจุดสีแดงก่อน)
    // ดังนั้นจะส่งกลับทุก candidate ที่พบ เพื่อให้สามารถกรองตาม priority ในภายหลัง
    for (const candidate of candidateMidConnections) {
        connections.push({
            mainPipeId: candidate.mainPipeId,
            subMainPipeId: candidate.subMainPipeId,
            connectionPoint: candidate.connectionPoint,
            subMainSegmentIndex: candidate.subMainSegmentIndex,
        });
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
    zoneId?: string;
}

export interface SubMainPipe {
    id: string;
    coordinates: Coordinate[];
    zoneId?: string;
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
        
        // Calculate adaptive tolerance based on plant spacing
        // Default: 0.000005 degrees ≈ 0.55 meters, but scale based on actual plant spacing
        let tolerance = 0.000005;
        
        if (plants.length >= 2) {
            // Sample some plant pairs to estimate row spacing
            const sampleSize = Math.min(10, plants.length);
            const latDiffs: number[] = [];
            
            // Sort by lat to find consecutive plants
            const sortedByLat = [...plants].sort((a, b) => a.position.lat - b.position.lat);
            
            for (let i = 1; i < sampleSize && i < sortedByLat.length; i++) {
                const diff = Math.abs(sortedByLat[i].position.lat - sortedByLat[i - 1].position.lat);
                if (diff > 0.0000001) { // Ignore nearly identical points
                    latDiffs.push(diff);
                }
            }
            
            if (latDiffs.length > 0) {
                // Use the minimum difference as row spacing indicator
                const minDiff = Math.min(...latDiffs);
                // Tolerance should be about 15-20% of the minimum row spacing
                // but at least the default value and at most 0.00005 (5.5 meters)
                tolerance = Math.min(0.00005, Math.max(0.000005, minDiff * 0.2));
            }
        }

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
    
    // Calculate adaptive tolerance based on plant spacing
    // Default: 0.000005 degrees ≈ 0.55 meters, but scale based on actual plant spacing
    let tolerance = 0.000005;
    
    if (plants.length >= 2) {
        // Sample some plant pairs to estimate column spacing
        const sampleSize = Math.min(10, plants.length);
        const lngDiffs: number[] = [];
        
        // Sort by lng to find consecutive plants
        const sortedByLng = [...plants].sort((a, b) => a.position.lng - b.position.lng);
        
        for (let i = 1; i < sampleSize && i < sortedByLng.length; i++) {
            const diff = Math.abs(sortedByLng[i].position.lng - sortedByLng[i - 1].position.lng);
            if (diff > 0.0000001) { // Ignore nearly identical points
                lngDiffs.push(diff);
            }
        }
        
        if (lngDiffs.length > 0) {
            // Use the minimum difference as column spacing indicator
            const minDiff = Math.min(...lngDiffs);
            // Tolerance should be about 15-20% of the minimum column spacing
            // but at least the default value and at most 0.00005 (5.5 meters)
            tolerance = Math.min(0.00005, Math.max(0.000005, minDiff * 0.2));
        }
    }

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

    const plantWithRotation = plants.find(
        (plant) => plant.rotationAngle !== undefined && plant.rotationAngle !== null
    );
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
    } else if (avgSpacing <= 15.0) {
        adaptiveThreshold = Math.min(avgSpacing * 0.5, baseThreshold * 0.8);
    } else {
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
    snapThreshold: number = 20,
    existingLateralPipes: any[] = []
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
        const adaptiveThreshold = calculateAdaptiveSnapThreshold(
            snapThreshold,
            plants,
            pipeDistance
        );

        const direction = getDragOrientation(startPoint, rawEndPoint, plants);

        if (placementMode === 'over_plants') {
            return computeOverPlantsMode(
                startPoint,
                rawEndPoint,
                plants,
                adaptiveThreshold,
                direction
            );
        } else {
            return computeBetweenPlantsMode(
                startPoint,
                rawEndPoint,
                plants,
                adaptiveThreshold,
                direction,
                existingLateralPipes
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
    snapThreshold: number = 20,
    existingLateralPipes: any[] = []
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
            direction,
            existingLateralPipes
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
    direction: 'rows' | 'columns',
    existingLateralPipes: any[] = []
): { alignedEnd: Coordinate; selectedPlants: PlantLocation[]; snappedStart: Coordinate } => {
    const rows = groupPlantsByRows(plants);
    const cols = groupPlantsByColumns(plants);

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
            closestToStart.distance <= adjustedSnapThreshold * 1.5 &&
            distanceBetweenGroupsCalc >= minGroupDistance * 0.5 &&
            distanceBetweenGroupsCalc <= maxGroupDistance * 1.5;

        let centerLineStart: Coordinate;
        let centerLineEnd: Coordinate;

        const rotationInfo = hasRotation(plants);

        if (rotationInfo.hasRotation) {
            // For rotated plants, use transformed coordinates to find the extremes
            // Sort by transformed coordinates to find true start/end of each row
            const transformPos = (pos: Coordinate): Coordinate => 
                transformToRotatedCoordinate(pos, rotationInfo.center, rotationInfo.rotationAngle);
            
            if (groupType === 'between_rows') {
                // Sort by transformed lng to find left-most and right-most plants
                const sorted1 = [...group1].sort((a, b) => 
                    transformPos(a.position).lng - transformPos(b.position).lng
                );
                const sorted2 = [...group2].sort((a, b) => 
                    transformPos(a.position).lng - transformPos(b.position).lng
                );

                const start1 = sorted1[0].position;
                const end1 = sorted1[sorted1.length - 1].position;
                const start2 = sorted2[0].position;
                const end2 = sorted2[sorted2.length - 1].position;

                centerLineStart = {
                    lat: (start1.lat + start2.lat) / 2,
                    lng: (start1.lng + start2.lng) / 2,
                };
                centerLineEnd = {
                    lat: (end1.lat + end2.lat) / 2,
                    lng: (end1.lng + end2.lng) / 2,
                };
            } else {
                // Sort by transformed lat to find top-most and bottom-most plants
                const sorted1 = [...group1].sort((a, b) => 
                    transformPos(a.position).lat - transformPos(b.position).lat
                );
                const sorted2 = [...group2].sort((a, b) => 
                    transformPos(a.position).lat - transformPos(b.position).lat
                );

                const start1 = sorted1[0].position;
                const end1 = sorted1[sorted1.length - 1].position;
                const start2 = sorted2[0].position;
                const end2 = sorted2[sorted2.length - 1].position;

                centerLineStart = {
                    lat: (start1.lat + start2.lat) / 2,
                    lng: (start1.lng + start2.lng) / 2,
                };
                centerLineEnd = {
                    lat: (end1.lat + end2.lat) / 2,
                    lng: (end1.lng + end2.lng) / 2,
                };
            }
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
            distanceBetweenGroupsCalc >= 1.0 && distanceBetweenGroupsCalc <= 25.0;

        const isBetterChoice =
            !bestAlignment ||
            distanceToCenterLine < bestAlignment.firstPlantDistance * 0.8 ||
            (distanceToCenterLine <= bestAlignment.firstPlantDistance * 1.2 && isOptimalDistance);

        const isCloseToCenterLine = distanceToCenterLine <= adjustedSnapThreshold * 1.2;

        const isGoodPair = isSuitablePair && isBetterChoice && isCloseToCenterLine;

        if (isGoodPair) {
            let fullCenterLine: { start: Coordinate; end: Coordinate } | null = null;

            // Use the same approach as computeOverPlantsMode for better bidirectional support
            // Calculate center point between the two rows/columns
            const allPlantsInPair = [...group1, ...group2];
            const centerPoint = {
                lat: allPlantsInPair.reduce((sum, p) => sum + p.position.lat, 0) / allPlantsInPair.length,
                lng: allPlantsInPair.reduce((sum, p) => sum + p.position.lng, 0) / allPlantsInPair.length,
            };

            // Get direction from plants (same as computeOverPlantsMode)
            // This ensures proper handling of rotated plants
            let lineDirection: { lat: number; lng: number };
            if (direction === 'rows') {
                lineDirection = directionFromPlantsLine(allPlantsInPair);
            } else {
                lineDirection = directionFromPlantsColumn(allPlantsInPair);
            }

            // Create a long centerLine from center point (same approach as computeOverPlantsMode)
            // Use 100 meters in both directions to support bidirectional drawing
            const lineLength = 100;
            fullCenterLine = {
                start: {
                    lat: centerPoint.lat - (lineDirection.lat * lineLength) / 111320,
                    lng:
                        centerPoint.lng -
                        (lineDirection.lng * lineLength) /
                            (111320 * Math.cos((centerPoint.lat * Math.PI) / 180)),
                },
                end: {
                    lat: centerPoint.lat + (lineDirection.lat * lineLength) / 111320,
                    lng:
                        centerPoint.lng +
                        (lineDirection.lng * lineLength) /
                            (111320 * Math.cos((centerPoint.lat * Math.PI) / 180)),
                },
            };

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
        const allPlants = [...plants];
        const directPlants = allPlants.filter((plant) => {
            const closestPoint = findClosestPointOnLineSegment(
                plant.position,
                initialStartPoint,
                rawEndPoint
            );
            const distance = calculateDistanceBetweenPoints(plant.position, closestPoint);

            return distance <= 25.0;
        });

        if (directPlants.length === 0 && allPlants.length > 0) {
            const closestPlant = allPlants.reduce((closest, plant) => {
                const distance = calculateDistanceBetweenPoints(plant.position, initialStartPoint);
                const closestDistance = calculateDistanceBetweenPoints(
                    closest.position,
                    initialStartPoint
                );
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

    // Create a very long centerLine that supports drawing in ALL directions
    // Calculate the direction vector from the original centerLine
    const centerLineVec = {
        lat: bestAlignment.centerLine.end.lat - bestAlignment.centerLine.start.lat,
        lng: bestAlignment.centerLine.end.lng - bestAlignment.centerLine.start.lng,
    };
    const centerLineLength = Math.sqrt(
        centerLineVec.lat * centerLineVec.lat + centerLineVec.lng * centerLineVec.lng
    );
    
    // Calculate center point of the original centerLine (middle of the two rows)
    const centerPoint = {
        lat: (bestAlignment.centerLine.start.lat + bestAlignment.centerLine.end.lat) / 2,
        lng: (bestAlignment.centerLine.start.lng + bestAlignment.centerLine.end.lng) / 2,
    };
    
    // Normalize the direction vector
    let normalizedVec = { lat: 0, lng: 0 };
    if (centerLineLength > 0.0000001) { // Avoid division by zero
        normalizedVec = {
            lat: centerLineVec.lat / centerLineLength,
            lng: centerLineVec.lng / centerLineLength,
        };
    } else {
        // Fallback: use a default direction if centerLine is too short
        normalizedVec = { lat: 1, lng: 0 };
    }
    
    // Create a VERY long centerLine (10 kilometers in both directions)
    // This ensures the guide line works in ALL directions, not just forward/backward
    const extensionLength = 10000 / 111320; // 10 kilometers in degrees
    
    // Create extended centerLine centered on the center point, extending in both directions
    const extendedCenterLineStart = {
        lat: centerPoint.lat - normalizedVec.lat * extensionLength,
        lng: centerPoint.lng - normalizedVec.lng * extensionLength,
    };
    const extendedCenterLineEnd = {
        lat: centerPoint.lat + normalizedVec.lat * extensionLength,
        lng: centerPoint.lng + normalizedVec.lng * extensionLength,
    };

    // For "between plants" mode: Allow COMPLETE FREE drawing - 100% mouse position
    // NO snapping, NO alignment, NO interference - use raw mouse position directly
    // User has full control - pipe follows mouse exactly as they draw
    
    const snappedStart = initialStartPoint;
    const alignedEnd = rawEndPoint; // Use rawEndPoint 100% - no modifications

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

    // Helper function to project point onto infinite line (for plant selection only)
    const projectPointOntoInfiniteLine = (
        point: Coordinate,
        linePoint: Coordinate,
        lineDirection: { lat: number; lng: number }
    ): Coordinate => {
        const dx = point.lat - linePoint.lat;
        const dy = point.lng - linePoint.lng;
        const dot = dx * lineDirection.lat + dy * lineDirection.lng;
        return {
            lat: linePoint.lat + lineDirection.lat * dot,
            lng: linePoint.lng + lineDirection.lng * dot,
        };
    };

    const selectedPlants = allPlantsInPair.filter((plant) => {
        // Use infinite line projection for plant selection
        // This helps find plants near the drawn line (even if line is not aligned)
        const plantProjected = projectPointOntoInfiniteLine(
            plant.position,
            centerPoint,
            normalizedVec
        );

        const distanceToStart = calculateDistanceBetweenPoints(plantProjected, snappedStart);
        const distanceToEnd = calculateDistanceBetweenPoints(plantProjected, alignedEnd);
        const lateralLength = calculateDistanceBetweenPoints(snappedStart, alignedEnd);

        // Increase pipe length tolerance significantly to capture more plants
        // Especially important for long pipes where plants might be slightly off
        const pipeLengthTolerance = Math.max(10.0, avgPlantSpacing * 1.2); // Increased from 5.0, 0.8

        const isWithinPipeLength =
            distanceToStart + distanceToEnd <= lateralLength + pipeLengthTolerance;

        // Check if plant is within the pipe length range
        // Use more lenient tolerance, especially for rotated plants
        let isInRange = false;

        if (rotationInfo.hasRotation) {
            // For rotated plants, use distance-based check with more generous tolerance
            // Increase tolerance significantly for long pipes
            const tolerance = Math.max(10.0, lateralLength * 0.15); // Increased from 5.0, 0.1
            isInRange = distanceToStart + distanceToEnd <= lateralLength + tolerance;
        } else {
            // For non-rotated plants, use coordinate-based check with tolerance
            if (bestAlignment.type === 'between_rows') {
                const minLng = Math.min(snappedStart.lng, alignedEnd.lng);
                const maxLng = Math.max(snappedStart.lng, alignedEnd.lng);
                // Increase tolerance to capture more plants
                const lngTolerance = Math.max(0.000005, avgPlantSpacing * 0.00001); // Increased
                isInRange =
                    plantProjected.lng >= minLng - lngTolerance &&
                    plantProjected.lng <= maxLng + lngTolerance;
            } else {
                const minLat = Math.min(snappedStart.lat, alignedEnd.lat);
                const maxLat = Math.max(snappedStart.lat, alignedEnd.lat);
                // Increase tolerance to capture more plants
                const latTolerance = Math.max(0.000005, avgPlantSpacing * 0.00001); // Increased
                isInRange =
                    plantProjected.lat >= minLat - latTolerance &&
                    plantProjected.lat <= maxLat + latTolerance;
            }
        }

        // Check if plant is between the two rows/columns
        // Use rotation-aware calculation when plants are rotated
        let isBetweenPlantPairs = false;
        if (rotationInfo.hasRotation) {
            // For rotated plants, use transformed coordinates
            const transformPos = (pos: Coordinate): Coordinate =>
                transformToRotatedCoordinate(pos, rotationInfo.center, rotationInfo.rotationAngle);
            
            if (bestAlignment.type === 'between_rows') {
                // Check in transformed coordinate system (lat direction after rotation)
                const row1Transformed = bestAlignment.row1.map(p => transformPos(p.position));
                const row2Transformed = bestAlignment.row2.map(p => transformPos(p.position));
                
                const row1LatAvg = row1Transformed.reduce((sum, p) => sum + p.lat, 0) / row1Transformed.length;
                const row2LatAvg = row2Transformed.reduce((sum, p) => sum + p.lat, 0) / row2Transformed.length;
                const minRowLat = Math.min(row1LatAvg, row2LatAvg);
                const maxRowLat = Math.max(row1LatAvg, row2LatAvg);
                
                const plantTransformed = transformPos(plant.position);
                // Use more generous tolerance (50% of row spacing) to capture more plants
                const rowSpacing = Math.abs(row2LatAvg - row1LatAvg);
                const tolerance = Math.max(0.00002, rowSpacing * 0.5); // Increased from 0.2
                isBetweenPlantPairs =
                    plantTransformed.lat >= minRowLat - tolerance &&
                    plantTransformed.lat <= maxRowLat + tolerance;
            } else {
                // Check in transformed coordinate system (lng direction after rotation)
                const row1Transformed = bestAlignment.row1.map(p => transformPos(p.position));
                const row2Transformed = bestAlignment.row2.map(p => transformPos(p.position));
                
                const col1LngAvg = row1Transformed.reduce((sum, p) => sum + p.lng, 0) / row1Transformed.length;
                const col2LngAvg = row2Transformed.reduce((sum, p) => sum + p.lng, 0) / row2Transformed.length;
                const minColLng = Math.min(col1LngAvg, col2LngAvg);
                const maxColLng = Math.max(col1LngAvg, col2LngAvg);
                
                const plantTransformed = transformPos(plant.position);
                // Use more generous tolerance (50% of column spacing) to capture more plants
                const colSpacing = Math.abs(col2LngAvg - col1LngAvg);
                const tolerance = Math.max(0.00002, colSpacing * 0.5); // Increased from 0.2
                isBetweenPlantPairs =
                    plantTransformed.lng >= minColLng - tolerance &&
                    plantTransformed.lng <= maxColLng + tolerance;
            }
        } else {
            // Non-rotated case: use original logic
            if (bestAlignment.type === 'between_rows') {
                const row1LatAvg =
                    bestAlignment.row1.reduce((sum, p) => sum + p.position.lat, 0) /
                    bestAlignment.row1.length;
                const row2LatAvg =
                    bestAlignment.row2.reduce((sum, p) => sum + p.position.lat, 0) /
                    bestAlignment.row2.length;
                const minRowLat = Math.min(row1LatAvg, row2LatAvg);
                const maxRowLat = Math.max(row1LatAvg, row2LatAvg);
                // Add tolerance for non-rotated case too (increased for better coverage)
                const rowSpacing = Math.abs(row2LatAvg - row1LatAvg);
                const tolerance = Math.max(0.00002, rowSpacing * 0.4); // Increased from 0.15
                isBetweenPlantPairs =
                    plant.position.lat >= minRowLat - tolerance &&
                    plant.position.lat <= maxRowLat + tolerance;
            } else {
                const col1LngAvg =
                    bestAlignment.row1.reduce((sum, p) => sum + p.position.lng, 0) /
                    bestAlignment.row1.length;
                const col2LngAvg =
                    bestAlignment.row2.reduce((sum, p) => sum + p.position.lng, 0) /
                    bestAlignment.row2.length;
                const minColLng = Math.min(col1LngAvg, col2LngAvg);
                const maxColLng = Math.max(col1LngAvg, col2LngAvg);
                // Add tolerance for non-rotated case too (increased for better coverage)
                const colSpacing = Math.abs(col2LngAvg - col1LngAvg);
                const tolerance = Math.max(0.00002, colSpacing * 0.4); // Increased from 0.15
                isBetweenPlantPairs =
                    plant.position.lng >= minColLng - tolerance &&
                    plant.position.lng <= maxColLng + tolerance;
            }
        }

        const distanceToLine = calculateDistanceBetweenPoints(plant.position, plantProjected);

        // Increase distance tolerance significantly to capture more plants
        // This is especially important for rotated plants where alignment may not be perfect
        let distanceTolerance;
        if (avgPlantSpacing < 3.0) {
            distanceTolerance = Math.max(4.0, avgPlantSpacing * 0.8); // Increased from 2.0, 0.5
        } else if (avgPlantSpacing < 8.0) {
            distanceTolerance = Math.max(5.0, avgPlantSpacing * 0.7); // Increased from 3.0, 0.45
        } else {
            distanceTolerance = Math.max(6.0, Math.min(10.0, avgPlantSpacing * 0.7)); // Increased from 4.0-6.0, 0.5
        }
        
        // Primary check: all conditions must be met
        const primaryResult =
            isInRange &&
            isWithinPipeLength &&
            distanceToLine <= distanceTolerance &&
            isBetweenPlantPairs;

        // Fallback check: if plant is close to centerLine and within pipe length, include it
        // This ensures we don't miss plants that are slightly off due to rotation or spacing variations
        // Use more lenient criteria for fallback to capture more plants
        const fallbackDistanceTolerance = distanceTolerance * 2.0; // Much more lenient
        const fallbackResult =
            isInRange &&
            isWithinPipeLength &&
            distanceToLine <= fallbackDistanceTolerance; // Don't require isBetweenPlantPairs for fallback

        // Include plant if it meets primary criteria OR fallback criteria
        // This ensures we capture all plants that are reasonably close to the pipe
        return primaryResult || fallbackResult;
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
                fallbackTolerance = 2.5;
            } else if (avgPlantSpacing < 8.0) {
                fallbackTolerance = 4.0;
            } else {
                fallbackTolerance = 6.0;
            }
            return distance <= fallbackTolerance;
        });

        if (fallbackPlants.length > 0) {
            return { alignedEnd, selectedPlants: fallbackPlants, snappedStart };
        }
    }

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

            // DEBUG: Check waypoint proximity for each plant
            // Only check waypoints that are NOT part of the current segment
            for (let j = 0; j < waypoints.length; j++) {
                const waypoint = waypoints[j];
                const distanceToWaypoint = calculateDistanceBetweenPoints(plant.position, waypoint);

                if (distanceToWaypoint <= waypointProximityThreshold) {
                    // FIXED: Only exclude plant if it's close to a waypoint that's NOT part of current segment
                    // Current segment i uses waypoints at indices i and i+1
                    // For segment 0: waypoints 0,1
                    // For segment 1: waypoints 1,2
                    // For segment 2: waypoints 2,3
                    // etc.
                    const isWaypointInCurrentSegment = j === i || j === i + 1;

                    // SPECIAL CASE: For the first segment (i=0), waypoint 0 is the start point
                    // and should not exclude plants even if they are very close to it
                    // Also, for any segment, if the waypoint is the start of that segment, don't exclude
                    const isFirstSegmentStartPoint = i === 0 && j === 0;
                    const isCurrentSegmentStartPoint = j === i;

                    // Additional check: Don't exclude plants near waypoint 0 if it's the start of any segment
                    // This handles the case where waypoint 0 is used as start point for multiple segments
                    const isWaypoint0StartPoint = j === 0;

                    // Also don't exclude plants near waypoint 1 if it's the start of any segment
                    // This handles the case where waypoint 1 is used as start point for multiple segments
                    const isWaypoint1StartPoint = j === 1;

                    if (
                        !isWaypointInCurrentSegment &&
                        !isFirstSegmentStartPoint &&
                        !isCurrentSegmentStartPoint &&
                        !isWaypoint0StartPoint &&
                        !isWaypoint1StartPoint
                    ) {
                        shouldAddPlant = false;
                        break;
                    } else {
                        // Plant is close to current segment's waypoint - this is OK
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
    direction: 'rows' | 'columns',
    existingLateralPipes: any[] = []
): { alignedEnd: Coordinate; selectedPlants: PlantLocation[]; snappedStart: Coordinate } => {
    return computeBetweenPlantsMode(
        snappedStartPoint,
        rawEndPoint,
        plants,
        snapThreshold,
        direction,
        existingLateralPipes
    );
};

/**
 * Calculate plant rows for a zone, considering rotation angle
 * Returns rows that are perpendicular to the sub main pipe direction
 */
export const calculatePlantRowsForZone = (
    plants: PlantLocation[],
    subMainPipes: SubMainPipe[]
): PlantLocation[][] => {
    if (plants.length === 0 || subMainPipes.length === 0) {
        return [];
    }

    // Get rotation info
    const rotationInfo = hasRotation(plants);

    // Group plants by rows and columns
    const rowGroups = groupPlantsByRows(plants);
    const columnGroups = groupPlantsByColumns(plants);

    // Calculate average direction of sub main pipes
    let totalDx = 0;
    let totalDy = 0;
    let pipeCount = 0;

    for (const pipe of subMainPipes) {
        if (pipe.coordinates && pipe.coordinates.length >= 2) {
            const start = pipe.coordinates[0];
            const end = pipe.coordinates[pipe.coordinates.length - 1];
            
            let dx, dy;
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
                dx = transformedEnd.lng - transformedStart.lng;
                dy = transformedEnd.lat - transformedStart.lat;
            } else {
                dx = end.lng - start.lng;
                dy = end.lat - start.lat;
            }

            totalDx += dx;
            totalDy += dy;
            pipeCount++;
        }
    }

    if (pipeCount === 0) {
        return rowGroups.length > 0 ? rowGroups : columnGroups;
    }

    // Average direction vector
    const avgDx = totalDx / pipeCount;
    const avgDy = totalDy / pipeCount;

    // Normalize
    const magnitude = Math.sqrt(avgDx * avgDx + avgDy * avgDy);
    if (magnitude === 0) {
        return rowGroups.length > 0 ? rowGroups : columnGroups;
    }

    const normDx = avgDx / magnitude;
    const normDy = avgDy / magnitude;

    // Calculate angle with horizontal (lng axis)
    const pipeAngle = Math.atan2(normDy, normDx);
    const pipeAngleDeg = (pipeAngle * 180) / Math.PI;

    // Determine if pipe is more horizontal or vertical
    // Rows are horizontal (along lng), columns are vertical (along lat)
    // We want plant rows perpendicular to pipe direction
    
    // If pipe is mostly horizontal (-45° to 45° or 135° to -135°), 
    // use column groups (vertical plant rows)
    // Otherwise use row groups (horizontal plant rows)
    const absPipeAngle = Math.abs(pipeAngleDeg);
    const useColumnGroups = absPipeAngle < 45 || absPipeAngle > 135;

    return useColumnGroups ? columnGroups : rowGroups;
};

/**
 * Find closest sub main pipe for a plant row
 */
const findClosestSubMainPipeForRow = (
    plantRow: PlantLocation[],
    subMainPipes: SubMainPipe[]
): SubMainPipe | null => {
    if (plantRow.length === 0 || subMainPipes.length === 0) {
        return null;
    }

    // Use first plant in row as reference point
    const referencePoint = plantRow[0].position;

    let closestPipe: SubMainPipe | null = null;
    let minDistance = Infinity;

    for (const pipe of subMainPipes) {
        if (!pipe.coordinates || pipe.coordinates.length < 2) {
            continue;
        }

        // Calculate minimum distance from reference point to pipe
        for (let i = 0; i < pipe.coordinates.length - 1; i++) {
            const segmentStart = pipe.coordinates[i];
            const segmentEnd = pipe.coordinates[i + 1];

            const pointOnSegment = findClosestPointOnLineSegment(
                referencePoint,
                segmentStart,
                segmentEnd
            );

            const distance = calculateDistanceBetweenPoints(referencePoint, pointOnSegment);

            if (distance < minDistance) {
                minDistance = distance;
                closestPipe = pipe;
            }
        }
    }

    return closestPipe;
};

/**
 * Split plant row if it crosses sub-main pipe (for Connect Mode)
 * Returns array of sub-rows, one for each side of the sub-main pipe
 */
const splitRowBySubMainPipe = (
    plantRow: PlantLocation[],
    subMainPipe: SubMainPipe
): PlantLocation[][] => {
    if (plantRow.length < 2 || !subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
        return [plantRow];
    }

    // Check if the row crosses the sub-main pipe
    const firstPlant = plantRow[0].position;
    const lastPlant = plantRow[plantRow.length - 1].position;

    // Find if there's an intersection
    let hasIntersection = false;
    for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
        const segmentStart = subMainPipe.coordinates[i];
        const segmentEnd = subMainPipe.coordinates[i + 1];

        const intersection = findLineIntersection(
            firstPlant,
            lastPlant,
            segmentStart,
            segmentEnd
        );

        if (intersection) {
            hasIntersection = true;
            break;
        }
    }

    // If no intersection, return the whole row
    if (!hasIntersection) {
        return [plantRow];
    }

    // Split plants into two groups based on which side of sub-main pipe they're on
    const side1: PlantLocation[] = [];
    const side2: PlantLocation[] = [];

    // Calculate sub-main pipe direction vector
    const pipeStart = subMainPipe.coordinates[0];
    const pipeEnd = subMainPipe.coordinates[subMainPipe.coordinates.length - 1];
    const pipeDx = pipeEnd.lng - pipeStart.lng;
    const pipeDy = pipeEnd.lat - pipeStart.lat;

    for (const plant of plantRow) {
        // Use cross product to determine which side of the line the plant is on
        const dx = plant.position.lng - pipeStart.lng;
        const dy = plant.position.lat - pipeStart.lat;
        const crossProduct = dx * pipeDy - dy * pipeDx;

        if (crossProduct >= 0) {
            side1.push(plant);
        } else {
            side2.push(plant);
        }
    }

    // Return non-empty sides
    const result: PlantLocation[][] = [];
    if (side1.length >= 2) result.push(side1);
    if (side2.length >= 2) result.push(side2);

    return result.length > 0 ? result : [plantRow];
};

/**
 * Create lateral pipe from plant row - Connect mode (starts from sub main)
 */
const createConnectModeLateralPipe = (
    plantRow: PlantLocation[],
    subMainPipe: SubMainPipe,
    zoneId?: string
): {
    coordinates: Coordinate[];
    plants: PlantLocation[];
    connectionPoint: Coordinate;
} | null => {
    if (plantRow.length === 0 || !subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
        return null;
    }

    // Find closest point on sub main pipe to first plant
    const firstPlant = plantRow[0];
    const lastPlant = plantRow[plantRow.length - 1];

    // Determine which end of the row is closer to the sub main pipe
    let closestToSubMain: Coordinate | null = null;
    let minDistToSubMain = Infinity;
    let connectionPoint: Coordinate | null = null;

    for (const plant of [firstPlant, lastPlant]) {
        for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
            const segmentStart = subMainPipe.coordinates[i];
            const segmentEnd = subMainPipe.coordinates[i + 1];

            const pointOnPipe = findClosestPointOnLineSegment(
                plant.position,
                segmentStart,
                segmentEnd
            );

            const dist = calculateDistanceBetweenPoints(plant.position, pointOnPipe);

            if (dist < minDistToSubMain) {
                minDistToSubMain = dist;
                closestToSubMain = plant.position;
                connectionPoint = pointOnPipe;
            }
        }
    }

    if (!connectionPoint || !closestToSubMain) {
        return null;
    }

    // Sort plants from connection point to far end
    const sortedPlants = [...plantRow].sort((a, b) => {
        const distA = calculateDistanceBetweenPoints(a.position, connectionPoint!);
        const distB = calculateDistanceBetweenPoints(b.position, connectionPoint!);
        return distA - distB;
    });

    // Create coordinates: straight line from connection point through the plant row
    // Start from connection point -> first plant -> last plant (straight line)
    const coordinates: Coordinate[] = [
        connectionPoint,
        sortedPlants[0].position,
        sortedPlants[sortedPlants.length - 1].position
    ];

    return {
        coordinates,
        plants: sortedPlants,
        connectionPoint,
    };
};

/**
 * Create lateral pipe from plant row - Intersect mode (crosses sub main)
 */
const createIntersectModeLateralPipe = (
    plantRow: PlantLocation[],
    subMainPipe: SubMainPipe,
    zoneId?: string
): {
    coordinates: Coordinate[];
    plants: PlantLocation[];
    intersectionPoint: Coordinate | null;
} | null => {
    if (plantRow.length < 2 || !subMainPipe.coordinates || subMainPipe.coordinates.length < 2) {
        return null;
    }

    // Sort plants to determine the row direction
    const sortedPlants = [...plantRow].sort((a, b) => {
        // Sort by distance to form a line
        const dx = a.position.lng - b.position.lng;
        const dy = a.position.lat - b.position.lat;
        return dx !== 0 ? dx : dy;
    });

    // Create a line through the plant row (first to last plant)
    const firstPlant = sortedPlants[0].position;
    const lastPlant = sortedPlants[sortedPlants.length - 1].position;

    // Find intersection with sub main pipe
    let intersectionPoint: Coordinate | null = null;

    for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
        const segmentStart = subMainPipe.coordinates[i];
        const segmentEnd = subMainPipe.coordinates[i + 1];

        const intersection = findLineIntersection(
            firstPlant,
            lastPlant,
            segmentStart,
            segmentEnd
        );

        if (intersection) {
            intersectionPoint = intersection;
            break;
        }
    }

    // Create coordinates: straight line from first plant to last plant
    const coordinates: Coordinate[] = [firstPlant, lastPlant];

    return {
        coordinates,
        plants: sortedPlants,
        intersectionPoint,
    };
};

/**
 * Generate automatic lateral pipes for selected zones
 */
export const generateAutoLateralPipes = (
    zones: any[],
    irrigationZones: any[],
    selectedZoneIds: string[],
    connectionMode: 'connect' | 'intersect',
    allPlants: PlantLocation[],
    allSubMainPipes: SubMainPipe[]
): {
    lateralPipes: any[];
    stats: {
        totalPipes: number;
        totalLength: number;
        totalPlants: number;
        zoneStats: { [zoneId: string]: { pipes: number; length: number; plants: number } };
    };
} => {
    // IMPORTANT: Deduplicate selectedZoneIds to prevent processing the same zone multiple times
    const uniqueZoneIds = Array.from(new Set(selectedZoneIds));
    
    const lateralPipes: any[] = [];
    const zoneStats: { [zoneId: string]: { pipes: number; length: number; plants: number } } = {};

    // Process each selected zone
    for (const zoneId of uniqueZoneIds) {
        // Find zone (could be in zones or irrigationZones)
        const zone = [...zones, ...irrigationZones].find((z) => z.id === zoneId);
        if (!zone) continue;

        // Get plants in this zone
        const zonePlants = allPlants.filter((p) => p.zoneId === zoneId);
        if (zonePlants.length === 0) continue;

        // Get sub main pipes in this zone
        // IMPORTANT: A sub-main pipe belongs to the zone where its ENDPOINT is located
        // Even if the pipe passes through other zones, it only belongs to the zone where it ends
        const zoneSubMainPipes = allSubMainPipes.filter((pipe) => {
            if (!pipe.coordinates || pipe.coordinates.length === 0) return false;

            // Use zoneId if available (explicit assignment)
            if (pipe.zoneId) {
                return pipe.zoneId === zoneId;
            }

            // Otherwise check if the LAST POINT (endpoint) is inside this zone
            const endpoint = pipe.coordinates[pipe.coordinates.length - 1];
            return isPointInPolygon(endpoint, zone.coordinates);
        });

        if (zoneSubMainPipes.length === 0) continue;

        // Calculate plant rows for this zone
        const plantRows = calculatePlantRowsForZone(zonePlants, zoneSubMainPipes);

        // IMPORTANT: Deduplicate plant rows
        // Sometimes the grouping algorithm can create duplicate rows (same plants in different row objects)
        // We need to filter these out to prevent creating duplicate pipes
        const uniquePlantRows: PlantLocation[][] = [];
        const processedPlantSets = new Set<string>();

        for (const plantRow of plantRows) {
            // Create a unique identifier for this row based on sorted plant IDs
            const plantIds = plantRow.map((p) => p.id).sort().join(',');
            
            if (!processedPlantSets.has(plantIds)) {
                uniquePlantRows.push(plantRow);
                processedPlantSets.add(plantIds);
            }
        }

        let zonePipeCount = 0;
        let zoneTotalLength = 0;
        let zoneTotalPlants = 0;

        // Track used connection points to prevent overlapping pipes (connect mode)
        const usedConnectionPoints: Coordinate[] = [];
        const MIN_CONNECTION_DISTANCE = 3; // meters - minimum distance between connection points

        // Temporary storage for pipes before merging (intersect mode)
        const tempLateralPipes: any[] = [];

        // Create lateral pipe for each plant row
        for (const plantRow of uniquePlantRows) {
            if (plantRow.length < 2) continue; // Skip rows with less than 2 plants

            // Find closest sub main pipe for this row
            const closestSubMainPipe = findClosestSubMainPipeForRow(plantRow, zoneSubMainPipes);
            if (!closestSubMainPipe) continue;

            // For CONNECT mode: Split row if it crosses the sub-main pipe
            // This ensures we create pipes on BOTH sides of the sub-main
            const rowsToProcess = connectionMode === 'connect' 
                ? splitRowBySubMainPipe(plantRow, closestSubMainPipe)
                : [plantRow];

            for (const processRow of rowsToProcess) {
                if (processRow.length < 2) continue;

                // Create lateral pipe based on connection mode
                let lateralPipeData;

                if (connectionMode === 'connect') {
                    lateralPipeData = createConnectModeLateralPipe(processRow, closestSubMainPipe, zoneId);
                    
                    // For connect mode, we don't skip rows based on connection point distance
                    // Instead, let all rows connect - the visual overlap is acceptable
                    // because they represent different plant rows
                } else {
                    lateralPipeData = createIntersectModeLateralPipe(
                        processRow,
                        closestSubMainPipe,
                        zoneId
                    );
                }

                if (!lateralPipeData) continue;

                // Calculate pipe length
                const pipeLength = calculatePipeLength(lateralPipeData.coordinates);

                // Create lateral pipe object
                const lateralPipe = {
                    id: `auto-lateral-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    subMainPipeId: closestSubMainPipe.id,
                    coordinates: lateralPipeData.coordinates,
                    length: pipeLength,
                    plants: lateralPipeData.plants,
                    placementMode: 'over_plants' as const,
                    emitterLines: [],
                    connectionPoint:
                        connectionMode === 'connect'
                            ? lateralPipeData.connectionPoint
                            : lateralPipeData.coordinates[0],
                    totalWaterNeed: calculateTotalWaterNeed(lateralPipeData.plants),
                    plantCount: lateralPipeData.plants.length,
                    zoneId: zoneId,
                    isEditable: true,
                    isAutoGenerated: true,
                };

                // Add intersection data for intersect mode
                if (connectionMode === 'intersect' && (lateralPipeData as any).intersectionPoint) {
                    const intersectionData = findLateralSubMainIntersection(
                        lateralPipeData.coordinates[0],
                        lateralPipeData.coordinates[lateralPipeData.coordinates.length - 1],
                        [closestSubMainPipe]
                    );

                    if (intersectionData) {
                        const segmentStats = calculateLateralPipeSegmentStats(
                            lateralPipeData.coordinates[0],
                            lateralPipeData.coordinates[lateralPipeData.coordinates.length - 1],
                            intersectionData.intersectionPoint,
                            lateralPipeData.plants
                        );

                        (lateralPipe as any).intersectionData = {
                            point: intersectionData.intersectionPoint,
                            subMainPipeId: intersectionData.subMainPipeId,
                            segmentIndex: intersectionData.segmentIndex,
                            segmentStats: segmentStats,
                        };

                        // Store for merging
                        tempLateralPipes.push(lateralPipe);
                    } else {
                        // No intersection found, add directly
                        tempLateralPipes.push(lateralPipe);
                    }
                } else {
                    // Connect mode or no intersection - add directly
                    lateralPipes.push(lateralPipe);

                    zonePipeCount++;
                    zoneTotalLength += pipeLength;
                    zoneTotalPlants += lateralPipeData.plants.length;
                }
            }
        }

        // For intersect mode: merge pipes with close intersection points
        if (connectionMode === 'intersect' && tempLateralPipes.length > 0) {
            const mergedPipes = mergeLateralPipesByIntersectionPoint(tempLateralPipes);

            for (const pipe of mergedPipes) {
                lateralPipes.push(pipe);
                zonePipeCount++;
                zoneTotalLength += pipe.length;
                zoneTotalPlants += pipe.plantCount;
            }
        }

        zoneStats[zoneId] = {
            pipes: zonePipeCount,
            length: zoneTotalLength,
            plants: zoneTotalPlants,
        };
    }

    // Calculate overall stats
    const totalPipes = lateralPipes.length;
    const totalLength = lateralPipes.reduce((sum, pipe) => sum + pipe.length, 0);
    const totalPlants = lateralPipes.reduce((sum, pipe) => sum + pipe.plantCount, 0);

    return {
        lateralPipes,
        stats: {
            totalPipes,
            totalLength,
            totalPlants,
            zoneStats,
        },
    };
};

/**
 * Merge lateral pipes that have close intersection points (for intersect mode)
 * This ensures one pipe = one intersection point
 */
const mergeLateralPipesByIntersectionPoint = (pipes: any[]): any[] => {
    if (pipes.length === 0) return [];

    const MERGE_THRESHOLD = 2; // meters - merge pipes if intersection points are within this distance
    const mergedPipes: any[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < pipes.length; i++) {
        if (processed.has(i)) continue;

        const pipe1 = pipes[i];
        if (!pipe1.intersectionData?.point) {
            mergedPipes.push(pipe1);
            processed.add(i);
            continue;
        }

        // Find all pipes with close intersection points
        const pipesToMerge: any[] = [pipe1];
        processed.add(i);

        for (let j = i + 1; j < pipes.length; j++) {
            if (processed.has(j)) continue;

            const pipe2 = pipes[j];
            if (!pipe2.intersectionData?.point) continue;

            // Check if intersection points are close
            const distance = calculateDistanceBetweenPoints(
                pipe1.intersectionData.point,
                pipe2.intersectionData.point
            );

            if (distance < MERGE_THRESHOLD) {
                pipesToMerge.push(pipe2);
                processed.add(j);
            }
        }

        // If only one pipe, add it directly
        if (pipesToMerge.length === 1) {
            mergedPipes.push(pipe1);
            continue;
        }

        // Merge multiple pipes into one
        const mergedPipe = mergePipesIntoOne(pipesToMerge);
        mergedPipes.push(mergedPipe);
    }

    return mergedPipes;
};

/**
 * Merge multiple lateral pipes into a single pipe
 */
const mergePipesIntoOne = (pipes: any[]): any => {
    if (pipes.length === 1) return pipes[0];

    // Combine all plants
    const allPlants: PlantLocation[] = [];
    pipes.forEach((pipe) => {
        allPlants.push(...pipe.plants);
    });

    // Sort plants by distance from intersection point (use first pipe's intersection)
    const intersectionPoint = pipes[0].intersectionData?.point || pipes[0].coordinates[0];

    // Sort plants to create a continuous line
    const sortedPlants = [...allPlants].sort((a, b) => {
        const distA = calculateDistanceBetweenPoints(a.position, intersectionPoint);
        const distB = calculateDistanceBetweenPoints(b.position, intersectionPoint);
        return distB - distA; // Sort from far to near (so the line goes from end to end)
    });

    // Create new coordinates from all plants
    const newCoordinates = sortedPlants.map((p) => p.position);

    // Calculate new length
    const newLength = calculatePipeLength(newCoordinates);

    // Use first pipe as base
    const basePipe = pipes[0];

    // Create merged pipe
    const mergedPipe = {
        ...basePipe,
        id: `auto-lateral-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        coordinates: newCoordinates,
        length: newLength,
        plants: sortedPlants,
        plantCount: sortedPlants.length,
        totalWaterNeed: calculateTotalWaterNeed(sortedPlants),
        connectionPoint: newCoordinates[0],
    };

    // Update intersection data if exists
    if (basePipe.intersectionData) {
        const newIntersectionData = findLateralSubMainIntersection(
            newCoordinates[0],
            newCoordinates[newCoordinates.length - 1],
            [{ id: basePipe.subMainPipeId, coordinates: [] }] // Simplified, actual data not needed for point
        );

        if (newIntersectionData) {
            const segmentStats = calculateLateralPipeSegmentStats(
                newCoordinates[0],
                newCoordinates[newCoordinates.length - 1],
                intersectionPoint,
                sortedPlants
            );

            mergedPipe.intersectionData = {
                point: intersectionPoint,
                subMainPipeId: basePipe.subMainPipeId,
                segmentIndex: basePipe.intersectionData.segmentIndex,
                segmentStats: segmentStats,
            };
        }
    }

    return mergedPipe;
};

/**
 * Calculate total pipe length from coordinates array
 */
const calculatePipeLength = (coordinates: Coordinate[]): number => {
    if (!coordinates || coordinates.length < 2) return 0;

    let totalLength = 0;
    for (let i = 1; i < coordinates.length; i++) {
        totalLength += calculateDistanceBetweenPoints(coordinates[i - 1], coordinates[i]);
    }

    return totalLength;
};
