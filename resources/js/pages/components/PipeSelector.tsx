/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    validatePipeSizeHierarchy,
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

export interface PipeSelectorProps {
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
    selectedPipeMaterial?: 'PE' | 'PVC';
    onPipeMaterialChange?: (material: 'PE' | 'PVC') => void;
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
    selectedPipeMaterial,
    onPipeMaterialChange,
}) => {
    const { t } = useLanguage();

    // ✅ Use prop selectedPipeMaterial if provided, otherwise use default based on pipeType
    const getDefaultPipeMaterial = () => {
        return pipeType === 'branch' || pipeType === 'emitter' ? 'PVC' : 'PE';
    };

    const [selectedPipeType, setSelectedPipeType] = useState<string>(() => {
        return selectedPipeMaterial || getDefaultPipeMaterial();
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
                // ใช้ข้อมูลต่อโซน (เหมือน horticulture) เพื่อให้ headloss อยู่ในช่วงที่เหมาะสม และเลือกท่อที่ใกล้ target ไม่ใช่ท่อที่ headloss ต่ำสุด
                const currentZone = activeZoneId
                    ? fcData.zones?.info?.find(
                          (z: any) => String(z.id) === String(activeZoneId)
                      )
                    : null;
                const zoneLateralCount = currentZone?.pipeStats?.lateral?.count ?? fcData.pipes?.stats?.lateral?.count ?? 1;
                const zoneSprinklerCount = currentZone?.sprinklerCount ?? 1;
                // จำนวนทางออกท่อย่อย = จำนวนหัวฉีดบน lateral ที่ยาวที่สุด (จาก field-crop-summary ส่งมาเป็น lateralOutlets)
                const branchOutlets = currentZone?.lateralOutlets ?? currentZone?.sprinklersOnLongestLateral ?? zoneSprinklerCount;
                // จำนวนทางออกท่อเมนรอง = จำนวน lateral ที่เชื่อมกับ submain ที่ยาวที่สุด (จาก field-crop-summary ส่งมาเป็น submainOutlets)
                const secondaryOutlets = currentZone?.submainOutlets ?? currentZone?.connectedLaterals ?? 1;
                const perSprinklerLmin = (fcData as any)?.irrigationSettings?.sprinkler_system?.flow ?? 30;
                const totalProjectSprinklers =
                    (fcData.summary as any)?.totalSprinklerCount ??
                    fcData.zones?.info?.reduce((s: number, z: any) => s + (z.sprinklerCount ?? 0), 0) ??
                    zoneSprinklerCount;
                const getZoneFlow = (key: 'lateral' | 'submain' | 'main') => {
                    if (!currentZone) return undefined;
                    const camel = key === 'lateral' ? 'lateralFlowLMin' : key === 'submain' ? 'submainFlowLMin' : 'mainFlowLMin';
                    const snake = key === 'lateral' ? 'lateral_flow_l_min' : key === 'submain' ? 'submain_flow_l_min' : 'main_flow_l_min';
                    const v = (currentZone as any)[camel] ?? (currentZone as any)[snake];
                    return typeof v === 'number' && v > 0 ? v : undefined;
                };

                const createFieldCropPipeInfo = (
                    type: string,
                    length: number,
                    flowRate: number,
                    count: number,
                    sprinklerCount?: number
                ) => ({
                    id: `${type}-pipe-field-crop`,
                    length: length,
                    count: count,
                    sprinklerCount: sprinklerCount,
                    waterFlowRate: flowRate,
                    details: { type: type },
                });

                // ใช้น้ำ + การคำนวณ loss: ใช้ flow/ความยาวตรงกับ field-crop-summary (ไม่ clamp ต่ำ เพื่อให้ head loss ถูกต้อง)
                const MIN_FLOW_LMIN = 1;
                const getLongest = (type: 'lateral' | 'submain' | 'main') => {
                    const zoneStats =
                        type === 'main'
                            ? (fcData.pipes?.stats as any)?.main ?? (currentZone?.pipeStats as any)?.main
                            : (currentZone?.pipeStats as any)?.[type] ?? (fcData.pipes?.stats as any)?.[type];
                    if (!zoneStats) return type === 'lateral' ? 50 : type === 'submain' ? 100 : 200;
                    const len =
                        zoneStats.longestLength ??
                        zoneStats.longest ??
                        (zoneStats as any).longest_length ??
                        (type === 'lateral' ? 50 : type === 'submain' ? 100 : 200);
                    return Number(len) || (type === 'lateral' ? 50 : type === 'submain' ? 100 : 200);
                };

                switch (pipeType) {
                    case 'branch': {
                        const lateralLongest = getLongest('lateral');
                        const lateralFlow = getZoneFlow('lateral');
                        const fallbackBranch = perSprinklerLmin * Math.max(Math.round(branchOutlets), 1);
                        const flowPerLateral = lateralFlow != null ? lateralFlow : Math.max(MIN_FLOW_LMIN, fallbackBranch);
                        return createFieldCropPipeInfo(
                            'branch',
                            lateralLongest,
                            flowPerLateral,
                            Math.max(Math.round(branchOutlets), 1),
                            Math.max(Math.round(branchOutlets), 1)
                        );
                    }
                    case 'secondary': {
                        const submainLongest = getLongest('submain');
                        const submainFlow = getZoneFlow('submain');
                        const fallbackSubmain =
                            perSprinklerLmin *
                            Math.max(Math.round(branchOutlets), 1) *
                            Math.max(Math.round(secondaryOutlets), 1);
                        const zoneFlow = submainFlow != null ? submainFlow : Math.max(MIN_FLOW_LMIN, fallbackSubmain);
                        return createFieldCropPipeInfo(
                            'secondary',
                            submainLongest,
                            zoneFlow,
                            Math.max(Math.round(secondaryOutlets), 1),
                            undefined
                        );
                    }
                    case 'main': {
                        const mainLongest = getLongest('main');
                        const mainFlow = getZoneFlow('main');
                        const fallbackMain = perSprinklerLmin * Math.max(totalProjectSprinklers, 1);
                        const projectFlow = mainFlow != null ? mainFlow : Math.max(MIN_FLOW_LMIN, fallbackMain);
                        return createFieldCropPipeInfo(
                            'main',
                            mainLongest,
                            projectFlow,
                            1,
                            undefined
                        );
                    }
                    case 'emitter': {
                        const lateralAvg =
                            fcData.pipes?.stats?.lateral?.averageLength ??
                            (currentZone?.pipeStats?.lateral?.totalLength && currentZone?.pipeStats?.lateral?.count
                                ? currentZone.pipeStats.lateral.totalLength / Math.max(currentZone.pipeStats.lateral.count, 1)
                                : 20);
                        return createFieldCropPipeInfo(
                            'emitter',
                            lateralAvg,
                            0.24,
                            zoneSprinklerCount,
                            zoneSprinklerCount
                        );
                    }
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
            const hasSelectedPipe = selectedPipe && typeof selectedPipe === 'object' && Object.keys(selectedPipe).length > 0;
            // ✅ แสดงปุ่ม "กลับไปใช้การเลือกอัตโนมัติ" เฉพาะเมื่อผู้ใช้เลือกท่อที่ต่างจากตัวที่ดีที่สุด
            // ถ้าท่อที่เลือกตรงกับตัวที่ดีที่สุด (รวมถึงการเลือกอัตโนมัติครั้งแรก) ไม่ต้องแสดงปุ่ม
            const normId = (p: any) =>
                p ? String(p.id ?? p.productCode ?? (p as any).product_code ?? '').trim() : '';
            const normSize = (p: any) => (p && p.sizeMM != null ? Number(p.sizeMM) : 0);
            // โซน horticulture: bestPipes จาก horticultureSystemData = findBest*InZone() มีแค่ id/length/count ไม่มี productCode/product_code → ถ้าไม่มี catalog id ให้ไม่แสดงปุ่ม
            const bestHasCatalogIdentity = (p: any) =>
                !!(p && ((p.productCode != null && p.productCode !== '') || ((p as any).product_code != null && (p as any).product_code !== '')));
            const isSameAsBest =
                hasSelectedPipe &&
                currentZoneBestPipe &&
                (() => {
                    const sid = normId(selectedPipe);
                    const bid = normId(currentZoneBestPipe);
                    if (sid && bid && sid === bid) return true;
                    if (!bestHasCatalogIdentity(currentZoneBestPipe)) return true; // best เป็น design data (ไม่มี productCode) → ถือว่าเลือกอัตโนมัติ ไม่แสดงปุ่ม
                    const sameSize = normSize(selectedPipe) === normSize(currentZoneBestPipe) && normSize(selectedPipe) > 0;
                    if (sameSize && (!sid || !bid)) return true;
                    return (
                        selectedPipe.id === currentZoneBestPipe.id ||
                        selectedPipe.productCode === currentZoneBestPipe.productCode ||
                        (selectedPipe as any).product_code === (currentZoneBestPipe as any).product_code
                    );
                })();
            const manuallyDifferent = hasSelectedPipe && currentZoneBestPipe && !isSameAsBest;
            // โหมด horticulture: แสดงปุ่ม "กลับไปใช้การเลือกอัตโนมัติ" เฉพาะเมื่อผู้ใช้กดเลือกท่อเอง (wasManuallySelected) ไม่ใช้การเทียบ selected vs best เพราะ best จาก design data ไม่มี productCode
            const showAsManuallySelected =
                projectMode === 'horticulture' ? wasManuallySelected : wasManuallySelected || manuallyDifferent;
            setIsManuallySelected(showAsManuallySelected);
        }
    }, [activeZoneId, pipeType, zoneManualSelections, selectedPipe, currentZoneBestPipe]);

    // ✅ Sync selectedPipeType with selectedPipeMaterial prop
    useEffect(() => {
        if (selectedPipeMaterial) {
            setSelectedPipeType(selectedPipeMaterial);
        } else {
            // Only use default if no prop is provided
            const defaultMaterial = getDefaultPipeMaterial();
            setSelectedPipeType(defaultMaterial);
        }
    }, [selectedPipeMaterial, pipeType]);

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

        // ✅ Only auto-select if selectedPipe is truly null/undefined (not just falsy)
        // This prevents auto-selecting when loading from database where selectedPipe already has a value
        const hasSelectedPipe = selectedPipe && typeof selectedPipe === 'object' && Object.keys(selectedPipe).length > 0;

        // ✅ เลือกท่อตามลำดับ: ท่อย่อย (branch) ก่อน → ท่อเมนรอง (secondary) → ท่อเมนหลัก (main). ไม่เลือกท่อเมนรอง/เมนหลักก่อนกว่าจะมีท่อย่อย/เมนรอง
        if (pipeType === 'secondary' && !selectedPipeSizes?.branch) return;
        if (pipeType === 'main' && !selectedPipeSizes?.secondary) return;
        if (pipeType === 'emitter' && !selectedPipeSizes?.branch) return;

        // รอให้รายการท่อโหลดเกือบครบก่อนค่อย auto-select
        const MIN_PIPES_FOR_AUTO_SELECT = 50;
        const pipesLoaded = availablePipes.length >= MIN_PIPES_FOR_AUTO_SELECT;
        // การแก้เป็นท่อแนะนำ: ใช้เกณฑ์ต่ำ (มี 3+ ตัวเลือกหลัง hierarchy) ไม่รอ 50
        const MIN_PIPES_FOR_CORRECTION = 3;
        const enoughPipesToCorrect = availablePipes.length >= MIN_PIPES_FOR_CORRECTION;
        const canAutoSelect =
            pipesLoaded &&
            currentZoneBestPipe &&
            sprinklerPressure &&
            !isManuallySelected &&
            !wasManuallySelectedInThisZone &&
            !hasSelectedPipe &&
            activeZoneId;
        // field-crop: แม้ parent จะ restore 200/306 มาก่อน พอมีท่อพอเลือกแล้วให้ทับด้วยท่อแนะนำ (ถ้าผู้ใช้ยังไม่เคยเลือกเอง)
        const shouldCorrectToRecommended =
            projectMode === 'field-crop' &&
            enoughPipesToCorrect &&
            currentZoneBestPipe &&
            sprinklerPressure &&
            activeZoneId &&
            !isManuallySelected &&
            !wasManuallySelectedInThisZone &&
            hasSelectedPipe;

        if (canAutoSelect) {
            const hierarchyFilteredPipes = getFilteredPipesByHierarchy(availablePipes);

            if (hierarchyFilteredPipes.length === 0) {
                return;
            }
            // ต้องมีตัวเลือกอย่างน้อย 3 ตัว (ไม่เลือกจากแค่ 1–2 ตัว)
            const MIN_CHOICES_AFTER_HIERARCHY = 3;
            if (hierarchyFilteredPipes.length < MIN_CHOICES_AFTER_HIERARCHY) {
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
                sprinklerPressure.head20PercentM,
                projectMode === 'field-crop' ? { preferSmallestValidPipe: true } : undefined
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
                            sprinklerPressure.head20PercentM,
                            projectMode === 'field-crop' ? { preferSmallestValidPipe: true } : undefined
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
        } else if (shouldCorrectToRecommended) {
            // field-crop: parent อาจ restore 200/306 มาก่อน → โหลดครบแล้วทับด้วยท่อแนะนำ
            // โซน 2+: ถ้า main รันก่อน secondary จะเห็น secondary=200 → hierarchy เป็น main>=200 ได้ผลผิด
            // ข้าม main correction เมื่อ sibling ยังเป็นค่า default (≥100) รอให้ branch/secondary correct ก่อน แล้วค่อย correct main ในรอบถัดไป
            const siblingStillDefault =
                pipeType === 'main' &&
                (Number(selectedPipeSizes?.secondary) >= 100 || Number(selectedPipeSizes?.branch) >= 100);
            if (siblingStillDefault) {
                // main รอ sibling correct ก่อน
            } else {
                const hierarchyFilteredPipes = getFilteredPipesByHierarchy(availablePipes);
                const MIN_CHOICES = 3;
                if (
                    hierarchyFilteredPipes.length >= MIN_CHOICES &&
                    selectedPipe &&
                    Number(selectedPipe.sizeMM) > 0
                ) {
                    const bestPipe = selectBestPipeByHeadLoss(
                        hierarchyFilteredPipes,
                        pipeType,
                        currentZoneBestPipe,
                        selectedPipeType,
                        selectedPipeSizes,
                        sprinklerPressure!.head20PercentM,
                        { preferSmallestValidPipe: true }
                    );
                    const sameSize =
                        bestPipe &&
                        Number(selectedPipe.sizeMM) === Number(bestPipe.sizeMM);
                    if (bestPipe && !sameSize) {
                        const validate = (p: any) => {
                            const s = p.sizeMM;
                            const main = selectedPipeSizes.main ?? 0;
                            const sec = selectedPipeSizes.secondary ?? 0;
                            const br = selectedPipeSizes.branch ?? 0;
                            const em = selectedPipeSizes.emitter ?? 0;
                            if (pipeType === 'main') return s >= Math.max(sec, br, em);
                            if (pipeType === 'secondary') return (main === 0 || s <= main) && s >= Math.max(br, em);
                            if (pipeType === 'branch' || pipeType === 'emitter') return (main === 0 || s <= main) && (sec === 0 || s <= sec);
                            return true;
                        };
                        if (validate(bestPipe)) {
                            onPipeChange(bestPipe);
                        }
                    }
                }
            }
        } else if (
            projectMode === 'horticulture' &&
            availablePipes.length > 0 &&
            currentZoneBestPipe &&
            sprinklerPressure &&
            !wasManuallySelectedInThisZone &&
            hasSelectedPipe &&
            activeZoneId
        ) {
            // โหมด horticulture: ถ้ามี selectedPipe จาก parent แต่ยังไม่เคยกดเลือกเอง → แก้เป็นตัวที่เหมาะสม (เหมือนตอนกดปุ่ม "กลับไปใช้การเลือกอัตโนมัติ")
            const hierarchyFilteredPipes = getFilteredPipesByHierarchy(availablePipes);
            if (hierarchyFilteredPipes.length > 0) {
                const bestPipe = selectBestPipeByHeadLoss(
                    hierarchyFilteredPipes,
                    pipeType,
                    currentZoneBestPipe,
                    selectedPipeType,
                    selectedPipeSizes,
                    sprinklerPressure.head20PercentM,
                    projectMode === 'field-crop' ? { preferSmallestValidPipe: true } : undefined
                );
                if (bestPipe) {
                    const normId = (p: any) =>
                        p ? String(p.id ?? p.productCode ?? (p as any).product_code ?? '').trim() : '';
                    const samePipe =
                        normId(selectedPipe) === normId(bestPipe) ||
                        (selectedPipe.id === bestPipe.id ||
                            selectedPipe.productCode === bestPipe.productCode ||
                            (selectedPipe as any).product_code === (bestPipe as any).product_code);
                    if (!samePipe) {
                        onPipeChange(bestPipe);
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
        projectMode,
    ]);

    // ล้างการเลือกท่อเมื่อท่อที่เลือกอยู่ละเมิด hierarchy (เช่น ท่อย่อยใหญ่กว่าท่อเมนรอง)
    useEffect(() => {
        if (!selectedPipe || !selectedPipeSizes || Object.keys(selectedPipeSizes).length === 0) return;
        const sizeMM = Number(selectedPipe.sizeMM ?? 0);
        if (!validatePipeSizeHierarchy(pipeType, sizeMM, selectedPipeSizes)) {
            onPipeChange(null);
        }
    }, [selectedPipe, selectedPipeSizes, pipeType, onPipeChange]);

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

                    const pipePayload = {
                        headLoss: calc.headLoss,
                        pipeLength: calc.pipeLength,
                        flowRate: calc.flowRate,
                        calculatedAt: new Date().toISOString(),
                    };

                    if (projectMode === 'horticulture' && activeZoneId) {
                        existingCalc.zones = existingCalc.zones || {};
                        existingCalc.zones[activeZoneId] = existingCalc.zones[activeZoneId] || {};
                        existingCalc.zones[activeZoneId][pipeType] = pipePayload;
                        existingCalc[pipeType] = pipePayload;
                    } else {
                        existingCalc[pipeType] = pipePayload;
                    }

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

    // ✅ Ensure selected pipe is always in availablePipes
    const selectedPipeInAvailable = selectedPipe && availablePipes.find(
        (p) => p.id === selectedPipe.id || 
               p.productCode === selectedPipe.productCode ||
               (p as any).product_code === selectedPipe.productCode ||
               p.productCode === selectedPipe.product_code ||
               (p as any).product_code === selectedPipe.product_code
    );
    const selectedPipeNotInAvailable = selectedPipe && !selectedPipeInAvailable;
    
    // ✅ If selected pipe is not in availablePipes, try to find it in results recommended pipes
    const allPipesFromResults = [
        ...(results?.recommendedBranchPipe || []),
        ...(results?.recommendedSecondaryPipe || []),
        ...(results?.recommendedMainPipe || []),
        ...(results?.recommendedEmitterPipe || []),
    ];
    const selectedFromAllPipes = selectedPipeNotInAvailable && allPipesFromResults.length > 0
        ? allPipesFromResults.find(
            (p) => p.id === selectedPipe.id || 
                   p.productCode === selectedPipe.productCode ||
                   (p as any).product_code === selectedPipe.productCode ||
                   p.productCode === selectedPipe.product_code ||
                   (p as any).product_code === selectedPipe.product_code
          )
        : null;
    
    // ✅ Fallback: If not found in allPipes, use selectedPipe directly (even if incomplete)
    const pipeToAdd = selectedPipeNotInAvailable 
        ? (selectedFromAllPipes || selectedPipe)
        : null;
    
    // ✅ Combine: selected pipe (if not in available) + available pipes (avoid duplicates)
    const pipesToUse = [
        ...(pipeToAdd ? [pipeToAdd] : []),
        ...availablePipes.filter((p) => {
            // Skip if it's the same as pipeToAdd
            if (pipeToAdd) {
                return p.id !== pipeToAdd.id;
            }
            return true;
        }),
    ];
    
    // โหมด field-crop: ท่อที่ระบบแนะนำ = ท่อที่เล็กที่สุดที่ head loss ผ่าน (ใช้แสดง "แนะนำ" ใน dropdown)
    const bestPipeForFieldCrop =
        projectMode === 'field-crop' &&
        currentZoneBestPipe &&
        sprinklerPressure &&
        pipesToUse.length > 0
            ? selectBestPipeByHeadLoss(
                  pipesToUse,
                  pipeType,
                  currentZoneBestPipe,
                  selectedPipeType,
                  selectedPipeSizes,
                  sprinklerPressure.head20PercentM,
                  { preferSmallestValidPipe: true }
              )
            : null;

    const pipeOptions = pipesToUse
        .filter((pipe) => {
            const isSelectedPipe = selectedPipe && (
                pipe.id === selectedPipe.id ||
                pipe.productCode === selectedPipe.productCode ||
                (pipe as any).product_code === selectedPipe.productCode ||
                pipe.productCode === selectedPipe.product_code ||
                (pipe as any).product_code === selectedPipe.product_code
            );

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

            // ✅ Normalize productCode - use productCode, product_code, or id
            const productCode = pipe.productCode || (pipe as any).product_code || pipe.id;
            // ✅ Check if this is the selected pipe
            const isSelectedPipe = selectedPipe && (
                pipe.id === selectedPipe.id ||
                String(pipe.id) === String(selectedPipe.id) ||
                productCode === selectedPipe.productCode ||
                productCode === selectedPipe.product_code ||
                (selectedPipe.productCode && productCode === selectedPipe.productCode) ||
                (selectedPipe.product_code && productCode === selectedPipe.product_code)
            );
            
            const option = {
                value: pipe.id || productCode, // ✅ Use id first, fallback to productCode
                label: `${isHierarchyCompliant ? '✅' : '⛔'} ${pipe.name || productCode} - ${pipe.sizeMM}mm (PN${pipe.pn}) | HL: ${headLoss.toFixed(3)}ม.`,
                image: pipe.image,
                productCode: productCode,
                name: pipe.name,
                brand: pipe.brand,
                price: pipe.price,
                unit: 'บาท/ม้วน',
                headLoss: headLoss,
                hasWarning: hasWarning,
                diffFromTarget: diffFromTarget,
                isHierarchyCompliant: isHierarchyCompliant,
                isRecommended:
                    (projectMode === 'field-crop' &&
                        bestPipeForFieldCrop &&
                        (String(pipe.id) === String(bestPipeForFieldCrop.id) ||
                            pipe.productCode === bestPipeForFieldCrop.productCode ||
                            (pipe as any).product_code === (bestPipeForFieldCrop as any).product_code)) ||
                    (isHierarchyCompliant && diffFromTarget <= 0.5),
                isGoodChoice: isHierarchyCompliant && diffFromTarget <= 1.0,
                isUsable: isHierarchyCompliant,
                isSelected: isSelectedPipe, // ✅ Mark selected pipe for easier sorting
                sizeMM: Number(pipe.sizeMM ?? 0), // สำหรับเรียงโหมด field-crop: ท่อเล็กก่อน
            };

            return option;
        })
        .sort((a, b) => {
            // ✅ Selected pipe should ALWAYS be at the top (highest priority)
            const aIsSelected = a.isSelected || (selectedPipe && (
                a.value === selectedPipe.id ||
                String(a.value) === String(selectedPipe.id) ||
                a.productCode === selectedPipe.productCode ||
                a.productCode === selectedPipe.product_code
            ));
            const bIsSelected = b.isSelected || (selectedPipe && (
                b.value === selectedPipe.id ||
                String(b.value) === String(selectedPipe.id) ||
                b.productCode === selectedPipe.productCode ||
                b.productCode === selectedPipe.product_code
            ));

            if (aIsSelected && !bIsSelected) return -1;
            if (!aIsSelected && bIsSelected) return 1;

            if (a.isHierarchyCompliant !== b.isHierarchyCompliant) {
                return a.isHierarchyCompliant ? -1 : 1;
            }

            // โหมด field-crop: เรียงท่อเล็กก่อน (ขนาดเล็ก → ใกล้ target head loss) เพื่อให้ตัวที่แนะนำอยู่บน
            if (projectMode === 'field-crop') {
                const sizeDiff = (a.sizeMM ?? 0) - (b.sizeMM ?? 0);
                if (sizeDiff !== 0) return sizeDiff;
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
                            onChange={(value) => {
                                const material = value.toString() as 'PE' | 'PVC';
                                setSelectedPipeType(material);
                                // ✅ Notify parent component about material change
                                if (onPipeMaterialChange) {
                                    onPipeMaterialChange(material);
                                }
                            }}
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
                                    : projectMode === 'field-crop' && currentZoneBestPipe
                                      ? `${currentZoneBestPipe.length.toFixed(1)} ม.`
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
                                    : projectMode === 'field-crop' && currentZoneBestPipe
                                      ? (currentZoneBestPipe.sprinklerCount ?? currentZoneBestPipe.count)
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
                                    : projectMode === 'field-crop' && currentZoneBestPipe
                                      ? `${currentZoneBestPipe.waterFlowRate.toFixed(1)} L/min`
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
                                    value={(() => {
                                        // ✅ Try id first (because options use id), then productCode, then product_code
                                        if (selectedPipe) {
                                            // ✅ Options use pipe.id as value, so we need to match by id
                                            // But if selectedPipe doesn't have id, try to find pipe by productCode/product_code
                                            if (selectedPipe.id) {
                                                return selectedPipe.id;
                                            }
                                            // If no id, find pipe by productCode/product_code and use its id
                                            const matchingPipe = availablePipes.find(
                                                (p) => p.productCode === selectedPipe.productCode || 
                                                       (p as any).product_code === selectedPipe.productCode ||
                                                       p.productCode === selectedPipe.product_code ||
                                                       (p as any).product_code === selectedPipe.product_code
                                            );
                                            const finalValue = matchingPipe?.id || selectedPipe.productCode || selectedPipe.product_code || '';
                                            return finalValue;
                                        }
                                        return '';
                                    })()}
                                    onChange={(value) => {
                                        const pipe = pipesToUse.find(
                                            (p) => p.id === value || p.productCode === value || (p as any).product_code === value
                                        ) ?? availablePipes.find((p) => p.id === value);
                                        if (pipe) {
                                            const sizeMM = Number(pipe.sizeMM ?? 0);
                                            if (!validatePipeSizeHierarchy(pipeType, sizeMM, selectedPipeSizes || {})) {
                                                return;
                                            }
                                            setIsManuallySelected(true);
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
                                                sprinklerPressure.head20PercentM,
                                                projectMode === 'field-crop' ? { preferSmallestValidPipe: true } : undefined
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
