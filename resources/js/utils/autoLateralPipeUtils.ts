import { Coordinate, PlantLocation } from './horticultureUtils';
import {
    groupPlantsByRows as groupPlantsByRowsWithRotation,
    groupPlantsByColumns as groupPlantsByColumnsWithRotation,
    hasRotation,
    transformToRotatedCoordinate,
} from './lateralPipeUtils';

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
    totalWaterNeed: number; // เปลี่ยนชื่อจาก totalFlowRate เป็น totalWaterNeed เพื่อให้สอดคล้องกับความหมาย
    connectionPoint: Coordinate;
    zoneId: string;
    intersectionData?: {
        subMainPipeId: string;
        point: Coordinate;
        segmentIndex: number;
    };
    connectionType?: 'through_submain' | 'from_submain';
}

export interface AutoLateralPipeConfig {
    mode: 'through_submain' | 'from_submain';
    snapThreshold: number;
    minPipeLength: number;
    maxPipeLength: number;
}

/**
 * ตรวจสอบว่าจุดอยู่ในโซนหรือไม่
 * ใช้ Ray casting algorithm
 */
export const isPointInZone = (point: Coordinate, zone: IrrigationZone): boolean => {
    const { coordinates } = zone;

    if (!coordinates || coordinates.length < 3) {
        return false;
    }

    // ตรวจสอบข้อมูลพิกัดก่อน
    if (
        !point ||
        typeof point.lat !== 'number' ||
        typeof point.lng !== 'number' ||
        isNaN(point.lat) ||
        isNaN(point.lng) ||
        !isFinite(point.lat) ||
        !isFinite(point.lng)
    ) {
        return false;
    }

    let inside = false;

    for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
        const xi = coordinates[i].lng;
        const yi = coordinates[i].lat;
        const xj = coordinates[j].lng;
        const yj = coordinates[j].lat;

        // ตรวจสอบว่าพิกัดถูกต้อง
        if (
            typeof xi !== 'number' ||
            typeof yi !== 'number' ||
            typeof xj !== 'number' ||
            typeof yj !== 'number' ||
            isNaN(xi) ||
            isNaN(yi) ||
            isNaN(xj) ||
            isNaN(yj)
        ) {
            continue;
        }

        const intersect =
            yi > point.lat !== yj > point.lat &&
            point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

        if (intersect) {
            inside = !inside;
        }
    }

    return inside;
};

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

export const calculateDistance = (point1: Coordinate, point2: Coordinate): number => {
    const R = 6371000;
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

export const groupPlantsByRows = (plants: PlantLocation[]): PlantLocation[][] => {
    return groupPlantsByRowsWithRotation(plants);
};

export const groupPlantsByColumns = (plants: PlantLocation[]): PlantLocation[][] => {
    return groupPlantsByColumnsWithRotation(plants);
};

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
        return null;
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

export const generateThroughSubMainPipes = (
    subMainPipes: SubMainPipe[],
    zones: IrrigationZone[],
    config: AutoLateralPipeConfig
): AutoLateralPipeResult[] => {
    const results: AutoLateralPipeResult[] = [];

    for (const zone of zones) {
        const plantsInZone = zone.plants;

        console.log(`🔍 Processing zone: ${zone.name}, plants: ${plantsInZone.length}`);

        if (plantsInZone.length === 0) {
            console.log(`⚠️ Zone ${zone.name}: No plants, skipping`);
            continue;
        }

        // หา Sub Main pipe ที่อยู่ในโซนนี้
        // ต้องกรองให้เหลือเฉพาะท่อที่มี zoneId ตรงกับโซนที่กำลังประมวลผลเท่านั้น
        // ห้ามใช้ท่อ SubMain ของโซนอื่นแม้ว่าจะผ่านโซนนี้ก็ตาม
        const relevantSubMainPipes = subMainPipes.filter((subMainPipe) => {
            // ตรวจสอบ zoneId ก่อน - ถ้ามี zoneId ต้องตรงกับโซนที่กำลังประมวลผลเท่านั้น
            if (subMainPipe.zoneId) {
                if (subMainPipe.zoneId !== zone.id) {
                    console.log(
                        `⚠️ [THROUGH_SUBMAIN] SubMain ${subMainPipe.id}: zoneId (${subMainPipe.zoneId}) ไม่ตรงกับโซน ${zone.id}, ข้ามทันที`
                    );
                    return false; // ข้ามท่อที่ zoneId ไม่ตรงกันทันที - ห้ามใช้ท่อของโซนอื่น
                }
                // ถ้า zoneId ตรงกัน ให้ใช้ท่อนี้
                console.log(
                    `✅ [THROUGH_SUBMAIN] SubMain ${subMainPipe.id}: zoneId (${subMainPipe.zoneId}) ตรงกับโซน ${zone.id}, ใช้ท่อนี้`
                );
                return true;
            }

            // ถ้าไม่มี zoneId (กรณีท่อสร้างก่อนวาดโซน) ให้ตรวจสอบด้วยพิกัด
            // ตรวจสอบว่ามี segment ใดที่ผ่านโซนหรือไม่
            for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                const segmentStart = subMainPipe.coordinates[i];
                const segmentEnd = subMainPipe.coordinates[i + 1];

                // ตรวจสอบจุดเริ่มต้น จุดสิ้นสุด และจุดกึ่งกลางของ segment
                const segmentMidPoint = {
                    lat: (segmentStart.lat + segmentEnd.lat) / 2,
                    lng: (segmentStart.lng + segmentEnd.lng) / 2,
                };

                const startInZone = isPointInZone(segmentStart, zone);
                const endInZone = isPointInZone(segmentEnd, zone);
                const midInZone = isPointInZone(segmentMidPoint, zone);

                if (startInZone || endInZone || midInZone) {
                    return true; // พบ segment ที่ผ่านโซน
                }
            }
            return false; // ไม่มี segment ใดผ่านโซน
        });

        console.log(
            `🔍 Zone ${zone.name}: Found ${relevantSubMainPipes.length} relevant SubMain pipes`
        );

        if (relevantSubMainPipes.length === 0) {
            console.log(`⚠️ Zone ${zone.name}: No SubMain pipes through zone, skipping`);
            continue;
        }

        // หา segment ที่ผ่านโซนเพื่อใช้ทิศทางในการจัดกลุ่มต้นไม้
        // ใช้ทิศทางของ segment ที่ตัดกันจริงๆ แทนทิศทางหลัก
        let segmentDirectionForGrouping: 'horizontal' | 'vertical' = 'horizontal';
        let foundSegment = false;

        // หา segment แรกที่ผ่านโซนเพื่อใช้ทิศทาง
        for (const subMainPipe of relevantSubMainPipes) {
            for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                const segmentStart = subMainPipe.coordinates[i];
                const segmentEnd = subMainPipe.coordinates[i + 1];
                const segmentMidPoint = {
                    lat: (segmentStart.lat + segmentEnd.lat) / 2,
                    lng: (segmentStart.lng + segmentEnd.lng) / 2,
                };
                const segmentInZone =
                    isPointInZone(segmentStart, zone) ||
                    isPointInZone(segmentEnd, zone) ||
                    isPointInZone(segmentMidPoint, zone);

                if (segmentInZone) {
                    segmentDirectionForGrouping = getSegmentDirection(segmentStart, segmentEnd);
                    foundSegment = true;
                    console.log(
                        `🔍 Zone ${zone.name}: ใช้ทิศทางของ segment ${i} ของท่อ ${subMainPipe.id}: ${segmentDirectionForGrouping}`
                    );
                    break;
                }
            }
            if (foundSegment) break;
        }

        // ถ้าไม่พบ segment ให้ใช้ทิศทางหลักของท่อเมนรอง
        if (!foundSegment) {
            segmentDirectionForGrouping = getSubMainDirection(relevantSubMainPipes[0]);
            console.log(
                `⚠️ Zone ${zone.name}: ไม่พบ segment ในโซน ใช้ทิศทางหลัก: ${segmentDirectionForGrouping}`
            );
        }

        // จัดกลุ่มต้นไม้ให้ตั้งฉากกับทิศทางของ segment ที่ตัดกัน
        // ถ้า SubMain แนวตั้ง (vertical) → ท่อย่อยแนวนอน (rows)
        // ถ้า SubMain แนวนอน (horizontal) → ท่อย่อยแนวตั้ง (columns)
        const plantGroups = groupPlantsPerpendicularToSubMain(
            plantsInZone,
            segmentDirectionForGrouping
        );

        console.log(
            `🔍 Zone ${zone.name}: Created ${plantGroups.length} plant groups (ทิศทาง SubMain: ${segmentDirectionForGrouping})`
        );

        for (const row of plantGroups) {
            if (row.length < 1) {
                console.log(`⚠️ Empty plant group, skipping`);
                continue;
            }

            // ใช้ createPerpendicularLateralPipe เพื่อคำนวณทิศทางที่ถูกต้องตามแนวต้นไม้
            // ใช้ทิศทางของ segment ที่ตัดกันจริงๆ
            let pipeStart: Coordinate;
            let pipeEnd: Coordinate;
            let pipeLength: number;

            try {
                const pipeData = createPerpendicularLateralPipe(row, segmentDirectionForGrouping);
                pipeStart = pipeData.start;
                pipeEnd = pipeData.end;
                pipeLength = pipeData.length;
            } catch (error) {
                console.warn(`Error creating perpendicular pipe: ${error}`);
                continue;
            }

            // ขยายเส้นเพื่อหาจุดตัด
            const direction = {
                lat: pipeEnd.lat - pipeStart.lat,
                lng: pipeEnd.lng - pipeStart.lng,
            };
            const dirLength = Math.sqrt(
                direction.lat * direction.lat + direction.lng * direction.lng
            );

            if (dirLength === 0) continue; // ข้ามถ้าทิศทางไม่ถูกต้อง

            const normalizedDir = {
                lat: direction.lat / dirLength,
                lng: direction.lng / dirLength,
            };

            const extendedStart = {
                lat: pipeStart.lat - normalizedDir.lat * 0.0001,
                lng: pipeStart.lng - normalizedDir.lng * 0.0001,
            };
            const extendedEnd = {
                lat: pipeEnd.lat + normalizedDir.lat * 0.0001,
                lng: pipeEnd.lng + normalizedDir.lng * 0.0001,
            };

            // ตรวจสอบทุก Sub Main pipe ที่เกี่ยวข้อง
            for (const subMainPipe of relevantSubMainPipes) {
                // ตรวจสอบทุก segment ของ Sub Main pipe
                for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                    const segmentStart = subMainPipe.coordinates[i];
                    const segmentEnd = subMainPipe.coordinates[i + 1];

                    // ตรวจสอบว่า segment อยู่ในโซนหรือไม่
                    const segmentMidPoint = {
                        lat: (segmentStart.lat + segmentEnd.lat) / 2,
                        lng: (segmentStart.lng + segmentEnd.lng) / 2,
                    };
                    const segmentInZone =
                        isPointInZone(segmentStart, zone) ||
                        isPointInZone(segmentEnd, zone) ||
                        isPointInZone(segmentMidPoint, zone);

                    if (!segmentInZone) {
                        continue;
                    }

                    // หาจุดตัดระหว่างเส้นท่อย่อย (ที่ผ่านแนวต้นไม้) กับ segment ของ SubMain
                    const intersection = findLineIntersection(
                        extendedStart,
                        extendedEnd,
                        segmentStart,
                        segmentEnd
                    );

                    if (intersection) {
                        const intersectionInZone = isPointInZone(intersection, zone);

                        if (!intersectionInZone) {
                            continue;
                        }

                        if (
                            isFinite(pipeLength) &&
                            pipeLength >= config.minPipeLength &&
                            pipeLength <= config.maxPipeLength &&
                            pipeStart &&
                            pipeEnd &&
                            isFinite(intersection.lat) &&
                            isFinite(intersection.lng)
                        ) {
                            // กรอง plants ที่มีข้อมูลครบถ้วน
                            let validPlants = row.filter(
                                (p) =>
                                    p &&
                                    p.position &&
                                    isFinite(p.position.lat) &&
                                    isFinite(p.position.lng) &&
                                    p.plantData
                            );

                            // กรองต้นไม้ให้เหลือเฉพาะต้นไม้ที่อยู่ในโซนเดียวกับท่อ SubMain
                            // เพื่อป้องกันการสร้างท่อย่อยที่มีต้นไม้ในโซนอื่น
                            if (subMainPipe.zoneId) {
                                const originalCount = validPlants.length;
                                validPlants = validPlants.filter((plant) => {
                                    // ตรวจสอบว่า plant อยู่ในโซนเดียวกับท่อ SubMain หรือไม่
                                    const plantInZone = isPointInZone(plant.position, zone);
                                    if (!plantInZone) {
                                        console.log(
                                            `⚠️ [THROUGH_SUBMAIN] กรองต้นไม้ ${plant.id}: ไม่อยู่ในโซน ${zone.id} (ท่อ SubMain zoneId: ${subMainPipe.zoneId})`
                                        );
                                    }
                                    return plantInZone;
                                });

                                if (validPlants.length < originalCount) {
                                    console.log(
                                        `🔍 [THROUGH_SUBMAIN] กรองต้นไม้ออก ${originalCount - validPlants.length} ต้น (เหลือ ${validPlants.length} ต้นในโซน ${zone.id})`
                                    );
                                }
                            }

                            if (validPlants.length === 0) {
                                console.log(
                                    `⚠️ [THROUGH_SUBMAIN] ไม่มีต้นไม้ที่อยู่ในโซน ${zone.id} หลังจากกรองแล้ว, ข้าม`
                                );
                                continue;
                            }

                            // ใช้ตำแหน่งต้นไม้จริง (ต้นแรกและสุดท้าย) แทน pipeStart/pipeEnd เพื่อไม่ให้ลากเกินต้นไม้
                            // เรียงต้นไม้ตามแนวท่อ
                            // ใช้ทิศทางของ segment หรือทิศทางหลักของ Sub Main
                            const segmentDirection = getSegmentDirection(segmentStart, segmentEnd);
                            const rotationInfo = hasRotation(validPlants);
                            let sortedPlants = [...validPlants];

                            if (segmentDirection === 'vertical') {
                                // ท่อย่อยแนวนอน - เรียงตาม lng
                                sortedPlants.sort((a, b) => {
                                    if (rotationInfo.hasRotation) {
                                        const aTransformed = transformToRotatedCoordinate(
                                            a.position,
                                            rotationInfo.center,
                                            rotationInfo.rotationAngle
                                        );
                                        const bTransformed = transformToRotatedCoordinate(
                                            b.position,
                                            rotationInfo.center,
                                            rotationInfo.rotationAngle
                                        );
                                        return aTransformed.lng - bTransformed.lng;
                                    }
                                    return a.position.lng - b.position.lng;
                                });
                            } else {
                                // ท่อย่อยแนวตั้ง - เรียงตาม lat
                                sortedPlants.sort((a, b) => {
                                    if (rotationInfo.hasRotation) {
                                        const aTransformed = transformToRotatedCoordinate(
                                            a.position,
                                            rotationInfo.center,
                                            rotationInfo.rotationAngle
                                        );
                                        const bTransformed = transformToRotatedCoordinate(
                                            b.position,
                                            rotationInfo.center,
                                            rotationInfo.rotationAngle
                                        );
                                        return aTransformed.lat - bTransformed.lat;
                                    }
                                    return a.position.lat - b.position.lat;
                                });
                            }

                            // ใช้ตำแหน่งต้นไม้ต้นแรกและสุดท้ายจริง
                            const actualStart = sortedPlants[0].position;
                            const actualEnd = sortedPlants[sortedPlants.length - 1].position;
                            const actualLength = calculateDistance(actualStart, actualEnd);

                            const lateralPipe: AutoLateralPipeResult = {
                                id: `auto-lateral-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                coordinates: [actualStart, actualEnd],
                                length: actualLength,
                                plants: validPlants,
                                placementMode: 'over_plants',
                                totalWaterNeed: validPlants.reduce(
                                    (sum, plant) => sum + (plant?.plantData?.waterNeed || 0),
                                    0
                                ),
                                connectionPoint: intersection,
                                zoneId: zone.id,
                                intersectionData: {
                                    subMainPipeId: subMainPipe.id,
                                    point: intersection,
                                    segmentIndex: i,
                                },
                                connectionType: 'through_submain',
                            };

                            // ตรวจสอบว่าท่อมีข้อมูลครบถ้วนก่อนเพิ่ม
                            if (
                                lateralPipe.plants.length > 0 &&
                                lateralPipe.coordinates.length >= 2 &&
                                isFinite(lateralPipe.length)
                            ) {
                                results.push(lateralPipe);
                                break; // หยุดเมื่อพบจุดตัดแรกที่ถูกต้อง
                            }
                        }
                    }
                }
            }
        }
    }

    if (results.length === 0) {
        return generateSimpleLateralPipes(subMainPipes, zones, config);
    }

    return results;
};

/**
 * คำนวณทิศทางหลักของ SubMain pipe โดยพิจารณาทุก segment
 * เหมาะสำหรับท่อที่โค้งหรือมีหลายจุด
 */
const getSubMainDirection = (subMainPipe: SubMainPipe): 'horizontal' | 'vertical' => {
    if (subMainPipe.coordinates.length < 2) return 'horizontal';

    // ถ้ามีแค่ 2 จุด ใช้วิธีเดิม
    if (subMainPipe.coordinates.length === 2) {
        const start = subMainPipe.coordinates[0];
        const end = subMainPipe.coordinates[1];
        const latDiff = Math.abs(end.lat - start.lat);
        const lngDiff = Math.abs(end.lng - start.lng);
        return latDiff > lngDiff ? 'vertical' : 'horizontal';
    }

    // สำหรับท่อที่มีหลายจุด: คำนวณค่าเฉลี่ยของทิศทางทุก segment
    let totalLatDiff = 0;
    let totalLngDiff = 0;
    let segmentCount = 0;

    for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
        const segmentStart = subMainPipe.coordinates[i];
        const segmentEnd = subMainPipe.coordinates[i + 1];
        const segmentLatDiff = Math.abs(segmentEnd.lat - segmentStart.lat);
        const segmentLngDiff = Math.abs(segmentEnd.lng - segmentStart.lng);

        // น้ำหนักตามความยาวของ segment
        const segmentLength = calculateDistance(segmentStart, segmentEnd);
        if (segmentLength > 0) {
            totalLatDiff += segmentLatDiff * segmentLength;
            totalLngDiff += segmentLngDiff * segmentLength;
            segmentCount += segmentLength;
        }
    }

    if (segmentCount === 0) return 'horizontal';

    const avgLatDiff = totalLatDiff / segmentCount;
    const avgLngDiff = totalLngDiff / segmentCount;

    return avgLatDiff > avgLngDiff ? 'vertical' : 'horizontal';
};

/**
 * คำนวณทิศทางของ segment เฉพาะ (local direction)
 * ใช้เมื่อต้องการทิศทางของ segment ที่เฉพาะเจาะจง
 */
const getSegmentDirection = (
    segmentStart: Coordinate,
    segmentEnd: Coordinate
): 'horizontal' | 'vertical' => {
    const latDiff = Math.abs(segmentEnd.lat - segmentStart.lat);
    const lngDiff = Math.abs(segmentEnd.lng - segmentStart.lng);
    return latDiff > lngDiff ? 'vertical' : 'horizontal';
};

const groupPlantsPerpendicularToSubMain = (
    plants: PlantLocation[],
    subMainDirection: 'horizontal' | 'vertical'
): PlantLocation[][] => {
    if (subMainDirection === 'vertical') {
        return groupPlantsByRows(plants);
    } else {
        return groupPlantsByColumns(plants);
    }
};

const createPerpendicularLateralPipe = (
    plants: PlantLocation[],
    subMainDirection: 'horizontal' | 'vertical'
): { start: Coordinate; end: Coordinate; length: number } => {
    if (plants.length === 0) {
        throw new Error('No plants provided');
    }

    const rotationInfo = hasRotation(plants);
    let start: Coordinate, end: Coordinate;

    if (rotationInfo.hasRotation) {
        const plantsWithTransformed = plants.map((plant) => ({
            plant,
            transformedPosition: transformToRotatedCoordinate(
                plant.position,
                rotationInfo.center,
                rotationInfo.rotationAngle
            ),
        }));

        if (subMainDirection === 'vertical') {
            // เรียงตาม lng (แนวตั้ง) - ท่อย่อยจะแนวนอน
            const sortedByTransformedLng = plantsWithTransformed.sort(
                (a, b) => a.transformedPosition.lng - b.transformedPosition.lng
            );

            // ใช้ต้นไม้แรกและสุดท้ายเพื่อคำนวณเส้นตรงที่ผ่านแนวต้นไม้
            const firstPlant = sortedByTransformedLng[0];
            const lastPlant = sortedByTransformedLng[sortedByTransformedLng.length - 1];

            // คำนวณค่าเฉลี่ย lat จากต้นไม้ทั้งหมด (เพื่อให้เส้นตรงแนวต้นไม้)
            const avgTransformedLat =
                plantsWithTransformed.reduce((sum, item) => sum + item.transformedPosition.lat, 0) /
                plantsWithTransformed.length;

            // ใช้ lng จากต้นไม้แรกและสุดท้ายจริง เพื่อให้ครอบคลุมแนวต้นไม้ทั้งหมด
            const startTransformed = {
                lat: avgTransformedLat,
                lng: firstPlant.transformedPosition.lng,
            };
            const endTransformed = {
                lat: avgTransformedLat,
                lng: lastPlant.transformedPosition.lng,
            };

            start = transformToRotatedCoordinate(
                startTransformed,
                rotationInfo.center,
                -rotationInfo.rotationAngle
            );
            end = transformToRotatedCoordinate(
                endTransformed,
                rotationInfo.center,
                -rotationInfo.rotationAngle
            );
        } else {
            // เรียงตาม lat (แนวนอน) - ท่อย่อยจะแนวตั้ง
            const sortedByTransformedLat = plantsWithTransformed.sort(
                (a, b) => a.transformedPosition.lat - b.transformedPosition.lat
            );

            // ใช้ต้นไม้แรกและสุดท้ายเพื่อคำนวณเส้นตรงที่ผ่านแนวต้นไม้
            const firstPlant = sortedByTransformedLat[0];
            const lastPlant = sortedByTransformedLat[sortedByTransformedLat.length - 1];

            // คำนวณค่าเฉลี่ย lng จากต้นไม้ทั้งหมด (เพื่อให้เส้นตรงแนวต้นไม้)
            const avgTransformedLng =
                plantsWithTransformed.reduce((sum, item) => sum + item.transformedPosition.lng, 0) /
                plantsWithTransformed.length;

            // ใช้ lat จากต้นไม้แรกและสุดท้ายจริง เพื่อให้ครอบคลุมแนวต้นไม้ทั้งหมด
            const startTransformed = {
                lat: firstPlant.transformedPosition.lat,
                lng: avgTransformedLng,
            };
            const endTransformed = {
                lat: lastPlant.transformedPosition.lat,
                lng: avgTransformedLng,
            };

            start = transformToRotatedCoordinate(
                startTransformed,
                rotationInfo.center,
                -rotationInfo.rotationAngle
            );
            end = transformToRotatedCoordinate(
                endTransformed,
                rotationInfo.center,
                -rotationInfo.rotationAngle
            );
        }
    } else {
        // ไม่มีการหมุน - ใช้ตำแหน่งต้นไม้จริงแทนค่าเฉลี่ย
        if (subMainDirection === 'vertical') {
            // Sub Main แนวตั้ง → ท่อย่อยแนวนอน (ตาม lng)
            const sortedByLng = [...plants].sort((a, b) => a.position.lng - b.position.lng);

            // คำนวณค่าเฉลี่ย lat จากต้นไม้ทั้งหมด
            const avgLat =
                plants.reduce((sum, plant) => sum + plant.position.lat, 0) / plants.length;

            // ใช้ตำแหน่งต้นไม้แรกและสุดท้ายจริง
            const firstPlant = sortedByLng[0];
            const lastPlant = sortedByLng[sortedByLng.length - 1];

            start = {
                lat: avgLat,
                lng: firstPlant.position.lng,
            };
            end = {
                lat: avgLat,
                lng: lastPlant.position.lng,
            };
        } else {
            // Sub Main แนวนอน → ท่อย่อยแนวตั้ง (ตาม lat)
            const sortedByLat = [...plants].sort((a, b) => a.position.lat - b.position.lat);

            // คำนวณค่าเฉลี่ย lng จากต้นไม้ทั้งหมด
            const avgLng =
                plants.reduce((sum, plant) => sum + plant.position.lng, 0) / plants.length;

            // ใช้ตำแหน่งต้นไม้แรกและสุดท้ายจริง
            const firstPlant = sortedByLat[0];
            const lastPlant = sortedByLat[sortedByLat.length - 1];

            start = {
                lat: firstPlant.position.lat,
                lng: avgLng,
            };
            end = {
                lat: lastPlant.position.lat,
                lng: avgLng,
            };
        }
    }

    const length = calculateDistance(start, end);
    return { start, end, length };
};

const generateSimpleLateralPipes = (
    subMainPipes: SubMainPipe[],
    zones: IrrigationZone[],
    config: AutoLateralPipeConfig
): AutoLateralPipeResult[] => {
    const results: AutoLateralPipeResult[] = [];

    for (const zone of zones) {
        const plantsInZone = zone.plants;
        if (plantsInZone.length === 0) continue;

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

        const subMainDirection = getSubMainDirection(closestSubMainPipe);

        const plantGroups = groupPlantsPerpendicularToSubMain(plantsInZone, subMainDirection);

        for (const group of plantGroups) {
            if (!group || group.length < 1) continue;

            try {
                const {
                    start: pipeStart,
                    end: pipeEnd,
                    length: pipeLength,
                } = createPerpendicularLateralPipe(group, subMainDirection);

                if (pipeLength >= config.minPipeLength && pipeLength <= config.maxPipeLength) {
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

                    if (
                        closestPoint &&
                        minDistance <= config.snapThreshold * 3 &&
                        isFinite(pipeLength) &&
                        isFinite(closestPoint.lat) &&
                        isFinite(closestPoint.lng) &&
                        pipeStart &&
                        pipeEnd
                    ) {
                        const lateralPipe: AutoLateralPipeResult = {
                            id: `auto-lateral-simple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            coordinates: [pipeStart, pipeEnd],
                            length: pipeLength,
                            plants: group.filter((p) => p && p.position && p.plantData), // กรอง plants ที่ไม่ถูกต้อง
                            placementMode: 'over_plants',
                            totalWaterNeed: group.reduce(
                                (sum, plant) => sum + (plant?.plantData?.waterNeed || 0),
                                0
                            ),
                            connectionPoint: closestPoint,
                            zoneId: zone.id,
                            intersectionData: {
                                subMainPipeId: closestSubMainPipe.id,
                                point: closestPoint,
                                segmentIndex: 0,
                            },
                            connectionType: 'from_submain',
                        };

                        // ตรวจสอบว่าท่อมีข้อมูลครบถ้วนก่อนเพิ่ม
                        if (
                            lateralPipe.plants.length > 0 &&
                            lateralPipe.coordinates.length >= 2 &&
                            isFinite(lateralPipe.length)
                        ) {
                            results.push(lateralPipe);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error creating lateral pipe: ${error}`);
            }
        }
    }

    return results;
};

export const generateFromSubMainPipes = (
    subMainPipes: SubMainPipe[],
    zones: IrrigationZone[],
    config: AutoLateralPipeConfig
): AutoLateralPipeResult[] => {
    const results: AutoLateralPipeResult[] = [];

    for (const zone of zones) {
        const plantsInZone = zone.plants;

        console.log(
            `🔍 [FROM_SUBMAIN] Processing zone: ${zone.name}, plants: ${plantsInZone.length}`
        );

        if (plantsInZone.length === 0) {
            console.log(`⚠️ [FROM_SUBMAIN] Zone ${zone.name}: No plants, skipping`);
            continue;
        }

        // หา Sub Main pipe ที่เกี่ยวข้องกับโซนนี้
        // ต้องกรองให้เหลือเฉพาะท่อที่มี zoneId ตรงกับโซนที่กำลังประมวลผลเท่านั้น
        // ห้ามใช้ท่อ SubMain ของโซนอื่นแม้ว่าจะผ่านโซนนี้ก็ตาม
        const relevantSubMainPipes = subMainPipes.filter((subMainPipe) => {
            // ตรวจสอบ zoneId ก่อน - ถ้ามี zoneId ต้องตรงกับโซนที่กำลังประมวลผลเท่านั้น
            if (subMainPipe.zoneId) {
                if (subMainPipe.zoneId !== zone.id) {
                    console.log(
                        `⚠️ [FROM_SUBMAIN] SubMain ${subMainPipe.id}: zoneId (${subMainPipe.zoneId}) ไม่ตรงกับโซน ${zone.id}, ข้ามทันที`
                    );
                    return false; // ข้ามท่อที่ zoneId ไม่ตรงกันทันที - ห้ามใช้ท่อของโซนอื่น
                }
                // ถ้า zoneId ตรงกัน ให้ใช้ท่อนี้
                console.log(
                    `✅ [FROM_SUBMAIN] SubMain ${subMainPipe.id}: zoneId (${subMainPipe.zoneId}) ตรงกับโซน ${zone.id}, ใช้ท่อนี้`
                );
                return true;
            }

            // ถ้าไม่มี zoneId (กรณีท่อสร้างก่อนวาดโซน) ให้ตรวจสอบด้วยพิกัด
            // (กรณีท่อสร้างก่อนวาดโซน หรือท่อที่อาจผ่านหลายโซน)
            let hasSegmentInZone = false;

            // ตรวจสอบว่ามี segment ใดที่ผ่านโซนหรือไม่
            for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                const segmentStart = subMainPipe.coordinates[i];
                const segmentEnd = subMainPipe.coordinates[i + 1];

                // ตรวจสอบจุดเริ่มต้น จุดสิ้นสุด และจุดกึ่งกลางของ segment
                const segmentMidPoint = {
                    lat: (segmentStart.lat + segmentEnd.lat) / 2,
                    lng: (segmentStart.lng + segmentEnd.lng) / 2,
                };

                const startInZone = isPointInZone(segmentStart, zone);
                const endInZone = isPointInZone(segmentEnd, zone);
                const midInZone = isPointInZone(segmentMidPoint, zone);

                if (startInZone || endInZone || midInZone) {
                    console.log(
                        `✅ [FROM_SUBMAIN] SubMain ${subMainPipe.id} segment ${i}: passes through zone (start: ${startInZone}, end: ${endInZone}, mid: ${midInZone})`
                    );
                    hasSegmentInZone = true;
                    break; // พบ segment ที่ผ่านโซนแล้ว ไม่ต้องตรวจต่อ
                }
            }

            if (!hasSegmentInZone) {
                console.log(
                    `⚠️ [FROM_SUBMAIN] SubMain ${subMainPipe.id}: No segments pass through zone (zoneId: ${subMainPipe.zoneId || 'none'}, zone.id: ${zone.id})`
                );
            }

            return hasSegmentInZone;
        });

        console.log(
            `🔍 [FROM_SUBMAIN] Zone ${zone.name}: Found ${relevantSubMainPipes.length} relevant SubMain pipes`
        );

        if (relevantSubMainPipes.length === 0) {
            console.log(
                `⚠️ [FROM_SUBMAIN] Zone ${zone.name}: No SubMain pipes through zone, skipping`
            );
            continue;
        }

        // หา segment ที่ผ่านโซนเพื่อใช้ทิศทางในการจัดกลุ่มต้นไม้
        // ใช้ทิศทางของ segment ที่ตัดกันจริงๆ แทนทิศทางหลัก
        let segmentDirectionForGrouping: 'horizontal' | 'vertical' = 'horizontal';
        let foundSegment = false;

        // หา segment แรกที่ผ่านโซนเพื่อใช้ทิศทาง
        for (const subMainPipe of relevantSubMainPipes) {
            for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                const segmentStart = subMainPipe.coordinates[i];
                const segmentEnd = subMainPipe.coordinates[i + 1];
                const segmentMidPoint = {
                    lat: (segmentStart.lat + segmentEnd.lat) / 2,
                    lng: (segmentStart.lng + segmentEnd.lng) / 2,
                };
                const segmentInZone =
                    isPointInZone(segmentStart, zone) ||
                    isPointInZone(segmentEnd, zone) ||
                    isPointInZone(segmentMidPoint, zone);

                if (segmentInZone) {
                    segmentDirectionForGrouping = getSegmentDirection(segmentStart, segmentEnd);
                    foundSegment = true;
                    console.log(
                        `🔍 [FROM_SUBMAIN] Zone ${zone.name}: ใช้ทิศทางของ segment ${i} ของท่อ ${subMainPipe.id}: ${segmentDirectionForGrouping}`
                    );
                    break;
                }
            }
            if (foundSegment) break;
        }

        // ถ้าไม่พบ segment ให้ใช้ทิศทางหลักของท่อเมนรอง
        if (!foundSegment) {
            segmentDirectionForGrouping = getSubMainDirection(relevantSubMainPipes[0]);
            console.log(
                `⚠️ [FROM_SUBMAIN] Zone ${zone.name}: ไม่พบ segment ในโซน ใช้ทิศทางหลัก: ${segmentDirectionForGrouping}`
            );
        }

        // จัดกลุ่มต้นไม้ให้ตั้งฉากกับทิศทางของ segment ที่ตัดกัน
        // ถ้า SubMain แนวตั้ง (vertical) → ท่อย่อยแนวนอน (rows)
        // ถ้า SubMain แนวนอน (horizontal) → ท่อย่อยแนวตั้ง (columns)
        const plantGroups = groupPlantsPerpendicularToSubMain(
            plantsInZone,
            segmentDirectionForGrouping
        );

        console.log(
            `🔍 [FROM_SUBMAIN] Zone ${zone.name}: Created ${plantGroups.length} plant groups (ทิศทาง SubMain: ${segmentDirectionForGrouping})`
        );

        for (let groupIdx = 0; groupIdx < plantGroups.length; groupIdx++) {
            const row = plantGroups[groupIdx];
            if (!row || row.length < 2) {
                console.log(
                    `⚠️ [FROM_SUBMAIN] Group ${groupIdx}: Too few plants (${row?.length || 0}), skipping`
                );
                continue;
            }

            console.log(`🔍 [FROM_SUBMAIN] Processing group ${groupIdx} with ${row.length} plants`);

            // กรอง plants ที่มีข้อมูลครบถ้วนก่อน
            let validPlants = row.filter(
                (p) =>
                    p &&
                    p.position &&
                    isFinite(p.position.lat) &&
                    isFinite(p.position.lng) &&
                    p.plantData
            );

            console.log(
                `🔍 [FROM_SUBMAIN] Group ${groupIdx}: Valid plants: ${validPlants.length} / ${row.length}`
            );

            // กรองต้นไม้ให้เหลือเฉพาะต้นไม้ที่อยู่ในโซนเดียวกับท่อ SubMain
            // เพื่อป้องกันการสร้างท่อย่อยที่มีต้นไม้ในโซนอื่น
            // หาท่อ SubMain ที่เกี่ยวข้องกับโซนนี้ (ควรมี zoneId ตรงกัน)
            const relevantSubMainForZone = relevantSubMainPipes.find((sm) => sm.zoneId === zone.id);

            if (relevantSubMainForZone && relevantSubMainForZone.zoneId) {
                const originalCount = validPlants.length;
                validPlants = validPlants.filter((plant) => {
                    // ตรวจสอบว่า plant อยู่ในโซนเดียวกับท่อ SubMain หรือไม่
                    const plantInZone = isPointInZone(plant.position, zone);
                    if (!plantInZone) {
                        console.log(
                            `⚠️ [FROM_SUBMAIN] กรองต้นไม้ ${plant.id}: ไม่อยู่ในโซน ${zone.id} (ท่อ SubMain zoneId: ${relevantSubMainForZone.zoneId})`
                        );
                    }
                    return plantInZone;
                });

                if (validPlants.length < originalCount) {
                    console.log(
                        `🔍 [FROM_SUBMAIN] กรองต้นไม้ออก ${originalCount - validPlants.length} ต้น (เหลือ ${validPlants.length} ต้นในโซน ${zone.id})`
                    );
                }
            }

            if (validPlants.length < 1) {
                console.log(
                    `⚠️ [FROM_SUBMAIN] Group ${groupIdx}: No valid plants after filtering, skipping`
                );
                continue;
            }

            // ใช้ createPerpendicularLateralPipe เพื่อคำนวณเส้นตรงที่ผ่านแนวต้นไม้จริง
            let pipeStart: Coordinate;
            let pipeEnd: Coordinate;

            try {
                const pipeData = createPerpendicularLateralPipe(
                    validPlants,
                    segmentDirectionForGrouping
                );
                pipeStart = pipeData.start;
                pipeEnd = pipeData.end;
            } catch (error) {
                console.warn(`Error creating perpendicular pipe for from_submain: ${error}`);
                continue;
            }

            // หาจุดตัดหรือจุดที่ใกล้ที่สุดระหว่างเส้นตรงที่ผ่านแนวต้นไม้กับ SubMain
            // ตรวจสอบทุก segment ของทุก Sub Main pipe
            let closestPoint: Coordinate | null = null;
            let minDistance = Infinity;
            let bestSegmentIndex = -1;
            let bestSubMainPipe: SubMainPipe | null = null;

            // ขยายเส้นตรงออกไปเพื่อหาจุดตัด
            const direction = {
                lat: pipeEnd.lat - pipeStart.lat,
                lng: pipeEnd.lng - pipeStart.lng,
            };
            const dirLength = Math.sqrt(
                direction.lat * direction.lat + direction.lng * direction.lng
            );

            if (dirLength > 0) {
                const normalizedDir = {
                    lat: direction.lat / dirLength,
                    lng: direction.lng / dirLength,
                };

                // ขยายเส้นตรงออกไปทั้งสองฝั่ง
                const extendedStart = {
                    lat: pipeStart.lat - normalizedDir.lat * 0.001,
                    lng: pipeStart.lng - normalizedDir.lng * 0.001,
                };
                const extendedEnd = {
                    lat: pipeEnd.lat + normalizedDir.lat * 0.001,
                    lng: pipeEnd.lng + normalizedDir.lng * 0.001,
                };

                // ตรวจสอบทุก Sub Main pipe
                for (const subMainPipe of relevantSubMainPipes) {
                    // ตรวจสอบทุก segment ของ Sub Main pipe
                    for (let i = 0; i < subMainPipe.coordinates.length - 1; i++) {
                        const segmentStart = subMainPipe.coordinates[i];
                        const segmentEnd = subMainPipe.coordinates[i + 1];

                        // ตรวจสอบว่า segment อยู่ในโซนหรือไม่
                        const segmentMidPoint = {
                            lat: (segmentStart.lat + segmentEnd.lat) / 2,
                            lng: (segmentStart.lng + segmentEnd.lng) / 2,
                        };
                        const segmentInZone =
                            isPointInZone(segmentStart, zone) ||
                            isPointInZone(segmentEnd, zone) ||
                            isPointInZone(segmentMidPoint, zone);

                        if (!segmentInZone) {
                            continue;
                        }

                        // หาจุดตัดระหว่างเส้นตรงกับ segment
                        const intersection = findLineIntersection(
                            extendedStart,
                            extendedEnd,
                            segmentStart,
                            segmentEnd
                        );

                        if (intersection) {
                            // พบจุดตัด - ตรวจสอบว่าจุดตัดอยู่บนเส้นตรงที่ผ่านแนวต้นไม้หรือไม่
                            const distToPipeStart = calculateDistance(intersection, pipeStart);
                            const distToPipeEnd = calculateDistance(intersection, pipeEnd);
                            const distOnPipeLine = Math.min(distToPipeStart, distToPipeEnd);

                            if (distOnPipeLine < minDistance) {
                                minDistance = distOnPipeLine;
                                closestPoint = intersection;
                                bestSegmentIndex = i;
                                bestSubMainPipe = subMainPipe;
                            }
                        } else {
                            // ไม่มีจุดตัด - หาจุดบน segment ที่ใกล้เส้นตรงที่ผ่านแนวต้นไม้มากที่สุด
                            let bestPointOnSegment: Coordinate | null = null;
                            let minDistToPipeLine = Infinity;

                            // หาจุดบน segment ที่ใกล้เส้นตรงมากที่สุด
                            const numChecks = 20;
                            for (let j = 0; j <= numChecks; j++) {
                                const t = j / numChecks;
                                const pointOnSegment = {
                                    lat: segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * t,
                                    lng: segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * t,
                                };

                                // หาจุดที่ใกล้ที่สุดบนเส้นตรงที่ผ่านแนวต้นไม้จาก pointOnSegment
                                const closestOnPipeLine = findClosestPointOnLine(
                                    pointOnSegment,
                                    pipeStart,
                                    pipeEnd
                                );
                                const distToPipeLine = calculateDistance(
                                    pointOnSegment,
                                    closestOnPipeLine
                                );

                                if (distToPipeLine < minDistToPipeLine) {
                                    minDistToPipeLine = distToPipeLine;
                                    bestPointOnSegment = pointOnSegment;
                                }
                            }

                            // ใช้จุดนี้ถ้าระยะห่างไม่เกิน snapThreshold
                            if (
                                bestPointOnSegment &&
                                minDistToPipeLine <= config.snapThreshold * 2
                            ) {
                                if (minDistToPipeLine < minDistance) {
                                    minDistance = minDistToPipeLine;
                                    closestPoint = bestPointOnSegment;
                                    bestSegmentIndex = i;
                                    bestSubMainPipe = subMainPipe;
                                }
                            }
                        }
                    }
                }
            }

            // ใช้ snapThreshold ที่ผ่อนปรนขึ้นเพื่อให้สร้างท่อได้มากขึ้น
            const relaxedThreshold = config.snapThreshold * 1.5;

            console.log(
                `🔍 [FROM_SUBMAIN] Group ${groupIdx}: Connection check - closestPoint: ${closestPoint ? 'found' : 'null'}, minDistance: ${minDistance.toFixed(2)}m, threshold: ${relaxedThreshold}m`
            );

            if (!closestPoint) {
                console.log(`⚠️ [FROM_SUBMAIN] Group ${groupIdx}: No closestPoint found, skipping`);
            } else if (!bestSubMainPipe) {
                console.log(
                    `⚠️ [FROM_SUBMAIN] Group ${groupIdx}: No bestSubMainPipe found, skipping`
                );
            } else if (minDistance > relaxedThreshold) {
                console.log(
                    `⚠️ [FROM_SUBMAIN] Group ${groupIdx}: Distance too far (${minDistance.toFixed(2)}m > ${relaxedThreshold}m), skipping`
                );
            }

            if (
                closestPoint &&
                bestSubMainPipe &&
                minDistance <= relaxedThreshold &&
                isFinite(closestPoint.lat) &&
                isFinite(closestPoint.lng)
            ) {
                console.log(
                    `✅ [FROM_SUBMAIN] Group ${groupIdx}: Creating lateral pipe from connection point`
                );

                // ใช้ bestSubMainPipe และ bestSegmentIndex แทน subMainPipe และ segmentIndex เดิม
                const subMainPipe = bestSubMainPipe;
                const segmentIndex = bestSegmentIndex;

                // หาจุดที่ใกล้ที่สุดบนเส้นท่อกับจุดเชื่อมต่อ
                const closestPointOnPipe = findClosestPointOnLine(closestPoint, pipeStart, pipeEnd);

                // คำนวณระยะทางจากจุดเชื่อมต่อไปยังปลายท่อทั้งสองข้าง
                const distFromConnectionToStart = calculateDistance(closestPoint, pipeStart);
                const distFromConnectionToEnd = calculateDistance(closestPoint, pipeEnd);
                const distOnPipeToStart = calculateDistance(closestPointOnPipe, pipeStart);
                const distOnPipeToEnd = calculateDistance(closestPointOnPipe, pipeEnd);
                const totalPipeLength = calculateDistance(pipeStart, pipeEnd);

                // ตรวจสอบว่าต้นไม้อยู่ฝั่งเดียวหรือสองฝั่ง
                // โดยดูว่าจุดเชื่อมต่ออยู่ใกล้ปลายท่อมากแค่ไหน (บนเส้นท่อ)
                // ถ้าจุดเชื่อมต่ออยู่ใกล้ปลายท่อมากกว่า 40% ของความยาวท่อ แสดงว่าต้นไม้อยู่ฝั่งเดียว
                const minDistOnPipe = Math.min(distOnPipeToStart, distOnPipeToEnd);
                const distanceRatio = totalPipeLength > 0 ? minDistOnPipe / totalPipeLength : 1;
                const isOneSideOnly = distanceRatio < 0.4 && totalPipeLength > 0;

                if (isOneSideOnly) {
                    // กรณีต้นไม้อยู่ฝั่งเดียว: สร้างท่อย่อยจากจุดเชื่อมต่อบนท่อเมนรองไปหาต้นไม้ทั้งหมด
                    // ใช้เส้นตรงที่คำนวณจาก createPerpendicularLateralPipe เพื่อให้ท่อตรงแนวต้นไม้

                    // กรองต้นไม้ให้เหลือเฉพาะต้นไม้ที่อยู่ในโซนเดียวกับท่อ SubMain
                    // เพื่อป้องกันการสร้างท่อย่อยที่มีต้นไม้ในโซนอื่น
                    const plantsInSubMainZoneForSingle = validPlants.filter((plant) => {
                        const plantInZone = isPointInZone(plant.position, zone);
                        if (!plantInZone) {
                            console.log(
                                `⚠️ [FROM_SUBMAIN] กรองต้นไม้ ${plant.id}: ไม่อยู่ในโซน ${zone.id} (ท่อ SubMain zoneId: ${subMainPipe.zoneId})`
                            );
                        }
                        return plantInZone;
                    });

                    if (plantsInSubMainZoneForSingle.length === 0) {
                        console.log(
                            `⚠️ [FROM_SUBMAIN] Group ${groupIdx}: ไม่มีต้นไม้ที่อยู่ในโซน ${zone.id} หลังจากกรองแล้ว, ข้าม`
                        );
                        continue;
                    }

                    // หาจุดบนเส้นท่อ (pipeStart-pipeEnd) ที่ควรเป็นจุดสิ้นสุด
                    // โดยหาจุดบนเส้นตรงที่ผ่านต้นไม้ที่ไกลจาก closestPoint ที่สุด
                    let farthestPlantOnLine: Coordinate | null = null;
                    let maxDistanceFromConnection = 0;

                    // หาต้นไม้ที่ไกลจากจุดเชื่อมต่อที่สุด (ใช้เฉพาะต้นไม้ที่อยู่ในโซน)
                    for (const plant of plantsInSubMainZoneForSingle) {
                        const distFromConnection = calculateDistance(closestPoint, plant.position);

                        // หาจุดบนเส้นท่อที่ใกล้ต้นไม้นี้ที่สุด (เพื่อให้ท่อตรงแนวต้นไม้)
                        const closestPointOnPipeForPlant = findClosestPointOnLine(
                            plant.position,
                            pipeStart,
                            pipeEnd
                        );

                        if (distFromConnection > maxDistanceFromConnection) {
                            maxDistanceFromConnection = distFromConnection;
                            farthestPlantOnLine = closestPointOnPipeForPlant;
                        }
                    }

                    if (!farthestPlantOnLine) {
                        continue; // ไม่มีต้นไม้ให้สร้างท่อ
                    }

                    // ใช้จุดบนเส้นตรงที่ผ่านแนวต้นไม้เป็นจุดสิ้นสุดท่อ (ตรงแนวต้นไม้)
                    const finalEnd = farthestPlantOnLine;
                    const pipeLength = calculateDistance(closestPoint, finalEnd);

                    if (
                        isFinite(pipeLength) &&
                        isFinite(finalEnd.lat) &&
                        isFinite(finalEnd.lng) &&
                        pipeLength >= config.minPipeLength &&
                        pipeLength <= config.maxPipeLength
                    ) {
                        const lateralPipe: AutoLateralPipeResult = {
                            id: `auto-lateral-single-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            coordinates: [closestPoint, finalEnd],
                            length: pipeLength,
                            plants: plantsInSubMainZoneForSingle, // ใช้เฉพาะต้นไม้ที่อยู่ในโซน
                            placementMode: 'over_plants',
                            totalWaterNeed: plantsInSubMainZoneForSingle.reduce(
                                (sum, plant) => sum + (plant?.plantData?.waterNeed || 0),
                                0
                            ),
                            connectionPoint: closestPoint,
                            zoneId: zone.id,
                            intersectionData: {
                                subMainPipeId: subMainPipe.id,
                                point: closestPoint,
                                segmentIndex: segmentIndex,
                            },
                            connectionType: 'from_submain',
                        };
                        if (lateralPipe.plants.length > 0 && isFinite(lateralPipe.length)) {
                            console.log(
                                `✅ [FROM_SUBMAIN] Group ${groupIdx}: Created single-side lateral pipe (length: ${lateralPipe.length.toFixed(2)}m, plants: ${lateralPipe.plants.length})`
                            );
                            results.push(lateralPipe);
                        } else {
                            console.log(
                                `⚠️ [FROM_SUBMAIN] Group ${groupIdx}: Single-side pipe validation failed (plants: ${lateralPipe.plants.length}, length: ${lateralPipe.length})`
                            );
                        }
                    }
                } else {
                    console.log(
                        `🔍 [FROM_SUBMAIN] Group ${groupIdx}: Plants on both sides (ratio: ${distanceRatio.toFixed(2)})`
                    );
                    // กรณีต้นไม้อยู่สองฝั่ง: สร้างท่อทั้งสองฝั่งจากจุดเชื่อมต่อ
                    // แยกต้นไม้เป็น 2 กลุ่ม: ฝั่งซ้าย (ใกล้ pipeStart) และฝั่งขวา (ใกล้ pipeEnd)

                    const leftPlants: PlantLocation[] = [];
                    const rightPlants: PlantLocation[] = [];

                    // กรองต้นไม้ให้เหลือเฉพาะต้นไม้ที่อยู่ในโซนเดียวกับท่อ SubMain ก่อน
                    const plantsInSubMainZone = validPlants.filter((plant) => {
                        const plantInZone = isPointInZone(plant.position, zone);
                        if (!plantInZone) {
                            console.log(
                                `⚠️ [FROM_SUBMAIN] กรองต้นไม้ ${plant.id}: ไม่อยู่ในโซน ${zone.id} (ท่อ SubMain zoneId: ${subMainPipe.zoneId})`
                            );
                        }
                        return plantInZone;
                    });

                    if (plantsInSubMainZone.length === 0) {
                        console.log(
                            `⚠️ [FROM_SUBMAIN] Group ${groupIdx}: ไม่มีต้นไม้ที่อยู่ในโซน ${zone.id} หลังจากกรองแล้ว, ข้าม`
                        );
                        continue;
                    }

                    // แยกต้นไม้ตามตำแหน่งเทียบกับจุดเชื่อมต่อบนเส้นท่อ (ใช้เฉพาะต้นไม้ที่อยู่ในโซน)
                    for (const plant of plantsInSubMainZone) {
                        const distToStart = calculateDistance(closestPointOnPipe, pipeStart);
                        const distToEnd = calculateDistance(closestPointOnPipe, pipeEnd);

                        // หาจุดที่ใกล้ที่สุดบนเส้นท่อกับตำแหน่งต้นไม้
                        const plantOnPipe = findClosestPointOnLine(
                            plant.position,
                            pipeStart,
                            pipeEnd
                        );
                        const plantDistToStart = calculateDistance(plantOnPipe, pipeStart);
                        const plantDistToEnd = calculateDistance(plantOnPipe, pipeEnd);

                        // ตรวจสอบว่าต้นไม่อยู่ฝั่งไหน โดยดูว่าอยู่ใกล้ pipeStart หรือ pipeEnd มากกว่า
                        if (plantDistToStart < plantDistToEnd) {
                            leftPlants.push(plant);
                        } else {
                            rightPlants.push(plant);
                        }
                    }

                    // สร้างท่อฝั่งซ้าย (ถ้ามีต้นไม้)
                    if (leftPlants.length > 0) {
                        // หาจุดบนเส้นท่อที่ควรเป็นจุดสิ้นสุดฝั่งซ้าย
                        // โดยหาจุดบนเส้นตรงที่ผ่านต้นไม้ที่ไกลจาก closestPoint ที่สุด
                        let farthestLeftPlantOnLine: Coordinate | null = null;
                        let maxLeftDistanceFromConnection = 0;

                        for (const plant of leftPlants) {
                            const distFromConnection = calculateDistance(
                                closestPoint,
                                plant.position
                            );

                            // หาจุดบนเส้นท่อที่ใกล้ต้นไม้นี้ที่สุด (เพื่อให้ท่อตรงแนวต้นไม้)
                            const closestPointOnPipeForPlant = findClosestPointOnLine(
                                plant.position,
                                pipeStart,
                                pipeEnd
                            );

                            if (distFromConnection > maxLeftDistanceFromConnection) {
                                maxLeftDistanceFromConnection = distFromConnection;
                                farthestLeftPlantOnLine = closestPointOnPipeForPlant;
                            }
                        }

                        if (farthestLeftPlantOnLine) {
                            // ใช้จุดบนเส้นตรงที่ผ่านแนวต้นไม้เป็นจุดสิ้นสุดท่อ (ตรงแนวต้นไม้)
                            const leftEnd = farthestLeftPlantOnLine;
                            const leftLength = calculateDistance(closestPoint, leftEnd);

                            if (
                                isFinite(leftLength) &&
                                isFinite(leftEnd.lat) &&
                                isFinite(leftEnd.lng) &&
                                leftLength >= config.minPipeLength &&
                                leftLength <= config.maxPipeLength
                            ) {
                                const leftPipe: AutoLateralPipeResult = {
                                    id: `auto-lateral-left-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    coordinates: [closestPoint, leftEnd],
                                    length: leftLength,
                                    plants: leftPlants,
                                    placementMode: 'over_plants',
                                    totalWaterNeed: leftPlants.reduce(
                                        (sum, plant) => sum + (plant?.plantData?.waterNeed || 0),
                                        0
                                    ),
                                    connectionPoint: closestPoint,
                                    zoneId: zone.id,
                                    intersectionData: {
                                        subMainPipeId: subMainPipe.id,
                                        point: closestPoint,
                                        segmentIndex: segmentIndex,
                                    },
                                    connectionType: 'from_submain',
                                };
                                if (leftPipe.plants.length > 0 && isFinite(leftPipe.length)) {
                                    console.log(
                                        `✅ [FROM_SUBMAIN] Group ${groupIdx}: Created left-side lateral pipe (length: ${leftPipe.length.toFixed(2)}m, plants: ${leftPipe.plants.length})`
                                    );
                                    results.push(leftPipe);
                                } else {
                                    console.log(
                                        `⚠️ [FROM_SUBMAIN] Group ${groupIdx}: Left-side pipe validation failed (plants: ${leftPipe.plants.length}, length: ${leftPipe.length})`
                                    );
                                }
                            }
                        }
                    }

                    // สร้างท่อฝั่งขวา (ถ้ามีต้นไม้)
                    if (rightPlants.length > 0) {
                        // หาจุดบนเส้นท่อที่ควรเป็นจุดสิ้นสุดฝั่งขวา
                        // โดยหาจุดบนเส้นตรงที่ผ่านต้นไม้ที่ไกลจาก closestPoint ที่สุด
                        let farthestRightPlantOnLine: Coordinate | null = null;
                        let maxRightDistanceFromConnection = 0;

                        for (const plant of rightPlants) {
                            const distFromConnection = calculateDistance(
                                closestPoint,
                                plant.position
                            );

                            // หาจุดบนเส้นท่อที่ใกล้ต้นไม้นี้ที่สุด (เพื่อให้ท่อตรงแนวต้นไม้)
                            const closestPointOnPipeForPlant = findClosestPointOnLine(
                                plant.position,
                                pipeStart,
                                pipeEnd
                            );

                            if (distFromConnection > maxRightDistanceFromConnection) {
                                maxRightDistanceFromConnection = distFromConnection;
                                farthestRightPlantOnLine = closestPointOnPipeForPlant;
                            }
                        }

                        if (farthestRightPlantOnLine) {
                            // ใช้จุดบนเส้นตรงที่ผ่านแนวต้นไม้เป็นจุดสิ้นสุดท่อ (ตรงแนวต้นไม้)
                            const rightEnd = farthestRightPlantOnLine;
                            const rightLength = calculateDistance(closestPoint, rightEnd);

                            if (
                                isFinite(rightLength) &&
                                isFinite(rightEnd.lat) &&
                                isFinite(rightEnd.lng) &&
                                rightLength >= config.minPipeLength &&
                                rightLength <= config.maxPipeLength
                            ) {
                                const rightPipe: AutoLateralPipeResult = {
                                    id: `auto-lateral-right-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    coordinates: [closestPoint, rightEnd],
                                    length: rightLength,
                                    plants: rightPlants,
                                    placementMode: 'over_plants',
                                    totalWaterNeed: rightPlants.reduce(
                                        (sum, plant) => sum + (plant?.plantData?.waterNeed || 0),
                                        0
                                    ),
                                    connectionPoint: closestPoint,
                                    zoneId: zone.id,
                                    intersectionData: {
                                        subMainPipeId: subMainPipe.id,
                                        point: closestPoint,
                                        segmentIndex: segmentIndex,
                                    },
                                    connectionType: 'from_submain',
                                };
                                if (rightPipe.plants.length > 0 && isFinite(rightPipe.length)) {
                                    console.log(
                                        `✅ [FROM_SUBMAIN] Group ${groupIdx}: Created right-side lateral pipe (length: ${rightPipe.length.toFixed(2)}m, plants: ${rightPipe.plants.length})`
                                    );
                                    results.push(rightPipe);
                                } else {
                                    console.log(
                                        `⚠️ [FROM_SUBMAIN] Group ${groupIdx}: Right-side pipe validation failed (plants: ${rightPipe.plants.length}, length: ${rightPipe.length})`
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return results;
};

export const generateAutoLateralPipes = (
    mode: 'through_submain' | 'from_submain',
    subMainPipes: SubMainPipe[],
    zones: IrrigationZone[],
    config: Partial<AutoLateralPipeConfig> = {}
): AutoLateralPipeResult[] => {
    console.log(
        `🚀 [GENERATE] Starting auto lateral pipe generation - mode: ${mode}, zones: ${zones.length}, subMainPipes: ${subMainPipes.length}`
    );

    const defaultConfig: AutoLateralPipeConfig = {
        mode,
        snapThreshold: 20,
        minPipeLength: 5,
        maxPipeLength: 200,
        ...config,
    };

    console.log(`🚀 [GENERATE] Final config:`, {
        snapThreshold: defaultConfig.snapThreshold,
        minPipeLength: defaultConfig.minPipeLength,
        maxPipeLength: defaultConfig.maxPipeLength,
    });

    let results: AutoLateralPipeResult[] = [];

    if (mode === 'through_submain') {
        console.log(`🚀 [GENERATE] Using through_submain mode`);
        results = generateThroughSubMainPipes(subMainPipes, zones, defaultConfig);
    } else if (mode === 'from_submain') {
        console.log(`🚀 [GENERATE] Using from_submain mode`);
        results = generateFromSubMainPipes(subMainPipes, zones, defaultConfig);
    } else {
        console.log(`🚀 [GENERATE] Using fallback simple mode`);
        // Fallback to simple mode
        results = generateSimpleLateralPipes(subMainPipes, zones, defaultConfig);
    }

    console.log(`🚀 [GENERATE] Final result: ${results.length} pipes generated`);

    return results;
};

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

        const zone = zones.find((z) => z.id === pipe.zoneId);
        if (!zone) {
            isValid = false;
            reason = 'ไม่พบโซนที่ระบุ';
        } else {
            // Check if most points are in zone (allow some tolerance)
            const pointsInZone = pipe.coordinates.filter((coord) => isPointInZone(coord, zone));
            const pointsInZonePercentage = (pointsInZone.length / pipe.coordinates.length) * 100;

            // ตรวจสอบว่าต้นไม้ทั้งหมดอยู่ในโซนหรือไม่
            const plantsInZone = pipe.plants.filter(
                (plant) => plant && plant.position && isPointInZone(plant.position, zone)
            );
            const plantsInZonePercentage =
                pipe.plants.length > 0 ? (plantsInZone.length / pipe.plants.length) * 100 : 0;

            // ถ้าต้นไม้ทั้งหมดอยู่ในโซน และจุดของท่ออย่างน้อย 70% อยู่ในโซน ให้ผ่าน
            // หรือถ้าจุดของท่อ 80% ขึ้นไปอยู่ในโซน ก็ให้ผ่าน
            if (plantsInZonePercentage >= 95 && pointsInZonePercentage >= 70) {
                // ผ่าน - ต้นไม้ทั้งหมดอยู่ในโซนและท่อส่วนใหญ่อยู่ในโซน
                if (pointsInZonePercentage < 95) {
                    console.warn(
                        `ท่อ ${pipe.id}: ${pointsInZonePercentage.toFixed(1)}% อยู่ในโซน แต่ต้นไม้ทั้งหมดอยู่ในโซน`
                    );
                }
            } else if (pointsInZonePercentage < 70) {
                isValid = false;
                reason = `ท่อออกนอกขอบเขตโซน (${pointsInZonePercentage.toFixed(1)}% อยู่ในโซน, ${plantsInZonePercentage.toFixed(1)}% ของต้นไม้อยู่ในโซน)`;
            } else if (pointsInZonePercentage < 95) {
                // Log warning but don't mark as invalid
                console.warn(`ท่อ ${pipe.id}: ${pointsInZonePercentage.toFixed(1)}% อยู่ในโซน`);
            }
        }

        if (pipe.length < 1) {
            isValid = false;
            reason = 'ท่อสั้นเกินไป';
        }

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

export interface AutoLateralConnectionPoint {
    id: string;
    position: Coordinate;
    connectedLaterals: string[];
    subMainPipeId: string;
    zoneId: string;
    type: 'through_submain' | 'from_submain';
    color: string;
    title: string;
}

export const createAutoLateralConnectionPoints = (
    pipes: AutoLateralPipeResult[]
): AutoLateralConnectionPoint[] => {
    const connectionPoints: AutoLateralConnectionPoint[] = [];

    // ตรวจสอบว่ามีท่อหรือไม่
    if (!pipes || pipes.length === 0) {
        return connectionPoints;
    }

    // ใช้ threshold 3 เมตรสำหรับการรวมจุดที่ใกล้กัน (ลดจาก 5 เมตรเพื่อความแม่นยำ)
    const MERGE_THRESHOLD_METERS = 3; // 3 meters

    // ฟังก์ชันตรวจสอบว่าจุดสองจุดอยู่ใกล้กันมากพอที่จะรวมกันหรือไม่
    const arePointsClose = (
        point1: Coordinate,
        point2: Coordinate,
        thresholdMeters: number = MERGE_THRESHOLD_METERS
    ): boolean => {
        const distance = calculateDistance(point1, point2);
        return distance <= thresholdMeters;
    };

    // ฟังก์ชันหาจุดเชื่อมต่อที่ใกล้ที่สุด (ปรับปรุงให้ครอบคลุมมากขึ้น)
    const findNearbyConnectionPoint = (
        point: Coordinate,
        zoneId: string,
        connectionType: 'through_submain' | 'from_submain',
        subMainPipeId: string
    ): AutoLateralConnectionPoint | null => {
        for (const existingPoint of connectionPoints) {
            // ตรวจสอบว่าจุดอยู่ใกล้กัน
            if (!arePointsClose(existingPoint.position, point, MERGE_THRESHOLD_METERS)) {
                continue;
            }

            // ตรวจสอบว่าเป็นโซนเดียวกัน, โหมดเดียวกัน, และท่อเมนรองเดียวกัน
            if (
                existingPoint.zoneId === zoneId &&
                existingPoint.type === connectionType &&
                existingPoint.subMainPipeId === subMainPipeId
            ) {
                return existingPoint;
            }

            // ถ้าจุดอยู่ใกล้กันมาก (ภายใน 1 เมตร) แม้จะเป็น type ต่างกันหรือ subMainPipeId ต่างกัน
            // ให้ merge ถ้าเป็นโซนเดียวกัน (เพื่อหลีกเลี่ยงจุดซ้ำ)
            if (
                arePointsClose(existingPoint.position, point, 1) &&
                existingPoint.zoneId === zoneId
            ) {
                return existingPoint;
            }
        }
        return null;
    };

    // ตรวจสอบและกรองท่อที่มี intersectionData
    const validPipes = pipes.filter((pipe) => {
        if (!pipe.intersectionData) return false;
        if (!pipe.intersectionData.point) return false;
        if (!pipe.intersectionData.subMainPipeId) return false;
        if (!pipe.zoneId) return false;
        return true;
    });

    for (const pipe of validPipes) {
        const { point, subMainPipeId } = pipe.intersectionData!;
        const connectionType = pipe.connectionType || 'from_submain';

        // ตรวจสอบว่าจุดมีข้อมูลครบถ้วน
        if (!point || !subMainPipeId || !pipe.zoneId) {
            console.warn('Invalid pipe data for connection point:', pipe);
            continue;
        }

        // หาจุดเชื่อมต่อที่ใกล้ที่สุด
        const nearbyPoint = findNearbyConnectionPoint(
            point,
            pipe.zoneId,
            connectionType,
            subMainPipeId
        );

        if (nearbyPoint) {
            // รวมท่อเข้ากับจุดที่มีอยู่แล้ว
            if (!nearbyPoint.connectedLaterals.includes(pipe.id)) {
                nearbyPoint.connectedLaterals.push(pipe.id);

                // อัปเดต title ให้แสดงจำนวนท่อที่เชื่อมต่อ
                if (connectionType === 'through_submain') {
                    nearbyPoint.title = `จุดข้ามท่อเมนย่อย (ลากผ่าน) - ${nearbyPoint.connectedLaterals.length} ท่อ`;
                } else {
                    nearbyPoint.title = `จุดเชื่อมต่อท่อเมนย่อย (เริ่มจาก) - ${nearbyPoint.connectedLaterals.length} ท่อ`;
                }
            }
        } else {
            // สร้างจุดเชื่อมต่อใหม่
            const color = connectionType === 'through_submain' ? '#4CAF50' : '#FFD700'; // เขียว : เหลือง
            const title =
                connectionType === 'through_submain'
                    ? 'จุดข้ามท่อเมนย่อย (ลากผ่าน) - 1 ท่อ'
                    : 'จุดเชื่อมต่อท่อเมนย่อย (เริ่มจาก) - 1 ท่อ';

            const connectionPoint: AutoLateralConnectionPoint = {
                id: `auto-connection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                position: point,
                connectedLaterals: [pipe.id],
                subMainPipeId,
                zoneId: pipe.zoneId,
                type: connectionType,
                color,
                title,
            };

            connectionPoints.push(connectionPoint);
        }
    }

    // ตรวจสอบและลบจุดที่ซ้ำกันซ้ำอีกครั้ง (เพื่อความแน่ใจ)
    const finalPoints: AutoLateralConnectionPoint[] = [];
    const seenPositions = new Map<string, AutoLateralConnectionPoint>();

    for (const point of connectionPoints) {
        const positionKey = `${point.position.lat.toFixed(6)}_${point.position.lng.toFixed(6)}`;
        const existingPoint = seenPositions.get(positionKey);

        if (existingPoint) {
            // ถ้ามีจุดอยู่ที่ตำแหน่งเดียวกัน ให้ merge ท่อเข้าด้วยกัน
            for (const lateralId of point.connectedLaterals) {
                if (!existingPoint.connectedLaterals.includes(lateralId)) {
                    existingPoint.connectedLaterals.push(lateralId);
                }
            }

            // อัปเดต title
            if (existingPoint.type === 'through_submain') {
                existingPoint.title = `จุดข้ามท่อเมนย่อย (ลากผ่าน) - ${existingPoint.connectedLaterals.length} ท่อ`;
            } else {
                existingPoint.title = `จุดเชื่อมต่อท่อเมนย่อย (เริ่มจาก) - ${existingPoint.connectedLaterals.length} ท่อ`;
            }
        } else {
            // เพิ่มจุดใหม่
            finalPoints.push(point);
            seenPositions.set(positionKey, point);
        }
    }

    return finalPoints;
};
