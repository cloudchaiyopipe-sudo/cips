import { Coordinate } from './horticultureUtils';
import { PlantLocation } from './lateralPipeUtils';
import {
    validateLateralPipeCoordinates,
    optimizeLateralPipePath,
    computeAlignedLateral,
    groupPlantsByRows,
    groupPlantsByColumns,
    hasRotation,
    transformToRotatedCoordinate
} from './lateralPipeUtils';
import { generateAutoLateralPipes } from './autoLateralPipeUtils';

export const testLateralPipeValidation = (): boolean => {
    const validCoordinates: Coordinate[] = [
        { lat: 13.7563, lng: 100.5018 },
        { lat: 13.7573, lng: 100.5028 }
    ];
    
    const invalidCoordinates: Coordinate[] = [
        { lat: NaN, lng: 100.5018 },
        { lat: 13.7563, lng: Infinity }
    ];
    
    const validResult = validateLateralPipeCoordinates(validCoordinates);
    const invalidResult = validateLateralPipeCoordinates(invalidCoordinates);
    
    return validResult && !invalidResult;
};

export const testLateralPipeOptimization = (): boolean => {
    const testCoordinates: Coordinate[] = [
        { lat: 13.7563, lng: 100.5018 },
        { lat: 13.7564, lng: 100.5019 },
        { lat: 13.7565, lng: 100.5020 },
        { lat: 13.7573, lng: 100.5028 }
    ];
    
    const optimized = optimizeLateralPipePath(testCoordinates, 0.001);
    
    return optimized.length <= testCoordinates.length && optimized.length >= 2;
};

export const testPlantGrouping = (): boolean => {
    const testPlants: PlantLocation[] = [
        {
            id: '1',
            position: { lat: 13.7563, lng: 100.5018 },
            plantData: {
                id: 1,
                name: 'Test Plant',
                plantSpacing: 2,
                rowSpacing: 3,
                waterNeed: 5
            }
        },
        {
            id: '2',
            position: { lat: 13.7563, lng: 100.5020 },
            plantData: {
                id: 1,
                name: 'Test Plant',
                plantSpacing: 2,
                rowSpacing: 3,
                waterNeed: 5
            }
        }
    ];
    
    try {
        const rows = groupPlantsByRows(testPlants);
        const cols = groupPlantsByColumns(testPlants);
        
        return rows.length > 0 && cols.length > 0;
    } catch (error) {
        console.error('Error in testPlantGrouping:', error);
        return false;
    }
};

export const testLateralPipeAlignment = (): boolean => {
    const startPoint: Coordinate = { lat: 13.7563, lng: 100.5018 };
    const endPoint: Coordinate = { lat: 13.7573, lng: 100.5028 };
    
    const testPlants: PlantLocation[] = [
        {
            id: '1',
            position: { lat: 13.7565, lng: 100.5020 },
            plantData: {
                id: 1,
                name: 'Test Plant',
                plantSpacing: 2,
                rowSpacing: 3,
                waterNeed: 5
            }
        }
    ];
    
    try {
        const result = computeAlignedLateral(
            startPoint,
            endPoint,
            testPlants,
            'over_plants',
            20
        );
        
        return Boolean(result.alignedEnd && result.selectedPlants && result.snappedStart);
    } catch (error) {
        console.error('Error in testLateralPipeAlignment:', error);
        return false;
    }
};

export const testPlantRotation = (): boolean => {
    const testPlants: PlantLocation[] = [
        {
            id: '1',
            position: { lat: 13.7563, lng: 100.5018 },
            plantData: {
                id: 1,
                name: 'Test Plant',
                plantSpacing: 2,
                rowSpacing: 3,
                waterNeed: 5
            },
            rotationAngle: 45
        },
        {
            id: '2',
            position: { lat: 13.7565, lng: 100.5020 },
            plantData: {
                id: 1,
                name: 'Test Plant',
                plantSpacing: 2,
                rowSpacing: 3,
                waterNeed: 5
            },
            rotationAngle: 45
        }
    ];
    
    try {
        const rotationInfo = hasRotation(testPlants);
        const transformed = transformToRotatedCoordinate(
            testPlants[0].position,
            rotationInfo.center,
            rotationInfo.rotationAngle
        );
        
        return rotationInfo.hasRotation && 
               rotationInfo.rotationAngle === 45 &&
               transformed.lat !== testPlants[0].position.lat;
    } catch (error) {
        console.error('Error in testPlantRotation:', error);
        return false;
    }
};

export const testAutoLateralWithRotation = (): boolean => {
    const testPlants: PlantLocation[] = [
        {
            id: '1',
            position: { lat: 13.7563, lng: 100.5018 },
            plantData: {
                id: 1,
                name: 'Test Plant',
                plantSpacing: 2,
                rowSpacing: 3,
                waterNeed: 5
            },
            rotationAngle: 30
        },
        {
            id: '2',
            position: { lat: 13.7565, lng: 100.5020 },
            plantData: {
                id: 1,
                name: 'Test Plant',
                plantSpacing: 2,
                rowSpacing: 3,
                waterNeed: 5
            },
            rotationAngle: 30
        }
    ];
    
    const testZones = [{
        id: 'zone1',
        name: 'Test Zone',
        coordinates: [
            { lat: 13.7560, lng: 100.5015 },
            { lat: 13.7570, lng: 100.5015 },
            { lat: 13.7570, lng: 100.5025 },
            { lat: 13.7560, lng: 100.5025 }
        ],
        plants: testPlants
    }];
    
    const testSubMainPipes = [{
        id: 'submain1',
        coordinates: [
            { lat: 13.7562, lng: 100.5016 },
            { lat: 13.7568, lng: 100.5024 }
        ],
        zoneId: 'zone1'
    }];
    
    try {
        const results = generateAutoLateralPipes(
            'through_submain',
            testSubMainPipes,
            testZones,
            { snapThreshold: 20, minPipeLength: 1, maxPipeLength: 100 }
        );
        
        return results.length > 0;
    } catch (error) {
        console.error('Error in testAutoLateralWithRotation:', error);
        return false;
    }
};

export const runAllLateralPipeTests = (): {
    validation: boolean;
    optimization: boolean;
    grouping: boolean;
    alignment: boolean;
    rotation: boolean;
    autoLateralWithRotation: boolean;
    overall: boolean;
} => {
    const validation = testLateralPipeValidation();
    const optimization = testLateralPipeOptimization();
    const grouping = testPlantGrouping();
    const alignment = testLateralPipeAlignment();
    const rotation = testPlantRotation();
    const autoLateralWithRotation = testAutoLateralWithRotation();
    
    const overall = validation && optimization && grouping && alignment && rotation && autoLateralWithRotation;
    
    console.log('Lateral Pipe Tests Results:', {
        validation,
        optimization,
        grouping,
        alignment,
        rotation,
        autoLateralWithRotation,
        overall
    });
    
    return {
        validation,
        optimization,
        grouping,
        alignment,
        rotation,
        autoLateralWithRotation,
        overall
    };
};
