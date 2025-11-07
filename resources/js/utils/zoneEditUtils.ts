import { Coordinate, PlantLocation, IrrigationZone } from './irrigationZoneUtils';
import { isPointInPolygon } from './horticultureUtils';

export interface ZoneEditState {
    isEditing: boolean;
    selectedZoneId: string | null;
    editingZone: IrrigationZone | null;
    controlPoints: ZoneControlPoint[];
    isDragging: boolean;
    draggedPointIndex: number | null;
}

export interface ZoneControlPoint {
    id: string;
    position: Coordinate;
    index: number;
    isDraggable: true;
}

export interface ZoneEditResult {
    updatedZone: IrrigationZone;
    affectedPlants: PlantLocation[];
    wasModified: boolean;
}

export const deepCopyZone = (zone: IrrigationZone): IrrigationZone => {
    return {
        id: zone.id,
        name: zone.name,
        coordinates: zone.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
        plants: zone.plants.map((plant) => ({ ...plant })),
        totalWaterNeed: zone.totalWaterNeed,
        color: zone.color,
        layoutIndex: zone.layoutIndex,
    };
};

export const createZoneControlPoints = (zone: IrrigationZone): ZoneControlPoint[] => {
    const controlPoints: ZoneControlPoint[] = [];

    zone.coordinates.forEach((coord, index) => {
        controlPoints.push({
            id: `control-${zone.id}-${index}`,
            position: { lat: coord.lat, lng: coord.lng },
            index: index,
            isDraggable: true,
        });
    });

    return controlPoints;
};

export const isPointWithinMainArea = (point: Coordinate, mainArea: Coordinate[]): boolean => {
    return isPointInPolygon(point, mainArea);
};

export const isPolygonWithinMainArea = (polygon: Coordinate[], mainArea: Coordinate[]): boolean => {
    return polygon.every((point) => isPointWithinMainArea(point, mainArea));
};

export const updateZoneCoordinatesOnDrag = (
    zone: IrrigationZone,
    controlPointIndex: number,
    newPosition: Coordinate,
    mainArea: Coordinate[]
): {
    updatedCoordinates: Coordinate[];
    isValid: boolean;
    errorMessage?: string;
} => {
    if (!zone.coordinates || zone.coordinates.length < 3) {
        return {
            updatedCoordinates: zone.coordinates || [],
            isValid: false,
            errorMessage: 'โซนไม่มีพิกัดที่ถูกต้อง',
        };
    }

    if (controlPointIndex < 0 || controlPointIndex >= zone.coordinates.length) {
        return {
            updatedCoordinates: zone.coordinates,
            isValid: false,
            errorMessage: 'จุดควบคุมไม่ถูกต้อง',
        };
    }

    const newCoordinates = zone.coordinates.map((coord, index) => {
        if (index === controlPointIndex) {
            return { lat: newPosition.lat, lng: newPosition.lng };
        }
        return { lat: coord.lat, lng: coord.lng };
    });

    const isWithinMainArea = isPointWithinMainArea(newPosition, mainArea);
    if (!isWithinMainArea) {
        console.warn('⚠️ Control point moved outside main area, but allowing for flexibility');
    }

    if (newCoordinates.length < 3) {
        return {
            updatedCoordinates: zone.coordinates,
            isValid: false,
            errorMessage: 'โซนต้องมีจุดอย่างน้อย 3 จุด',
        };
    }

    if (hasPolygonSelfIntersection(newCoordinates)) {
        console.warn('⚠️ Zone has self-intersection, but allowing edit to continue');
    }

    return {
        updatedCoordinates: newCoordinates,
        isValid: true,
    };
};

const hasPolygonSelfIntersection = (coordinates: Coordinate[]): boolean => {
    const n = coordinates.length;
    if (n < 4) return false;

    // ตรวจสอบจุดซ้ำกันก่อน
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dist = Math.sqrt(
                Math.pow(coordinates[i].lat - coordinates[j].lat, 2) +
                    Math.pow(coordinates[i].lng - coordinates[j].lng, 2)
            );
            if (dist < 1e-8) {
                return true;
            }
        }
    }

    for (let i = 0; i < n; i++) {
        const line1Start = coordinates[i];
        const line1End = coordinates[(i + 1) % n];

        for (let j = i + 2; j < n; j++) {
            if (j === (i - 1 + n) % n || j === (i + 1) % n) continue;

            const line2Start = coordinates[j];
            const line2End = coordinates[(j + 1) % n];

            if (doLineSegmentsIntersect(line1Start, line1End, line2Start, line2End)) {
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

export const findPlantsInEditedZone = (
    updatedCoordinates: Coordinate[],
    allPlants: PlantLocation[]
): PlantLocation[] => {
    return allPlants.filter((plant) => isPointInPolygon(plant.position, updatedCoordinates));
};

export const calculateZoneWaterNeed = (plants: PlantLocation[]): number => {
    return plants.reduce((total, plant) => total + plant.plantData.waterNeed, 0);
};

export const createUpdatedZone = (
    originalZone: IrrigationZone,
    newCoordinates: Coordinate[],
    newPlants: PlantLocation[]
): IrrigationZone => {
    const totalWaterNeed = calculateZoneWaterNeed(newPlants);

    return {
        ...originalZone,
        coordinates: newCoordinates,
        plants: newPlants,
        totalWaterNeed: totalWaterNeed,
    };
};

export const findZoneByPoint = (
    point: Coordinate,
    zones: IrrigationZone[]
): IrrigationZone | null => {
    for (const zone of zones) {
        if (isPointInPolygon(point, zone.coordinates)) {
            return zone;
        }
    }
    return null;
};

export const calculateDistanceToControlPoint = (
    point: Coordinate,
    controlPoint: ZoneControlPoint
): number => {
    const R = 6371000;
    const dLat = ((controlPoint.position.lat - point.lat) * Math.PI) / 180;
    const dLng = ((controlPoint.position.lng - point.lng) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((point.lat * Math.PI) / 180) *
            Math.cos((controlPoint.position.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const findNearestControlPoint = (
    clickPoint: Coordinate,
    controlPoints: ZoneControlPoint[],
    threshold: number = 20
): ZoneControlPoint | null => {
    let nearestPoint: ZoneControlPoint | null = null;
    let minDistance = threshold;

    for (const controlPoint of controlPoints) {
        const distance = calculateDistanceToControlPoint(clickPoint, controlPoint);
        if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = controlPoint;
        }
    }

    return nearestPoint;
};

export const createInitialZoneEditState = (): ZoneEditState => {
    return {
        isEditing: false,
        selectedZoneId: null,
        editingZone: null,
        controlPoints: [],
        isDragging: false,
        draggedPointIndex: null,
    };
};

export const startZoneEditing = (
    zone: IrrigationZone,
    currentState: ZoneEditState
): ZoneEditState => {
    const editingZone = deepCopyZone(zone);
    const controlPoints = createZoneControlPoints(editingZone);

    return {
        ...currentState,
        isEditing: true,
        selectedZoneId: zone.id,
        editingZone: editingZone,
        controlPoints: controlPoints,
        isDragging: false,
        draggedPointIndex: null,
    };
};

export const stopZoneEditing = (): ZoneEditState => {
    return createInitialZoneEditState();
};

export const startDragging = (
    controlPoint: ZoneControlPoint,
    currentState: ZoneEditState
): ZoneEditState => {
    return {
        ...currentState,
        isDragging: true,
        draggedPointIndex: controlPoint.index,
    };
};

export const stopDragging = (currentState: ZoneEditState): ZoneEditState => {
    return {
        ...currentState,
        isDragging: false,
        draggedPointIndex: null,
    };
};

export const updateZoneControlPoints = (
    controlPoints: ZoneControlPoint[],
    updatedCoordinates: Coordinate[],
    draggedPointIndex: number
): ZoneControlPoint[] => {
    return controlPoints.map((controlPoint) => {
        if (controlPoint.index === draggedPointIndex) {
            const newPosition = updatedCoordinates[draggedPointIndex];
            return {
                id: controlPoint.id,
                position: { lat: newPosition.lat, lng: newPosition.lng },
                index: controlPoint.index,
                isDraggable: controlPoint.isDraggable,
            };
        }
        return {
            id: controlPoint.id,
            position: { lat: controlPoint.position.lat, lng: controlPoint.position.lng },
            index: controlPoint.index,
            isDraggable: controlPoint.isDraggable,
        };
    });
};

export { isPointInPolygon } from './horticultureUtils';
