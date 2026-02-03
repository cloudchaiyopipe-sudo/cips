/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    IrrigationInput,
    ProjectMode,
    SprinklerSetGroup,
    SprinklerSetItem,
} from '../types/interfaces';
import type { ConnectionPointStats } from '../../utils/horticultureProjectStats';
import type { ConnectionPointEquipment } from './ConnectionEquipmentsSelector';
import { findMatchingPlotData } from '../../utils/greenhouseZoneMapping';
import { formatNumber } from '../utils/calculations';
import { Zone, PlantData } from '../../utils/horticultureUtils';
import {
    getLongestBranchPipeStats,
    getSubMainPipeBranchCount,
    getDetailedBranchPipeStats,
} from '../../utils/horticultureProjectStats';
import { useCalculations } from '../hooks/useCalculations';
import { useLanguage } from '@/contexts/LanguageContext';
import SearchableDropdown from './SearchableDropdown';
import { loadSprinklerConfig } from '../../utils/sprinklerUtils';

interface InputFormProps {
    input: IrrigationInput;
    onInputChange: (input: IrrigationInput) => void;
    selectedSprinkler?: any;
    activeZone?: Zone;
    projectMode?: ProjectMode;
    maxZones?: number;
    zoneAreaData?: {
        zoneId: string;
        zoneName: string;
        areaInRai: number;
        coordinates?: { lat: number; lng: number }[];
        /** จำนวนต้นไม้ (ตรงกับ HorticultureResultsPage) */
        plantCount?: number;
        /** ความต้องการน้ำ ลิตร/นาที (ตรงกับ HorticultureResultsPage) */
        waterNeedPerMinute?: number;
    };
    connectionStats?: ConnectionPointStats[];
    onConnectionEquipmentsChange?: (equipments: ConnectionPointEquipment[]) => void;
    greenhouseData?: any;
    fieldCropSystemData?: any;
    fieldCropIrrigationSettings?: any;
}

interface BranchPipeStats {
    longestBranchPlantCount: number;
    longestBranchLength: number;
    maxBranchesPerSubMain: number;
    totalSubMainPipes: number;
    zoneName: string;
}

interface SprinklerPressureInfo {
    pressureBar: number;
    pressureM: number;
    range: string;
    sprinklerName: string;
}

interface PlantDataWithCategory extends PlantData {
    category?: string;
}

const hasCategory = (plantData: PlantData): plantData is PlantDataWithCategory => {
    return 'category' in plantData;
};


const InputForm: React.FC<InputFormProps> = ({
    input,
    onInputChange,
    selectedSprinkler,
    activeZone,
    projectMode = 'horticulture' as ProjectMode,
    zoneAreaData,
    connectionStats = [],
    onConnectionEquipmentsChange,
    greenhouseData,
    fieldCropSystemData,
    fieldCropIrrigationSettings,
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [validationMessages, setValidationMessages] = useState<string[]>([]);
    const [pipeData, setPipeData] = useState<any[]>([]);
    const [gardenWaterRequirement, setGardenWaterRequirement] = useState<number>(0);

    const { t } = useLanguage();

    const fieldCropSystemDataRef = useRef(fieldCropSystemData);
    fieldCropSystemDataRef.current = fieldCropSystemData;

    const inputRef = useRef(input);
    const onInputChangeRef = useRef(onInputChange);
    const activeZoneRef = useRef(activeZone);
    const hasInitializedSprinklersPerTree = useRef(false);

    // Load sprinklersPerTree from config for horticulture mode
    const defaultSprinklersPerTree = useMemo(() => {
        if (
            projectMode === 'horticulture' &&
            (!input.sprinklersPerTree || input.sprinklersPerTree === 0)
        ) {
            const config = loadSprinklerConfig();
            return config?.sprinklersPerTree || 1;
        }
        return input.sprinklersPerTree || 1;
    }, [projectMode, input.sprinklersPerTree]);

    useEffect(() => {
        inputRef.current = input;
        onInputChangeRef.current = onInputChange;
        activeZoneRef.current = activeZone;
    });

    // Initialize sprinklersPerTree from config only once on mount if not set or is default value (1)
    useEffect(() => {
        if (projectMode === 'horticulture' && !hasInitializedSprinklersPerTree.current) {
            const config = loadSprinklerConfig();
            const configValue = config?.sprinklersPerTree;

            // ถ้ายังไม่มีค่า หรือค่าเป็น 0 หรือค่าเป็น 1 (ค่าเริ่มต้น) ให้ sync กับ config
            // แต่ถ้าผู้ใช้แก้ไขเป็นค่าอื่น (2, 3, 4, 5) แล้ว จะไม่ override
            if (
                configValue &&
                (!input.sprinklersPerTree ||
                    input.sprinklersPerTree === 0 ||
                    input.sprinklersPerTree === 1)
            ) {
                // ตรวจสอบว่า config มีค่าและไม่ใช่ 1 (ถ้า config เป็น 1 ก็ไม่ต้อง sync)
                if (configValue !== 1) {
                    updateInput('sprinklersPerTree', configValue);
                }
            }
            hasInitializedSprinklersPerTree.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectMode]);

    const isPointInZone = useCallback((point: any, zone: any): boolean => {
        if (!point.lat || !point.lng || !zone.coordinates) return false;

        try {
            const zoneCoords = zone.coordinates;
            if (!Array.isArray(zoneCoords) || zoneCoords.length < 3) return false;

            let minLat = Infinity,
                maxLat = -Infinity,
                minLng = Infinity,
                maxLng = -Infinity;

            zoneCoords.forEach((coord: any) => {
                let lat, lng;
                if (Array.isArray(coord) && coord.length === 2) {
                    [lng, lat] = coord;
                } else if (coord.lat !== undefined && coord.lng !== undefined) {
                    lat = coord.lat;
                    lng = coord.lng;
                } else {
                    return;
                }

                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
            });

            return (
                point.lat >= minLat &&
                point.lat <= maxLat &&
                point.lng >= minLng &&
                point.lng <= maxLng
            );
        } catch {
            return false;
        }
    }, []);

    const calculateZoneIrrigationCounts = useCallback(
        (
            zone: any,
            irrigationPoints: any[]
        ): {
            sprinkler: number;
            pivot: number;
            total: number;
        } => {
            if (!irrigationPoints || !Array.isArray(irrigationPoints)) {
                return { sprinkler: 0, pivot: 0, total: 0 };
            }

            let sprinklerCount = 0;
            let pivotCount = 0;

            irrigationPoints.forEach((point) => {
                if (isPointInZone(point, zone)) {
                    if (point.type === 'sprinkler') {
                        sprinklerCount++;
                    } else if (point.type === 'pivot') {
                        pivotCount++;
                    }
                }
            });

            return {
                sprinkler: sprinklerCount,
                pivot: pivotCount,
                total: sprinklerCount + pivotCount,
            };
        },
        [isPointInZone]
    );

    const fieldCropDebugInfo = useMemo(() => {
        return null;
    }, []);


    const calculatePolygonArea = (coords: { lat: number; lng: number }[]): number => {
        if (!coords || coords.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < coords.length; i++) {
            const j = (i + 1) % coords.length;
            area += coords[i].lat * coords[j].lng;
            area -= coords[j].lat * coords[i].lng;
        }
        area = Math.abs(area) / 2;

        const metersPerDegree = 111320;
        return area * metersPerDegree * metersPerDegree;
    };

    const getZoneAreaInRai = (): number => {
        if (zoneAreaData?.areaInRai && zoneAreaData.areaInRai > 0) {
            return zoneAreaData.areaInRai;
        }

        if (zoneAreaData?.coordinates && zoneAreaData.coordinates.length > 0) {
            const areaInSquareMeters = calculatePolygonArea(zoneAreaData.coordinates);
            return areaInSquareMeters / 1600;
        }

        return 0;
    };

    // โหมด horticulture: ใช้ค่าจาก zoneAreaData ให้ตรงกับ HorticultureResultsPage
    const effectiveAreaInRai =
        projectMode === 'horticulture' && zoneAreaData && getZoneAreaInRai() > 0
            ? getZoneAreaInRai()
            : input.farmSizeRai;
    const effectivePlantCount =
        projectMode === 'horticulture' && zoneAreaData?.plantCount != null
            ? zoneAreaData.plantCount
            : input.totalTrees;
    const effectiveWaterNeedPerMinute =
        projectMode === 'horticulture' && zoneAreaData?.waterNeedPerMinute != null
            ? zoneAreaData.waterNeedPerMinute
            : input.waterPerTreeLiters;

    // Sync ข้อมูลจาก zoneAreaData ไป parent เมื่อโหมด horticulture เพื่อให้ input ตรงกับ Results
    useEffect(() => {
        if (
            projectMode !== 'horticulture' ||
            !zoneAreaData ||
            !onInputChangeRef.current
        ) {
            return;
        }
        const areaInRai = getZoneAreaInRai();
        const plantCount = zoneAreaData.plantCount;
        const waterNeed = zoneAreaData.waterNeedPerMinute;
        const cur = inputRef.current;
        const needArea = areaInRai > 0 && Math.abs((cur.farmSizeRai || 0) - areaInRai) > 0.001;
        const needPlants = plantCount != null && cur.totalTrees !== plantCount;
        const needWater = waterNeed != null && Math.abs((cur.waterPerTreeLiters || 0) - waterNeed) > 0.01;
        if (needArea || needPlants || needWater) {
            onInputChangeRef.current({
                ...cur,
                farmSizeRai: areaInRai > 0 ? areaInRai : cur.farmSizeRai,
                totalTrees: plantCount != null ? plantCount : cur.totalTrees,
                waterPerTreeLiters: waterNeed != null ? waterNeed : cur.waterPerTreeLiters,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectMode, zoneAreaData?.zoneId, zoneAreaData?.areaInRai, zoneAreaData?.plantCount, zoneAreaData?.waterNeedPerMinute]);

    useEffect(() => {
        const fetchPipeData = async () => {
            try {
                const endpoints = [
                    '/api/equipments/by-category/pipe',
                    '/api/equipments/category/pipe',
                    '/api/equipments?category=pipe',
                    '/api/equipments/by-category-name/pipe',
                ];
                let data: any[] = [];
                for (const endpoint of endpoints) {
                    try {
                        const response = await fetch(endpoint);
                        if (response.ok) {
                            const result = await response.json();
                            data = Array.isArray(result) ? result : [];
                            break;
                        }
                    } catch (error) {
                        continue;
                    }
                }
                if (data.length === 0) {
                    const response = await fetch('/api/equipments');
                    if (response.ok) {
                        const allEquipments = await response.json();
                        data = Array.isArray(allEquipments)
                            ? allEquipments.filter((item) => {
                                  const categoryMatch =
                                      item.category?.name === 'pipe' ||
                                      item.category?.display_name?.toLowerCase().includes('pipe');
                                  return categoryMatch;
                              })
                            : [];
                    }
                }
                setPipeData(data);
            } catch (error) {
                setPipeData([]);
            }
        };
        fetchPipeData();
    }, []);



    useEffect(() => {
        if (projectMode === 'garden' && activeZone) {
            try {
                const gardenStatsStr = localStorage.getItem('garden_statistics');
                if (gardenStatsStr) {
                    const gardenStats = JSON.parse(gardenStatsStr);
                    if (gardenStats.zones && gardenStats.zones.length > 0) {
                        const currentZoneStats = gardenStats.zones.find(
                            (zone: any) => zone.zoneId === activeZone.id
                        );

                        if (
                            currentZoneStats &&
                            currentZoneStats.sprinklerFlowRate &&
                            currentZoneStats.sprinklerCount
                        ) {
                            const zoneWaterRequirement =
                                currentZoneStats.sprinklerFlowRate *
                                currentZoneStats.sprinklerCount;

                            setGardenWaterRequirement(zoneWaterRequirement);

                            if (
                                zoneWaterRequirement > 0 &&
                                Math.abs(
                                    zoneWaterRequirement - inputRef.current.waterPerTreeLiters
                                ) > 0.01
                            ) {
                                onInputChangeRef.current({
                                    ...inputRef.current,
                                    waterPerTreeLiters: zoneWaterRequirement,
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error calculating garden water requirement:', error);
            }
        } else if (projectMode === 'greenhouse' && activeZone) {
            try {
                // ดึงข้อมูลจาก localStorage ที่เก็บไว้จาก green-house-summary.tsx
                const greenhouseSystemDataStr = localStorage.getItem('greenhouseSystemData');
                if (greenhouseSystemDataStr) {
                    const systemData = JSON.parse(greenhouseSystemDataStr);
                    const plotPipeData = systemData.plotPipeData || [];

                    // หา plot ปัจจุบันจาก plotPipeData
                    const currentPlotPipeData = plotPipeData.find(
                        (plot: any) => plot.plotId === activeZone.id
                    );

                    if (currentPlotPipeData && currentPlotPipeData.totalFlowRate) {
                        const totalFlowRate = currentPlotPipeData.totalFlowRate;

                        setGardenWaterRequirement(totalFlowRate);

                        if (
                            totalFlowRate > 0 &&
                            Math.abs(totalFlowRate - inputRef.current.waterPerTreeLiters) > 0.01
                        ) {
                            onInputChangeRef.current({
                                ...inputRef.current,
                                waterPerTreeLiters: totalFlowRate,
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error processing greenhouse data:', error);
            }
        } else if (projectMode === 'field-crop' && activeZone) {
            try {
                const fieldCropDataStr = localStorage.getItem('fieldCropData');
                if (fieldCropDataStr) {
                    const fieldCropData = JSON.parse(fieldCropDataStr);
                    if (fieldCropData.zones?.info && Array.isArray(fieldCropData.zones.info)) {
                        const currentZone = fieldCropData.zones.info.find(
                            (zone: any) => zone.id === activeZone.id
                        );

                        if (currentZone) {
                            // Get irrigation settings from fieldCropData (same as in field-crop-summary.tsx)
                            // Try to get the same irrigationSettingsData that field-crop-summary.tsx uses
                            const irrigationSettings =
                                (fieldCropData as any).irrigationSettingsData ||
                                fieldCropData.irrigationSettings ||
                                fieldCropIrrigationSettings ||
                                {};

                            // If still no data, try to get from localStorage directly
                            if (!irrigationSettings.sprinkler_system?.flow) {
                                try {
                                    const localStorageData = localStorage.getItem('fieldCropData');
                                    if (localStorageData) {
                                        const parsed = JSON.parse(localStorageData);
                                        if (parsed.irrigationSettings?.sprinkler_system?.flow) {
                                            irrigationSettings.sprinkler_system =
                                                parsed.irrigationSettings.sprinkler_system;
                                        }
                                    }
                                } catch (error) {
                                    console.error('Error parsing fieldCropData:', error);
                                }
                            }
                            const flowPerUnit = {
                                sprinkler: irrigationSettings.sprinkler_system?.flow || 10, // Use real value from field-crop-summary.tsx, fallback to 10
                                pivot: irrigationSettings.pivot?.flow || 0,
                            };

                            // Use sprinklerCount and pivotCount from currentZone (they should be correct)
                            const sprinklerCount = currentZone.sprinklerCount || 0;
                            const pivotCount = currentZone.pivotCount || 0;

                            // Calculate zone total flow (same as in field-crop-summary.tsx)
                            // This matches the calculation: rows.reduce((s, r) => s + r.total, 0)
                            const zoneTotal =
                                sprinklerCount * flowPerUnit.sprinkler +
                                pivotCount * flowPerUnit.pivot;

                            if (
                                zoneTotal > 0 &&
                                Math.abs(zoneTotal - inputRef.current.waterPerTreeLiters) > 0.01
                            ) {
                                onInputChangeRef.current({
                                    ...inputRef.current,
                                    waterPerTreeLiters: zoneTotal,
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error calculating field crop water requirement:', error);
            }
        }
    }, [
        projectMode,
        activeZone?.id,
        activeZone,
        fieldCropSystemData,
        fieldCropIrrigationSettings,
        calculateZoneIrrigationCounts,
    ]);

    // Read elevation difference (tree - pump) computed on results page and set as static head (m)
    useEffect(() => {
        if (projectMode !== 'horticulture') return;
        try {
            const stored = localStorage.getItem('horticulture_elevation_diff_m');
            if (stored !== null) {
                const value = parseFloat(stored);
                if (isFinite(value)) {
                    if (Math.abs(value - inputRef.current.staticHeadM) > 0.01) {
                        onInputChangeRef.current({
                            ...inputRef.current,
                            staticHeadM: value,
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error reading elevation difference from localStorage:', error);
        }
    }, [projectMode, activeZone?.id]);

    const isMultiZone = input.numberOfZones > 1;

    const updateInput = (field: keyof IrrigationInput, value: number) => {
        let validatedValue = value;

        switch (field) {
            case 'farmSizeRai':
                validatedValue = Math.max(0, value);
                break;
            case 'totalTrees':
                validatedValue = Math.max(1, Math.round(value));
                break;
            case 'waterPerTreeLiters':
                validatedValue = Math.max(0.1, value);
                break;
            case 'numberOfZones':
                validatedValue = Math.max(1, Math.round(value));
                break;
            case 'simultaneousZones':
                validatedValue = Math.max(1, Math.min(Math.round(value), input.numberOfZones));
                break;
            case 'irrigationTimeMinutes':
                validatedValue = Math.max(1, Math.min(300, value));
                break;
            case 'staticHeadM':
                // อนุญาตให้เป็นค่าติดลบได้ (สำหรับ elevation difference)
                validatedValue = value;
                break;
            case 'pressureHeadM':
                validatedValue = Math.max(0, value);
                break;
            case 'pipeAgeYears':
                validatedValue = Math.max(0, Math.min(50, value));
                break;
            default:
                validatedValue = Math.max(0, value);
        }

        const formattedValue = [
            'farmSizeRai',
            'waterPerTreeLiters',
            'irrigationTimeMinutes',
            'staticHeadM',
            'pressureHeadM',
            'longestBranchPipeM',
            'totalBranchPipeM',
            'longestSecondaryPipeM',
            'totalSecondaryPipeM',
            'longestMainPipeM',
            'totalMainPipeM',
        ].includes(field)
            ? formatNumber(validatedValue, 3)
            : Math.round(validatedValue);

        // บันทึกค่า staticHeadM ที่แก้ไขกลับไปใน localStorage เพื่อให้ค่าคงที่ทุกโซน
        if (field === 'staticHeadM' && projectMode === 'horticulture') {
            try {
                localStorage.setItem('horticulture_elevation_diff_m', String(formattedValue));
            } catch (error) {
                console.warn('Error saving elevation difference to localStorage:', error);
            }
        }

        onInputChangeRef.current({
            ...inputRef.current,
            [field]: formattedValue,
        });
    };

    const updateInputOnBlur = (field: keyof IrrigationInput, value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || value === '') {
            let defaultValue = 0;
            switch (field) {
                case 'totalTrees':
                    defaultValue = 1;
                    break;
                case 'waterPerTreeLiters':
                    defaultValue = 0.1;
                    break;
                case 'numberOfZones':
                    defaultValue = 1;
                    break;
                case 'irrigationTimeMinutes':
                    defaultValue = 45;
                    break;
                case 'sprinklersPerTree':
                    defaultValue = 1;
                    break;
                case 'sprinklersPerLongestBranch':
                case 'sprinklersPerBranch':
                    defaultValue = input.sprinklersPerBranch || 1;
                    break;
                case 'branchesPerLongestSecondary':
                case 'branchesPerSecondary':
                    defaultValue = input.branchesPerSecondary || 1;
                    break;
                default:
                    defaultValue = 0;
            }
            updateInput(field, defaultValue);
        } else {
            updateInput(field, numValue);
        }
    };

    const calculateEstimatedVelocity = (input: IrrigationInput): number => {
        let estimatedFlowLPM: number;

        if (projectMode === 'greenhouse' || projectMode === 'garden') {
            estimatedFlowLPM =
                (input.totalTrees * input.waterPerTreeLiters) / (input.irrigationTimeMinutes || 30);
        } else if (projectMode === 'field-crop') {
            estimatedFlowLPM = input.totalTrees * input.waterPerTreeLiters;
        } else {
            estimatedFlowLPM = input.totalTrees * input.waterPerTreeLiters;
        }

        const flowM3s = estimatedFlowLPM / 60000;

        const diameterM = 0.032;
        const pipeArea = Math.PI * Math.pow(diameterM / 2, 2);

        return flowM3s / pipeArea;
    };

    const getSprinklerPressureInfo = (): SprinklerPressureInfo | null => {
        if (!selectedSprinkler) return null;

        try {
            let minPressure: number, maxPressure: number;
            const pressureData = selectedSprinkler.pressureBar || selectedSprinkler.pressure_bar;

            if (Array.isArray(pressureData)) {
                minPressure = pressureData[0];
                maxPressure = pressureData[1];
            } else if (typeof pressureData === 'string' && pressureData.includes('-')) {
                const parts = pressureData.split('-');
                minPressure = parseFloat(parts[0]);
                maxPressure = parseFloat(parts[1]);
            } else {
                minPressure = maxPressure = parseFloat(String(pressureData));
            }

            if (isNaN(minPressure) || isNaN(maxPressure)) {
                return null;
            }

            const optimalPressureBar = minPressure + (maxPressure - minPressure) * 0.7;
            const pressureM = optimalPressureBar * 10.2;

            return {
                pressureBar: optimalPressureBar,
                pressureM: pressureM,
                range: `${minPressure}-${maxPressure} บาร์`,
                sprinklerName: selectedSprinkler.productCode,
            };
        } catch (error) {
            return null;
        }
    };

    const calculateBranchPipeStats = (): BranchPipeStats | null => {
        if (
            projectMode === 'garden' ||
            projectMode === 'field-crop' ||
            projectMode === 'greenhouse'
        ) {
            return null;
        }

        try {
            const longestBranchStats = getLongestBranchPipeStats();
            const subMainBranchCount = getSubMainPipeBranchCount();

            if (!longestBranchStats || !subMainBranchCount) {
                return null;
            }

            let zoneStats: BranchPipeStats | null = null;
            if (activeZone) {
                const longestStat = longestBranchStats.find(
                    (stat) => stat.zoneId === activeZone.id
                );
                const subMainStat = subMainBranchCount.find(
                    (stat) => stat.zoneId === activeZone.id
                );

                if (longestStat && subMainStat) {
                    zoneStats = {
                        longestBranchPlantCount: longestStat.longestBranchPipe.plantCount,
                        longestBranchLength: longestStat.longestBranchPipe.length,
                        maxBranchesPerSubMain:
                            subMainStat.subMainPipes.length > 0
                                ? Math.max(...subMainStat.subMainPipes.map((sm) => sm.branchCount))
                                : 0,
                        totalSubMainPipes: subMainStat.subMainPipes.length,
                        zoneName: longestStat.zoneName,
                    };
                }
            } else {
                if (longestBranchStats.length > 0 && subMainBranchCount.length > 0) {
                    zoneStats = {
                        longestBranchPlantCount: longestBranchStats[0].longestBranchPipe.plantCount,
                        longestBranchLength: longestBranchStats[0].longestBranchPipe.length,
                        maxBranchesPerSubMain:
                            subMainBranchCount[0].subMainPipes.length > 0
                                ? Math.max(
                                      ...subMainBranchCount[0].subMainPipes.map(
                                          (sm) => sm.branchCount
                                      )
                                  )
                                : 0,
                        totalSubMainPipes: subMainBranchCount[0].subMainPipes.length,
                        zoneName: longestBranchStats[0].zoneName,
                    };
                }
            }

            return zoneStats;
        } catch (error) {
            return null;
        }
    };

    const branchStats = calculateBranchPipeStats();
    const sprinklerPressure = getSprinklerPressureInfo();

    const getProjectIcon = () => {
        switch (projectMode) {
            case 'garden':
                return '🏡';
            case 'field-crop':
                return '🌾';
            case 'greenhouse':
                return '🏠';
            default:
                return '🌱';
        }
    };

    const getItemName = () => {
        switch (projectMode) {
            case 'garden':
                return t('หัวฉีด');
            case 'field-crop':
                return t('หัวฉีด');
            case 'greenhouse':
                return t('หัวฉีด');
            default:
                return t('ต้นไม้');
        }
    };

    const getAreaUnit = () => {
        switch (projectMode) {
            case 'garden':
            case 'greenhouse':
            case 'field-crop':
            case 'horticulture':
            default:
                return t('ไร่');
        }
    };

    const getAreaConversionFactor = () => {
        return 1;
    };

    const getWaterSourceLabel = () => {
        switch (projectMode) {
            case 'garden':
                return t('แหล่งน้ำ');
            case 'field-crop':
                return t('ปั๊ม');
            case 'greenhouse':
                return t('แหล่งน้ำ');
            default:
                return t('ปั๊ม');
        }
    };

    const getWaterPerItemLabel = () => {
        switch (projectMode) {
            case 'field-crop':
                return t('ต้องการน้ำ (ลิตร/นาที)');
            case 'greenhouse':
                return t('ความต้องการน้ำ (ลิตร/นาที)');
            case 'garden':
                return t('ต้องการน้ำ (ลิตร/นาที)');
            case 'horticulture':
                return t('ต้องการน้ำ (ลิตร/นาที)');
            default:
                return t('น้ำต่อ') + getItemName() + t(' (ลิตร/ครั้ง)');
        }
    };

    const getQuantityLabel = () => {
        switch (projectMode) {
            case 'greenhouse':
                return t('จำนวนหัวฉีด');
            case 'garden':
                return t('จำนวนหัวฉีด');
            case 'field-crop':
                return t('จำนวนหัวฉีด');
            default:
                return t('จำนวนต้นไม้');
        }
    };

    const shouldShowSprinklersPerTree = () => {
        return (
            projectMode !== 'field-crop' && projectMode !== 'greenhouse' && projectMode !== 'garden'
        );
    };


    return (
        <div className="mb-6 rounded-lg bg-gray-800 p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-green-400">
                        📋 {t('ข้อมูลพื้นฐาน')}
                    </h2>

                    <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-700 p-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                {projectMode === 'field-crop'
                                    ? t('ขนาดพื้นที่โซน')
                                    : t('ขนาดพื้นที่')}{' '}
                                ({getAreaUnit()})
                            </label>
                            <input
                                type="number"
                                value={effectiveAreaInRai > 0 ? effectiveAreaInRai.toFixed(2) : (input.farmSizeRai?.toFixed(2) ?? '0')}
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    updateInput('farmSizeRai', value);
                                }}
                                onBlur={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || isNaN(parseFloat(value))) {
                                        updateInput('farmSizeRai', effectiveAreaInRai || 0);
                                    }
                                }}
                                step="0.1"
                                min="0"
                                className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-white focus:border-blue-400"
                            />
                            <p className="mt-1 text-xs text-gray-400">
                                (
                                {(effectiveAreaInRai * 1600).toLocaleString(undefined, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                })}{' '}
                                {t('ตร.ม.')})
                            </p>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                {getQuantityLabel()}
                            </label>
                            <input
                                type="number"
                                value={effectivePlantCount}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value, 10);
                                    if (!isNaN(value)) {
                                        updateInput('totalTrees', value);
                                    }
                                }}
                                onBlur={(e) => updateInputOnBlur('totalTrees', e.target.value)}
                                min="0"
                                step="1"
                                className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-white focus:border-blue-400"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                {getWaterPerItemLabel()}
                            </label>
                            <input
                                type="number"
                                value={(() => {
                                    if (projectMode === 'greenhouse' && activeZone) {
                                        try {
                                            const greenhouseSystemDataStr =
                                                localStorage.getItem('greenhouseSystemData');

                                            if (greenhouseSystemDataStr) {
                                                const systemData =
                                                    JSON.parse(greenhouseSystemDataStr);
                                                const plotPipeData = systemData.plotPipeData || [];
                                                const currentPlotPipeData = findMatchingPlotData(
                                                    activeZone.id,
                                                    plotPipeData
                                                ) as any;

                                                if (
                                                    currentPlotPipeData &&
                                                    currentPlotPipeData.totalFlowRate
                                                ) {
                                                    return currentPlotPipeData.totalFlowRate;
                                                }
                                            }
                                        } catch (error) {
                                            console.error(
                                                'Error getting greenhouse flow rate:',
                                                error
                                            );
                                        }
                                    }
                                    return effectiveWaterNeedPerMinute;
                                })()}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                        updateInput('waterPerTreeLiters', 0);
                                    } else {
                                        const num = parseFloat(value);
                                        if (!isNaN(num)) {
                                            updateInput('waterPerTreeLiters', num);
                                        }
                                    }
                                }}
                                onBlur={(e) =>
                                    updateInputOnBlur('waterPerTreeLiters', e.target.value)
                                }
                                step="0.1"
                                min="0"
                                className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-white focus:border-blue-400"
                            />
                        </div>
                    </div>

                    <div className="rounded-lg bg-gray-700 p-2">
                        <h3 className="mb-3 text-lg font-semibold text-orange-400">
                            ⚙️ {t('การตั้งค่าระบบ')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {shouldShowSprinklersPerTree() && (
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        {t('หัวฉีดต่อต้น')}
                                    </label>
                                    <input
                                        type="number"
                                        step="1"
                                        value={input.sprinklersPerTree || defaultSprinklersPerTree}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value);
                                            if (!isNaN(value)) {
                                                updateInput('sprinklersPerTree', value);
                                            }
                                        }}
                                        onBlur={(e) =>
                                            updateInputOnBlur('sprinklersPerTree', e.target.value)
                                        }
                                        min="1"
                                        max="5"
                                        disabled={projectMode === 'horticulture'}
                                        className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-white focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    {projectMode === 'horticulture' &&
                                        (() => {
                                            const config = loadSprinklerConfig();
                                            const configValue = config?.sprinklersPerTree;
                                            if (configValue) {
                                                const currentValue =
                                                    input.sprinklersPerTree ||
                                                    defaultSprinklersPerTree;
                                                return (
                                                    <p className="mt-1 text-xs text-gray-400">
                                                        {configValue === currentValue ? (
                                                            <span>
                                                                {t('ค่าจาก config')}: {configValue}
                                                            </span>
                                                        ) : (
                                                            <span>
                                                                {t('ค่าจาก config')}: {configValue}{' '}
                                                                ({t('ปัจจุบัน')}: {currentValue})
                                                            </span>
                                                        )}
                                                    </p>
                                                );
                                            }
                                            return null;
                                        })()}
                                </div>
                            )}

                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    {t('ความสูงจาก')}
                                    {getWaterSourceLabel()}
                                    {t('ไปจุดสูงสุด (ม.)')}
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={input.staticHeadM}
                                    onChange={(e) => {
                                        const value =
                                            e.target.value === '' ? 0 : parseFloat(e.target.value);
                                        if (!isNaN(value)) {
                                            updateInput('staticHeadM', value);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const value = e.target.value;
                                        if (value === '' || isNaN(parseFloat(value))) {
                                            updateInput('staticHeadM', 0);
                                        }
                                    }}
                                    className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-white focus:border-blue-400"
                                />
                                <p className="mt-1 text-xs text-gray-400">
                                    {input.staticHeadM < 0
                                        ? t('(ค่าติดลบหมายถึงปั๊มอยู่สูงกว่าต้นไม้)')
                                        : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-400">🔧 {t('ข้อมูลท่อ')}</h3>

                    <div className="rounded-lg bg-gray-700 p-3">
                        <h4 className="mb-2 text-sm font-medium text-yellow-300">
                            🟡 {t('ท่อย่อย (Branch Pipe)')}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-sm">
                                    {t('ท่อเส้นที่ยาวที่สุด (ม.)')}
                                </label>
                                <input
                                    type="number"
                                    defaultValue={Number(input.longestBranchPipeM).toFixed(2)}
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value);
                                        if (!isNaN(value)) {
                                            updateInput('longestBranchPipeM', value);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const value = e.target.value;
                                        if (value === '' || isNaN(parseFloat(value))) {
                                            e.target.value = Number(input.longestBranchPipeM).toFixed(2);
                                        }
                                    }}
                                    step="0.1"
                                    min="0"
                                    className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm">
                                    {t('ท่อรวมทั้งหมด (ม.)')}
                                </label>
                                <input
                                    type="number"
                                    defaultValue={Number(input.totalBranchPipeM).toFixed(2)}
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value);
                                        if (!isNaN(value)) {
                                            updateInput('totalBranchPipeM', value);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const value = e.target.value;
                                        if (value === '' || isNaN(parseFloat(value))) {
                                            e.target.value = Number(input.totalBranchPipeM).toFixed(2);
                                        }
                                    }}
                                    step="0.1"
                                    min="0"
                                    className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                />
                            </div>
                        </div>
                    </div>

                    {input.longestSecondaryPipeM > 0 ? (
                        <div className="rounded-lg bg-gray-700 p-3">
                            <>
                                <h4 className="mb-2 text-sm font-medium text-purple-300">
                                    🟣 {t('ท่อเมนรอง (Sub Main)')}
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1 block text-sm">
                                            {t('ท่อเส้นที่ยาวที่สุด (ม.)')}
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue={Number(input.longestSecondaryPipeM).toFixed(2)}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    updateInput('longestSecondaryPipeM', value);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || isNaN(parseFloat(value))) {
                                                    e.target.value =
                                                        Number(input.longestSecondaryPipeM).toFixed(2);
                                                }
                                            }}
                                            step="0.1"
                                            min="0"
                                            className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">
                                            {t('ท่อรวมทั้งหมด (ม.)')}
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue={Number(input.totalSecondaryPipeM).toFixed(2)}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    updateInput('totalSecondaryPipeM', value);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || isNaN(parseFloat(value))) {
                                                    e.target.value =
                                                        Number(input.totalSecondaryPipeM).toFixed(2);
                                                }
                                            }}
                                            step="0.1"
                                            min="0"
                                            className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                        />
                                    </div>
                                </div>
                            </>
                        </div>
                    ) : null}

                    {input.longestMainPipeM > 0 ? (
                        <div className="rounded-lg bg-gray-700 p-3">
                            <h4 className="mb-2 text-sm font-medium text-red-300">
                                🔴 {t('ท่อเมนหลัก (Main)')}
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-sm">
                                        {t('ท่อเส้นที่ยาวที่สุด (ม.)')}
                                    </label>
                                    <input
                                        type="number"
                                        defaultValue={Number(input.longestMainPipeM).toFixed(2)}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value);
                                            if (!isNaN(value)) {
                                                updateInput('longestMainPipeM', value);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const value = e.target.value;
                                            if (value === '' || isNaN(parseFloat(value))) {
                                                e.target.value = Number(input.longestMainPipeM).toFixed(2);
                                            }
                                        }}
                                        step="0.1"
                                        min="0"
                                        className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm">
                                        {t('ท่อรวมทั้งหมด (ม.)')}
                                    </label>
                                    <input
                                        type="number"
                                        defaultValue={Number(input.totalMainPipeM).toFixed(2)}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value);
                                            if (!isNaN(value)) {
                                                updateInput('totalMainPipeM', value);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const value = e.target.value;
                                            if (value === '' || isNaN(parseFloat(value))) {
                                                e.target.value = Number(input.totalMainPipeM).toFixed(2);
                                            }
                                        }}
                                        step="0.1"
                                        min="0"
                                        className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {input.longestEmitterPipeM && input.longestEmitterPipeM > 0 ? (
                        <>
                            <div className="rounded-lg bg-gray-700 p-3">
                                <h4 className="mb-2 text-sm font-medium text-green-300">
                                    🌿 {t('ท่อย่อยแยก (Emitter Pipe)')}
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1 block text-sm">
                                            {t('ท่อเส้นที่ยาวที่สุด (ม.)')}
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue={
                                                Number(input.longestEmitterPipeM ?? 0).toFixed(2)
                                            }
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    updateInput('longestEmitterPipeM', value);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || isNaN(parseFloat(value))) {
                                                    e.target.value =
                                                        Number(input.longestEmitterPipeM ?? 0).toFixed(2);
                                                }
                                            }}
                                            step="0.1"
                                            min="0"
                                            className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">
                                            {t('ท่อรวมทั้งหมด (ม.)')}
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue={
                                                Number(input.totalEmitterPipeM ?? 0).toFixed(2)
                                            }
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    updateInput('totalEmitterPipeM', value);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || isNaN(parseFloat(value))) {
                                                    e.target.value =
                                                        Number(input.totalEmitterPipeM ?? 0).toFixed(2);
                                                }
                                            }}
                                            step="0.1"
                                            min="0"
                                            className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>

        </div>
    );
};

export default InputForm;
