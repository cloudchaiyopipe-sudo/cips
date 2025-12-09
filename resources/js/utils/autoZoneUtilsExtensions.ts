import { Coordinate, PlantLocation, IrrigationZone } from './irrigationZoneUtils';
import {
    isPointInPolygon,
    findPlantsInPolygon,
    checkPolygonIntersection,
    calculatePolygonArea,
    calculateOverlapArea,
} from './autoZoneUtils';

// 🔧 FIX: ปรับปรุง updateEditedZone เพื่อ reassign ต้นไม้ให้ถูกต้อง
export const updateEditedZone = (
    zones: IrrigationZone[],
    editedZone: IrrigationZone,
    allPlants: PlantLocation[]
): IrrigationZone[] => {
    // 🔧 FIX: หาต้นไม้ในโซนที่แก้ไขแล้วจาก coordinates จริง
    const plantsInEditedZone = findPlantsInPolygon(allPlants, editedZone.coordinates);

    const updatedEditedZone: IrrigationZone = {
        ...editedZone,
        plants: plantsInEditedZone,
        totalWaterNeed: plantsInEditedZone.reduce(
            (sum, plant) => sum + plant.plantData.waterNeed,
            0
        ),
    };

    // 🔧 FIX: Reassign ต้นไม้ทั้งหมดให้โซนที่ถูกต้อง
    // เริ่มจากโซนที่แก้ไข แล้วค่อย reassign ให้โซนอื่น
    const updatedZones = zones.map((zone) => {
        if (zone.id === editedZone.id) {
            return updatedEditedZone;
        } else {
            // หาต้นไม้ในโซนนี้ (ไม่รวมต้นไม้ที่อยู่ในโซนที่แก้ไขแล้ว)
            const plantsInThisZone = findPlantsInPolygon(
                allPlants.filter(
                    (plant) => !plantsInEditedZone.some((p) => p.id === plant.id)
                ),
                zone.coordinates
            );
            
            return {
                ...zone,
                plants: plantsInThisZone,
                totalWaterNeed: plantsInThisZone.reduce(
                    (sum, plant) => sum + plant.plantData.waterNeed,
                    0
                ),
            };
        }
    });

    // 🔧 FIX: ตรวจสอบว่าต้นไม้ทั้งหมดถูก assign แล้วหรือไม่
    const assignedPlantIds = new Set<string>();
    updatedZones.forEach((zone) => {
        zone.plants.forEach((plant) => {
            assignedPlantIds.add(plant.id);
        });
    });

    // ต้นไม้ที่ไม่อยู่ในโซนใดเลย (อาจอยู่ใกล้ขอบเขต)
    const unassignedPlants = allPlants.filter((plant) => !assignedPlantIds.has(plant.id));
    
    if (unassignedPlants.length > 0) {
        console.warn(
            `⚠️ มีต้นไม้ ${unassignedPlants.length} ต้นที่ไม่อยู่ในโซนใดเลย หลังจากแก้ไขโซน`
        );
    }

    return updatedZones;
};

export const recalculateAllZones = (
    zones: IrrigationZone[],
    allPlants: PlantLocation[]
): IrrigationZone[] => {
    const updatedZones = zones.map((zone) => {
        const plantsInZone = findPlantsInPolygon(allPlants, zone.coordinates);

        const totalWaterNeed = plantsInZone.reduce(
            (sum, plant) => sum + plant.plantData.waterNeed,
            0
        );

        return {
            ...zone,
            plants: plantsInZone,
            totalWaterNeed: totalWaterNeed,
        };
    });

    return updatedZones;
};

export const validateEditedZone = (
    editedZone: IrrigationZone,
    allZones: IrrigationZone[],
    mainArea: Coordinate[]
): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
} => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!editedZone.coordinates || editedZone.coordinates.length < 3) {
        errors.push(`โซน ${editedZone.name} ต้องมีจุดอย่างน้อย 3 จุด`);
        return { isValid: false, errors, warnings };
    }

    if (!isPolygonWithinMainArea(editedZone.coordinates, mainArea)) {
        const outsidePoints = editedZone.coordinates.filter(
            (coord) => !isPointInPolygon(coord, mainArea)
        );
        const outsidePercentage = (outsidePoints.length / editedZone.coordinates.length) * 100;

        if (outsidePercentage > 50) {
            errors.push(
                `โซน ${editedZone.name} มีส่วนที่อยู่นอกพื้นที่หลัก ${outsidePercentage.toFixed(1)}%`
            );
        } else if (outsidePercentage > 10) {
            warnings.push(
                `โซน ${editedZone.name} มีส่วนที่อยู่นอกพื้นที่หลัก ${outsidePercentage.toFixed(1)}%`
            );
        }
    }

    const otherZones = allZones.filter((zone) => zone.id !== editedZone.id);
    for (const otherZone of otherZones) {
        if (otherZone.coordinates && otherZone.coordinates.length >= 3) {
            if (checkPolygonIntersection(editedZone.coordinates, otherZone.coordinates)) {
                const overlapArea = calculateOverlapArea(
                    editedZone.coordinates,
                    otherZone.coordinates
                );
                const editedZoneArea = calculatePolygonArea(editedZone.coordinates);
                const overlapPercentage = (overlapArea / editedZoneArea) * 100;

                if (overlapPercentage > 10) {
                    errors.push(
                        `โซน ${editedZone.name} ทับซ้อนกับโซน ${otherZone.name} ${overlapPercentage.toFixed(1)}%`
                    );
                } else if (overlapPercentage > 1) {
                    warnings.push(
                        `โซน ${editedZone.name} ทับซ้อนกับโซน ${otherZone.name} ${overlapPercentage.toFixed(1)}%`
                    );
                }
            }
        }
    }

    if (editedZone.plants.length === 0) {
        warnings.push(`โซน ${editedZone.name} ไม่มีต้นไม้`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
};

const isPolygonWithinMainArea = (polygon: Coordinate[], mainArea: Coordinate[]): boolean => {
    return polygon.every((point) => isPointInPolygon(point, mainArea));
};

export const generateZoneEditStats = (
    originalZones: IrrigationZone[],
    editedZones: IrrigationZone[]
): {
    totalZones: number;
    modifiedZones: number;
    totalPlants: number;
    totalWaterNeed: number;
    balanceImprovement: number;
} => {
    const modifiedZones = editedZones.filter((editedZone, index) => {
        const originalZone = originalZones[index];
        return (
            originalZone &&
            (JSON.stringify(editedZone.coordinates) !== JSON.stringify(originalZone.coordinates) ||
                editedZone.plants.length !== originalZone.plants.length)
        );
    }).length;

    const totalPlants = editedZones.reduce((sum, zone) => sum + zone.plants.length, 0);
    const totalWaterNeed = editedZones.reduce((sum, zone) => sum + zone.totalWaterNeed, 0);

    const originalWaterNeeds = originalZones.map((z) => z.totalWaterNeed);
    const editedWaterNeeds = editedZones.map((z) => z.totalWaterNeed);

    const originalVariance = calculateWaterNeedVariance(originalWaterNeeds);
    const editedVariance = calculateWaterNeedVariance(editedWaterNeeds);

    const balanceImprovement =
        originalVariance > 0 ? ((originalVariance - editedVariance) / originalVariance) * 100 : 0;

    return {
        totalZones: editedZones.length,
        modifiedZones,
        totalPlants,
        totalWaterNeed,
        balanceImprovement,
    };
};

const calculateWaterNeedVariance = (waterNeeds: number[]): number => {
    if (waterNeeds.length === 0) return 0;

    const mean = waterNeeds.reduce((sum, need) => sum + need, 0) / waterNeeds.length;
    const variance =
        waterNeeds.reduce((sum, need) => sum + Math.pow(need - mean, 2), 0) / waterNeeds.length;

    return variance;
};
