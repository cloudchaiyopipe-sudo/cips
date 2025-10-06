import { Coordinate, PlantLocation, IrrigationZone } from './irrigationZoneUtils';
import { isPointInPolygon, findPlantsInPolygon, checkPolygonIntersection } from './autoZoneUtils';

export const updateEditedZone = (
    zones: IrrigationZone[],
    editedZone: IrrigationZone,
    allPlants: PlantLocation[]
): IrrigationZone[] => {
    const plantsInEditedZone = findPlantsInPolygon(allPlants, editedZone.coordinates);

    const updatedEditedZone: IrrigationZone = {
        ...editedZone,
        plants: plantsInEditedZone,
        totalWaterNeed: plantsInEditedZone.reduce(
            (sum, plant) => sum + plant.plantData.waterNeed,
            0
        ),
    };

    const updatedPlants = allPlants.map((plant) => {
        const newZoneId = plantsInEditedZone.find((p) => p.id === plant.id)
            ? editedZone.id
            : plant.zoneId;
        return { ...plant, zoneId: newZoneId };
    });

    const updatedZones = zones.map((zone) => {
        if (zone.id === editedZone.id) {
            return updatedEditedZone;
        } else {
            const plantsInThisZone = updatedPlants.filter((plant) => plant.zoneId === zone.id);
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

    if (!isPolygonWithinMainArea(editedZone.coordinates, mainArea)) {
        errors.push(`โซน ${editedZone.name} มีส่วนที่อยู่นอกพื้นที่หลัก`);
    }

    const otherZones = allZones.filter((zone) => zone.id !== editedZone.id);
    for (const otherZone of otherZones) {
        if (checkPolygonIntersection(editedZone.coordinates, otherZone.coordinates)) {
            warnings.push(`โซน ${editedZone.name} ทับซ้อนกับโซน ${otherZone.name}`);
        }
    }

    if (editedZone.plants.length === 0) {
        warnings.push(`โซน ${editedZone.name} ไม่มีต้นไม้`);
    }

    if (editedZone.coordinates.length < 3) {
        errors.push(`โซน ${editedZone.name} ต้องมีจุดอย่างน้อย 3 จุด`);
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
