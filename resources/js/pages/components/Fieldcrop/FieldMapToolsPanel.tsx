/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useState } from 'react';
import * as turf from '@turf/turf';
import {
    ZONE_COLORS,
    OBSTACLE_TYPES,
    PIPE_TYPES,
    EQUIPMENT_TYPES,
    MAP_TILES,
    type EquipmentType,
    type PipeType,
    type MapTileType,
    type ObstacleType,
} from '@/pages/utils/fieldMapConstants';
import { getTranslatedCropByValue, type TranslatedCrop } from '@/pages/utils/cropData';
import FieldMapCropSpacing from './FieldMapCropSpacing';

// Import LateralPipe interface from field-map.tsx
interface LateralPipe {
    id: number;
    coordinates: { lat: number; lng: number }[];
    type: string;
    name: string;
    color: string;
    zoneId: string | number;
    polyline?: google.maps.Polyline;
    parentPipeId?: any;
    angle?: number;
    side?: string;
    connectionPoint?: number;
    length?: number;
}

interface FieldMapToolsPanelProps {
    // Step management
    currentStep: number;
    setCurrentStep: (step: number) => void;
    validateStep: (step: number) => boolean;
    nextStep: () => void;
    previousStep: () => void;
    resetAll: () => void;

    // NEW: เพิ่ม props สำหรับ crop spacing functions
    getCropSpacingInfo?: (cropValue: string) => {
        defaultRowSpacing: number;
        defaultPlantSpacing: number;
        currentRowSpacing: number;
        currentPlantSpacing: number;
        waterRequirement: number;
        irrigationNeedsKey: 'low' | 'medium' | 'high';
        growthPeriod: number;
    };
    resetSpacingToDefaults?: () => void;

    // Field data
    mainField: any;
    fieldAreaSize: number;
    selectedCrops: string[];
    zones: any[];
    pipes: any[];
    setPipes: React.Dispatch<React.SetStateAction<any[]>>; // เพิ่มเพื่อใช้ในการอัปเดตท่อ
    obstacles: any[];

    // Settings
    snapEnabled: boolean;
    setSnapEnabled: (enabled: boolean) => void;
    gridEnabled: boolean;
    setGridEnabled: (enabled: boolean) => void;
    pipeSnapEnabled: boolean;
    setPipeSnapEnabled: (enabled: boolean) => void;
    mapType: MapTileType;
    setMapType: (type: MapTileType) => void;

    // Drawing modes
    drawingStage: 'field' | 'zones' | 'pipes' | 'irrigation';
    setDrawingStage: React.Dispatch<
        React.SetStateAction<'field' | 'zones' | 'pipes' | 'irrigation'>
    >;
    drawingMode: 'zone' | 'obstacle';
    setDrawingMode: React.Dispatch<React.SetStateAction<'zone' | 'obstacle'>>;
    currentZoneColor: string;
    setCurrentZoneColor: (color: string) => void;
    currentObstacleType: ObstacleType;
    setCurrentObstacleType: (type: ObstacleType) => void;
    currentPipeType: PipeType;
    setCurrentPipeType: (type: PipeType) => void;

    // Equipment
    isPlacingEquipment: boolean;
    selectedEquipmentType: EquipmentType | null;
    startPlacingEquipment: (type: EquipmentType) => void;
    cancelPlacingEquipment: () => void;
    clearAllEquipment: () => void;
    undoEquipment: () => void;
    redoEquipment: () => void;
    equipmentIcons: any[];
    equipmentHistory: any[];
    equipmentHistoryIndex: number;

    // Zone management
    usedColors: string[];
    addNewZone: () => void;
    zoneAssignments: any;
    assignPlantToZone: (zoneId: string, plantValue: string) => void;
    removePlantFromZone: (zoneId: string) => void;
    deleteZone: (zoneId: string) => void;

    // Pipe generation
    generateLateralPipes: () => void;
    generateLateralPipesForZone: (zone: any) => void;
    isGeneratingPipes: boolean;
    clearLateralPipes: () => void;

    // NEW: Pipe branch angle settings
    currentBranchAngle: number;
    setCurrentBranchAngle: (angle: number) => void;
    handleStartRealTimeBranchEdit?: (pipeId: string) => void;
    branchPipeSettings: {
        defaultAngle: number;
        maxAngle: number;
        minAngle: number;
        angleStep: number;
    };
    setBranchPipeSettings: React.Dispatch<
        React.SetStateAction<{
            defaultAngle: number;
            maxAngle: number;
            minAngle: number;
            angleStep: number;
        }>
    >;
    realTimeEditing: {
        activePipeId: any;
        activeAngle: number;
        isAdjusting: boolean;
    };
    setRealTimeEditing: React.Dispatch<
        React.SetStateAction<{
            activePipeId: any;
            activeAngle: number;
            isAdjusting: boolean;
        }>
    >;
    regenerateLateralPipesWithAngle: (
        pipeId: any,
        newAngle: number,
        targetZone: any
    ) => LateralPipe[];

    // Irrigation
    irrigationAssignments: any;
    setIrrigationAssignments: (assignments: any) => void;
    irrigationPoints: any[];
    irrigationLines: any[];
    irrigationRadius: any;
    setIrrigationRadius: (radius: any) => void;
    // ลบ sprinklerOverlap และ setSprinklerOverlap
    generateIrrigationForZone: (zone: any, type: string) => void;
    clearIrrigationForZone: (zoneId: string) => void;
    irrigationSettings: any;
    setIrrigationSettings: (settings: any) => void;

    // Summary data
    zoneSummaries: any;
    plantingPoints: any[];

    // Crop spacing props
    selectedCropObjects: TranslatedCrop[];
    rowSpacing: Record<string, number>;
    tempRowSpacing: any;
    setTempRowSpacing: (spacing: any) => void;
    editingRowSpacingForCrop: string | null;
    setEditingRowSpacingForCrop: (crop: string | null) => void;
    handleRowSpacingConfirm: (cropValue: string) => void;
    handleRowSpacingCancel: (cropValue: string) => void;
    plantSpacing: Record<string, number>;
    tempPlantSpacing: any;
    setTempPlantSpacing: (spacing: any) => void;
    editingPlantSpacingForCrop: string | null;
    setEditingPlantSpacingForCrop: (crop: string | null) => void;
    handlePlantSpacingConfirm: (cropValue: string) => void;
    handlePlantSpacingCancel: (cropValue: string) => void;
    handleCaptureMapAndSummary?: () => void;
    dripSpacing: Record<string, number>;
    setDripSpacing: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    t: (key: string) => string;
    language: 'en' | 'th';
}

const FieldMapToolsPanel: React.FC<FieldMapToolsPanelProps> = ({
    currentStep,
    setCurrentStep,
    validateStep,
    nextStep,
    previousStep,
    resetAll,
    mainField,
    fieldAreaSize,
    selectedCrops,
    zones,
    pipes,
    setPipes,
    obstacles,
    snapEnabled,
    setSnapEnabled,
    gridEnabled,
    setGridEnabled,
    pipeSnapEnabled,
    setPipeSnapEnabled,
    drawingStage,
    setDrawingStage,
    drawingMode,
    setDrawingMode,
    currentZoneColor,
    setCurrentZoneColor,
    currentObstacleType,
    setCurrentObstacleType,
    currentPipeType,
    setCurrentPipeType,
    isPlacingEquipment,
    selectedEquipmentType,
    startPlacingEquipment,
    cancelPlacingEquipment,
    clearAllEquipment,
    undoEquipment,
    redoEquipment,
    equipmentIcons,
    equipmentHistory,
    equipmentHistoryIndex,
    usedColors,
    addNewZone,
    zoneAssignments,
    assignPlantToZone,
    removePlantFromZone,
    deleteZone,
    generateLateralPipes,
    generateLateralPipesForZone,
    isGeneratingPipes,
    clearLateralPipes,
    currentBranchAngle,
    setCurrentBranchAngle,
    handleStartRealTimeBranchEdit,
    branchPipeSettings,
    setBranchPipeSettings,
    realTimeEditing,
    setRealTimeEditing,
    regenerateLateralPipesWithAngle,
    irrigationAssignments,
    setIrrigationAssignments,
    irrigationPoints,
    irrigationLines,
    irrigationRadius,
    setIrrigationRadius,
    // ลบ sprinklerOverlap และ setSprinklerOverlap
    generateIrrigationForZone,
    clearIrrigationForZone,
    irrigationSettings,
    setIrrigationSettings,
    zoneSummaries,
    plantingPoints,
    selectedCropObjects,
    rowSpacing,
    tempRowSpacing,
    setTempRowSpacing,
    editingRowSpacingForCrop,
    setEditingRowSpacingForCrop,
    handleRowSpacingConfirm,
    handleRowSpacingCancel,
    plantSpacing,
    tempPlantSpacing,
    setTempPlantSpacing,
    editingPlantSpacingForCrop,
    setEditingPlantSpacingForCrop,
    handlePlantSpacingConfirm,
    handlePlantSpacingCancel,
    handleCaptureMapAndSummary,
    dripSpacing,
    setDripSpacing,
    getCropSpacingInfo,
    resetSpacingToDefaults,
    t,
    language = 'en',
}) => {
    // State สำหรับการเรียงลำดับท่อย่อย
    const [sortType, setSortType] = useState<'angle' | 'length' | 'name'>('angle');
    // Configuration for radius-based irrigation systems
    const irrigationRadiusConfig = {
        sprinkler: { min: 3, max: 15, step: 0.5, defaultValue: 8 },
        mini_sprinkler: { min: 0.5, max: 3, step: 0.1, defaultValue: 1.5 },
        micro_spray: { min: 3, max: 8, step: 0.5, defaultValue: 5 },
    };

    // Get irrigation recommendation based on crop
    const getIrrigationRecommendation = (cropValue: string): string[] => {
        const crop = getTranslatedCropByValue(cropValue, language);
        if (!crop) return [];

        const recommendations: string[] = [];

        switch (crop.irrigationNeedsKey) {
            case 'high':
                recommendations.push('sprinkler', 'drip-tape');
                break;
            case 'medium':
                recommendations.push('mini_sprinkler', 'micro_spray', 'drip-tape');
                break;
            case 'low':
                recommendations.push('micro_spray', 'drip-tape');
                break;
        }

        return recommendations;
    };

    // Calculate optimal drip spacing based on crop
    const getOptimalDripSpacing = (cropValue: string): number => {
        const crop = getTranslatedCropByValue(cropValue, language);
        if (!crop) return 0.3;

        // Base drip spacing on plant spacing
        const plantSpacingInMeters = crop.plantSpacing / 100; // Convert cm to meters
        return Math.max(0.2, Math.min(0.5, plantSpacingInMeters));
    };

    const calculatePlantsInZone = useCallback(
        (zoneId: string): number => {
            const zone = zones.find((z) => z.id.toString() === zoneId);
            const assignedCrop = zoneAssignments[zoneId];

            if (!zone || !assignedCrop) return 0;

            // ตรวจสอบข้อมูล spacing ปัจจุบัน
            const currentRowSpacing = rowSpacing[assignedCrop] || 25; // default 25cm for rice
            const currentPlantSpacing = plantSpacing[assignedCrop] || 25; // default 25cm for rice

            try {
                // คำนวณพื้นที่ zone
                const polygonCoords = zone.coordinates.map((coord: any) => [coord.lng, coord.lat]);
                const firstPoint = polygonCoords[0];
                const lastPoint = polygonCoords[polygonCoords.length - 1];

                if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
                    polygonCoords.push(firstPoint);
                }

                const turfPolygon = turf.polygon([polygonCoords]);
                const areaInSquareMeters = turf.area(turfPolygon);

                // ตรวจสอบว่าพื้นที่สมเหตุสมผลหรือไม่
                if (areaInSquareMeters < 1) {
                    return 0;
                }

                // แปลง cm เป็น m (ต้องแน่ใจว่าหน่วยถูก)
                const rowSpacingInM = currentRowSpacing / 100;
                const plantSpacingInM = currentPlantSpacing / 100;

                // คำนวณจำนวนต้นต่อ ตร.ม.
                const plantsPerSquareMeter = 1 / (rowSpacingInM * plantSpacingInM);

                // จำนวนต้นทั้งหมดใน zone
                const totalPlants = Math.floor(areaInSquareMeters * plantsPerSquareMeter);

                // เตือนถ้าจำนวนต้นน้อยผิดปกติ
                if (totalPlants < 100 && areaInSquareMeters > 100) {
                    console.warn(`⚠️ Unusually low plant count for area:`, {
                        plants: totalPlants,
                        area: areaInSquareMeters.toFixed(2),
                        possibleIssue: 'Check spacing units or crop data',
                    });
                }

                return totalPlants;
            } catch (error) {
                console.error('Error calculating plants in zone:', error);
                return 0;
            }
        },
        [zones, zoneAssignments, rowSpacing, plantSpacing]
    );

    return (
        <>
            {/* Step 1: Field Drawing */}
            {currentStep === 1 && (
                <div className="space-y-3">
                    <div className="rounded-lg border border-white bg-orange-500/10 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-orange-300">
                                🏗️ {t('Step 1: Draw Field')}
                            </span>
                            <span className="text-xs">{mainField ? '✅' : '⏳'}</span>
                        </div>
                        <div className="mt-1 text-xs text-orange-400">
                            {t('Draw your field boundary on the map')}
                        </div>
                    </div>

                    {selectedCropObjects.length > 0 && (
                        <div
                            className="rounded border border-white p-2"
                            style={{ backgroundColor: '#000005' }}
                        >
                            <FieldMapCropSpacing
                                selectedCropObjects={selectedCropObjects}
                                rowSpacing={rowSpacing}
                                tempRowSpacing={tempRowSpacing}
                                setTempRowSpacing={setTempRowSpacing}
                                editingRowSpacingForCrop={editingRowSpacingForCrop}
                                setEditingRowSpacingForCrop={setEditingRowSpacingForCrop}
                                handleRowSpacingConfirm={handleRowSpacingConfirm}
                                handleRowSpacingCancel={handleRowSpacingCancel}
                                plantSpacing={plantSpacing}
                                tempPlantSpacing={tempPlantSpacing}
                                setTempPlantSpacing={setTempPlantSpacing}
                                editingPlantSpacingForCrop={editingPlantSpacingForCrop}
                                setEditingPlantSpacingForCrop={setEditingPlantSpacingForCrop}
                                handlePlantSpacingConfirm={handlePlantSpacingConfirm}
                                handlePlantSpacingCancel={handlePlantSpacingCancel}
                                getCropSpacingInfo={getCropSpacingInfo}
                                resetSpacingToDefaults={resetSpacingToDefaults}
                                t={t}
                            />
                        </div>
                    )}

                    {mainField && (
                        <div
                            className="rounded-lg border border-white p-3"
                            style={{ backgroundColor: '#000005' }}
                        >
                            <div className="mb-2 text-sm text-gray-300">📐 {t('Field Info')}</div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">{t('Area')}:</span>
                                    <span className="text-white">
                                        {fieldAreaSize > 0
                                            ? fieldAreaSize >= 1600
                                                ? `${(fieldAreaSize / 1600).toFixed(2)} ${t('Rai')}`
                                                : `${fieldAreaSize.toFixed(0)} ${t('m²')}`
                                            : t('Calculating...')}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">{t('Status')}:</span>
                                    <span className="text-orange-400">{t('Ready for zones')}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div
                        className="rounded-lg border border-white p-3"
                        style={{ backgroundColor: '#000005' }}
                    >
                        <div className="flex items-center justify-between">
                            <button
                                onClick={resetAll}
                                className="rounded border border-white bg-red-600 px-3 py-1 text-sm text-white transition-colors hover:bg-red-700"
                            >
                                🗑️ {t('Reset All')}
                            </button>
                            <button
                                onClick={nextStep}
                                disabled={!validateStep(1)}
                                className={`rounded border border-white px-4 py-1 text-sm transition-colors ${
                                    validateStep(1)
                                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                                        : 'cursor-not-allowed text-gray-400'
                                }`}
                                style={{ backgroundColor: validateStep(1) ? undefined : '#000005' }}
                            >
                                {t('Next Step')} ➡️
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Zones & Obstacles */}
            {currentStep === 2 && (
                <div className="space-y-3">
                    <div className="rounded-lg border border-white bg-blue-500/10 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-300">
                                🎯 {t('Step 2: Zones & Obstacles')}
                            </span>
                            <span className="text-xs">{zones.length > 0 ? '✅' : '⏳'}</span>
                        </div>
                        <div className="mt-1 text-xs text-blue-400">
                            {t('Create zones and mark obstacles')}
                        </div>
                    </div>

                    <div
                        className="rounded-lg border border-white p-3"
                        style={{ backgroundColor: '#000005' }}
                    >
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-300">
                                {t('Drawing Mode')}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            <button
                                onClick={() => setDrawingMode('zone')}
                                className={`rounded border border-white p-2 text-xs transition-colors ${
                                    drawingMode === 'zone'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-300 hover:bg-gray-500'
                                }`}
                                style={{
                                    backgroundColor: drawingMode === 'zone' ? undefined : '#000005',
                                }}
                            >
                                🎯 {t('Zones')}
                            </button>
                            <button
                                onClick={() => setDrawingMode('obstacle')}
                                className={`rounded border border-white p-2 text-xs transition-colors ${
                                    drawingMode === 'obstacle'
                                        ? 'bg-orange-600 text-white'
                                        : 'text-gray-300 hover:bg-gray-500'
                                }`}
                                style={{
                                    backgroundColor:
                                        drawingMode === 'obstacle' ? undefined : '#000005',
                                }}
                            >
                                ⛔ {t('Obstacles')}
                            </button>
                        </div>
                    </div>

                    {drawingMode === 'obstacle' && (
                        <div className="rounded-lg border border-white bg-orange-500/10 p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-medium text-orange-300">
                                    {t('Obstacle Type')}
                                </span>
                                <span className="text-xs text-orange-400">
                                    {obstacles.length} {t('obstacles')}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 gap-1">
                                {Object.entries(OBSTACLE_TYPES).map(([key, config]) => (
                                    <button
                                        key={key}
                                        onClick={() => setCurrentObstacleType(key as ObstacleType)}
                                        className={`rounded-md border border-white px-3 py-2 text-left transition-colors ${
                                            currentObstacleType === key
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <span className="text-lg">{config.icon}</span>
                                            <span className="text-xs">{t(config.name)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {zones.length > 0 && selectedCrops.length > 0 && (
                        <div className="rounded-lg border border-white bg-purple-500/10 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <span className="font-medium text-purple-300">
                                        🌱 {t('Assign Crops')}
                                    </span>
                                    <span className="rounded-full border border-white bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
                                        {zones.length} {t('zones')}
                                    </span>
                                </div>
                                <div className="text-xs text-purple-400">
                                    {Object.keys(zoneAssignments).length}/{zones.length}{' '}
                                    {t('assigned')}
                                </div>
                            </div>

                            <div className="grid gap-3">
                                {zones.map((zone: any, index: number) => {
                                    const assignedCrop = zoneAssignments[zone.id];
                                    const cropData = assignedCrop
                                        ? getTranslatedCropByValue(assignedCrop, language)
                                        : null;

                                    return (
                                        <div
                                            key={zone.id}
                                            className="relative rounded-lg border border-white p-3 transition-all hover:bg-gray-700/70"
                                            style={{ backgroundColor: '#000005' }}
                                        >
                                            <button
                                                onClick={() => deleteZone(zone.id.toString())}
                                                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white shadow-lg transition-all hover:scale-110 hover:bg-red-600"
                                                title={t('Delete Zone {zoneName}').replace(
                                                    '{zoneName}',
                                                    `${index + 1}`
                                                )}
                                            >
                                                ×
                                            </button>

                                            <div className="mb-3 flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <div
                                                        className="h-4 w-4 rounded-full border-2 border-white/30"
                                                        style={{ backgroundColor: zone.color }}
                                                    ></div>
                                                    <span className="font-medium text-white">
                                                        {t('Zone')} {index + 1}
                                                    </span>
                                                    {assignedCrop && (
                                                        <span className="rounded-full border border-white bg-green-500/20 px-2 py-0.5 text-xs text-green-300">
                                                            ✓ {t('Assigned')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <select
                                                value={assignedCrop || ''}
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        assignPlantToZone(
                                                            zone.id.toString(),
                                                            e.target.value
                                                        );
                                                    } else {
                                                        removePlantFromZone(zone.id.toString());
                                                    }
                                                }}
                                                className="w-full rounded-lg border border-white bg-gray-800 px-3 py-2 text-sm text-white transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                            >
                                                <option value="">
                                                    {t('Select a crop for this zone...')}
                                                </option>
                                                {selectedCrops.map((cropValue) => {
                                                    const crop = getTranslatedCropByValue(
                                                        cropValue,
                                                        language
                                                    );
                                                    return crop ? (
                                                        <option key={crop.value} value={crop.value}>
                                                            {crop.icon} {crop.name}
                                                        </option>
                                                    ) : null;
                                                })}
                                            </select>

                                            {/* Show crop information when assigned */}
                                            {cropData && (
                                                <div className="mt-3 rounded border border-gray-600 bg-gray-800/50 p-2">
                                                    <div className="text-xs text-gray-300">
                                                        <div className="flex justify-between">
                                                            <span>{t('Row Spacing')}:</span>
                                                            <span className="text-white">
                                                                {rowSpacing[assignedCrop] ||
                                                                    cropData.rowSpacing}{' '}
                                                                cm
                                                                {rowSpacing[assignedCrop] &&
                                                                    rowSpacing[assignedCrop] !==
                                                                        cropData.rowSpacing && (
                                                                        <span className="ml-1 text-green-400">
                                                                            (ปรับแล้ว)
                                                                        </span>
                                                                    )}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t('Plant Spacing')}:</span>
                                                            <span className="text-white">
                                                                {plantSpacing[assignedCrop] ||
                                                                    cropData.plantSpacing}{' '}
                                                                cm
                                                                {plantSpacing[assignedCrop] &&
                                                                    plantSpacing[assignedCrop] !==
                                                                        cropData.plantSpacing && (
                                                                        <span className="ml-1 text-green-400">
                                                                            (ปรับแล้ว)
                                                                        </span>
                                                                    )}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t('Water Needs')}:</span>
                                                            <span
                                                                className={`${
                                                                    cropData.irrigationNeedsKey ===
                                                                    'high'
                                                                        ? 'text-red-300'
                                                                        : cropData.irrigationNeedsKey ===
                                                                            'medium'
                                                                          ? 'text-yellow-300'
                                                                          : 'text-green-300'
                                                                }`}
                                                            >
                                                                {cropData.irrigationNeeds}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t('Growth Period')}:</span>
                                                            <span className="text-white">
                                                                {cropData.growthPeriod} {t('days')}
                                                            </span>
                                                        </div>
                                                        {/* แสดงจำนวนต้นที่คำนวณจากระยะที่ปรับแล้ว */}
                                                        {(rowSpacing[assignedCrop] ||
                                                            plantSpacing[assignedCrop]) && (
                                                            <div className="mt-2 border-t border-gray-600 pt-2">
                                                                <div className="flex justify-between">
                                                                    <span className="text-green-300">
                                                                        {t('Estimated Plants')}:
                                                                    </span>
                                                                    <span className="font-medium text-white">
                                                                        {calculatePlantsInZone(
                                                                            zone.id.toString()
                                                                        ).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {zones.length > 0 && (
                        <div
                            className="rounded-lg border border-white p-3"
                            style={{ backgroundColor: '#000005' }}
                        >
                            <div className="mb-2 text-sm text-gray-300">📊 {t('Zone Summary')}</div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                    <span className="text-orange-300">{t('Obstacles')}:</span>
                                    <span className="ml-1 text-white">{obstacles.length}</span>
                                </div>
                                <div>
                                    <span className="text-green-300">{t('Assigned')}:</span>
                                    <span className="ml-1 text-white">
                                        {Object.keys(zoneAssignments).length}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-blue-300">{t('Total zones')}:</span>
                                    <span className="ml-1 text-white">{zones.length}</span>
                                </div>
                            </div>

                            {/* แสดงข้อมูลสรุปการปลูกที่ใช้ระยะที่ปรับแล้ว */}
                            {Object.keys(zoneAssignments).length > 0 && (
                                <div className="mt-3 border-t border-gray-600 pt-3">
                                    <div className="mb-2 text-xs text-gray-300">
                                        🌱 {t('Planting Summary')}
                                    </div>
                                    <div className="space-y-1 text-xs">
                                        {Object.entries(zoneAssignments).map(
                                            ([zoneId, cropValue]) => {
                                                const zone = zones.find(
                                                    (z) => z.id.toString() === zoneId
                                                );
                                                const cropData = getTranslatedCropByValue(
                                                    cropValue as string,
                                                    language
                                                );
                                                const currentRowSpacing =
                                                    rowSpacing[cropValue as string] ||
                                                    cropData?.rowSpacing;
                                                const currentPlantSpacing =
                                                    plantSpacing[cropValue as string] ||
                                                    cropData?.plantSpacing;
                                                const plantCount = calculatePlantsInZone(zoneId);

                                                return zone && cropData ? (
                                                    <div
                                                        key={zoneId}
                                                        className="flex items-center justify-between"
                                                    >
                                                        <span className="text-gray-400">
                                                            {t('Zone')}{' '}
                                                            {zones.findIndex(
                                                                (z) => z.id.toString() === zoneId
                                                            ) + 1}
                                                            :
                                                        </span>
                                                        <div className="text-right">
                                                            <div className="font-medium text-white">
                                                                {plantCount.toLocaleString()}{' '}
                                                                {t('plants')}
                                                            </div>
                                                            <div className="text-xs text-gray-400">
                                                                {currentRowSpacing}×
                                                                {currentPlantSpacing} cm
                                                                {(rowSpacing[cropValue as string] ||
                                                                    plantSpacing[
                                                                        cropValue as string
                                                                    ]) && (
                                                                    <span className="ml-1 text-green-400">
                                                                        (ปรับแล้ว)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null;
                                            }
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div
                        className="rounded-lg border border-white p-3"
                        style={{ backgroundColor: '#000005' }}
                    >
                        <div className="flex items-center justify-between">
                            <button
                                onClick={previousStep}
                                className="rounded border border-white px-3 py-1 text-sm text-white transition-colors hover:bg-gray-500"
                                style={{ backgroundColor: '#000005' }}
                            >
                                ⬅️ {t('Previous Step')}
                            </button>
                            <button
                                onClick={nextStep}
                                disabled={!validateStep(2)}
                                className={`rounded border border-white px-4 py-1 text-sm transition-colors ${
                                    validateStep(2)
                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                        : 'cursor-not-allowed text-gray-400'
                                }`}
                                style={{ backgroundColor: validateStep(2) ? undefined : '#000005' }}
                            >
                                {t('Next Step')} ➡️
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Pipe System */}
            {currentStep === 3 && (
                <div className="space-y-3">
                    <div className="rounded-lg border border-white bg-purple-500/10 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-purple-300">
                                <img
                                    src="/images/water-pump.png"
                                    alt="Water Pump"
                                    className="mr-1 inline h-4 w-4 object-contain"
                                />
                                {t('Step 3: Pipe System')}
                            </span>
                            <span className="text-xs">{pipes.length > 0 ? '✅' : '⏳'}</span>
                        </div>
                        <div className="mt-1 text-xs text-purple-400">
                            {t('Design water distribution network')}
                        </div>
                    </div>

                    <div
                        className="rounded-lg border border-white p-3"
                        style={{ backgroundColor: '#000005' }}
                    >
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-300">
                                {t('Manual Drawing')}
                            </span>
                            <span className="text-xs text-gray-400">
                                {pipes.filter((p) => p.type !== 'lateral').length} {t('pipes')}
                            </span>
                        </div>

                        <div className="space-y-1">
                            {Object.entries(PIPE_TYPES)
                                .filter(([key, config]) => config.manual)
                                .map(([key, config]) => (
                                    <button
                                        key={key}
                                        onClick={() => setCurrentPipeType(key as any)}
                                        className={`w-full rounded border border-white p-2 text-left text-xs transition-colors ${
                                            currentPipeType === key
                                                ? 'bg-purple-600 text-white'
                                                : 'text-gray-300 hover:bg-gray-500'
                                        }`}
                                        style={{
                                            backgroundColor:
                                                currentPipeType === key ? undefined : '#000005',
                                        }}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <span>{config.icon}</span>
                                            <div
                                                className="h-1 w-8 rounded"
                                                style={{ backgroundColor: config.color }}
                                            ></div>
                                            <span>{t(config.name)}</span>
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </div>

                    <div className="rounded-lg border border-white bg-yellow-500/10 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-yellow-300">
                                ⚡ {t('Auto Generate')}
                            </span>
                            <span className="text-xs text-yellow-400">
                                {pipes.filter((p) => p.type === 'lateral').length} {t('laterals')}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <button
                                onClick={generateLateralPipes}
                                disabled={
                                    isGeneratingPipes ||
                                    pipes.filter((p) => p.type === 'submain').length === 0
                                }
                                className={`w-full rounded border border-white px-3 py-2 text-sm transition-colors ${
                                    pipes.filter((p) => p.type === 'submain').length === 0
                                        ? 'cursor-not-allowed text-gray-400'
                                        : isGeneratingPipes
                                          ? 'cursor-not-allowed bg-yellow-500/50 text-gray-300'
                                          : 'bg-yellow-600 text-white hover:bg-yellow-700'
                                }`}
                                style={{
                                    backgroundColor:
                                        pipes.filter((p) => p.type === 'submain').length === 0 ||
                                        isGeneratingPipes
                                            ? '#000005'
                                            : undefined,
                                }}
                            >
                                {isGeneratingPipes
                                    ? `⏳ ${t('Generating...')}`
                                    : `⚡ ${t('Generate Lateral Pipes')}`}
                            </button>

                            {pipes.filter((p) => p.type === 'lateral').length > 0 && (
                                <button
                                    onClick={clearLateralPipes}
                                    className="w-full rounded border border-white bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700"
                                >
                                    🗑️ {t('Clear Lateral Pipes')}
                                </button>
                            )}
                        </div>

                        {pipes.filter((p) => p.type === 'submain').length === 0 && (
                            <div className="mt-2 text-xs text-yellow-400">
                                💡 {t('Draw submain pipes first')}
                            </div>
                        )}
                    </div>

                    {/* NEW: Lateral Pipe Settings Section - แสดงเฉพาะเมื่อมีท่อย่อย */}
                    {pipes.filter((p) => p.type === 'lateral').length > 0 && (
                        <div
                            className="mt-4 rounded border border-white p-3"
                            style={{ backgroundColor: '#000005' }}
                        >
                            <h4 className="mb-3 text-sm font-semibold text-white">
                                🎛️ {t('การตั้งค่าท่อย่อย')}
                            </h4>

                            <div className="space-y-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-white">
                                        {t('มุมเริ่มต้น')}: {currentBranchAngle}°
                                    </label>
                                    <div className="mb-2 text-xs text-gray-400">
                                        💡 {t('ปรับมุมเริ่มต้นสำหรับท่อใหม่ที่จะสร้าง')}
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="180"
                                        step="1"
                                        value={currentBranchAngle}
                                        onChange={(e) => {
                                            const newAngle = parseInt(e.target.value);
                                            setCurrentBranchAngle(newAngle);

                                            // อัปเดตมุมเริ่มต้นสำหรับท่อใหม่ที่จะสร้าง
                                            setBranchPipeSettings((prev) => ({
                                                ...prev,
                                                defaultAngle: newAngle,
                                            }));

                                            // เรียกใช้ฟังก์ชันอัปเดต Global Angle สำหรับท่อใหม่
                                            if (
                                                typeof window !== 'undefined' &&
                                                (window as any).updateGlobalBranchAngle
                                            ) {
                                                (window as any).updateGlobalBranchAngle(newAngle);
                                            }
                                        }}
                                        className="w-full accent-blue-600"
                                    />
                                    <div className="flex justify-between text-xs text-white">
                                        <span>0°</span>
                                        <span>90°</span>
                                        <span>180°</span>
                                    </div>
                                </div>

                                {/* แสดงรายการท่อย่อยเรียงตามมุม */}
                                {pipes.filter((p) => p.type === 'lateral').length > 0 && (
                                    <div
                                        className="rounded-lg border border-green-200 p-3"
                                        style={{ backgroundColor: '#000005' }}
                                    >
                                        <div className="mb-2 text-xs font-medium text-white">
                                            🎯 {t('รายการท่อย่อย (แสดงข้อมูล)')}
                                        </div>
                                        <div className="max-h-32 space-y-2 overflow-y-auto">
                                            {pipes
                                                .filter((p) => p.type === 'lateral')
                                                .sort((a, b) => {
                                                    switch (sortType) {
                                                        case 'angle':
                                                            return (
                                                                (a.angle || a.currentAngle || 90) -
                                                                (b.angle || b.currentAngle || 90)
                                                            );
                                                        case 'length':
                                                            return (
                                                                (b.length || 0) - (a.length || 0)
                                                            );
                                                        case 'name':
                                                            return a.name.localeCompare(b.name);
                                                        default:
                                                            return 0;
                                                    }
                                                })
                                                .map((pipe) => (
                                                    <div
                                                        key={pipe.id}
                                                        className="rounded p-2 text-xs text-white"
                                                        style={{ backgroundColor: '#000010' }}
                                                    >
                                                        <div className="font-medium">
                                                            {pipe.name}
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>
                                                                {t('มุม')}:{' '}
                                                                {pipe.angle ||
                                                                    pipe.currentAngle ||
                                                                    90}
                                                                °
                                                            </span>
                                                            <span>
                                                                {t('ความยาว')}:{' '}
                                                                {pipe.length?.toFixed(1) || 0}{' '}
                                                                {t('ม.')}
                                                            </span>
                                                        </div>
                                                        <div className="text-gray-400">
                                                            {t('ฝั่ง')}:{' '}
                                                            {pipe.side === 'left'
                                                                ? t('ซ้าย')
                                                                : t('ขวา')}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                        <div className="mt-2 flex gap-1">
                                            <button
                                                onClick={() => {
                                                    setSortType('angle');
                                                    // เรียงตามมุมจากน้อยไปมาก
                                                    const sortedPipes = [
                                                        ...pipes.filter(
                                                            (p) => p.type === 'lateral'
                                                        ),
                                                    ].sort(
                                                        (a, b) =>
                                                            (a.angle || a.currentAngle || 90) -
                                                            (b.angle || b.currentAngle || 90)
                                                    );
                                                    setPipes((prev) => [
                                                        ...prev.filter((p) => p.type !== 'lateral'),
                                                        ...sortedPipes,
                                                    ]);
                                                }}
                                                className={`flex-1 rounded border border-white px-2 py-1 text-xs text-white transition-colors ${
                                                    sortType === 'angle'
                                                        ? 'bg-blue-700'
                                                        : 'bg-blue-600 hover:bg-blue-700'
                                                }`}
                                            >
                                                ↕️ {t('เรียงมุม')}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSortType('length');
                                                    // เรียงตามความยาวจากมากไปน้อย
                                                    const sortedPipes = [
                                                        ...pipes.filter(
                                                            (p) => p.type === 'lateral'
                                                        ),
                                                    ].sort(
                                                        (a, b) => (b.length || 0) - (a.length || 0)
                                                    );
                                                    setPipes((prev) => [
                                                        ...prev.filter((p) => p.type !== 'lateral'),
                                                        ...sortedPipes,
                                                    ]);
                                                }}
                                                className={`flex-1 rounded border border-white px-2 py-1 text-xs text-white transition-colors ${
                                                    sortType === 'length'
                                                        ? 'bg-green-700'
                                                        : 'bg-green-600 hover:bg-green-700'
                                                }`}
                                            >
                                                📏 {t('เรียงความยาว')}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSortType('name');
                                                    // เรียงตามชื่อ
                                                    const sortedPipes = [
                                                        ...pipes.filter(
                                                            (p) => p.type === 'lateral'
                                                        ),
                                                    ].sort((a, b) => a.name.localeCompare(b.name));
                                                    setPipes((prev) => [
                                                        ...prev.filter((p) => p.type !== 'lateral'),
                                                        ...sortedPipes,
                                                    ]);
                                                }}
                                                className={`flex-1 rounded border border-white px-2 py-1 text-xs text-white transition-colors ${
                                                    sortType === 'name'
                                                        ? 'bg-purple-700'
                                                        : 'bg-purple-600 hover:bg-purple-700'
                                                }`}
                                            >
                                                📝 {t('เรียงชื่อ')}
                                            </button>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-400">
                                            💡{' '}
                                            {t('คลิกปุ่มเพื่อเรียงลำดับท่อย่อยตามมุม/ความยาว/ชื่อ')}
                                        </div>
                                        <div className="mt-2 flex gap-1">
                                            <button
                                                onClick={() => {
                                                    // แสดงข้อมูลสถิติเพิ่มเติม
                                                    const lateralPipes = pipes.filter(
                                                        (p) => p.type === 'lateral'
                                                    );
                                                    const avgAngle =
                                                        lateralPipes.length > 0
                                                            ? lateralPipes.reduce(
                                                                  (sum, p) =>
                                                                      sum +
                                                                      (p.angle ||
                                                                          p.currentAngle ||
                                                                          90),
                                                                  0
                                                              ) / lateralPipes.length
                                                            : 0;
                                                    const totalLength = lateralPipes.reduce(
                                                        (sum, p) => sum + (p.length || 0),
                                                        0
                                                    );
                                                    alert(
                                                        `${t('สถิติท่อย่อย')}\n${t('จำนวนท่อ')}: ${lateralPipes.length} ${t('เส้น')}\n${t('มุมเฉลี่ย')}: ${avgAngle.toFixed(1)}°\n${t('ความยาวรวม')}: ${totalLength.toFixed(1)} ${t('ม.')}`
                                                    );
                                                }}
                                                className="w-full rounded border border-white bg-yellow-600 px-2 py-1 text-xs text-white transition-colors hover:bg-yellow-700"
                                            >
                                                📊 {t('ดูสถิติ')}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ข้อมูลสถิติท่อย่อย */}
                                {pipes.filter((p) => p.type === 'lateral').length > 0 && (
                                    <div
                                        className="rounded border border-green-200 p-3 text-xs"
                                        style={{ backgroundColor: '#000005' }}
                                    >
                                        <div className="mb-2 font-medium text-white">
                                            📊 {t('สถิติท่อย่อย')}
                                        </div>
                                        <div className="space-y-1 text-white">
                                            <div className="flex justify-between">
                                                <span>{t('จำนวนท่อย่อย')}:</span>
                                                <span className="font-bold text-green-400">
                                                    {
                                                        pipes.filter((p) => p.type === 'lateral')
                                                            .length
                                                    }{' '}
                                                    {t('เส้น')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>{t('ความยาวรวม')}:</span>
                                                <span className="font-bold text-blue-400">
                                                    {pipes
                                                        .filter((p) => p.type === 'lateral')
                                                        .reduce(
                                                            (sum, p) => sum + (p.length || 0),
                                                            0
                                                        )
                                                        .toFixed(1)}{' '}
                                                    {t('ม.')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>{t('มุมเฉลี่ย')}:</span>
                                                <span className="font-bold text-purple-400">
                                                    {pipes.filter((p) => p.type === 'lateral')
                                                        .length > 0
                                                        ? (
                                                              pipes
                                                                  .filter(
                                                                      (p) => p.type === 'lateral'
                                                                  )
                                                                  .reduce(
                                                                      (sum, p) =>
                                                                          sum +
                                                                          (p.currentAngle || 90),
                                                                      0
                                                                  ) /
                                                              pipes.filter(
                                                                  (p) => p.type === 'lateral'
                                                              ).length
                                                          ).toFixed(1)
                                                        : 0}
                                                    °
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ปุ่มรีเซ็ตมุมท่อย่อย */}
                                {pipes.filter((p) => p.type === 'lateral').length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (
                                                confirm(
                                                    t('รีเซ็ตมุมท่อย่อยทั้งหมดเป็น 90° หรือไม่?')
                                                )
                                            ) {
                                                setPipes((prev) =>
                                                    prev.map((pipe) =>
                                                        pipe.type === 'lateral'
                                                            ? {
                                                                  ...pipe,
                                                                  currentAngle: 90,
                                                                  angle: 90,
                                                              }
                                                            : pipe
                                                    )
                                                );
                                                setCurrentBranchAngle(90);
                                                setBranchPipeSettings((prev) => ({
                                                    ...prev,
                                                    defaultAngle: 90,
                                                }));
                                                setSortType('angle'); // รีเซ็ตการเรียงลำดับ
                                            }
                                        }}
                                        className="w-full rounded border border-white bg-orange-600 px-3 py-2 text-xs text-white transition-colors hover:bg-orange-700"
                                    >
                                        🔄 {t('รีเซ็ตมุมท่อย่อย')}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {pipes.length > 0 && (
                        <div
                            className="rounded-lg border border-white p-3"
                            style={{ backgroundColor: '#000005' }}
                        >
                            <div className="mb-2 text-sm text-gray-300">📊 {t('Pipe Summary')}</div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-blue-300">{t('Main Pipe')}:</span>
                                    <span className="ml-1 text-white">
                                        {pipes.filter((p) => p.type === 'main').length}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-green-300">{t('Sub Main Pipe')}:</span>
                                    <span className="ml-1 text-white">
                                        {pipes.filter((p) => p.type === 'submain').length}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-yellow-300">{t('Lateral Pipe')}:</span>
                                    <span className="ml-1 text-white">
                                        {pipes.filter((p) => p.type === 'lateral').length}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-300">{t('Total')}:</span>
                                    <span className="ml-1 text-white">{pipes.length}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div
                        className="rounded-lg border border-white p-3"
                        style={{ backgroundColor: '#000005' }}
                    >
                        <div className="flex items-center justify-between">
                            <button
                                onClick={previousStep}
                                className="rounded border border-white px-3 py-1 text-sm text-white transition-colors hover:bg-gray-500"
                                style={{ backgroundColor: '#000005' }}
                            >
                                ⬅️ {t('Previous Step')}
                            </button>
                            <button
                                onClick={nextStep}
                                disabled={!validateStep(3)}
                                className={`rounded border border-white px-4 py-1 text-sm transition-colors ${
                                    validateStep(3)
                                        ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                                        : 'cursor-not-allowed text-gray-400'
                                }`}
                                style={{ backgroundColor: validateStep(3) ? undefined : '#000005' }}
                            >
                                {t('Next Step')} ➡️
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Irrigation System */}
            {currentStep === 4 && (
                <div className="space-y-3">
                    <div className="rounded-lg border border-white bg-cyan-500/10 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-cyan-300">
                                🚿 {t('Step 4: Irrigation System')}
                            </span>
                            <span className="text-xs">
                                {Object.keys(irrigationAssignments).length > 0 ? '✅' : '⏳'}
                            </span>
                        </div>
                        <div className="mt-1 text-xs text-cyan-400">
                            {t('Set irrigation systems for each zone')}
                        </div>
                    </div>

                    {zones.length > 0 && (
                        <div className="rounded-lg border border-white bg-cyan-500/10 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <span className="font-medium text-cyan-300">
                                        🚿 {t('Irrigation Systems')}
                                    </span>
                                    <span className="rounded-full border border-white bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-300">
                                        {zones.length} {t('zones')}
                                    </span>
                                </div>
                                <div className="text-xs text-cyan-400">
                                    {Object.keys(irrigationAssignments).length}/{zones.length}{' '}
                                    {t('assigned')}
                                </div>
                            </div>

                            <div className="grid gap-3">
                                {zones.map((zone: any, index: number) => {
                                    const irrigationType = irrigationAssignments[zone.id];
                                    const assignedCrop = zoneAssignments[zone.id];
                                    const cropData = assignedCrop
                                        ? getTranslatedCropByValue(assignedCrop, language)
                                        : null;
                                    const dripPointCount =
                                        zoneSummaries[zone.id]?.dripPointCount || 0;
                                    const currentRadiusConfig =
                                        irrigationRadiusConfig[
                                            irrigationType as keyof typeof irrigationRadiusConfig
                                        ];
                                    const recommendations = assignedCrop
                                        ? getIrrigationRecommendation(assignedCrop)
                                        : [];

                                    return (
                                        <div
                                            key={zone.id}
                                            className="relative rounded-lg border border-white p-3 transition-all hover:bg-gray-700/70"
                                            style={{ backgroundColor: '#000005' }}
                                        >
                                            <div className="mb-3 flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <div
                                                        className="h-4 w-4 rounded-full border-2 border-white/30"
                                                        style={{ backgroundColor: zone.color }}
                                                    ></div>
                                                    <span className="font-medium text-white">
                                                        {t('Zone')} {index + 1}
                                                    </span>
                                                    {irrigationType && (
                                                        <span className="rounded-full border border-white bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-300">
                                                            ✓ {t('Assigned')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Show crop info and recommendations */}
                                            {cropData && (
                                                <div className="mb-3 rounded border border-gray-600 bg-gray-800/50 p-2">
                                                    <div className="flex items-center space-x-2 text-xs">
                                                        <span className="text-lg">
                                                            {cropData.icon}
                                                        </span>
                                                        <span className="font-medium text-white">
                                                            {cropData.name}
                                                        </span>
                                                        <span
                                                            className={`rounded px-2 py-0.5 text-xs ${
                                                                cropData.irrigationNeedsKey ===
                                                                'high'
                                                                    ? 'bg-red-500/20 text-red-300'
                                                                    : cropData.irrigationNeedsKey ===
                                                                        'medium'
                                                                      ? 'bg-yellow-500/20 text-yellow-300'
                                                                      : 'bg-green-500/20 text-green-300'
                                                            }`}
                                                        >
                                                            {cropData.irrigationNeeds}
                                                        </span>
                                                    </div>
                                                    {recommendations.length > 0 && (
                                                        <div className="mt-1 text-xs text-gray-400">
                                                            💡 {t('Recommended')}:{' '}
                                                            {recommendations
                                                                .map((r) => {
                                                                    switch (r) {
                                                                        case 'sprinkler':
                                                                            return t('Sprinkler');
                                                                        case 'mini_sprinkler':
                                                                            return t('Sprinkler');
                                                                        case 'micro_spray':
                                                                            return t('Sprinkler');
                                                                        case 'drip-tape':
                                                                            return t('Drip System');
                                                                        default:
                                                                            return r;
                                                                    }
                                                                })
                                                                .join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <select
                                                value={irrigationType || ''}
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        setIrrigationAssignments((prev: any) => ({
                                                            ...prev,
                                                            [zone.id]: e.target.value,
                                                        }));

                                                        // Set optimal drip spacing if drip system is selected
                                                        if (
                                                            e.target.value === 'drip-tape' &&
                                                            assignedCrop
                                                        ) {
                                                            const optimalSpacing =
                                                                getOptimalDripSpacing(assignedCrop);
                                                            setDripSpacing((prev) => ({
                                                                ...prev,
                                                                [zone.id]: optimalSpacing,
                                                            }));
                                                        }
                                                    } else {
                                                        clearIrrigationForZone(zone.id);
                                                    }
                                                }}
                                                className="w-full rounded-lg border border-white bg-gray-800 px-3 py-2 text-sm text-white transition-colors focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                            >
                                                <option value="">
                                                    {t('Select irrigation system...')}
                                                </option>
                                                <option
                                                    value="sprinkler"
                                                    className={
                                                        recommendations.includes('sprinkler')
                                                            ? 'bg-green-700'
                                                            : ''
                                                    }
                                                >
                                                    🌿 {t('Sprinkler')}{' '}
                                                    {recommendations.includes('sprinkler')
                                                        ? '⭐'
                                                        : ''}
                                                </option>
                                                {/* Removed mini_sprinkler and micro_spray options */}
                                                <option
                                                    value="drip-tape"
                                                    className={
                                                        recommendations.includes('drip-tape')
                                                            ? 'bg-green-700'
                                                            : ''
                                                    }
                                                >
                                                    💧 {t('Drip System')}{' '}
                                                    {recommendations.includes('drip-tape')
                                                        ? '⭐'
                                                        : ''}
                                                </option>
                                            </select>

                                            {irrigationType && (
                                                <div className="mt-3 rounded-lg border border-white bg-gray-800 p-3">
                                                    <div className="mb-2 text-xs text-gray-300">
                                                        {t('Settings')}:
                                                    </div>

                                                    {irrigationType === 'drip-tape' ? (
                                                        <div className="space-y-2">
                                                            <div>
                                                                <label
                                                                    htmlFor={`drip-spacing-${zone.id}`}
                                                                    className="block text-xs font-medium text-gray-400"
                                                                >
                                                                    {t('Emitter Spacing')} (m):
                                                                </label>
                                                                <div className="flex items-center space-x-2">
                                                                    <input
                                                                        id={`drip-spacing-${zone.id}`}
                                                                        type="range"
                                                                        min={0.2}
                                                                        max={0.5}
                                                                        step={0.05}
                                                                        value={
                                                                            dripSpacing[zone.id] ||
                                                                            (assignedCrop
                                                                                ? getOptimalDripSpacing(
                                                                                      assignedCrop
                                                                                  )
                                                                                : 0.3)
                                                                        }
                                                                        onChange={(e) =>
                                                                            setDripSpacing({
                                                                                ...dripSpacing,
                                                                                [zone.id]:
                                                                                    parseFloat(
                                                                                        e.target
                                                                                            .value
                                                                                    ),
                                                                            })
                                                                        }
                                                                        className="w-full"
                                                                    />
                                                                    <span className="text-sm font-semibold text-white">
                                                                        {(
                                                                            dripSpacing[zone.id] ||
                                                                            (assignedCrop
                                                                                ? getOptimalDripSpacing(
                                                                                      assignedCrop
                                                                                  )
                                                                                : 0.3)
                                                                        ).toFixed(2)}
                                                                        m
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {t(
                                                                        'Spacing between emitters on the tape'
                                                                    )}
                                                                </div>
                                                                {cropData && (
                                                                    <div className="text-xs text-cyan-300">
                                                                        💡{' '}
                                                                        {t(
                                                                            'Optimal for {cropName}: {spacing}m'
                                                                        )
                                                                            .replace(
                                                                                '{cropName}',
                                                                                cropData.name
                                                                            )
                                                                            .replace(
                                                                                '{spacing}',
                                                                                getOptimalDripSpacing(
                                                                                    assignedCrop ||
                                                                                        ''
                                                                                ).toFixed(2)
                                                                            )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {dripPointCount > 0 && (
                                                                <div className="text-xs text-cyan-300">
                                                                    {t(
                                                                        'Estimated {count} emitters for this zone'
                                                                    ).replace(
                                                                        '{count}',
                                                                        dripPointCount.toLocaleString()
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : irrigationType && currentRadiusConfig ? (
                                                        <div className="space-y-2">
                                                            <div>
                                                                <label
                                                                    htmlFor={`radius-${zone.id}`}
                                                                    className="block text-xs font-medium text-gray-400"
                                                                >
                                                                    {t('Coverage Radius')} (m):
                                                                </label>
                                                                <div className="flex items-center space-x-2">
                                                                    <input
                                                                        id={`radius-${zone.id}`}
                                                                        type="range"
                                                                        min={
                                                                            currentRadiusConfig.min
                                                                        }
                                                                        max={
                                                                            currentRadiusConfig.max
                                                                        }
                                                                        step={
                                                                            currentRadiusConfig.step
                                                                        }
                                                                        value={
                                                                            irrigationRadius[
                                                                                zone.id
                                                                            ] ||
                                                                            currentRadiusConfig.defaultValue
                                                                        }
                                                                        onChange={(e) =>
                                                                            setIrrigationRadius({
                                                                                ...irrigationRadius,
                                                                                [zone.id]:
                                                                                    parseFloat(
                                                                                        e.target
                                                                                            .value
                                                                                    ),
                                                                            })
                                                                        }
                                                                        className="w-full"
                                                                    />
                                                                    <span className="text-sm font-semibold text-white">
                                                                        {(
                                                                            irrigationRadius[
                                                                                zone.id
                                                                            ] ||
                                                                            currentRadiusConfig.defaultValue
                                                                        ).toFixed(2)}
                                                                        m
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {/* ลบส่วน Overlap Coverage */}
                                                        </div>
                                                    ) : null}

                                                    <div className="mt-3 flex space-x-2">
                                                        <button
                                                            onClick={() =>
                                                                generateIrrigationForZone(
                                                                    zone,
                                                                    irrigationType
                                                                )
                                                            }
                                                            className="flex-1 rounded border border-white bg-cyan-600 px-3 py-1 text-xs text-white transition-colors hover:bg-cyan-700"
                                                        >
                                                            🚿 {t('Generate')}
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                clearIrrigationForZone(
                                                                    zone.id.toString()
                                                                )
                                                            }
                                                            className="rounded border border-white bg-red-600 px-3 py-1 text-xs text-white transition-colors hover:bg-red-700"
                                                        >
                                                            🗑️ {t('Clear')}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div
                        className="rounded-lg border border-white p-3"
                        style={{ backgroundColor: '#000005' }}
                    >
                        <div className="flex items-center justify-between">
                            <button
                                onClick={previousStep}
                                className="rounded border border-white px-3 py-1 text-sm text-white transition-colors hover:bg-gray-500"
                                style={{ backgroundColor: '#000005' }}
                            >
                                ⬅️ {t('Previous Step')}
                            </button>
                            <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-400">{t('Final Step')}</span>
                                <span className="text-lg">{validateStep(4) ? '✅' : '⏳'}</span>
                            </div>
                        </div>
                    </div>

                    {validateStep(4) && handleCaptureMapAndSummary && (
                        <div className="rounded-lg border border-white bg-green-500/10 p-3">
                            <div className="text-center">
                                <div className="mb-2 text-sm font-medium text-green-300">
                                    🎉 {t('Project Complete!')}
                                </div>
                                <div className="mb-3 text-xs text-green-400">
                                    {t(
                                        'All steps completed successfully. Ready to view your project summary.'
                                    )}
                                </div>
                                <button
                                    onClick={handleCaptureMapAndSummary}
                                    className="w-full rounded-lg border border-white bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700"
                                >
                                    📸 {t('View Summary')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default FieldMapToolsPanel;
