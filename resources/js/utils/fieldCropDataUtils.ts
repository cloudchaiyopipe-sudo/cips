import {
    FieldData,
    FieldCropPageProps,
    Coordinate,
    Obstacle,
    Zone,
    PlantPoint,
    DEFAULT_IRRIGATION_COUNTS,
    DEFAULT_IRRIGATION_POSITIONS,
    MAP_CONFIG,
} from '../types/fieldCropTypes';

// Safe JSON parsing utility
export const parseJsonSafely = <T>(jsonString: string | undefined, fallback: T): T => {
    if (!jsonString) return fallback;
    try {
        return JSON.parse(jsonString);
    } catch {
        return fallback;
    }
};

// Standardized data parsing from props
export const parseFieldDataFromProps = (props: FieldCropPageProps): Partial<FieldData> => {
    console.log('parseFieldDataFromProps - Input props:', props);

    // Always try to load from localStorage first, then merge with props
    let localStorageData: Partial<FieldData> = {};
    try {
        const stored = localStorage.getItem('fieldCropData');
        console.log('parseFieldDataFromProps - localStorage raw data:', stored ? 'exists' : 'null');
        if (stored) {
            localStorageData = JSON.parse(stored);
            console.log('parseFieldDataFromProps - localStorage parsed data:', {
                selectedCrops: localStorageData.selectedCrops?.length || 0,
                mainArea: localStorageData.mainArea?.length || 0,
                obstacles: localStorageData.obstacles?.length || 0,
                plantPoints: localStorageData.plantPoints?.length || 0,
                zones: localStorageData.zones?.length || 0,
                pipes: localStorageData.pipes?.length || 0,
            });
        }
    } catch (error) {
        console.warn('Failed to parse localStorage data:', error);
    }

    // Parse from props (only if they exist)
    const propsData: Partial<FieldData> = {};

    if (props.crops) {
        propsData.selectedCrops = props.crops.split(',').filter((c) => c.trim());
    }
    if (props.mainArea) {
        propsData.mainArea = parseJsonSafely(props.mainArea, []);
    }
    if (props.obstacles) {
        propsData.obstacles = parseJsonSafely(props.obstacles, []);
    }
    if (props.plantPoints) {
        propsData.plantPoints = parseJsonSafely(props.plantPoints, []);
    }
    if (props.zones) {
        propsData.zones = parseJsonSafely(props.zones, []);
    }
    if (props.pipes) {
        propsData.pipes = parseJsonSafely(props.pipes, []);
    }
    if (props.selectedIrrigationType) {
        propsData.selectedIrrigationType = props.selectedIrrigationType;
    }
    if (props.irrigationCounts) {
        propsData.irrigationCounts = parseJsonSafely(props.irrigationCounts, {
            ...DEFAULT_IRRIGATION_COUNTS,
        });
    }
    if (props.totalWaterRequirement) {
        propsData.totalWaterRequirement = parseFloat(props.totalWaterRequirement) || 0;
    }
    if (props.irrigationSettings) {
        propsData.irrigationSettings = parseJsonSafely(props.irrigationSettings, {});
    }
    if (props.irrigationPositions) {
        propsData.irrigationPositions = parseJsonSafely(props.irrigationPositions, {
            ...DEFAULT_IRRIGATION_POSITIONS,
        });
    }
    if (props.areaRai) {
        propsData.areaRai = parseFloat(props.areaRai) || null;
    }
    if (props.perimeterMeters) {
        propsData.perimeterMeters = parseFloat(props.perimeterMeters) || null;
    }
    if (props.rotationAngle) {
        propsData.rotationAngle = parseFloat(props.rotationAngle) || 0;
    }
    if (props.rowSpacing) {
        propsData.rowSpacing = parseJsonSafely(props.rowSpacing, {});
    }
    if (props.plantSpacing) {
        propsData.plantSpacing = parseJsonSafely(props.plantSpacing, {});
    }
    if (props.mapCenter) {
        propsData.mapCenter = parseJsonSafely(props.mapCenter, MAP_CONFIG.DEFAULT_CENTER);
    }
    if (props.mapZoom) {
        propsData.mapZoom = parseFloat(props.mapZoom) || MAP_CONFIG.DEFAULT_ZOOM;
    }

    // Merge localStorage data with props data (props take precedence)
    const mergedData = {
        ...localStorageData,
        ...propsData,
    };

    console.log('parseFieldDataFromProps - Final merged data:', {
        selectedCrops: mergedData.selectedCrops?.length || 0,
        mainArea: mergedData.mainArea?.length || 0,
        obstacles: mergedData.obstacles?.length || 0,
        plantPoints: mergedData.plantPoints?.length || 0,
        zones: mergedData.zones?.length || 0,
        pipes: mergedData.pipes?.length || 0,
    });

    return mergedData;
};

// Standardized data merging with localStorage
export const mergeWithLocalStorage = (propsData: Partial<FieldData>): FieldData => {
    // Since parseFieldDataFromProps already merged localStorage with props,
    // we just need to provide defaults for missing fields
    return {
        selectedCrops: propsData.selectedCrops || [],
        mainArea: propsData.mainArea || [],
        obstacles: propsData.obstacles || [],
        plantPoints: propsData.plantPoints || [],
        zones: propsData.zones || [],
        pipes: propsData.pipes || [],
        selectedIrrigationType: propsData.selectedIrrigationType || '',
        irrigationCounts: propsData.irrigationCounts || { ...DEFAULT_IRRIGATION_COUNTS },
        totalWaterRequirement: propsData.totalWaterRequirement || 0,
        irrigationSettings: propsData.irrigationSettings || {},
        irrigationPositions: propsData.irrigationPositions || { ...DEFAULT_IRRIGATION_POSITIONS },
        areaRai: propsData.areaRai || null,
        perimeterMeters: propsData.perimeterMeters || null,
        rotationAngle: propsData.rotationAngle || 0,
        rowSpacing: propsData.rowSpacing || {},
        plantSpacing: propsData.plantSpacing || {},
        mapCenter: propsData.mapCenter || MAP_CONFIG.DEFAULT_CENTER,
        mapZoom: propsData.mapZoom || MAP_CONFIG.DEFAULT_ZOOM,
        realPlantCount: propsData.realPlantCount || 0,
    };
};

// Standardized localStorage operations
export const fieldDataStorage = {
    save: (data: Partial<FieldData>) => {
        try {
            const existing = localStorage.getItem('fieldCropData');
            const existingData = existing ? JSON.parse(existing) : {};
            const mergedData = { ...existingData, ...data };
            localStorage.setItem('fieldCropData', JSON.stringify(mergedData));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    },

    load: (): Partial<FieldData> | null => {
        try {
            const data = localStorage.getItem('fieldCropData');
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return null;
        }
    },

    clear: () => {
        localStorage.removeItem('fieldCropData');
    },

    resetPipesOnly: () => {
        try {
            const existing = localStorage.getItem('fieldCropData');
            if (existing) {
                const existingData = JSON.parse(existing);
                delete existingData.pipes;
                localStorage.setItem('fieldCropData', JSON.stringify(existingData));
            }
        } catch (error) {
            console.error('Error resetting pipes only:', error);
        }
    },
};

// Data validation utilities
export const validateCoordinates = (coords: unknown[]): Coordinate[] => {
    if (!Array.isArray(coords)) return [];

    return coords.filter((coord: unknown): coord is Coordinate => {
        return (
            coord !== null &&
            typeof coord === 'object' &&
            'lat' in coord &&
            'lng' in coord &&
            typeof (coord as { lat: unknown; lng: unknown }).lat === 'number' &&
            typeof (coord as { lat: unknown; lng: unknown }).lng === 'number' &&
            !isNaN((coord as { lat: number; lng: number }).lat) &&
            !isNaN((coord as { lat: number; lng: number }).lng) &&
            (coord as { lat: number; lng: number }).lat >= -90 &&
            (coord as { lat: number; lng: number }).lat <= 90 &&
            (coord as { lat: number; lng: number }).lng >= -180 &&
            (coord as { lat: number; lng: number }).lng <= 180
        );
    });
};

export const validateMainArea = (mainArea: unknown): Coordinate[] => {
    const validCoords = validateCoordinates(Array.isArray(mainArea) ? mainArea : []);
    return validCoords.length >= 3 ? validCoords : [];
};

export const validateObstacles = (obstacles: unknown[]): Obstacle[] => {
    if (!Array.isArray(obstacles)) return [];

    return obstacles.filter((obstacle: unknown): obstacle is Obstacle => {
        return (
            obstacle !== null &&
            typeof obstacle === 'object' &&
            'id' in obstacle &&
            'type' in obstacle &&
            'coordinates' in obstacle &&
            Array.isArray((obstacle as { coordinates: unknown }).coordinates) &&
            (obstacle as { coordinates: unknown[] }).coordinates.length >= 3 &&
            validateCoordinates((obstacle as { coordinates: unknown[] }).coordinates).length >= 3
        );
    });
};

export const validatePlantPoints = (plantPoints: unknown[]): PlantPoint[] => {
    if (!Array.isArray(plantPoints)) return [];

    return plantPoints.filter((point: unknown): point is PlantPoint => {
        return (
            point !== null &&
            typeof point === 'object' &&
            'id' in point &&
            'lat' in point &&
            'lng' in point &&
            'cropType' in point &&
            'isValid' in point &&
            typeof (point as { lat: unknown }).lat === 'number' &&
            typeof (point as { lng: unknown }).lng === 'number' &&
            typeof (point as { isValid: unknown }).isValid === 'boolean'
        );
    });
};

export const validateZones = (zones: unknown[]): Zone[] => {
    if (!Array.isArray(zones)) return [];

    return zones.filter((zone: unknown): zone is Zone => {
        return (
            zone !== null &&
            typeof zone === 'object' &&
            'id' in zone &&
            'name' in zone &&
            'color' in zone &&
            'coordinates' in zone &&
            Array.isArray((zone as { coordinates: unknown }).coordinates) &&
            (zone as { coordinates: unknown[] }).coordinates.length >= 3 &&
            validateCoordinates((zone as { coordinates: unknown[] }).coordinates).length >= 3
        );
    });
};
