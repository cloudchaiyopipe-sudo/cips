/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalculationResults, PipeType, IrrigationInput, AnalyzedPipe } from '../types/interfaces';
import { calculatePipeRolls } from '../utils/calculations';
import { useLanguage } from '@/contexts/LanguageContext';
import { findMatchingPlotData } from '../../utils/greenhouseZoneMapping';
import SearchableDropdown from './SearchableDropdown';
import {
    BestPipeInfo,
    calculateNewHeadLoss,
    calculateSprinklerPressure,
    validatePipeSelection,
    selectBestPipe,
    createCalculationSummary,
    PipeCalculationResult,
    SprinklerPressureInfo,
    selectBestPipeByHeadLoss,
    SelectedPipeSizes,
} from '../../utils/horticulturePipeCalculations';

function getTargetHeadLoss(pipeType: string, head20Percent: number): number {
    switch (pipeType) {
        case 'main':
            return head20Percent;
        case 'secondary':
            return head20Percent * 0.6;
        case 'branch':
        case 'emitter':
            return head20Percent * 0.4;
        default:
            return head20Percent * 0.4;
    }
}
import { getSelectedPipeDataInfo, getPipeDataWithSmartSize } from './PipeFrictionLoss';
import { getEnhancedFieldCropData, FieldCropData } from '../../utils/fieldCropData';

interface PipeSelectorProps {
    pipeType: PipeType;
    results: CalculationResults;
    input: IrrigationInput;
    selectedPipe?: any;
    onPipeChange: (pipe: any) => void;
    horticultureSystemData?: any;
    gardenSystemData?: any;
    greenhouseSystemData?: any;
    fieldCropData?: any;
    activeZoneId?: string;
    selectedSprinkler?: any;
    projectMode?: 'horticulture' | 'garden' | 'field-crop' | 'greenhouse';
    selectedPipeSizes?: SelectedPipeSizes;
}

const PipeSelector: React.FC<PipeSelectorProps> = ({
    pipeType,
    results,
    input,
    selectedPipe,
    onPipeChange,
    horticultureSystemData,
    gardenSystemData,
    greenhouseSystemData,
    fieldCropData,
    activeZoneId,
    selectedSprinkler,
    projectMode = 'horticulture',
    selectedPipeSizes = {},
}) => {
    const { t } = useLanguage();

    const [selectedPipeType, setSelectedPipeType] = useState<string>(() => {
        // ท่อย่อย (branch) และท่อย่อยแยก (emitter) ใช้ PVC เป็น default, ท่ออื่นๆ ใช้ PE
        return pipeType === 'branch' || pipeType === 'emitter' ? 'PVC' : 'PE';
    });
    const [availablePipes, setAvailablePipes] = useState<any[]>([]);
    const [calculation, setCalculation] = useState<PipeCalculationResult | null>(null);
    const [sprinklerPressure, setSprinklerPressure] = useState<SprinklerPressureInfo | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [isManuallySelected, setIsManuallySelected] = useState<boolean>(false);
    const [gardenZoneStats, setGardenZoneStats] = useState<any>(null);

    const [zoneManualSelections, setZoneManualSelections] = useState<{ [key: string]: boolean }>(
        {}
    );

    const currentZoneBestPipe = useMemo(() => {
        if (projectMode === 'garden' && gardenSystemData && activeZoneId) {
            const currentZone = gardenSystemData.zones?.find(
                (zone: any) => zone.id === activeZoneId
            );
            if (!currentZone?.bestPipes) return null;

            switch (pipeType) {
                case 'branch':
                    return currentZone.bestPipes.branch;
                case 'secondary':
                    return currentZone.bestPipes.subMain;
                case 'main':
                    return currentZone.bestPipes.main;
                case 'emitter':
                    if (gardenSystemData?.sprinklerConfig) {
                        return {
                            id: 'emitter-pipe',
                            length: 10,
                            count: 1,
                            waterFlowRate: gardenSystemData.sprinklerConfig.flowRatePerPlant,
                            details: { type: 'emitter' },
                        };
                    }
                    return currentZone.bestPipes.branch;
                default:
                    return null;
            }
        }

        if (projectMode === 'field-crop') {
            const fcData = fieldCropData || getEnhancedFieldCropData();
            if (fcData) {
                const createFieldCropPipeInfo = (
                    type: string,
                    length: number,
                    flowRate: number
                ) => ({
                    id: `${type}-pipe-field-crop`,
                    length: length,
                    count: 1,
                    waterFlowRate: flowRate,
                    details: { type: type },
                });

                switch (pipeType) {
                    case 'branch':
                        return createFieldCropPipeInfo(
                            'branch',
                            fcData.pipes?.stats?.lateral?.longest || 50,
                            (fcData.summary?.totalWaterRequirementPerDay || 0) /
                                Math.max(fcData.summary?.totalPlantingPoints || 1, 1) /
                                60
                        );
                    case 'secondary':
                        return createFieldCropPipeInfo(
                            'secondary',
                            fcData.pipes?.stats?.submain?.longest || 100,
                            (fcData.summary?.totalWaterRequirementPerDay || 0) / 60
                        );
                    case 'main':
                        return createFieldCropPipeInfo(
                            'main',
                            fcData.pipes?.stats?.main?.longest || 200,
                            (fcData.summary?.totalWaterRequirementPerDay || 0) / 60
                        );
                    case 'emitter':
                        return createFieldCropPipeInfo(
                            'emitter',
                            fcData.pipes?.stats?.lateral?.averageLength || 20,
                            0.24
                        );
                    default:
                        return null;
                }
            }
        }

        if (projectMode === 'greenhouse' && greenhouseSystemData && activeZoneId) {
            // ดึงข้อมูลจาก localStorage ที่เก็บไว้จาก green-house-summary.tsx
            try {
                const greenhouseSystemDataStr = localStorage.getItem('greenhouseSystemData');
                if (greenhouseSystemDataStr) {
                    const systemData = JSON.parse(greenhouseSystemDataStr);
                    const plotPipeData = systemData.plotPipeData || [];
                    const pipeFlowData = systemData.pipeFlowData || {};

                    // หา plot ปัจจุบันจาก plotPipeData
                    const currentPlotPipeData = plotPipeData.find(
                        (plot: any) => plot.plotId === activeZoneId
                    );

                    if (currentPlotPipeData && pipeFlowData) {
                        const createGreenhousePipeInfo = (
                            type: string,
                            length: number,
                            count: number,
                            flowRate: number
                        ) => ({
                            id: `${type}-pipe-${activeZoneId}`,
                            length: length,
                            count: count,
                            waterFlowRate: flowRate,
                            details: { type: type },
                        });

                        switch (pipeType) {
                            case 'branch': {
                                // ใช้ข้อมูลจาก pipeFlowData.longest.sub (ท่อย่อย)
                                const branchLength =
                                    pipeFlowData.longest?.sub?.length ||
                                    currentPlotPipeData.maxSubPipeLength ||
                                    30;
                                const branchEmitters =
                                    pipeFlowData.longest?.sub?.emitters ||
                                    currentPlotPipeData.longestSubPipeEmitters ||
                                    1;
                                // ใช้การคำนวณเดียวกับในตารางสำหรับแต่ละแปลง: longestSubPipeEmitters * sprinklerFlowRate
                                const sprinklerFlowRate = 8; // L/min per sprinkler (จาก console.log แสดงว่าเป็น 8)
                                const branchFlowRate = branchEmitters * sprinklerFlowRate;

                                return createGreenhousePipeInfo(
                                    'branch',
                                    branchLength,
                                    branchEmitters,
                                    branchFlowRate
                                );
                            }
                            case 'main': {
                                // ใช้ข้อมูลจาก pipeFlowData.longest.main (ท่อเมน)
                                const mainLength =
                                    pipeFlowData.longest?.main?.length ||
                                    currentPlotPipeData.maxMainPipeLength ||
                                    100;
                                const mainConnections =
                                    pipeFlowData.longest?.main?.connections || 1;
                                // ใช้ค่าเดียวกับที่แสดงในบรรทัด 5555-5563 ของ green-house-summary.tsx: plotPipe?.totalFlowRate
                                const mainFlowRate = currentPlotPipeData.totalFlowRate || 0;

                                return createGreenhousePipeInfo(
                                    'main',
                                    mainLength,
                                    mainConnections,
                                    mainFlowRate
                                );
                            }
                            default:
                                return null;
                        }
                    }
                }
            } catch (error) {
                console.error('Error parsing greenhouseSystemData:', error);
            }

            // Fallback to old method if localStorage data not available
            const currentPlot = greenhouseSystemData.summary.plotStats.find(
                (plot: any) => plot.plotId === activeZoneId
            );
            if (!currentPlot) return null;

            const createGreenhousePipeInfo = (type: string, length: number, flowRate: number) => ({
                id: `${type}-pipe-${activeZoneId}`,
                length: length,
                count: 1,
                waterFlowRate: flowRate,
                details: { type: type },
            });

            switch (pipeType) {
                case 'branch': {
                    const branchLength =
                        currentPlot.pipeStats.sub.longest ||
                        currentPlot.pipeStats.drip.longest ||
                        30;
                    const branchFlowRate = currentPlot.production?.waterCalculation
                        ? (currentPlot.production.waterCalculation.dailyWaterNeed?.optimal || 0) /
                          (2 * 30)
                        : currentPlot.production.waterRequirementPerIrrigation / 30;

                    return createGreenhousePipeInfo(
                        'branch',
                        branchLength,
                        Math.max(branchFlowRate, 2.0)
                    );
                }
                case 'main': {
                    const mainLength = currentPlot.pipeStats.main.longest || 100;
                    const mainFlowRate = currentPlot.production?.waterCalculation
                        ? (currentPlot.production.waterCalculation.dailyWaterNeed?.optimal || 0) /
                          (2 * 30)
                        : currentPlot.production.waterRequirementPerIrrigation / 30;

                    return createGreenhousePipeInfo(
                        'main',
                        mainLength,
                        Math.max(mainFlowRate, 10.0)
                    );
                }
                default:
                    return null;
            }
        }

        if (!horticultureSystemData || !activeZoneId) return null;

        const currentZone = horticultureSystemData.zones?.find(
            (zone: any) => zone.id === activeZoneId
        );
        if (!currentZone?.bestPipes) return null;

        switch (pipeType) {
            case 'branch':
                return currentZone.bestPipes.branch;
            case 'secondary':
                return currentZone.bestPipes.subMain;
            case 'main':
                return currentZone.bestPipes.main;
            case 'emitter':
                if (horticultureSystemData?.sprinklerConfig) {
                    const currentProject = localStorage.getItem('currentHorticultureProject');
                    let longestEmitterLength = 10;

                    if (currentProject) {
                        try {
                            const projectData = JSON.parse(currentProject);
                            if (projectData.lateralPipes && projectData.lateralPipes.length > 0) {
                                let maxEmitterLength = 0;
                                projectData.lateralPipes.forEach((lateralPipe: any) => {
                                    if (
                                        lateralPipe.emitterLines &&
                                        lateralPipe.emitterLines.length > 0
                                    ) {
                                        lateralPipe.emitterLines.forEach((emitterLine: any) => {
                                            if (emitterLine.length > maxEmitterLength) {
                                                maxEmitterLength = emitterLine.length;
                                            }
                                        });
                                    }
                                });
                                if (maxEmitterLength > 0) {
                                    longestEmitterLength = maxEmitterLength;
                                }
                            }
                        } catch (error) {
                            console.error('Error parsing horticultureSystemData:', error);
                        }
                    }

                    return {
                        id: 'emitter-pipe',
                        length: longestEmitterLength,
                        count: 1,
                        waterFlowRate: horticultureSystemData.sprinklerConfig.flowRatePerPlant,
                        details: { type: 'emitter' },
                    };
                }
                return currentZone.bestPipes.branch;
            default:
                return null;
        }
    }, [
        projectMode,
        horticultureSystemData,
        gardenSystemData,
        greenhouseSystemData,
        fieldCropData,
        activeZoneId,
        pipeType,
    ]);

    useEffect(() => {
        if (projectMode === 'garden') {
            if (gardenSystemData?.sprinklerConfig?.pressureBar) {
                const pressureBar = gardenSystemData.sprinklerConfig.pressureBar;
                const pressureInfo = {
                    pressureBar: pressureBar,
                    headM: pressureBar * 10,
                    head20PercentM: pressureBar * 10 * 0.2,
                };
                setSprinklerPressure(pressureInfo);
            } else {
                const pressureInfo = {
                    pressureBar: 2.5,
                    headM: 25,
                    head20PercentM: 5,
                };
                setSprinklerPressure(pressureInfo);
            }
        } else if (projectMode === 'greenhouse') {
            if (greenhouseSystemData && activeZoneId) {
                const currentPlot = greenhouseSystemData.summary.plotStats.find(
                    (p: any) => p.plotId === activeZoneId
                );

                let pressureBar = 2.0;

                const irrigationMethod =
                    greenhouseSystemData.projectInfo?.irrigationMethod || 'mini-sprinkler';

                if (irrigationMethod === 'drip') {
                    pressureBar = 1.5;
                } else if (irrigationMethod === 'mini-sprinkler') {
                    pressureBar = 2.0;
                } else if (irrigationMethod === 'mixed') {
                    pressureBar = 2.2;
                }

                if (greenhouseSystemData.rawData?.irrigationElements) {
                    const sprinklerElements =
                        greenhouseSystemData.rawData.irrigationElements.filter(
                            (el: any) => el.type === 'sprinkler'
                        );
                    if (sprinklerElements.length > 0 && sprinklerElements[0].pressureBar) {
                        pressureBar = sprinklerElements[0].pressureBar;
                    }
                }

                const pressureInfo = {
                    pressureBar: pressureBar,
                    headM: pressureBar * 10,
                    head20PercentM: pressureBar * 10 * 0.2,
                };
                setSprinklerPressure(pressureInfo);
            } else {
                const pressureInfo = {
                    pressureBar: 2.0,
                    headM: 20,
                    head20PercentM: 4,
                };
                setSprinklerPressure(pressureInfo);
            }
        } else if (projectMode === 'field-crop') {
            if (fieldCropData) {
                const irrigationByType = fieldCropData.irrigation?.byType || {};
                let pressureBar = 2.5;

                if (irrigationByType.dripTape > 0) {
                    pressureBar = 1.0;
                } else if (irrigationByType.pivot > 0) {
                    pressureBar = 3.0;
                } else if (irrigationByType.waterJetTape > 0) {
                    pressureBar = 1.5;
                }

                const pressureInfo = {
                    pressureBar: pressureBar,
                    headM: pressureBar * 10,
                    head20PercentM: pressureBar * 10 * 0.2,
                };
                setSprinklerPressure(pressureInfo);
            } else {
                const pressureInfo = {
                    pressureBar: 2.5,
                    headM: 25,
                    head20PercentM: 5,
                };
                setSprinklerPressure(pressureInfo);
            }
        } else if (horticultureSystemData?.sprinklerConfig?.pressureBar) {
            const pressureBar = horticultureSystemData.sprinklerConfig.pressureBar;
            const pressureInfo = {
                pressureBar: pressureBar,
                headM: pressureBar * 10,
                head20PercentM: pressureBar * 10 * 0.2,
            };
            setSprinklerPressure(pressureInfo);
        } else if (selectedSprinkler) {
            const pressureInfo = calculateSprinklerPressure(selectedSprinkler);
            setSprinklerPressure(pressureInfo);
        }
    }, [
        projectMode,
        horticultureSystemData,
        gardenSystemData,
        greenhouseSystemData,
        fieldCropData,
        activeZoneId,
        selectedSprinkler,
    ]);

    useEffect(() => {
        if (projectMode === 'garden' && activeZoneId) {
            try {
                const gardenStatsStr = localStorage.getItem('garden_statistics');
                if (gardenStatsStr) {
                    const gardenStats = JSON.parse(gardenStatsStr);
                    if (gardenStats.zones) {
                        const currentZoneStats = gardenStats.zones.find(
                            (zone: any) => zone.zoneId === activeZoneId
                        );
                        setGardenZoneStats(currentZoneStats);
                    }
                }
            } catch (error) {
                setGardenZoneStats(null);
            }
        }
    }, [projectMode, activeZoneId]);

    useEffect(() => {
        if (activeZoneId) {
            const zoneKey = `${activeZoneId}_${pipeType}`;
            const wasManuallySelected = zoneManualSelections[zoneKey] || false;
            setIsManuallySelected(wasManuallySelected);
        }
    }, [activeZoneId, pipeType, zoneManualSelections]);

    // อัปเดต selectedPipeType เมื่อ pipeType เปลี่ยน
    useEffect(() => {
        const newPipeType = pipeType === 'branch' || pipeType === 'emitter' ? 'PVC' : 'PE';
        setSelectedPipeType(newPipeType);
    }, [pipeType]);

    const getPipeTypeName = useCallback(
        (pipeType: PipeType) => {
            switch (pipeType) {
                case 'branch':
                    return t('ท่อย่อย');
                case 'secondary':
                    return t('ท่อเมนรอง');
                case 'main':
                    return t('ท่อเมนหลัก');
                case 'emitter':
                    return t('ท่อย่อยแยก');
                default:
                    return '';
            }
        },
        [t]
    );

    useEffect(() => {
        const loadPipes = async () => {
            try {
                const endpoints = [
                    '/api/equipments/by-category/pipe',
                    '/api/equipments/category/pipe',
                    '/api/equipments?category=pipe',
                ];

                let pipes: any[] = [];
                for (const endpoint of endpoints) {
                    try {
                        const response = await fetch(endpoint);
                        if (response.ok) {
                            pipes = await response.json();
                            break;
                        }
                    } catch (error) {
                        continue;
                    }
                }

                let filteredPipes = pipes.filter((pipe) => {
                    const pipeTypeMatch =
                        pipe.pipeType?.toLowerCase() === selectedPipeType.toLowerCase() ||
                        pipe.type?.toLowerCase() === selectedPipeType.toLowerCase();

                    return pipeTypeMatch;
                });

                if (sprinklerPressure) {
                    filteredPipes = filteredPipes.filter((pipe) => {
                        return (
                            typeof pipe.pn === 'number' && pipe.pn >= sprinklerPressure.pressureBar
                        );
                    });
                }

                setAvailablePipes(filteredPipes);
            } catch (error) {
                setAvailablePipes([]);
            }
        };

        loadPipes();
    }, [projectMode, selectedPipeType, pipeType, sprinklerPressure]);

    const getFilteredPipesByHierarchy = useCallback(
        (pipes: any[]): any[] => {
            if (!selectedPipeSizes || Object.keys(selectedPipeSizes).length === 0) {
                return pipes;
            }

            return pipes.filter((pipe) => {
                const currentSize = pipe.sizeMM;

                switch (pipeType) {
                    case 'emitter':
                        if (selectedPipeSizes.branch) {
                            return currentSize <= selectedPipeSizes.branch;
                        }
                        if (selectedPipeSizes.secondary) {
                            return currentSize <= selectedPipeSizes.secondary;
                        }
                        if (selectedPipeSizes.main) {
                            return currentSize <= selectedPipeSizes.main;
                        }
                        return true;

                    case 'branch':
                        if (selectedPipeSizes.secondary) {
                            return currentSize <= selectedPipeSizes.secondary;
                        }
                        if (selectedPipeSizes.main) {
                            return currentSize <= selectedPipeSizes.main;
                        }
                        if (selectedPipeSizes.emitter) {
                            return currentSize >= selectedPipeSizes.emitter;
                        }
                        return true;

                    case 'secondary':
                        if (selectedPipeSizes.main) {
                            return currentSize <= selectedPipeSizes.main;
                        }
                        if (selectedPipeSizes.branch) {
                            return currentSize >= selectedPipeSizes.branch;
                        }
                        if (selectedPipeSizes.emitter) {
                            return currentSize >= selectedPipeSizes.emitter;
                        }
                        return true;

                    case 'main':
                        if (selectedPipeSizes.secondary) {
                            return currentSize >= selectedPipeSizes.secondary;
                        }
                        if (selectedPipeSizes.branch) {
                            return currentSize >= selectedPipeSizes.branch;
                        }
                        if (selectedPipeSizes.emitter) {
                            return currentSize >= selectedPipeSizes.emitter;
                        }
                        return true;

                    default:
                        return true;
                }
            });
        },
        [selectedPipeSizes, pipeType]
    );

    useEffect(() => {
        const zoneKey = activeZoneId ? `${activeZoneId}_${pipeType}` : '';
        const wasManuallySelectedInThisZone = zoneKey ? zoneManualSelections[zoneKey] : false;

        if (
            availablePipes.length > 0 &&
            currentZoneBestPipe &&
            sprinklerPressure &&
            !isManuallySelected &&
            !wasManuallySelectedInThisZone && // ไม่เคยเลือกด้วยตนเองในโซนนี้
            activeZoneId // ตรวจสอบว่ามี activeZoneId
        ) {
            const hierarchyFilteredPipes = getFilteredPipesByHierarchy(availablePipes);

            if (hierarchyFilteredPipes.length === 0) {
                return;
            }

            const pipesToSelect = hierarchyFilteredPipes;

            const validateCrossComponentHierarchy = (candidatePipe: any): boolean => {
                const candidateSize = candidatePipe.sizeMM;

                let violationFound = false;
                const violationMessages: string[] = [];

                switch (pipeType) {
                    case 'main':
                        if (
                            selectedPipeSizes.secondary &&
                            candidateSize < selectedPipeSizes.secondary
                        ) {
                            violationFound = true;
                            violationMessages.push(
                                `❌ MAIN (${candidateSize}mm) < SECONDARY (${selectedPipeSizes.secondary}mm)`
                            );
                        }
                        if (selectedPipeSizes.branch && candidateSize < selectedPipeSizes.branch) {
                            violationFound = true;
                            violationMessages.push(
                                `❌ MAIN (${candidateSize}mm) < BRANCH (${selectedPipeSizes.branch}mm)`
                            );
                        }
                        if (
                            selectedPipeSizes.emitter &&
                            candidateSize < selectedPipeSizes.emitter
                        ) {
                            violationFound = true;
                            violationMessages.push(
                                `❌ MAIN (${candidateSize}mm) < EMITTER (${selectedPipeSizes.emitter}mm)`
                            );
                        }
                        break;

                    case 'secondary':
                        if (selectedPipeSizes.main && candidateSize > selectedPipeSizes.main) {
                            violationFound = true;
                            violationMessages.push(
                                `❌ SECONDARY (${candidateSize}mm) > MAIN (${selectedPipeSizes.main}mm)`
                            );
                        }
                        if (selectedPipeSizes.branch && candidateSize < selectedPipeSizes.branch) {
                            violationFound = true;
                            violationMessages.push(
                                `❌ SECONDARY (${candidateSize}mm) < BRANCH (${selectedPipeSizes.branch}mm)`
                            );
                        }
                        if (
                            selectedPipeSizes.emitter &&
                            candidateSize < selectedPipeSizes.emitter
                        ) {
                            violationFound = true;
                            violationMessages.push(
                                `❌ SECONDARY (${candidateSize}mm) < EMITTER (${selectedPipeSizes.emitter}mm)`
                            );
                        }
                        break;

                    case 'branch':
                        if (selectedPipeSizes.main && candidateSize > selectedPipeSizes.main) {
                            violationFound = true;
                            violationMessages.push(
                                `❌ BRANCH (${candidateSize}mm) > MAIN (${selectedPipeSizes.main}mm)`
                            );
                        }
                        if (
                            selectedPipeSizes.secondary &&
                            candidateSize > selectedPipeSizes.secondary
                        ) {
                            violationFound = true;
                            violationMessages.push(
                                `❌ BRANCH (${candidateSize}mm) > SECONDARY (${selectedPipeSizes.secondary}mm)`
                            );
                        }
                        if (
                            selectedPipeSizes.emitter &&
                            candidateSize < selectedPipeSizes.emitter
                        ) {
                            violationFound = true;
                            violationMessages.push(
                                `❌ BRANCH (${candidateSize}mm) < EMITTER (${selectedPipeSizes.emitter}mm)`
                            );
                        }
                        break;

                    case 'emitter':
                        if (selectedPipeSizes.main && candidateSize > selectedPipeSizes.main) {
                            violationFound = true;
                            violationMessages.push(
                                `❌ EMITTER (${candidateSize}mm) > MAIN (${selectedPipeSizes.main}mm)`
                            );
                        }
                        if (
                            selectedPipeSizes.secondary &&
                            candidateSize > selectedPipeSizes.secondary
                        ) {
                            violationFound = true;
                            violationMessages.push(
                                `❌ EMITTER (${candidateSize}mm) > SECONDARY (${selectedPipeSizes.secondary}mm)`
                            );
                        }
                        if (selectedPipeSizes.branch && candidateSize > selectedPipeSizes.branch) {
                            violationFound = true;
                            violationMessages.push(
                                `❌ EMITTER (${candidateSize}mm) > BRANCH (${selectedPipeSizes.branch}mm)`
                            );
                        }
                        break;
                }

                if (violationFound) {
                    return false;
                } else {
                    return true;
                }
            };

            const bestPipe = selectBestPipeByHeadLoss(
                pipesToSelect,
                pipeType,
                currentZoneBestPipe,
                selectedPipeType,
                selectedPipeSizes,
                sprinklerPressure.head20PercentM
            );

            if (bestPipe) {
                if (validateCrossComponentHierarchy(bestPipe)) {
                    if (!selectedPipe || selectedPipe.id !== bestPipe.id) {
                        onPipeChange(bestPipe);
                    }
                } else {
                    const alternativePipes = pipesToSelect.filter(validateCrossComponentHierarchy);

                    if (alternativePipes.length > 0) {
                        const alternativeBest = selectBestPipeByHeadLoss(
                            alternativePipes,
                            pipeType,
                            currentZoneBestPipe,
                            selectedPipeType,
                            selectedPipeSizes,
                            sprinklerPressure.head20PercentM
                        );
                        if (
                            alternativeBest &&
                            (!selectedPipe || selectedPipe.id !== alternativeBest.id)
                        ) {
                            onPipeChange(alternativeBest);
                        }
                    } else {
                        onPipeChange(null);
                    }
                }
            }
        }
    }, [
        availablePipes,
        currentZoneBestPipe,
        sprinklerPressure,
        pipeType,
        selectedPipeType,
        selectedPipeSizes,
        selectedPipe,
        onPipeChange,
        isManuallySelected,
        zoneManualSelections,
        activeZoneId,
        getFilteredPipesByHierarchy,
        getPipeTypeName,
    ]);

    useEffect(() => {
        if (selectedPipe && currentZoneBestPipe) {
            const actualPressureClass =
                selectedPipeType === 'PE' ? `PN${selectedPipe.pn}` : `Class${selectedPipe.pn}`;

            const calc = calculateNewHeadLoss(
                currentZoneBestPipe,
                selectedPipeType,
                actualPressureClass,
                `${selectedPipe.sizeMM}mm`,
                pipeType // ส่ง pipeType เพื่อให้ใช้ sprinklerCount สำหรับ branch pipe
            );

            setCalculation(calc);

            if (calc) {
                try {
                    const storageKey =
                        projectMode === 'garden'
                            ? 'garden_pipe_calculations'
                            : projectMode === 'greenhouse'
                              ? 'greenhouse_pipe_calculations'
                              : projectMode === 'field-crop'
                                ? 'field_crop_pipe_calculations'
                                : 'horticulture_pipe_calculations';
                    const existingCalcStr = localStorage.getItem(storageKey);
                    const existingCalc = existingCalcStr ? JSON.parse(existingCalcStr) : {};

                    existingCalc[pipeType] = {
                        headLoss: calc.headLoss,
                        pipeLength: calc.pipeLength,
                        flowRate: calc.flowRate,
                        calculatedAt: new Date().toISOString(),
                    };

                    if (projectMode === 'greenhouse') {
                        delete existingCalc.secondary;
                        delete existingCalc.emitter;
                    }

                    localStorage.setItem(storageKey, JSON.stringify(existingCalc));

                    if (projectMode === 'greenhouse') {
                        const branchHeadLoss = existingCalc.branch?.headLoss || 0;
                        const mainHeadLoss = existingCalc.main?.headLoss || 0;
                        const totalHeadLoss = branchHeadLoss + mainHeadLoss;

                        let maxHeadLoss = 0;
                        try {
                            const maxHeadLossStr = localStorage.getItem('greenhouse_max_head_loss');
                            if (maxHeadLossStr) {
                                const maxHeadLossData = JSON.parse(maxHeadLossStr);
                                maxHeadLoss = maxHeadLossData.totalHeadLoss || 0;
                            }
                        } catch (e) {
                            console.error('Error parsing greenhouse max head loss:', e);
                        }

                        if (totalHeadLoss > maxHeadLoss) {
                            localStorage.setItem(
                                'greenhouse_max_head_loss',
                                JSON.stringify({
                                    totalHeadLoss: totalHeadLoss,
                                    branchHeadLoss: branchHeadLoss,
                                    mainHeadLoss: mainHeadLoss,
                                    updatedAt: new Date().toISOString(),
                                })
                            );
                        }
                    }
                } catch (error) {
                    console.error('Error parsing greenhouse pipe calculations:', error);
                }
            }

            const newWarnings: string[] = [];
            if (calc && sprinklerPressure) {
                if (pipeType === 'main' && calc.headLoss > sprinklerPressure.head20PercentM) {
                    newWarnings.push(
                        `⚠️ ท่อเมนหลัก: ${calc.headLoss.toFixed(3)}ม. มากกว่า 20% Head หัวฉีด (${sprinklerPressure.head20PercentM.toFixed(1)}ม.)`
                    );
                }
            }
            setWarnings(newWarnings);
        }
    }, [
        selectedPipe,
        currentZoneBestPipe,
        selectedPipeType,
        pipeType,
        sprinklerPressure,
        projectMode,
    ]);

    const pipeTypeOptions = [
        { value: 'PE', label: 'PE' },
        { value: 'PVC', label: 'PVC' },
    ];

    const pipeOptions = availablePipes
        .filter((pipe) => {
            const tempValidation = (candidatePipe: any): boolean => {
                const candidateSize = candidatePipe.sizeMM;

                switch (pipeType) {
                    case 'main':
                        return !(
                            (selectedPipeSizes.secondary &&
                                candidateSize < selectedPipeSizes.secondary) ||
                            (selectedPipeSizes.branch &&
                                candidateSize < selectedPipeSizes.branch) ||
                            (selectedPipeSizes.emitter && candidateSize < selectedPipeSizes.emitter)
                        );
                    case 'secondary':
                        return !(
                            (selectedPipeSizes.main && candidateSize > selectedPipeSizes.main) ||
                            (selectedPipeSizes.branch &&
                                candidateSize < selectedPipeSizes.branch) ||
                            (selectedPipeSizes.emitter && candidateSize < selectedPipeSizes.emitter)
                        );
                    case 'branch':
                        return !(
                            (selectedPipeSizes.main && candidateSize > selectedPipeSizes.main) ||
                            (selectedPipeSizes.secondary &&
                                candidateSize > selectedPipeSizes.secondary) ||
                            (selectedPipeSizes.emitter && candidateSize < selectedPipeSizes.emitter)
                        );
                    case 'emitter':
                        return !(
                            (selectedPipeSizes.main && candidateSize > selectedPipeSizes.main) ||
                            (selectedPipeSizes.secondary &&
                                candidateSize > selectedPipeSizes.secondary) ||
                            (selectedPipeSizes.branch && candidateSize > selectedPipeSizes.branch)
                        );
                    default:
                        return true;
                }
            };

            return tempValidation(pipe);
        })
        .map((pipe) => {
            const actualPressureClass =
                selectedPipeType === 'PE' ? `PN${pipe.pn}` : `Class${pipe.pn}`;

            const calc = currentZoneBestPipe
                ? calculateNewHeadLoss(
                      currentZoneBestPipe,
                      selectedPipeType,
                      actualPressureClass,
                      `${pipe.sizeMM}mm`,
                      pipeType // ส่ง pipeType เพื่อให้ใช้ sprinklerCount สำหรับ branch pipe
                  )
                : null;

            const hasWarning =
                calc && sprinklerPressure
                    ? calc.headLoss > sprinklerPressure.head20PercentM
                    : false;

            const headLoss = calc?.headLoss || 0;
            const targetHeadLoss = getTargetHeadLoss(
                pipeType,
                sprinklerPressure?.head20PercentM || 1.9
            );
            const diffFromTarget = Math.abs(headLoss - targetHeadLoss);

            const isHierarchyCompliant = (() => {
                const candidateSize = pipe.sizeMM;
                switch (pipeType) {
                    case 'main':
                        return !(
                            (selectedPipeSizes.secondary &&
                                candidateSize < selectedPipeSizes.secondary) ||
                            (selectedPipeSizes.branch &&
                                candidateSize < selectedPipeSizes.branch) ||
                            (selectedPipeSizes.emitter && candidateSize < selectedPipeSizes.emitter)
                        );
                    case 'secondary':
                        return !(
                            (selectedPipeSizes.main && candidateSize > selectedPipeSizes.main) ||
                            (selectedPipeSizes.branch &&
                                candidateSize < selectedPipeSizes.branch) ||
                            (selectedPipeSizes.emitter && candidateSize < selectedPipeSizes.emitter)
                        );
                    case 'branch':
                        return !(
                            (selectedPipeSizes.main && candidateSize > selectedPipeSizes.main) ||
                            (selectedPipeSizes.secondary &&
                                candidateSize > selectedPipeSizes.secondary) ||
                            (selectedPipeSizes.emitter && candidateSize < selectedPipeSizes.emitter)
                        );
                    case 'emitter':
                        return !(
                            (selectedPipeSizes.main && candidateSize > selectedPipeSizes.main) ||
                            (selectedPipeSizes.secondary &&
                                candidateSize > selectedPipeSizes.secondary) ||
                            (selectedPipeSizes.branch && candidateSize > selectedPipeSizes.branch)
                        );
                    default:
                        return true;
                }
            })();

            return {
                value: pipe.id,
                label: `${isHierarchyCompliant ? '✅' : '⛔'} ${pipe.name || pipe.productCode} - ${pipe.sizeMM}mm (PN${pipe.pn}) | HL: ${headLoss.toFixed(3)}ม.`,
                image: pipe.image,
                productCode: pipe.productCode,
                name: pipe.name,
                brand: pipe.brand,
                price: pipe.price,
                unit: 'บาท/ม้วน',
                headLoss: headLoss,
                hasWarning: hasWarning,
                diffFromTarget: diffFromTarget,
                isHierarchyCompliant: isHierarchyCompliant,
                isRecommended: isHierarchyCompliant && diffFromTarget <= 0.5,
                isGoodChoice: isHierarchyCompliant && diffFromTarget <= 1.0,
                isUsable: isHierarchyCompliant,
            };
        })
        .sort((a, b) => {
            if (a.isHierarchyCompliant !== b.isHierarchyCompliant) {
                return a.isHierarchyCompliant ? -1 : 1;
            }

            return a.diffFromTarget - b.diffFromTarget;
        });

    if (
        projectMode !== 'horticulture' &&
        projectMode !== 'garden' &&
        projectMode !== 'greenhouse' &&
        projectMode !== 'field-crop'
    ) {
        return (
            <div className="flex items-center justify-center rounded-lg bg-gray-800 p-8">
                <div className="text-center text-gray-500">
                    <div className="mb-2 text-4xl">🚧</div>
                    <p>ระบบใหม่สำหรับ Horticulture, Garden, Greenhouse และ Field-crop เท่านั้น</p>
                </div>
            </div>
        );
    }

    if (!currentZoneBestPipe) {
        return (
            <div className="flex items-center justify-center rounded-lg bg-gray-800 p-8">
                <div className="text-center text-gray-500">
                    <div className="mb-2 text-4xl">📊</div>
                    <p>ไม่พบข้อมูลท่อที่ต้องการน้ำมากที่สุด</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`rounded-lg bg-${getPipeTypeName(pipeType) === 'ท่อย่อยแยก' ? 'green-300' : getPipeTypeName(pipeType) === 'ท่อย่อย' ? 'yellow-300' : getPipeTypeName(pipeType) === 'ท่อเมนรอง' ? 'purple-400' : 'red-300'} p-6`}
        >
            <div>
                <div className="mb-2 flex flex-row items-center justify-between gap-4">
                    <div>
                        <h3
                            className={`m-0 p-0 text-2xl font-bold text-${getPipeTypeName(pipeType) === 'ท่อย่อยแยก' ? 'green-800' : getPipeTypeName(pipeType) === 'ท่อย่อย' ? 'yellow-800' : getPipeTypeName(pipeType) === 'ท่อเมนรอง' ? 'purple-800' : 'red-800'}`}
                        >
                            {getPipeTypeName(pipeType)}
                        </h3>
                    </div>
                    <div className="w-32">
                        <SearchableDropdown
                            options={pipeTypeOptions}
                            value={selectedPipeType}
                            onChange={(value) => setSelectedPipeType(value.toString())}
                            placeholder="เลือกประเภทท่อ"
                        />
                    </div>
                </div>

                <div className="mb-2 rounded bg-orange-900 p-2">
                    <h4 className="flex items-center gap-4 text-[12px] font-medium text-orange-300">
                        🔥 ท่อใช้น้ำมากที่สุด:
                        <span className="flex items-center gap-2 text-[12px]">
                            <span className="text-[12px] text-orange-200">ยาว:</span>
                            <span className="text-[12px] font-bold text-white">
                                {projectMode === 'garden' && gardenZoneStats
                                    ? `${gardenZoneStats.totalPipeLength.toFixed(1)} ม.`
                                    : projectMode === 'field-crop' && fieldCropData && activeZoneId
                                      ? (() => {
                                            const currentZone = fieldCropData.zones.info.find(
                                                (z: any) => z.id === activeZoneId
                                            );
                                            if (currentZone) {
                                                const sprinklerFlow =
                                                    fieldCropData.irrigationSettings
                                                        ?.sprinkler_system?.flow ?? 0;
                                                const sprinklerCount =
                                                    currentZone.sprinklerCount || 0;

                                                switch (pipeType) {
                                                    case 'branch':
                                                        return `${(currentZone.pipeStats.lateral.longestLength || 0).toFixed(1)} ม.`;
                                                    case 'secondary':
                                                        return `${(currentZone.pipeStats.submain.longestLength || 0).toFixed(1)} ม.`;
                                                    case 'main':
                                                        return `${(currentZone.pipeStats.main.longestLength || 0).toFixed(1)} ม.`;
                                                    case 'emitter':
                                                        return `${(currentZone.pipeStats.lateral.longestLength || 0).toFixed(1)} ม.`;
                                                    default:
                                                        return `${currentZoneBestPipe.length.toFixed(1)} ม.`;
                                                }
                                            }
                                            return `${currentZoneBestPipe.length.toFixed(1)} ม.`;
                                        })()
                                      : projectMode === 'greenhouse' && activeZoneId
                                        ? (() => {
                                              // ดึงข้อมูลจาก localStorage ที่เก็บไว้จาก green-house-summary.tsx
                                              try {
                                                  const greenhouseSystemDataStr =
                                                      localStorage.getItem('greenhouseSystemData');
                                                  if (greenhouseSystemDataStr) {
                                                      const systemData =
                                                          JSON.parse(greenhouseSystemDataStr);
                                                      const plotPipeData =
                                                          systemData.plotPipeData || [];
                                                      const pipeFlowData =
                                                          systemData.pipeFlowData || {};

                                                      const currentPlotPipeData = plotPipeData.find(
                                                          (plot: any) =>
                                                              plot.plotId === activeZoneId
                                                      );

                                                      if (currentPlotPipeData && pipeFlowData) {
                                                          switch (pipeType) {
                                                              case 'branch':
                                                                  return `${(pipeFlowData.longest?.sub?.length || currentPlotPipeData.maxSubPipeLength || 30).toFixed(1)} ม.`;
                                                              case 'main':
                                                                  return `${(pipeFlowData.longest?.main?.length || currentPlotPipeData.maxMainPipeLength || 100).toFixed(1)} ม.`;
                                                              default:
                                                                  return `${currentZoneBestPipe.length.toFixed(1)} ม.`;
                                                          }
                                                      }
                                                  }
                                              } catch (error) {
                                                  console.error(
                                                      'Error parsing greenhouseSystemData:',
                                                      error
                                                  );
                                              }

                                              // Fallback to old method
                                              const currentPlot =
                                                  greenhouseSystemData?.summary?.plotStats?.find(
                                                      (p: any) => p.plotId === activeZoneId
                                                  );
                                              if (currentPlot) {
                                                  switch (pipeType) {
                                                      case 'branch':
                                                          return `${(currentPlot.pipeStats.drip.longest || currentPlot.pipeStats.sub.longest || 30).toFixed(1)} ม.`;
                                                      case 'main':
                                                          return `${(currentPlot.pipeStats.main.longest || 0).toFixed(1)} ม.`;
                                                      default:
                                                          return `${currentZoneBestPipe.length.toFixed(1)} ม.`;
                                                  }
                                              }
                                              return `${currentZoneBestPipe.length.toFixed(1)} ม.`;
                                          })()
                                        : `${currentZoneBestPipe.length.toFixed(1)} ม.`}
                            </span>
                            <span className="text-[12px] text-orange-200">| ทางออก:</span>
                            <span className="text-[12px] font-bold text-white">
                                {projectMode === 'garden' && gardenZoneStats
                                    ? gardenZoneStats.sprinklerCount
                                    : projectMode === 'field-crop' && fieldCropData && activeZoneId
                                      ? (() => {
                                            const currentZone = fieldCropData.zones.info.find(
                                                (z: any) => z.id === activeZoneId
                                            );
                                            if (currentZone) {
                                                // Based on the table: lateral=5, submain=5, main=1
                                                switch (pipeType) {
                                                    case 'branch':
                                                        // Lateral pipe outlets (sprinklers per lateral)
                                                        return 5; // Based on the table showing 5 outlets for lateral
                                                    case 'secondary':
                                                        // Submain pipe outlets (laterals per submain)
                                                        return 5; // Based on the table showing 5 outlets for submain
                                                    case 'main':
                                                        // Main pipe outlets (submains per main)
                                                        return 1; // Based on the table showing 1 outlet for main
                                                    case 'emitter':
                                                        // Emitter pipe outlets (same as lateral)
                                                        return 5;
                                                    default:
                                                        return currentZoneBestPipe.count;
                                                }
                                            }
                                            return currentZoneBestPipe.count;
                                        })()
                                      : projectMode === 'greenhouse' && activeZoneId
                                        ? (() => {
                                              // ดึงข้อมูลจาก localStorage ที่เก็บไว้จาก green-house-summary.tsx
                                              try {
                                                  const greenhouseSystemDataStr =
                                                      localStorage.getItem('greenhouseSystemData');
                                                  if (greenhouseSystemDataStr) {
                                                      const systemData =
                                                          JSON.parse(greenhouseSystemDataStr);
                                                      const plotPipeData =
                                                          systemData.plotPipeData || [];
                                                      const pipeFlowData =
                                                          systemData.pipeFlowData || {};

                                                      const currentPlotPipeData = plotPipeData.find(
                                                          (plot: any) =>
                                                              plot.plotId === activeZoneId
                                                      );

                                                      if (currentPlotPipeData && pipeFlowData) {
                                                          switch (pipeType) {
                                                              case 'branch':
                                                                  return (
                                                                      pipeFlowData.longest?.sub
                                                                          ?.emitters ||
                                                                      currentPlotPipeData.longestSubPipeEmitters ||
                                                                      1
                                                                  );
                                                              case 'main':
                                                                  return (
                                                                      pipeFlowData.longest?.main
                                                                          ?.connections || 1
                                                                  );
                                                              default:
                                                                  return currentZoneBestPipe.count;
                                                          }
                                                      }
                                                  }
                                              } catch (error) {
                                                  console.error(
                                                      'Error parsing greenhouseSystemData:',
                                                      error
                                                  );
                                              }

                                              // Fallback to old method
                                              const currentPlot =
                                                  greenhouseSystemData?.summary?.plotStats?.find(
                                                      (p: any) => p.plotId === activeZoneId
                                                  );
                                              if (currentPlot) {
                                                  switch (pipeType) {
                                                      case 'branch':
                                                          return (
                                                              currentPlot.equipmentCount
                                                                  .sprinklers || 1
                                                          );
                                                      case 'main':
                                                          return 1;
                                                      default:
                                                          return currentZoneBestPipe.count;
                                                  }
                                              }
                                              return currentZoneBestPipe.count;
                                          })()
                                        : projectMode === 'horticulture' &&
                                            pipeType === 'branch' &&
                                            currentZoneBestPipe.sprinklerCount
                                          ? currentZoneBestPipe.sprinklerCount
                                          : currentZoneBestPipe.count}
                            </span>
                            <span className="text-[12px] text-orange-200">| ใช้น้ำ:</span>
                            <span className="text-[12px] font-bold text-white">
                                {projectMode === 'garden' && gardenZoneStats
                                    ? `${(gardenZoneStats.sprinklerFlowRate * gardenZoneStats.sprinklerCount).toFixed(1)} L/min`
                                    : projectMode === 'field-crop' && fieldCropData && activeZoneId
                                      ? (() => {
                                            const currentZone = fieldCropData.zones.info.find(
                                                (z: any) => z.id === activeZoneId
                                            );
                                            if (currentZone && fieldCropData.irrigationSettings) {
                                                const sprinklerFlow =
                                                    fieldCropData.irrigationSettings
                                                        .sprinkler_system?.flow ?? 0;
                                                // Based on the table: lateral=30, submain=120, main=120
                                                switch (pipeType) {
                                                    case 'branch':
                                                        // Lateral pipe flow (per lateral)
                                                        return `30.0 L/min`; // Based on the table showing 30 L/min for lateral
                                                    case 'secondary':
                                                        // Submain pipe flow (total for submain)
                                                        return `120.0 L/min`; // Based on the table showing 120 L/min for submain
                                                    case 'main':
                                                        // Main pipe flow (total for main)
                                                        return `120.0 L/min`; // Based on the table showing 120 L/min for main
                                                    case 'emitter':
                                                        // Emitter pipe flow (per emitter)
                                                        return `30.0 L/min`; // Same as lateral
                                                    default:
                                                        return `${currentZoneBestPipe.waterFlowRate.toFixed(1)} L/min`;
                                                }
                                            }
                                            return `${currentZoneBestPipe.waterFlowRate.toFixed(1)} L/min`;
                                        })()
                                      : projectMode === 'greenhouse' && activeZoneId
                                        ? (() => {
                                              // ดึงข้อมูลจาก localStorage ที่เก็บไว้จาก green-house-summary.tsx
                                              try {
                                                  const greenhouseSystemDataStr =
                                                      localStorage.getItem('greenhouseSystemData');
                                                  if (greenhouseSystemDataStr) {
                                                      const systemData =
                                                          JSON.parse(greenhouseSystemDataStr);
                                                      const plotPipeData =
                                                          systemData.plotPipeData || [];
                                                      const pipeFlowData =
                                                          systemData.pipeFlowData || {};

                                                      // ใช้ utility function ที่ยืดหยุ่น
                                                      const currentPlotPipeData =
                                                          findMatchingPlotData(
                                                              activeZoneId,
                                                              plotPipeData
                                                          ) as any;

                                                      if (currentPlotPipeData && pipeFlowData) {
                                                          switch (pipeType) {
                                                              case 'branch': {
                                                                  // ใช้การคำนวณเดียวกับในตารางสำหรับแต่ละแปลง: longestSubPipeEmitters * sprinklerFlowRate
                                                                  const longestSubPipeEmitters =
                                                                      currentPlotPipeData.longestSubPipeEmitters ||
                                                                      0;
                                                                  // ดึง sprinklerFlowRate จาก summaryData เหมือนใน green-house-summary.tsx
                                                                  const sprinklerFlowRate = 8; // L/min per sprinkler (จาก console.log แสดงว่าเป็น 8)
                                                                  const flowRate =
                                                                      longestSubPipeEmitters *
                                                                      sprinklerFlowRate;
                                                                  return `${flowRate.toFixed(1)} L/min`;
                                                              }
                                                              case 'main': {
                                                                  // ใช้ค่าเดียวกับที่แสดงในบรรทัด 5555-5563 ของ green-house-summary.tsx: plotPipe?.totalFlowRate
                                                                  const mainFlowRate =
                                                                      currentPlotPipeData.totalFlowRate ||
                                                                      0;
                                                                  return `${mainFlowRate.toFixed(1)} L/min`;
                                                              }
                                                              default:
                                                                  return `${currentZoneBestPipe.waterFlowRate.toFixed(1)} L/min`;
                                                          }
                                                      }
                                                  }
                                              } catch (error) {
                                                  console.error(
                                                      'Error parsing greenhouseSystemData:',
                                                      error
                                                  );
                                              }

                                              // Fallback to old method
                                              const currentPlot =
                                                  greenhouseSystemData?.summary?.plotStats?.find(
                                                      (p: any) => p.plotId === activeZoneId
                                                  );
                                              if (currentPlot) {
                                                  switch (pipeType) {
                                                      case 'branch':
                                                          return `${(currentPlot.production.waterRequirementPerIrrigation / Math.max(currentPlot.equipmentCount.sprinklers || 1, 1)).toFixed(1)} L/min`;
                                                      case 'main':
                                                          return `${currentPlot.production.waterRequirementPerIrrigation.toFixed(1)} L/min`;
                                                      default:
                                                          return `${currentZoneBestPipe.waterFlowRate.toFixed(1)} L/min`;
                                                  }
                                              }
                                              return `${currentZoneBestPipe.waterFlowRate.toFixed(1)} L/min`;
                                          })()
                                        : `${currentZoneBestPipe.waterFlowRate.toFixed(1)} L/min`}
                            </span>
                        </span>
                    </h4>
                </div>

                {/* เลือกท่อ */}
                {pipeOptions.length > 0 ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                                <SearchableDropdown
                                    options={pipeOptions}
                                    value={selectedPipe?.id || ''}
                                    onChange={(value) => {
                                        const pipe = availablePipes.find((p) => p.id === value);
                                        if (pipe) {
                                            setIsManuallySelected(true);
                                            // บันทึกการเลือกด้วยตนเองในโซนนี้
                                            if (activeZoneId) {
                                                const zoneKey = `${activeZoneId}_${pipeType}`;
                                                setZoneManualSelections((prev) => ({
                                                    ...prev,
                                                    [zoneKey]: true,
                                                }));
                                            }
                                            onPipeChange(pipe);
                                        }
                                    }}
                                    placeholder="เลือกท่อ"
                                />
                            </div>
                            {isManuallySelected && (
                                <button
                                    onClick={() => {
                                        setIsManuallySelected(false);
                                        // ลบการเลือกด้วยตนเองในโซนนี้
                                        if (activeZoneId) {
                                            const zoneKey = `${activeZoneId}_${pipeType}`;
                                            setZoneManualSelections((prev) => ({
                                                ...prev,
                                                [zoneKey]: false,
                                            }));
                                        }
                                        if (
                                            availablePipes.length > 0 &&
                                            currentZoneBestPipe &&
                                            sprinklerPressure
                                        ) {
                                            const hierarchyFilteredPipes = availablePipes.filter(
                                                (pipe) => {
                                                    const candidateSize = pipe.sizeMM;
                                                    switch (pipeType) {
                                                        case 'main':
                                                            return !(
                                                                (selectedPipeSizes.secondary &&
                                                                    candidateSize <
                                                                        selectedPipeSizes.secondary) ||
                                                                (selectedPipeSizes.branch &&
                                                                    candidateSize <
                                                                        selectedPipeSizes.branch) ||
                                                                (selectedPipeSizes.emitter &&
                                                                    candidateSize <
                                                                        selectedPipeSizes.emitter)
                                                            );
                                                        case 'secondary':
                                                            return !(
                                                                (selectedPipeSizes.main &&
                                                                    candidateSize >
                                                                        selectedPipeSizes.main) ||
                                                                (selectedPipeSizes.branch &&
                                                                    candidateSize <
                                                                        selectedPipeSizes.branch) ||
                                                                (selectedPipeSizes.emitter &&
                                                                    candidateSize <
                                                                        selectedPipeSizes.emitter)
                                                            );
                                                        case 'branch':
                                                            return !(
                                                                (selectedPipeSizes.main &&
                                                                    candidateSize >
                                                                        selectedPipeSizes.main) ||
                                                                (selectedPipeSizes.secondary &&
                                                                    candidateSize >
                                                                        selectedPipeSizes.secondary) ||
                                                                (selectedPipeSizes.emitter &&
                                                                    candidateSize <
                                                                        selectedPipeSizes.emitter)
                                                            );
                                                        case 'emitter':
                                                            return !(
                                                                (selectedPipeSizes.main &&
                                                                    candidateSize >
                                                                        selectedPipeSizes.main) ||
                                                                (selectedPipeSizes.secondary &&
                                                                    candidateSize >
                                                                        selectedPipeSizes.secondary) ||
                                                                (selectedPipeSizes.branch &&
                                                                    candidateSize >
                                                                        selectedPipeSizes.branch)
                                                            );
                                                        default:
                                                            return true;
                                                    }
                                                }
                                            );
                                            const pipesToSelect = hierarchyFilteredPipes;
                                            const bestPipe = selectBestPipeByHeadLoss(
                                                pipesToSelect,
                                                pipeType,
                                                currentZoneBestPipe,
                                                selectedPipeType,
                                                selectedPipeSizes,
                                                sprinklerPressure.head20PercentM
                                            );
                                            if (bestPipe) {
                                                onPipeChange(bestPipe);
                                            }
                                        }
                                    }}
                                    className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
                                    title={t('กลับไปใช้การเลือกอัตโนมัติ')}
                                >
                                    🤖
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="py-4 text-center text-black">
                        <p className="font-semibold text-red-600">🚫 ไม่มีท่อให้เลือก</p>
                        <div className="mt-3 text-sm">
                            {(() => {
                                const totalAvailable = availablePipes.length;
                                const hierarchyFiltered = availablePipes.filter((pipe) => {
                                    const candidateSize = pipe.sizeMM;
                                    switch (pipeType) {
                                        case 'main':
                                            return !(
                                                (selectedPipeSizes.secondary &&
                                                    candidateSize < selectedPipeSizes.secondary) ||
                                                (selectedPipeSizes.branch &&
                                                    candidateSize < selectedPipeSizes.branch) ||
                                                (selectedPipeSizes.emitter &&
                                                    candidateSize < selectedPipeSizes.emitter)
                                            );
                                        case 'secondary':
                                            return !(
                                                (selectedPipeSizes.main &&
                                                    candidateSize > selectedPipeSizes.main) ||
                                                (selectedPipeSizes.branch &&
                                                    candidateSize < selectedPipeSizes.branch) ||
                                                (selectedPipeSizes.emitter &&
                                                    candidateSize < selectedPipeSizes.emitter)
                                            );
                                        case 'branch':
                                            return !(
                                                (selectedPipeSizes.main &&
                                                    candidateSize > selectedPipeSizes.main) ||
                                                (selectedPipeSizes.secondary &&
                                                    candidateSize > selectedPipeSizes.secondary) ||
                                                (selectedPipeSizes.emitter &&
                                                    candidateSize < selectedPipeSizes.emitter)
                                            );
                                        case 'emitter':
                                            return !(
                                                (selectedPipeSizes.main &&
                                                    candidateSize > selectedPipeSizes.main) ||
                                                (selectedPipeSizes.secondary &&
                                                    candidateSize > selectedPipeSizes.secondary) ||
                                                (selectedPipeSizes.branch &&
                                                    candidateSize > selectedPipeSizes.branch)
                                            );
                                        default:
                                            return true;
                                    }
                                }).length;

                                if (totalAvailable === 0) {
                                    return (
                                        <div className="space-y-2">
                                            <div className="rounded border border-red-300 bg-red-100 p-2">
                                                <p className="font-medium text-red-700">
                                                    ❌ ไม่มีท่อในฐานข้อมูล:
                                                </p>
                                                <ul className="mt-1 list-inside list-disc text-xs text-red-600">
                                                    <li>ไม่มีท่อประเภท {selectedPipeType}</li>
                                                    <li>
                                                        หรือไม่มีท่อที่มีแรงดัน ≥{' '}
                                                        {sprinklerPressure?.pressureBar.toFixed(1)}{' '}
                                                        บาร์
                                                    </li>
                                                    {(pipeType === 'branch' ||
                                                        pipeType === 'emitter') && (
                                                        <li>
                                                            หรือขนาดท่อเกิน 32mm (
                                                            {getPipeTypeName(pipeType)}: ≤32mm)
                                                        </li>
                                                    )}
                                                </ul>
                                            </div>
                                        </div>
                                    );
                                } else if (hierarchyFiltered === 0) {
                                    return (
                                        <div className="space-y-3">
                                            <div className="rounded border border-orange-300 bg-orange-100 p-3">
                                                <p className="font-semibold text-orange-700">
                                                    ⛔ Hierarchy Violation!
                                                </p>
                                                <p className="mt-1 text-orange-600">
                                                    มีท่อ{' '}
                                                    <span className="font-bold">
                                                        {totalAvailable}
                                                    </span>{' '}
                                                    รายการ แต่
                                                    <span className="font-bold text-red-600">
                                                        {' '}
                                                        ไม่เข้ากับลำดับชั้นท่อ
                                                    </span>
                                                </p>

                                                <div className="mt-2 rounded border bg-orange-50 p-2 text-xs">
                                                    <p className="font-medium text-orange-800">
                                                        📋 กฎลำดับชั้น:
                                                    </p>
                                                    <p className="mt-1 text-orange-700">
                                                        เมนหลัก {`>`} เมนรอง {`>`} ย่อย {`>`}{' '}
                                                        ย่อยแยก
                                                    </p>
                                                </div>

                                                <div className="mt-2 rounded border bg-red-50 p-2 text-xs">
                                                    <p className="font-medium text-red-700">
                                                        🎯 วิธีแก้ไข:
                                                    </p>
                                                    <ul className="mt-1 list-inside list-disc space-y-1 text-red-600">
                                                        <li>
                                                            เลือก<strong>ท่ออื่น</strong>
                                                            ในประเภทที่มีปัญหา hierarchy
                                                        </li>
                                                        <li>
                                                            หรือใช้ปุ่ม{' '}
                                                            <strong>"🔄 Reset ทั้งหมด"</strong>{' '}
                                                            ด้านบน
                                                        </li>
                                                        <li>
                                                            <strong>ลำดับความสำคัญ:</strong>{' '}
                                                            Hierarchy {`>`} Head Loss
                                                        </li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return <p>กรุณาเปลี่ยนประเภทท่อ</p>;
                            })()}
                        </div>
                    </div>
                )}

                {calculation && (
                    <div className="mt-2 rounded bg-green-900 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <h4 className="font-medium text-green-300">📊 การคำนวณ Head Loss</h4>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-red-500">
                                    {calculation.headLoss.toFixed(3)} ม.
                                </span>
                            </div>
                        </div>

                        <details className="text-xs text-green-200">
                            <summary className="cursor-pointer hover:text-green-100">
                                รายละเอียดการคำนวณ
                            </summary>
                            <pre className="mt-2 whitespace-pre-wrap rounded bg-green-800 p-2">
                                {selectedPipe && (
                                    <div className="mb-3 rounded bg-blue-900 p-2">
                                        <h5 className="mb-1 text-xs font-medium text-blue-300">
                                            🔍 ข้อมูลที่ใช้ในการคำนวณ
                                        </h5>
                                        {(() => {
                                            const actualPressureClass =
                                                selectedPipeType === 'PE'
                                                    ? `PN${selectedPipe.pn}`
                                                    : `Class${selectedPipe.pn}`;
                                            const pipeDataInfo = getSelectedPipeDataInfo(
                                                selectedPipeType,
                                                actualPressureClass,
                                                `${selectedPipe.sizeMM}mm`
                                            );

                                            if (pipeDataInfo) {
                                                return (
                                                    <div className="text-xs text-blue-200">
                                                        <div className="flex justify-between">
                                                            <span>ท่อที่เลือก:</span>
                                                            <span className="font-medium">
                                                                {selectedPipeType}{' '}
                                                                {pipeDataInfo.originalValue} ขนาด{' '}
                                                                {pipeDataInfo.sizeInfo
                                                                    ?.originalSize ||
                                                                    `${selectedPipe.sizeMM}mm`}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>ใช้ข้อมูลจากตาราง:</span>
                                                            <span className="font-medium text-yellow-300">
                                                                {selectedPipeType}{' '}
                                                                {pipeDataInfo.selectedValue} ขนาด{' '}
                                                                {pipeDataInfo.sizeInfo
                                                                    ?.selectedSize ||
                                                                    `${selectedPipe.sizeMM}mm`}
                                                                {(!pipeDataInfo.isExactMatch ||
                                                                    (pipeDataInfo.sizeInfo &&
                                                                        !pipeDataInfo.sizeInfo
                                                                            .isExactSizeMatch)) &&
                                                                    ' ⚠️'}
                                                            </span>
                                                        </div>

                                                        {/* แสดงคำอธิบายสำหรับ PN/Class */}
                                                        {/* {!pipeDataInfo.isExactMatch && (
                                                    <div className="mt-1 text-yellow-200 bg-yellow-900 rounded px-2 py-1">
                                                        <div className="text-xs">{pipeDataInfo.reason}</div>
                                                    </div>
                                                )} */}

                                                        {/* แสดงคำอธิบายสำหรับขนาดท่อ */}
                                                        {/* {pipeDataInfo.sizeInfo && !pipeDataInfo.sizeInfo.isExactSizeMatch && (
                                                    <div className="mt-1 text-orange-200 bg-orange-900 rounded px-2 py-1">
                                                        <div className="text-xs">{pipeDataInfo.sizeInfo.sizeReason}</div>
                                                    </div>
                                                )} */}

                                                        {/* แสดงข้อมูลลำดับชั้นท่อ */}
                                                        {selectedPipeSizes &&
                                                            Object.keys(selectedPipeSizes).length >
                                                                0 && (
                                                                <div className="mt-2 rounded bg-gray-800 p-2">
                                                                    <div className="mb-1 text-xs text-gray-300">
                                                                        📏 ลำดับชั้นของท่อ:
                                                                    </div>
                                                                    <div className="text-xs text-gray-400">
                                                                        {selectedPipeSizes.main &&
                                                                            `เมน: ${selectedPipeSizes.main}mm `}
                                                                        {selectedPipeSizes.secondary &&
                                                                            `| เมนรอง: ${selectedPipeSizes.secondary}mm `}
                                                                        {selectedPipeSizes.branch &&
                                                                            `| ย่อย: ${selectedPipeSizes.branch}mm `}
                                                                        {selectedPipeSizes.emitter &&
                                                                            `| ย่อยแยก: ${selectedPipeSizes.emitter}mm`}
                                                                    </div>
                                                                    <div className="mt-1 text-xs text-purple-300">
                                                                        📋 ขนาดปัจจุบัน ({pipeType}
                                                                        ): {selectedPipe.sizeMM}mm
                                                                    </div>
                                                                </div>
                                                            )}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                )}
                                {calculation.calculationDetails}
                            </pre>
                        </details>
                    </div>
                )}

                {/* แสดง warnings */}
                {warnings.length > 0 && (
                    <div className="mt-2 rounded bg-red-900 p-3">
                        <h4 className="mb-2 font-medium text-red-300">⚠️ คำเตือน</h4>
                        {warnings.map((warning, index) => (
                            <p key={index} className="text-sm text-red-200">
                                {warning}
                            </p>
                        ))}
                    </div>
                )}

                {/* แสดงข้อมูลท่อที่เลือก */}
                {selectedPipe && (
                    <div className="mt-2 rounded bg-gray-700 p-4">
                        <div className="mb-2 flex items-center justify-between">
                            <h4 className="font-medium text-gray-300">
                                รหัสสินค้า:{' '}
                                <span className="font-bold text-white">
                                    {selectedPipe.productCode}
                                </span>
                            </h4>
                            <div className="text-xs">
                                {isManuallySelected ? (
                                    <span className="flex items-center gap-1 rounded bg-blue-800 px-2 py-1 text-blue-200">
                                        👤
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 rounded bg-green-800 px-2 py-1 text-green-200">
                                        🤖
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-start space-x-4">
                            {/* ข้อมูลท่อ */}
                            <div className="flex-1">
                                <div className="grid grid-cols-12 gap-2 text-sm">
                                    <div className="col-span-12">
                                        <p className="text-lg font-medium text-white">
                                            {selectedPipe.name || selectedPipe.productCode}
                                        </p>
                                    </div>
                                    <div className="col-span-12 flex flex-wrap items-end gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-gray-400">ขนาด:</span>
                                            <span className="font-medium text-white">
                                                {selectedPipe.sizeMM} mm.{' '}
                                                {selectedPipe.sizeInch &&
                                                    `(${selectedPipe.sizeInch})`}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-400">แรงดัน:</span>
                                            <span className="font-medium text-white">
                                                PN{selectedPipe.pn || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-400">ยาว/ม้วน:</span>
                                            <span className="font-medium text-white">
                                                {selectedPipe.lengthM} ม.
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-400">ราคา/ม้วน:</span>
                                            <span className="font-medium text-white">
                                                {selectedPipe.price?.toLocaleString()} บาท
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-400">แบรนด์:</span>
                                            <span
                                                className={`font-medium ${selectedPipe.brand === 'ตรามือ' ? 'text-red-400' : selectedPipe.brand === 'ไชโย' ? 'text-green-400' : selectedPipe.brand === 'แชมป์' ? 'text-blue-400' : 'text-white'}`}
                                            >
                                                {selectedPipe.brand}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="col-span-8">
                                        {/* แสดงข้อมูลเพิ่มเติมถ้ามี */}

                                        {selectedPipe.description && (
                                            <div className="mt-1 text-xs text-gray-400">
                                                {selectedPipe.description}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-4 flex items-center justify-center">
                                        {/* รูปภาพท่อ */}
                                        {selectedPipe.image ? (
                                            <img
                                                src={selectedPipe.image}
                                                alt={selectedPipe.name || selectedPipe.productCode}
                                                className="h-28 w-28 rounded border border-gray-600 object-contain"
                                            />
                                        ) : (
                                            <div className="flex h-28 w-28 items-center justify-center rounded bg-gray-500 text-xs text-gray-300">
                                                ไม่มีรูป
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PipeSelector;
