import { Coordinate, PlantLocation } from './horticultureUtils';

export interface SubMainPipe {
    id: string;
    coordinates: Coordinate[];
    zoneId?: string;
}

export interface IrrigationZone {
    id: string;
    name: string;
    coordinates: Coordinate[];
    plants: PlantLocation[];
}

export interface AutoLateralPipeResult {
    id: string;
    coordinates: Coordinate[];
    length: number;
    plants: PlantLocation[];
    placementMode: 'over_plants';
    totalFlowRate: number;
    connectionPoint: Coordinate;
    zoneId: string;
    intersectionData?: {
        subMainPipeId: string;
        point: Coordinate;
        segmentIndex: number;
    };
}

export interface AutoLateralPipeConfig {
    mode: 'through_submain' | 'from_submain';
    snapThreshold: number;
    minPipeLength: number;
    maxPipeLength: number;
}

// ฟังก์ชันตัดท่อให้อยู่ในโซนเท่านั้น
function clipPipeToZone(coordinates: Coordinate[], zone: IrrigationZone): Coordinate[] {
    if (coordinates.length < 2) return coordinates;

    const start = coordinates[0];
    const end = coordinates[coordinates.length - 1];

    const startInZone = isPointInZone(start, zone);
    const endInZone = isPointInZone(end, zone);

    if (startInZone && endInZone) {
        // ทั้งสองจุดอยู่ในโซน - ไม่ต้องตัด
        return coordinates;
    }

    // หาจุดตัดกับขอบโซน
    const intersections = findZoneBoundaryIntersections(start, end, zone);

    if (intersections.length === 0) {
        // ไม่มีจุดตัด - ใช้จุดที่ใกล้ที่สุดในโซน
        const clippedPoint = findNearestPointInZone(startInZone ? end : start, zone);
        if (startInZone) {
            return [start, clippedPoint];
        } else if (endInZone) {
            return [clippedPoint, end];
        } else {
            // ทั้งสองจุดอยู่นอกโซน - คืนค่าเดิม
            return coordinates;
        }
    }

    // มีจุดตัด - ใช้จุดตัดที่เหมาะสม
    if (startInZone && !endInZone) {
        // จุดเริ่มต้นอยู่ในโซน จุดสิ้นสุดอยู่นอกโซน - ใช้จุดตัดที่ใกล้จุดเริ่มต้นที่สุด
        const closestIntersection = intersections.reduce((closest, current) => {
            const distToStart = calculateDistance(start, current);
            const distToClosest = calculateDistance(start, closest);
            return distToStart < distToClosest ? current : closest;
        });
        return [start, closestIntersection];
    } else if (!startInZone && endInZone) {
        // จุดเริ่มต้นอยู่นอกโซน จุดสิ้นสุดอยู่ในโซน - ใช้จุดตัดที่ใกล้จุดสิ้นสุดที่สุด
        const closestIntersection = intersections.reduce((closest, current) => {
            const distToEnd = calculateDistance(end, current);
            const distToClosest = calculateDistance(end, closest);
            return distToEnd < distToClosest ? current : closest;
        });
        return [closestIntersection, end];
    } else if (!startInZone && !endInZone) {
        // ทั้งสองจุดอยู่นอกโซน แต่เส้นผ่านโซน - ใช้จุดตัดทั้งสองจุด
        if (intersections.length >= 2) {
            return [intersections[0], intersections[1]];
        } else {
            const intersection = intersections[0];
            // หาจุดที่ใกล้ที่สุดในโซนจากจุดตัด
            const nearestBoundaryPoint = findNearestPointInZone(intersection, zone);
            return [intersection, nearestBoundaryPoint];
        }
    }
    return coordinates;
}

// ฟังก์ชันหาจุดที่ใกล้ที่สุดในโซน
function findNearestPointInZone(point: Coordinate, zone: IrrigationZone): Coordinate {
    let nearestPoint = point;
    let minDistance = Infinity;

    // ตรวจสอบทุกจุดบนขอบโซน
    for (let i = 0; i < zone.coordinates.length; i++) {
        const boundaryPoint = zone.coordinates[i];
        const distance = calculateDistance(point, boundaryPoint);

        if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = boundaryPoint;
        }
    }

    return nearestPoint;
}

// ฟังก์ชันหาจุดตัดกับขอบโซน
function findZoneBoundaryIntersections(
    start: Coordinate,
    end: Coordinate,
    zone: IrrigationZone
): Coordinate[] {
    const intersections: Coordinate[] = [];

    for (let i = 0; i < zone.coordinates.length; i++) {
        const boundaryStart = zone.coordinates[i];
        const boundaryEnd = zone.coordinates[(i + 1) % zone.coordinates.length];

        const intersection = findLineIntersection(start, end, boundaryStart, boundaryEnd);
        if (intersection) {
            intersections.push(intersection);
        }
    }

    return intersections;
}

// ฟังก์ชันตรวจสอบว่าจุดอยู่ในโซนหรือไม่
export const isPointInZone = (point: Coordinate, zone: IrrigationZone): boolean => {
    const { coordinates } = zone;

    if (!coordinates || coordinates.length < 3) {
        return false;
    }

    let inside = false;

    for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
        if (
            coordinates[i].lat > point.lat !== coordinates[j].lat > point.lat &&
            point.lng <
                ((coordinates[j].lng - coordinates[i].lng) * (point.lat - coordinates[i].lat)) /
                    (coordinates[j].lat - coordinates[i].lat) +
                    coordinates[i].lng
        ) {
            inside = !inside;
        }
    }

    return inside;
};

// ฟังก์ชันหาโซนที่จุดอยู่ในนั้น
export const findZoneForPoint = (
    point: Coordinate,
    zones: IrrigationZone[]
): IrrigationZone | null => {
    for (const zone of zones) {
        if (isPointInZone(point, zone)) {
            return zone;
        }
    }
    return null;
};

// ฟังก์ชันคำนวณระยะห่างระหว่างจุด
export const calculateDistance = (point1: Coordinate, point2: Coordinate): number => {
    const R = 6371000; // รัศมีโลกเป็นเมตร
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
    const lat1Rad = (point1.lat * Math.PI) / 180;
    const lat2Rad = (point2.lat * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

// ฟังก์ชันหาจุดที่ใกล้ที่สุดบนเส้นตรง
export const findClosestPointOnLine = (
    point: Coordinate,
    lineStart: Coordinate,
    lineEnd: Coordinate
): Coordinate => {
    const A = point.lat - lineStart.lat;
    const B = point.lng - lineStart.lng;
    const C = lineEnd.lat - lineStart.lat;
    const D = lineEnd.lng - lineStart.lng;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return lineStart;

    let param = dot / lenSq;
    param = Math.max(0, Math.min(1, param));

    return {
        lat: lineStart.lat + param * C,
        lng: lineStart.lng + param * D,
    };
};

// ฟังก์ชันจัดกลุ่มต้นไม้ตามแถว
export const groupPlantsByRows = (plants: PlantLocation[]): PlantLocation[][] => {
    if (plants.length === 0) return [];

    // เรียงต้นไม้ตาม latitude
    const sortedPlants = [...plants].sort((a, b) => a.position.lat - b.position.lat);

    const rows: PlantLocation[][] = [];
    const tolerance = 0.00005; // ลด tolerance ลงเพื่อแยกแถวให้ชัดเจนขึ้น (ประมาณ 5 เมตร)

    let currentRow: PlantLocation[] = [sortedPlants[0]];

    for (let i = 1; i < sortedPlants.length; i++) {
        const currentPlant = sortedPlants[i];
        const lastPlantInRow = currentRow[currentRow.length - 1];
        const latDiff = Math.abs(currentPlant.position.lat - lastPlantInRow.position.lat);

        if (latDiff <= tolerance) {
            currentRow.push(currentPlant);
        } else {
            // เรียงต้นไม้ในแถวตาม longitude
            currentRow.sort((a, b) => a.position.lng - b.position.lng);
            rows.push(currentRow);
            currentRow = [currentPlant];
        }
    }

    // เพิ่มแถวสุดท้าย
    if (currentRow.length > 0) {
        currentRow.sort((a, b) => a.position.lng - b.position.lng);
        rows.push(currentRow);
    }

    return rows;
};

// ฟังก์ชันจัดกลุ่มต้นไม้ตามคอลัมน์
export const groupPlantsByColumns = (plants: PlantLocation[]): PlantLocation[][] => {
    if (plants.length === 0) return [];

    // เรียงต้นไม้ตาม longitude
    const sortedPlants = [...plants].sort((a, b) => a.position.lng - b.position.lng);

    const columns: PlantLocation[][] = [];
    const tolerance = 0.00001; // ความคลาดเคลื่อนที่ยอมรับได้สำหรับ longitude

    let currentColumn: PlantLocation[] = [sortedPlants[0]];

    for (let i = 1; i < sortedPlants.length; i++) {
        const currentPlant = sortedPlants[i];
        const lastPlantInColumn = currentColumn[currentColumn.length - 1];

        if (Math.abs(currentPlant.position.lng - lastPlantInColumn.position.lng) <= tolerance) {
            currentColumn.push(currentPlant);
        } else {
            // เรียงต้นไม้ในคอลัมน์ตาม latitude
            currentColumn.sort((a, b) => a.position.lat - b.position.lat);
            columns.push(currentColumn);
            currentColumn = [currentPlant];
        }
    }

    // เพิ่มคอลัมน์สุดท้าย
    if (currentColumn.length > 0) {
        currentColumn.sort((a, b) => a.position.lat - b.position.lat);
        columns.push(currentColumn);
    }

    return columns;
};

// ฟังก์ชันหาจุดตัดระหว่างเส้นตรงสองเส้น
export const findLineIntersection = (
    line1Start: Coordinate,
    line1End: Coordinate,
    line2Start: Coordinate,
    line2End: Coordinate
): Coordinate | null => {
    const x1 = line1Start.lng;
    const y1 = line1Start.lat;
    const x2 = line1End.lng;
    const y2 = line1End.lat;
    const x3 = line2Start.lng;
    const y3 = line2Start.lat;
    const x4 = line2End.lng;
    const y4 = line2End.lat;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

    if (Math.abs(denom) < 1e-10) {
        return null; // เส้นขนานกัน
    }

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            lng: x1 + t * (x2 - x1),
            lat: y1 + t * (y2 - y1),
        };
    }

    return null;
};

// ฟังก์ชันสร้างท่อย่อยแบบ "ลากผ่านท่อ Sub Main"
export const generateThroughSubMainPipes = (
    subMainPipes: SubMainPipe[],
    zones: IrrigationZone[],
    config: AutoLateralPipeConfig
): AutoLateralPipeResult[] => {
    const results: AutoLateralPipeResult[] = [];

    console.log('🚀 Starting generateThroughSubMainPipes');
    console.log('📊 Zones:', zones.length, 'SubMain pipes:', subMainPipes.length);

    for (const zone of zones) {
        const plantsInZone = zone.plants;
        console.log(`🌿 Processing zone ${zone.id}: ${plantsInZone.length} plants`);

        if (plantsInZone.length === 0) continue;

        // จัดกลุ่มต้นไม้ตามแถว
        const plantRows = groupPlantsByRows(plantsInZone);
        console.log(`📋 Found ${plantRows.length} plant rows in zone ${zone.id}`);

        for (const row of plantRows) {
            console.log(`🔍 Processing row with ${row.length} plants`);
            if (row.length < 1) continue; // ลดเงื่อนไขจาก 2 เป็น 1

            // สร้างเส้นท่อย่อยตามแถวต้นไม้
            const rowStart = row[0].position;
            const rowEnd = row[row.length - 1].position;

            // ขยายเส้นออกไปนอกแถวต้นไม้เล็กน้อย
            const direction = {
                lat: rowEnd.lat - rowStart.lat,
                lng: rowEnd.lng - rowStart.lng,
            };
            const length = Math.sqrt(direction.lat * direction.lat + direction.lng * direction.lng);
            const normalizedDir = {
                lat: direction.lat / length,
                lng: direction.lng / length,
            };

            const extendedStart = {
                lat: rowStart.lat - normalizedDir.lat * 0.0001, // ขยายออกไป ~10 เมตร
                lng: rowStart.lng - normalizedDir.lng * 0.0001,
            };
            const extendedEnd = {
                lat: rowEnd.lat + normalizedDir.lat * 0.0001,
                lng: rowEnd.lng + normalizedDir.lng * 0.0001,
            };

            // หาจุดตัดกับท่อ Sub Main ในโซนเดียวกัน
            for (const subMainPipe of subMainPipes) {
                console.log(`🔧 Checking subMainPipe ${subMainPipe.id} for zone ${zone.id}`);

                // ปรับเงื่อนไขการตรวจสอบโซน - อนุญาตให้ท่อทุกเส้นผ่านได้
                console.log(
                    `✅ SubMain pipe ${subMainPipe.id} will be checked (zoneId: ${subMainPipe.zoneId})`
                );

                // ตรวจสอบว่าท่อ Sub Main ผ่านโซนนี้หรือไม่
                const subMainInZone = subMainPipe.coordinates.some((coord) =>
                    isPointInZone(coord, zone)
                );
                console.log(`📍 SubMain pipe ${subMainPipe.id} in zone: ${subMainInZone}`);
                if (!subMainInZone) {
                    console.log(
                        `❌ SubMain pipe ${subMainPipe.id} does not pass through zone ${zone.id}`
                    );
                    continue;
                }
                console.log(`✅ SubMain pipe ${subMainPipe.id} passes through zone ${zone.id}`);

                // หาจุดตัดระหว่างแถวต้นไม้กับท่อ Sub Main
                for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                    const segmentStart = subMainPipe.coordinates[i];
                    const segmentEnd = subMainPipe.coordinates[i + 1];

                    const intersection = findLineIntersection(
                        extendedStart,
                        extendedEnd,
                        segmentStart,
                        segmentEnd
                    );

                    console.log(`🎯 Checking intersection for segment ${i}`);

                    if (intersection) {
                        console.log(`✅ Found intersection at:`, intersection);
                        const intersectionInZone = isPointInZone(intersection, zone);
                        console.log(`📍 Intersection in zone: ${intersectionInZone}`);

                        if (!intersectionInZone) {
                            console.log(`❌ Intersection point outside zone ${zone.id}`);
                            continue;
                        }

                        if (intersectionInZone) {
                            // สร้างท่อจากจุดตัดไปถึงต้นไม้ต้นสุดท้ายในแนว
                            const rowStart = row[0].position;
                            const rowEnd = row[row.length - 1].position;
                            const pipeCoordinates = [intersection, rowStart, rowEnd];
                            const pipeLength = calculateDistance(rowStart, rowEnd);
                            console.log(
                                `📏 Pipe length (to last plant): ${pipeLength.toFixed(2)}m`
                            );

                            if (
                                pipeLength >= config.minPipeLength &&
                                pipeLength <= config.maxPipeLength
                            ) {
                                const lateralPipe: AutoLateralPipeResult = {
                                    id: `auto-lateral-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    coordinates: [rowStart, rowEnd],
                                    length: pipeLength,
                                    plants: row,
                                    placementMode: 'over_plants',
                                    totalFlowRate: row.reduce(
                                        (sum, plant) => sum + plant.plantData.waterNeed,
                                        0
                                    ),
                                    connectionPoint: intersection,
                                    zoneId: zone.id,
                                    intersectionData: {
                                        subMainPipeId: subMainPipe.id,
                                        point: intersection,
                                        segmentIndex: i,
                                    },
                                };

                                console.log(`🎉 Created lateral pipe: ${lateralPipe.id}`);
                                results.push(lateralPipe);
                            } else {
                                console.log(
                                    `❌ Pipe length ${pipeLength.toFixed(2)}m outside range ${config.minPipeLength}-${config.maxPipeLength}m`
                                );
                            }
                        }
                    } else {
                        console.log(`❌ No intersection found for segment ${i}`);
                    }
                }
            }
        }
    }

    console.log(`🏁 generateThroughSubMainPipes completed: ${results.length} pipes created`);

    // ถ้าไม่มีท่อย่อยที่สร้างได้ ให้ลองใช้วิธี fallback
    if (results.length === 0) {
        console.log(
            '🔄 No pipes created with intersection method, trying simple fallback approach...'
        );
        return generateSimpleLateralPipes(subMainPipes, zones, config);
    }

    return results;
};

// ฟังก์ชัน fallback สำหรับสร้างท่อย่อยเมื่อไม่พบจุดตัด
const generateFallbackLateralPipes = (
    subMainPipes: SubMainPipe[],
    zones: IrrigationZone[],
    config: AutoLateralPipeConfig
): AutoLateralPipeResult[] => {
    const results: AutoLateralPipeResult[] = [];

    for (const zone of zones) {
        const plantsInZone = zone.plants;
        if (plantsInZone.length === 0) continue;

        // จัดกลุ่มต้นไม้ตามแถว
        const plantRows = groupPlantsByRows(plantsInZone);

        for (const row of plantRows) {
            if (row.length < 1) continue;

            // สร้างท่อย่อยตามแถวต้นไม้โดยไม่ต้องหาจุดตัด
            const rowStart = row[0].position;
            const rowEnd = row[row.length - 1].position;

            // ขยายเส้นออกไปเล็กน้อย
            const direction = {
                lat: rowEnd.lat - rowStart.lat,
                lng: rowEnd.lng - rowStart.lng,
            };
            const length = Math.sqrt(direction.lat * direction.lat + direction.lng * direction.lng);

            if (length === 0) continue;

            const normalizedDir = {
                lat: direction.lat / length,
                lng: direction.lng / length,
            };

            const extendedStart = {
                lat: rowStart.lat - normalizedDir.lat * 0.0001,
                lng: rowStart.lng - normalizedDir.lng * 0.0001,
            };
            const extendedEnd = {
                lat: rowEnd.lat + normalizedDir.lat * 0.0001,
                lng: rowEnd.lng + normalizedDir.lng * 0.0001,
            };

            // หาท่อ Sub Main ที่ใกล้ที่สุด
            let closestSubMainPipe: SubMainPipe | null = null;
            let minDistance = Infinity;
            let closestPoint: Coordinate | null = null;

            for (const subMainPipe of subMainPipes) {
                if (subMainPipe.zoneId && subMainPipe.zoneId !== zone.id) continue;

                const subMainInZone = subMainPipe.coordinates.some((coord) =>
                    isPointInZone(coord, zone)
                );
                if (!subMainInZone) continue;

                // หาจุดที่ใกล้ที่สุดบนท่อ Sub Main
                const rowCenter = {
                    lat: (rowStart.lat + rowEnd.lat) / 2,
                    lng: (rowStart.lng + rowEnd.lng) / 2,
                };

                for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                    const segmentStart = subMainPipe.coordinates[i];
                    const segmentEnd = subMainPipe.coordinates[i + 1];

                    const closestOnSegment = findClosestPointOnLine(
                        rowCenter,
                        segmentStart,
                        segmentEnd
                    );
                    const distance = calculateDistance(rowCenter, closestOnSegment);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestSubMainPipe = subMainPipe;
                        closestPoint = closestOnSegment;
                    }
                }
            }

            if (closestSubMainPipe && closestPoint && minDistance <= config.snapThreshold * 2) {
                const pipeLength = calculateDistance(extendedStart, extendedEnd);

                if (pipeLength >= config.minPipeLength && pipeLength <= config.maxPipeLength) {
                    const lateralPipe: AutoLateralPipeResult = {
                        id: `auto-lateral-fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        coordinates: [extendedStart, extendedEnd],
                        length: pipeLength,
                        plants: row,
                        placementMode: 'over_plants',
                        totalFlowRate: row.reduce(
                            (sum, plant) => sum + plant.plantData.waterNeed,
                            0
                        ),
                        connectionPoint: closestPoint,
                        zoneId: zone.id,
                        intersectionData: {
                            subMainPipeId: closestSubMainPipe.id,
                            point: closestPoint,
                            segmentIndex: 0,
                        },
                    };

                    results.push(lateralPipe);
                }
            }
        }
    }
    return results;
};

// ฟังก์ชันคำนวณทิศทางของท่อ Sub Main
const getSubMainDirection = (subMainPipe: SubMainPipe): 'horizontal' | 'vertical' => {
    if (subMainPipe.coordinates.length < 2) return 'horizontal';

    const start = subMainPipe.coordinates[0];
    const end = subMainPipe.coordinates[subMainPipe.coordinates.length - 1];

    const latDiff = Math.abs(end.lat - start.lat);
    const lngDiff = Math.abs(end.lng - start.lng);

    // ถ้า lat เปลี่ยนมากกว่า lng = ท่อวางในแนวตั้ง
    // ถ้า lng เปลี่ยนมากกว่า lat = ท่อวางในแนวนอน
    return latDiff > lngDiff ? 'vertical' : 'horizontal';
};

// ฟังก์ชันจัดกลุ่มต้นไม้ตามทิศทางที่ตั้งฉากกับท่อ Sub Main
const groupPlantsPerpendicularToSubMain = (
    plants: PlantLocation[],
    subMainDirection: 'horizontal' | 'vertical'
): PlantLocation[][] => {
    if (subMainDirection === 'vertical') {
        // ท่อ Sub Main ตั้ง → ลากท่อย่อยในแนวนอน → จัดกลุ่มตาม lat (แถว)
        return groupPlantsByRows(plants);
    } else {
        // ท่อ Sub Main นอน → ลากท่อย่อยในแนวตั้ง → จัดกลุ่มตาม lng (คอลัมน์)
        return groupPlantsByColumns(plants);
    }
};

// ฟังก์ชันสร้างท่อย่อยในทิศทางที่ตั้งฉากกับท่อ Sub Main
const createPerpendicularLateralPipe = (
    plants: PlantLocation[],
    subMainDirection: 'horizontal' | 'vertical'
): { start: Coordinate; end: Coordinate; length: number } => {
    if (plants.length === 0) {
        throw new Error('No plants provided');
    }

    let start: Coordinate, end: Coordinate;

    if (subMainDirection === 'vertical') {
        // ท่อ Sub Main ตั้ง → ลากท่อย่อยในแนวนอน (lng เปลี่ยน, lat คงที่)
        const sortedByLng = [...plants].sort((a, b) => a.position.lng - b.position.lng);
        const avgLat = plants.reduce((sum, plant) => sum + plant.position.lat, 0) / plants.length;

        start = {
            lat: avgLat,
            lng: sortedByLng[0].position.lng,
        };
        end = {
            lat: avgLat,
            lng: sortedByLng[sortedByLng.length - 1].position.lng,
        };
    } else {
        // ท่อ Sub Main นอน → ลากท่อย่อยในแนวตั้ง (lat เปลี่ยน, lng คงที่)
        const sortedByLat = [...plants].sort((a, b) => a.position.lat - b.position.lat);
        const avgLng = plants.reduce((sum, plant) => sum + plant.position.lng, 0) / plants.length;

        start = {
            lat: sortedByLat[0].position.lat,
            lng: avgLng,
        };
        end = {
            lat: sortedByLat[sortedByLat.length - 1].position.lat,
            lng: avgLng,
        };
    }

    const length = calculateDistance(start, end);
    return { start, end, length };
};

// ฟังก์ชันง่ายๆ สำหรับสร้างท่อย่อยโดยไม่ต้องตรวจสอบโซนมาก
const generateSimpleLateralPipes = (
    subMainPipes: SubMainPipe[],
    zones: IrrigationZone[],
    config: AutoLateralPipeConfig
): AutoLateralPipeResult[] => {
    const results: AutoLateralPipeResult[] = [];

    for (const zone of zones) {
        const plantsInZone = zone.plants;
        if (plantsInZone.length === 0) continue;

        // หาท่อ Sub Main ที่ใกล้ที่สุดเพื่อกำหนดทิศทาง
        let closestSubMainPipe: SubMainPipe | null = null;
        let minDistanceToZone = Infinity;

        const zoneCenter = {
            lat:
                zone.coordinates.reduce((sum, coord) => sum + coord.lat, 0) /
                zone.coordinates.length,
            lng:
                zone.coordinates.reduce((sum, coord) => sum + coord.lng, 0) /
                zone.coordinates.length,
        };

        for (const subMainPipe of subMainPipes) {
            const subMainCenter = {
                lat:
                    subMainPipe.coordinates.reduce((sum, coord) => sum + coord.lat, 0) /
                    subMainPipe.coordinates.length,
                lng:
                    subMainPipe.coordinates.reduce((sum, coord) => sum + coord.lng, 0) /
                    subMainPipe.coordinates.length,
            };

            const distance = calculateDistance(zoneCenter, subMainCenter);
            if (distance < minDistanceToZone) {
                minDistanceToZone = distance;
                closestSubMainPipe = subMainPipe;
            }
        }

        if (!closestSubMainPipe) continue;

        // กำหนดทิศทางของท่อ Sub Main
        const subMainDirection = getSubMainDirection(closestSubMainPipe);

        // จัดกลุ่มต้นไม้ตามทิศทางที่ตั้งฉากกับท่อ Sub Main
        const plantGroups = groupPlantsPerpendicularToSubMain(plantsInZone, subMainDirection);

        for (const group of plantGroups) {
            if (group.length < 1) continue;

            try {
                // สร้างท่อย่อยในทิศทางที่ตั้งฉากกับท่อ Sub Main
                const {
                    start: pipeStart,
                    end: pipeEnd,
                    length: pipeLength,
                } = createPerpendicularLateralPipe(group, subMainDirection);

                // ตรวจสอบความยาวท่อ
                if (pipeLength >= config.minPipeLength && pipeLength <= config.maxPipeLength) {
                    // หาจุดเชื่อมต่อกับท่อ Sub Main
                    let closestPoint: Coordinate | null = null;
                    let minDistance = Infinity;

                    const pipeCenter = {
                        lat: (pipeStart.lat + pipeEnd.lat) / 2,
                        lng: (pipeStart.lng + pipeEnd.lng) / 2,
                    };

                    for (const subMainPipe of subMainPipes) {
                        for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                            const segmentStart = subMainPipe.coordinates[i];
                            const segmentEnd = subMainPipe.coordinates[i + 1];

                            const closestOnSegment = findClosestPointOnLine(
                                pipeCenter,
                                segmentStart,
                                segmentEnd
                            );
                            const distance = calculateDistance(pipeCenter, closestOnSegment);

                            if (distance < minDistance) {
                                minDistance = distance;
                                closestPoint = closestOnSegment;
                            }
                        }
                    }

                    if (closestPoint && minDistance <= config.snapThreshold * 3) {
                        const lateralPipe: AutoLateralPipeResult = {
                            id: `auto-lateral-simple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            coordinates: [pipeStart, pipeEnd],
                            length: pipeLength,
                            plants: group,
                            placementMode: 'over_plants',
                            totalFlowRate: group.reduce(
                                (sum, plant) => sum + plant.plantData.waterNeed,
                                0
                            ),
                            connectionPoint: closestPoint,
                            zoneId: zone.id,
                            intersectionData: {
                                subMainPipeId: closestSubMainPipe.id,
                                point: closestPoint,
                                segmentIndex: 0,
                            },
                        };

                        results.push(lateralPipe);
                    }
                }
            } catch (error) {
                // Silent error handling
            }
        }
    }

    return results;
};

// ฟังก์ชันสร้างท่อย่อยแบบ "เริ่มจากท่อ Sub Main"
export const generateFromSubMainPipes = (
    subMainPipes: SubMainPipe[],
    zones: IrrigationZone[],
    config: AutoLateralPipeConfig
): AutoLateralPipeResult[] => {
    const results: AutoLateralPipeResult[] = [];

    console.log('🚀 Starting generateFromSubMainPipes');
    console.log('📊 Zones:', zones.length, 'SubMain pipes:', subMainPipes.length);

    for (const zone of zones) {
        const plantsInZone = zone.plants;
        console.log(`🌿 Processing zone ${zone.id}: ${plantsInZone.length} plants`);

        if (plantsInZone.length === 0) continue;

        // จัดกลุ่มต้นไม้ตามแถว
        const plantRows = groupPlantsByRows(plantsInZone);
        console.log(`📋 Found ${plantRows.length} plant rows in zone ${zone.id}`);

        for (const subMainPipe of subMainPipes) {
            if (subMainPipe.zoneId && subMainPipe.zoneId !== zone.id) continue;

            // ตรวจสอบว่าท่อ Sub Main ผ่านโซนนี้หรือไม่
            const subMainInZone = subMainPipe.coordinates.some((coord) =>
                isPointInZone(coord, zone)
            );
            if (!subMainInZone) continue;

            for (const row of plantRows) {
                if (row.length < 2) continue;

                // หาจุดเริ่มต้นบนท่อ Sub Main ที่ใกล้แถวต้นไม้ที่สุด
                let closestPoint: Coordinate | null = null;
                let minDistance = Infinity;
                let segmentIndex = -1;

                const rowCenter = {
                    lat: row.reduce((sum, plant) => sum + plant.position.lat, 0) / row.length,
                    lng: row.reduce((sum, plant) => sum + plant.position.lng, 0) / row.length,
                };

                for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                    const segmentStart = subMainPipe.coordinates[i];
                    const segmentEnd = subMainPipe.coordinates[i + 1];

                    const closestOnSegment = findClosestPointOnLine(
                        rowCenter,
                        segmentStart,
                        segmentEnd
                    );
                    const distance = calculateDistance(rowCenter, closestOnSegment);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestPoint = closestOnSegment;
                        segmentIndex = i;
                    }
                }

                if (closestPoint && minDistance <= config.snapThreshold) {
                    // สร้างท่อย่อยจากจุดบนท่อ Sub Main ไปยังแถวต้นไม้
                    const rowStart = row[0].position;
                    const rowEnd = row[row.length - 1].position;

                    // เลือกจุดปลายที่ไกลจากท่อ Sub Main มากที่สุด
                    const distToStart = calculateDistance(closestPoint, rowStart);
                    const distToEnd = calculateDistance(closestPoint, rowEnd);
                    const farEnd = distToStart > distToEnd ? rowStart : rowEnd;

                    const pipeLength = calculateDistance(closestPoint, farEnd);

                    if (pipeLength >= config.minPipeLength && pipeLength <= config.maxPipeLength) {
                        const lateralPipe: AutoLateralPipeResult = {
                            id: `auto-lateral-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            coordinates: [closestPoint, farEnd],
                            length: pipeLength,
                            plants: row,
                            placementMode: 'over_plants',
                            totalFlowRate: row.reduce(
                                (sum, plant) => sum + plant.plantData.waterNeed,
                                0
                            ),
                            connectionPoint: closestPoint,
                            zoneId: zone.id,
                            intersectionData: {
                                subMainPipeId: subMainPipe.id,
                                point: closestPoint,
                                segmentIndex: segmentIndex,
                            },
                        };

                        results.push(lateralPipe);
                    }
                }
            }
        }
    }

    return results;
};

// ฟังก์ชันหลักสำหรับสร้างท่อย่อยอัตโนมัติ
export const generateAutoLateralPipes = (
    mode: 'through_submain' | 'from_submain',
    subMainPipes: SubMainPipe[],
    zones: IrrigationZone[],
    config: Partial<AutoLateralPipeConfig> = {}
): AutoLateralPipeResult[] => {
    const defaultConfig: AutoLateralPipeConfig = {
        mode,
        snapThreshold: 20, // 20 เมตร
        minPipeLength: 5, // 5 เมตร
        maxPipeLength: 200, // 200 เมตร
        ...config,
    };

    let results: AutoLateralPipeResult[] = [];

    if (mode === 'through_submain') {
        results = generateThroughSubMainPipes(subMainPipes, zones, defaultConfig);
    } else {
        results = generateSimpleLateralPipes(subMainPipes, zones, defaultConfig);
    }

    return results;
};

// ฟังก์ชันตรวจสอบความถูกต้องของท่อย่อยที่สร้างขึ้น
export const validateAutoLateralPipes = (
    pipes: AutoLateralPipeResult[],
    zones: IrrigationZone[]
): {
    valid: AutoLateralPipeResult[];
    invalid: { pipe: AutoLateralPipeResult; reason: string }[];
} => {
    const valid: AutoLateralPipeResult[] = [];
    const invalid: { pipe: AutoLateralPipeResult; reason: string }[] = [];

    for (const pipe of pipes) {
        let isValid = true;
        let reason = '';

        // ตรวจสอบว่าท่อทั้งเส้นอยู่ในโซนหรือไม่ (ปิดการตรวจสอบชั่วคราว)
        const zone = zones.find((z) => z.id === pipe.zoneId);
        if (!zone) {
            // isValid = false;
            // reason = 'ไม่พบโซนที่ระบุ';
        } else {
            const allPointsInZone = pipe.coordinates.every((coord) => isPointInZone(coord, zone));
            if (!allPointsInZone) {
                // isValid = false;
                // reason = 'ท่อออกนอกขอบเขตโซน';
            }
        }

        // ตรวจสอบความยาวท่อ
        if (pipe.length < 1) {
            isValid = false;
            reason = 'ท่อสั้นเกินไป';
        }

        // ตรวจสอบจำนวนต้นไม้
        if (pipe.plants.length === 0) {
            isValid = false;
            reason = 'ไม่มีต้นไม้ในเส้นทางท่อ';
        }

        if (isValid) {
            valid.push(pipe);
        } else {
            invalid.push({ pipe, reason });
        }
    }

    return { valid, invalid };
};
