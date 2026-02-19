import { useState, useCallback, useMemo } from 'react';
import {
    FieldData,
    FieldCropPageProps,
    DEFAULT_IRRIGATION_COUNTS,
    DEFAULT_IRRIGATION_POSITIONS,
    MAP_CONFIG,
} from '../types/fieldCropTypes';
import {
    parseFieldDataFromProps,
    mergeWithLocalStorage,
    fieldDataStorage,
    validateMainArea,
    validateObstacles,
    validatePlantPoints,
    validateZones,
} from '../utils/fieldCropDataUtils';

export const useFieldData = (props: FieldCropPageProps) => {
    // Initialize field data from props and localStorage
    const initialFieldData = useMemo((): FieldData => {
        const propsData = parseFieldDataFromProps(props);
        const mergedData = mergeWithLocalStorage(propsData);

        // Validate and sanitize data
        const validatedData = {
            ...mergedData,
            mainArea: validateMainArea(mergedData.mainArea),
            obstacles: validateObstacles(mergedData.obstacles),
            plantPoints: validatePlantPoints(mergedData.plantPoints),
            zones: validateZones(mergedData.zones),
        };

        return validatedData;
    }, [props]);

    const [fieldData, setFieldData] = useState<FieldData>(initialFieldData);

    // Save to localStorage
    const saveToStorage = useCallback((data: Partial<FieldData>) => {
        fieldDataStorage.save(data);
        setFieldData((prev) => ({ ...prev, ...data }));
    }, []);

    // Load from localStorage
    const loadFromStorage = useCallback((): Partial<FieldData> | null => {
        return fieldDataStorage.load();
    }, []);

    // Clear localStorage
    const clearStorage = useCallback(() => {
        fieldDataStorage.clear();
        setFieldData({
            selectedCrops: [],
            mainArea: [],
            obstacles: [],
            plantPoints: [],
            zones: [],
            pipes: [],
            selectedIrrigationType: '',
            irrigationCounts: { ...DEFAULT_IRRIGATION_COUNTS },
            totalWaterRequirement: 0,
            irrigationSettings: {},
            irrigationPositions: { ...DEFAULT_IRRIGATION_POSITIONS },
            areaRai: null,
            perimeterMeters: null,
            rotationAngle: 0,
            rowSpacing: {},
            plantSpacing: {},
            mapCenter: MAP_CONFIG.DEFAULT_CENTER,
            mapZoom: MAP_CONFIG.DEFAULT_ZOOM,
            realPlantCount: 0,
        });
    }, []);

    // Reset pipes only
    const resetPipesOnly = useCallback(() => {
        fieldDataStorage.resetPipesOnly();
        setFieldData((prev) => ({ ...prev, pipes: [] }));
    }, []);

    // Update field data
    const updateFieldData = useCallback((updates: Partial<FieldData>) => {
        setFieldData((prev) => ({ ...prev, ...updates }));
        fieldDataStorage.save(updates);
    }, []);

    return {
        fieldData,
        setFieldData,
        saveToStorage,
        loadFromStorage,
        clearStorage,
        resetPipesOnly,
        updateFieldData,
    };
};
