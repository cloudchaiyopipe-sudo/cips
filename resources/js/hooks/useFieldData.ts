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
        console.log('useFieldData - Props received:', props);

        const propsData = parseFieldDataFromProps(props);
        console.log('useFieldData - Parsed props data:', {
            selectedCrops: propsData.selectedCrops?.length || 0,
            mainArea: propsData.mainArea?.length || 0,
            obstacles: propsData.obstacles?.length || 0,
            plantPoints: propsData.plantPoints?.length || 0,
            zones: propsData.zones?.length || 0,
            pipes: propsData.pipes?.length || 0,
        });

        const mergedData = mergeWithLocalStorage(propsData);
        console.log('useFieldData - Merged data:', {
            selectedCrops: mergedData.selectedCrops?.length || 0,
            mainArea: mergedData.mainArea?.length || 0,
            obstacles: mergedData.obstacles?.length || 0,
            plantPoints: mergedData.plantPoints?.length || 0,
            zones: mergedData.zones?.length || 0,
            pipes: mergedData.pipes?.length || 0,
        });

        // Validate and sanitize data
        const validatedData = {
            ...mergedData,
            mainArea: validateMainArea(mergedData.mainArea),
            obstacles: validateObstacles(mergedData.obstacles),
            plantPoints: validatePlantPoints(mergedData.plantPoints),
            zones: validateZones(mergedData.zones),
        };

        console.log('useFieldData - Final validated data:', {
            selectedCrops: validatedData.selectedCrops?.length || 0,
            mainArea: validatedData.mainArea?.length || 0,
            obstacles: validatedData.obstacles?.length || 0,
            plantPoints: validatedData.plantPoints?.length || 0,
            zones: validatedData.zones?.length || 0,
            pipes: validatedData.pipes?.length || 0,
        });

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
