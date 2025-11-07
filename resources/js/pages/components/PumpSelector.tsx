/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalculationResults, IrrigationInput } from '../types/interfaces';
import { useLanguage } from '@/contexts/LanguageContext';
import SearchableDropdown from './SearchableDropdown';
import { getEnhancedFieldCropData, FieldCropData } from '../../utils/fieldCropData';
interface PumpSelectorProps {
    results: CalculationResults;
    selectedPump?: any;
    selectedSprinkler?: any;
    onPumpChange: (pump: any) => void;
    zoneOperationGroups?: ZoneOperationGroup[];
    zoneInputs?: { [zoneId: string]: IrrigationInput };
    simultaneousZonesCount?: number;
    selectedZones?: string[];
    allZoneResults?: any[];
    projectSummary?: any;
    zoneOperationMode?: string;
    projectMode?: 'horticulture' | 'garden' | 'field-crop' | 'greenhouse';
    greenhouseData?: any;
    fieldCropData?: any;
    maxPumpHeadForProjectMode?: number;
}

interface ZoneOperationGroup {
    id: string;
    zones: string[];
    order: number;
    label: string;
}

const PumpSelector: React.FC<PumpSelectorProps> = ({
    results,
    selectedPump,
    selectedSprinkler,
    onPumpChange,
    zoneOperationGroups = [],
    zoneInputs = {},
    simultaneousZonesCount = 1,
    selectedZones = [],
    allZoneResults,
    projectSummary,
    zoneOperationMode = 'sequential',
    projectMode = 'horticulture',
    greenhouseData,
    fieldCropData,
    maxPumpHeadForProjectMode,
}) => {
    const [showImageModal, setShowImageModal] = useState(false);
    const [showAccessoriesModal, setShowAccessoriesModal] = useState(false);
    const [modalImage, setModalImage] = useState({ src: '', alt: '' });
    const [hasAutoSelected, setHasAutoSelected] = useState(false);
    const { t } = useLanguage();

    const requiredFlow = results.flows.main;
    const requiredHead = results.pumpHeadRequired;

    const getHorticultureRequirements = () => {
        if (
            projectMode !== 'horticulture' &&
            projectMode !== 'garden' &&
            projectMode !== 'greenhouse'
        ) {
            return {
                requiredFlowLPM: requiredFlow,
                minRequiredHead: 0, // ใช้ค่าคงที่ 0
                qHeadSpray: 0,
            };
        }

        if (projectMode === 'garden') {
            const gardenDataStr = localStorage.getItem('garden_planner_data');
            if (!gardenDataStr) {
                return {
                    requiredFlowLPM: requiredFlow,
                    minRequiredHead: 0, // ใช้ค่าคงที่ 0
                    qHeadSpray: 0,
                };
            }

            try {
                const gardenData = JSON.parse(gardenDataStr);
                const gardenStatsStr = localStorage.getItem('garden_statistics');
                if (!gardenStatsStr) {
                    return {
                        requiredFlowLPM: requiredFlow,
                        minRequiredHead: 0, // ใช้ค่าคงที่ 0
                        qHeadSpray: 0,
                    };
                }

                const gardenStats = JSON.parse(gardenStatsStr);

                let totalWaterRequirement = 0;
                if (gardenStats.zones && gardenStats.zones.length > 0) {
                    const gardenPlannerDataStr = localStorage.getItem('garden_planner_data');
                    let simultaneousZones = gardenStats.zones.length;

                    if (gardenPlannerDataStr) {
                        try {
                            const gardenPlannerData = JSON.parse(gardenPlannerDataStr);
                            if (gardenPlannerData.zoneOperationMode === 'sequential') {
                                simultaneousZones = 1;
                            } else if (gardenPlannerData.zoneOperationMode === 'group') {
                                simultaneousZones = gardenPlannerData.simultaneousZones || 1;
                            }
                        } catch (e) {
                            console.error('Error parsing garden planner data:', e);
                        }
                    }

                    if (simultaneousZones >= gardenStats.zones.length) {
                        totalWaterRequirement = gardenStats.zones.reduce(
                            (total: number, zone: any) => {
                                return total + zone.sprinklerFlowRate * zone.sprinklerCount;
                            },
                            0
                        );
                    } else {
                        const maxZoneRequirement = Math.max(
                            ...gardenStats.zones.map(
                                (zone: any) => zone.sprinklerFlowRate * zone.sprinklerCount
                            )
                        );
                        totalWaterRequirement = maxZoneRequirement * simultaneousZones;
                    }
                }

                return {
                    requiredFlowLPM: totalWaterRequirement || requiredFlow,
                    minRequiredHead: 0, // ใช้ค่าคงที่ 0
                    qHeadSpray: gardenStats.zones?.[0]?.sprinklerFlowRate || 0,
                };
            } catch (error) {
                return {
                    requiredFlowLPM: requiredFlow,
                    minRequiredHead: 0, // ใช้ค่าคงที่ 0
                    qHeadSpray: 0,
                };
            }
        }

        if (projectMode === 'greenhouse') {
            try {
                const greenhouseSystemDataStr = localStorage.getItem('greenhouseSystemData');
                if (!greenhouseSystemDataStr) {
                    return {
                        requiredFlowLPM: requiredFlow,
                        minRequiredHead: 0, // ใช้ค่าคงที่ 0
                        qHeadSpray: 0,
                    };
                }

                const greenhouseSystemData = JSON.parse(greenhouseSystemDataStr);
                const plotPipeData = greenhouseSystemData.plotPipeData || [];

                const productDataStr = localStorage.getItem('product_data');
                let zoneOperationMode = 'sequential';

                if (productDataStr) {
                    try {
                        const productData = JSON.parse(productDataStr);
                        zoneOperationMode = productData.zoneOperationMode || 'sequential';
                    } catch (e) {
                        console.error('Error parsing product data:', e);
                    }
                }

                let totalWaterRequirement = 0;

                if (zoneOperationMode === 'simultaneous') {
                    totalWaterRequirement = plotPipeData.reduce(
                        (total: number, plot: any) => total + (plot.totalFlowRate || 0),
                        0
                    );
                } else {
                    totalWaterRequirement = Math.max(
                        ...plotPipeData.map((plot: any) => plot.totalFlowRate || 0)
                    );
                }

                return {
                    requiredFlowLPM: totalWaterRequirement || requiredFlow,
                    minRequiredHead: 0, // ใช้ค่าคงที่ 0
                    qHeadSpray: 6.0,
                };
            } catch (error) {
                return {
                    requiredFlowLPM: requiredFlow,
                    minRequiredHead: 0, // ใช้ค่าคงที่ 0
                    qHeadSpray: 0,
                };
            }
        }

        if (projectMode === 'horticulture') {
            const horticulturePumpHead = maxPumpHeadForProjectMode !== undefined ? maxPumpHeadForProjectMode : 0;
            
            const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
            if (!horticultureSystemDataStr) {
                return {
                    requiredFlowLPM: requiredFlow,
                    minRequiredHead: horticulturePumpHead,
                    qHeadSpray: 0,
                };
            }

            try {
                const horticultureSystemData = JSON.parse(horticultureSystemDataStr);
                const { sprinklerConfig, zones } = horticultureSystemData;

                if (!sprinklerConfig || !zones) {
                    return {
                        requiredFlowLPM: requiredFlow,
                        minRequiredHead: horticulturePumpHead,
                        qHeadSpray: 0,
                    };
                }

                const qHeadSpray = sprinklerConfig.flowRatePerPlant || 0;
                let requiredFlowLPM = 0;

                if (zoneOperationMode === 'simultaneous') {
                    requiredFlowLPM = zones.reduce(
                        (total: number, zone: any) => total + zone.waterNeedPerMinute,
                        0
                    );
                } else if (zoneOperationMode === 'custom' && zoneOperationGroups.length > 0) {
                    let maxGroupFlow = 0;
                    zoneOperationGroups.forEach((group: ZoneOperationGroup) => {
                        const groupFlow = group.zones.reduce((sum: number, zoneId: string) => {
                            const zone = zones.find((z: any) => z.id === zoneId);
                            return sum + (zone?.waterNeedPerMinute || 0);
                        }, 0);
                        maxGroupFlow = Math.max(maxGroupFlow, groupFlow);
                    });
                    requiredFlowLPM = maxGroupFlow;
                } else {
                    requiredFlowLPM = Math.max(
                        ...zones.map((zone: any) => zone.waterNeedPerMinute || 0)
                    );
                }

                return {
                    requiredFlowLPM,
                    minRequiredHead: horticulturePumpHead,
                    qHeadSpray,
                };
            } catch (error) {
                return {
                    requiredFlowLPM: requiredFlow,
                    minRequiredHead: horticulturePumpHead,
                    qHeadSpray: 0,
                };
            }
        }

        const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
        if (!horticultureSystemDataStr) {
            return {
                requiredFlowLPM: requiredFlow,
                minRequiredHead: 0, // ใช้ค่าคงที่ 0
                qHeadSpray: 0,
            };
        }

        try {
            const horticultureSystemData = JSON.parse(horticultureSystemDataStr);
            const { sprinklerConfig, zones } = horticultureSystemData;

            if (!sprinklerConfig || !zones) {
                return {
                    requiredFlowLPM: requiredFlow,
                    minRequiredHead: 0, // ใช้ค่าคงที่ 0
                    qHeadSpray: 0,
                };
            }

            const qHeadSpray = sprinklerConfig.flowRatePerPlant || 0;
            let requiredFlowLPM = 0;

            if (zoneOperationMode === 'simultaneous') {
                requiredFlowLPM = zones.reduce(
                    (total: number, zone: any) => total + zone.waterNeedPerMinute,
                    0
                );
            } else if (zoneOperationMode === 'custom' && zoneOperationGroups.length > 0) {
                let maxGroupFlow = 0;
                zoneOperationGroups.forEach((group: ZoneOperationGroup) => {
                    const groupFlow = group.zones.reduce((sum: number, zoneId: string) => {
                        const zone = zones.find((z: any) => z.id === zoneId);
                        return sum + (zone?.waterNeedPerMinute || 0);
                    }, 0);
                    maxGroupFlow = Math.max(maxGroupFlow, groupFlow);
                });
                requiredFlowLPM = maxGroupFlow;
            } else {
                requiredFlowLPM = Math.max(
                    ...zones.map((zone: any) => zone.waterNeedPerMinute || 0)
                );
            }

            return {
                requiredFlowLPM,
                minRequiredHead: 0, // ใช้ค่าคงที่ 0
                qHeadSpray,
            };
        } catch (error) {
            return {
                requiredFlowLPM: requiredFlow,
                minRequiredHead: 0, // ใช้ค่าคงที่ 0
                qHeadSpray: 0,
            };
        }
    };

    const horticultureReq = getHorticultureRequirements();

    const [cachedMaxPumpHead, setCachedMaxPumpHead] = React.useState<number | null>(null);

    React.useEffect(() => {
        setCachedMaxPumpHead(null);
    }, []);

    React.useEffect(() => {
        if (projectMode !== 'garden') {
            return;
        }

        const calculateMaxPumpHead = () => {
            try {
                const gardenStatsStr = localStorage.getItem('garden_statistics');
                const pipeCalculationsStr = localStorage.getItem('garden_pipe_calculations');

                if (!gardenStatsStr) {
                    return;
                }

                const gardenStats = JSON.parse(gardenStatsStr);

                if (!gardenStats.zones || gardenStats.zones.length === 0) {
                    return;
                }

                const allZoneHeadLoss: number[] = [];

                if (pipeCalculationsStr) {
                    try {
                        const pipeCalculations = JSON.parse(pipeCalculationsStr);

                        gardenStats.zones.forEach((zone: any, index: number) => {
                            const pipeHeadLoss =
                                (pipeCalculations.branch?.headLoss || 0) +
                                (pipeCalculations.secondary?.headLoss || 0) +
                                (pipeCalculations.main?.headLoss || 0) +
                                (pipeCalculations.emitter?.headLoss || 0);

                            const sprinklerHeadLoss = (zone.sprinklerPressure || 2.5) * 10;

                            const totalZoneHeadLoss = pipeHeadLoss + sprinklerHeadLoss;
                            allZoneHeadLoss.push(totalZoneHeadLoss);
                        });

                        const maxHead = Math.max(...allZoneHeadLoss);

                        if (cachedMaxPumpHead === null || maxHead > cachedMaxPumpHead) {
                            setCachedMaxPumpHead(maxHead);
                        }
                    } catch (error) {
                        setCachedMaxPumpHead(null);
                    }
                } else {
                    const maxZonePressure = Math.max(
                        ...gardenStats.zones.map((zone: any) => zone.sprinklerPressure || 2.5)
                    );
                    const fallbackHead = maxZonePressure * 10;

                    if (cachedMaxPumpHead === null || fallbackHead > cachedMaxPumpHead) {
                        setCachedMaxPumpHead(fallbackHead);
                    }
                }
            } catch (error) {
                setCachedMaxPumpHead(null);
            }
        };

        calculateMaxPumpHead();

        const handleStorageChange = () => {
            calculateMaxPumpHead();
        };

        window.addEventListener('storage', handleStorageChange);

        let pollCount = 0;
        const maxPollCount = 10; 

        const pollInterval = setInterval(() => {
            pollCount++;
            const currentPipeCalc = localStorage.getItem('garden_pipe_calculations');

            if (currentPipeCalc) {
                try {
                    const pipeCalc = JSON.parse(currentPipeCalc);
                    const hasPipeData =
                        pipeCalc.branch || pipeCalc.secondary || pipeCalc.main || pipeCalc.emitter;

                    if (hasPipeData) {
                        calculateMaxPumpHead();
                    }
                } catch (error) {
                    console.error('Error parsing pipe calculations:', error);
                }
            }

            if (pollCount >= maxPollCount) {
                clearInterval(pollInterval);
            }
        }, 2000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(pollInterval);
        };
    }, [projectMode, cachedMaxPumpHead]);

    const fieldCropRequirements = useMemo(() => {
        if (projectMode !== 'field-crop') {
            return {
                requiredFlowLPM: horticultureReq.requiredFlowLPM,
                pumpHeadM: 0, // ใช้ค่าคงที่ 0
            };
        }

        let maxFlowLPM = 0;
        
        if (zoneInputs && Object.keys(zoneInputs).length > 0) {
            const zoneFlows = Object.values(zoneInputs).map((zoneInput: any) => {
                const flowLPM = zoneInput.waterPerTreeLiters || 0;
                return flowLPM;
            });
            maxFlowLPM = Math.max(...zoneFlows, 0);
        }

        if (maxFlowLPM === 0) {
            const fcData = fieldCropData || getEnhancedFieldCropData();
            if (fcData && fcData.zoneSummaries) {
                const zoneFlows = Object.values(fcData.zoneSummaries).map((zoneSummary: any) => {
                    const sprinklerFlow = zoneSummary.sprinklerCount * (fcData.irrigationSettings?.sprinkler_system?.flow || 30);
                    const pivotFlow = zoneSummary.pivotCount * (fcData.irrigationSettings?.pivot_system?.flow || 50);
                    const totalFlow = sprinklerFlow + pivotFlow;
                    return totalFlow;
                });
                maxFlowLPM = Math.max(...zoneFlows, 0);
            }
        }

        return {
            requiredFlowLPM: maxFlowLPM,
            pumpHeadM: 0, // ใช้ค่าคงที่ 0
        };
    }, [projectMode, fieldCropData, zoneInputs, horticultureReq.requiredFlowLPM]);

    const getGardenRequirements = () => {
        if (projectMode === 'field-crop') {
            return fieldCropRequirements;
        }

        if (projectMode !== 'garden') {
            return {
                requiredFlowLPM: horticultureReq.requiredFlowLPM,
                pumpHeadM: 0, // ใช้ค่าคงที่ 0
            };
        }

        try {
            const gardenStatsStr = localStorage.getItem('garden_statistics');

            if (!gardenStatsStr) {
                return {
                    requiredFlowLPM: horticultureReq.requiredFlowLPM,
                    pumpHeadM: 0, // ใช้ค่าคงที่ 0
                };
            }

            const gardenStats = JSON.parse(gardenStatsStr);
            let requiredFlowLPM = 0;

            if (gardenStats.zones && gardenStats.zones.length > 0) {
                if (
                    results.projectSummary?.operationMode === 'sequential' ||
                    results.projectSummary?.operationMode === 'single'
                ) {
                    requiredFlowLPM = Math.max(
                        ...gardenStats.zones.map(
                            (zone: any) => zone.sprinklerFlowRate * zone.sprinklerCount
                        )
                    );
                } else {
                    requiredFlowLPM = gardenStats.zones.reduce((total: number, zone: any) => {
                        return total + zone.sprinklerFlowRate * zone.sprinklerCount;
                    }, 0);
                }
            }

            return {
                requiredFlowLPM: requiredFlowLPM || horticultureReq.requiredFlowLPM,
                pumpHeadM: 0, // ใช้ค่าคงที่ 0
            };
        } catch (error) {
            return {
                requiredFlowLPM: horticultureReq.requiredFlowLPM,
                pumpHeadM: 0, // ใช้ค่าคงที่ 0
            };
        }
    };

    const gardenReq = getGardenRequirements();

    const evaluatePumpAdequacy = (pump: any) => {
        if (!pump) {
            return {
                isFlowAdequate: false,
                isHeadAdequate: false,
                flowRatio: 0,
                headRatio: 0,
            };
        }

        return checkPumpAdequacy(pump);
    };

    const openImageModal = (src: string, alt: string) => {
        setModalImage({ src, alt });
        setShowImageModal(true);
    };

    const closeImageModal = () => {
        setShowImageModal(false);
        setModalImage({ src: '', alt: '' });
    };

    const calculateSimultaneousFlow = () => {
        if (results.projectSummary) {
            return {
                flow: results.projectSummary.selectedGroupFlowLPM,
                head: results.projectSummary.selectedGroupHeadM,
                mode: results.projectSummary.operationMode,
                sourceInfo: t('คำนวณจากระบบ Project Summary'),
            };
        }

        if (!selectedZones || selectedZones.length <= 1 || !zoneInputs) {
            return {
                flow: requiredFlow,
                head: requiredHead,
                mode: 'single',
                sourceInfo: t('โซนเดียว'),
            };
        }

        const zoneFlows = selectedZones
            .map((zoneId) => {
                const zoneInput = zoneInputs[zoneId];
                if (!zoneInput) return { zoneId, flow: 0, head: 0 };

                let flowLPM = zoneInput.totalTrees * zoneInput.waterPerTreeLiters;

                if (projectMode === 'field-crop' && flowLPM === 0) {
                    try {
                        const fieldCropSystemDataStr = localStorage.getItem('fieldCropSystemData');
                        if (fieldCropSystemDataStr) {
                            const fieldCropSystemData = JSON.parse(fieldCropSystemDataStr);
                            if (fieldCropSystemData?.sprinklerConfig?.totalFlowRatePerMinute) {
                                flowLPM =
                                    fieldCropSystemData.sprinklerConfig.totalFlowRatePerMinute;
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing fieldCropSystemData:', error);
                    }
                }
                const headTotal = zoneInput.staticHeadM + zoneInput.pressureHeadM;

                return {
                    zoneId,
                    flow: flowLPM,
                    head: headTotal,
                };
            })
            .sort((a, b) => b.head - a.head);

        const topZones = zoneFlows.slice(0, simultaneousZonesCount);
        const totalFlow = topZones.reduce((sum, zone) => sum + zone.flow, 0);
        const maxHead = topZones.length > 0 ? topZones[0].head : 0;

        return {
            flow: totalFlow,
            head: maxHead,
            mode:
                simultaneousZonesCount === selectedZones.length
                    ? 'simultaneous'
                    : simultaneousZonesCount === 1
                      ? 'sequential'
                      : 'custom',
            sourceInfo: `${simultaneousZonesCount} ${t('โซนพร้อมกัน')} (${t('Fallback calculation')})`,
        };
    };

    const flowData = calculateSimultaneousFlow();
    const actualRequiredFlow = flowData.flow;
    const actualRequiredHead = flowData.head;

    const currentPump = selectedPump || results.autoSelectedPump; // ใช้ selectedPump หรือ autoSelectedPump
    const autoSelectedPump = results.autoSelectedPump;
    const analyzedPumps = useMemo(() => results.analyzedPumps || [], [results.analyzedPumps]);

    const calculatePumpHead = useCallback(() => {
        // ใช้ค่าเดียวกันกับ CalculationSummary.tsx
        if (projectMode === 'horticulture') {
            // ใช้ค่าเดียวกันกับ CalculationSummary.tsx - horticulture mode
            let horticultureSprinklerHeadLoss = 2.5 * 10; // default fallback
            
            try {
                const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
                if (horticultureSystemDataStr) {
                    const horticultureSystemData = JSON.parse(horticultureSystemDataStr);
                    if (horticultureSystemData?.sprinklerConfig?.pressureBar) {
                        horticultureSprinklerHeadLoss = horticultureSystemData.sprinklerConfig.pressureBar * 10;
                    }
                }
            } catch (error) {
                console.error('Error parsing horticulture system data:', error);
            }
            
            if (horticultureSprinklerHeadLoss === 2.5 * 10 && selectedSprinkler && selectedSprinkler.pressureBar) {
                let pressureBar = 2.5; // default fallback
                if (Array.isArray(selectedSprinkler.pressureBar)) {
                    pressureBar = (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) / 2;
                } else if (typeof selectedSprinkler.pressureBar === 'string' && selectedSprinkler.pressureBar.includes('-')) {
                    const parts = selectedSprinkler.pressureBar.split('-');
                    pressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                } else {
                    pressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                }
                horticultureSprinklerHeadLoss = pressureBar * 10;
            }
            
            let horticulturePipeHeadLoss = 0;
            try {
                const horticulturePipeCalculationsStr = localStorage.getItem('horticulture_pipe_calculations');
                if (horticulturePipeCalculationsStr) {
                    const horticulturePipeCalculations = JSON.parse(horticulturePipeCalculationsStr);
                    const branchHeadLoss = horticulturePipeCalculations.branch?.headLoss || 0;
                    const secondaryHeadLoss = horticulturePipeCalculations.secondary?.headLoss || 0;
                    const mainHeadLoss = horticulturePipeCalculations.main?.headLoss || 0;
                    const emitterHeadLoss = horticulturePipeCalculations.emitter?.headLoss || 0;
                    horticulturePipeHeadLoss = branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;
                }
            } catch (error) {
                console.error('Error parsing horticulture pipe calculations:', error);
            }
            
            // ถ้าไม่เจอใน localStorage ให้ใช้ fallback
            if (horticulturePipeHeadLoss === 0) {
                // ใช้ค่าจาก results หรือ fallback
                horticulturePipeHeadLoss = results.headLoss?.total || 0;
            }
            
            // เพิ่ม static head (ความสูงจากปั๊มไปจุดสูงสุด) จาก localStorage
            let staticHeadM = 0;
            try {
                const stored = localStorage.getItem('horticulture_elevation_diff_m');
                if (stored !== null) {
                    const value = parseFloat(stored);
                    if (isFinite(value)) {
                        staticHeadM = value;
                    }
                }
            } catch (error) {
                console.warn('Error reading elevation difference from localStorage:', error);
            }
            
            const totalPumpHead = horticulturePipeHeadLoss + horticultureSprinklerHeadLoss + staticHeadM;
            return totalPumpHead;
        } else if (projectMode === 'garden') {
            // สำหรับ garden mode ให้ใช้ cachedMaxPumpHead หรือ fallback
            return cachedMaxPumpHead !== null ? cachedMaxPumpHead : 0;
        } else if (projectMode === 'greenhouse') {
            // ใช้ค่าเดียวกันกับ CalculationSummary.tsx - greenhouse mode
            try {
                const greenhousePipeCalculationsStr = localStorage.getItem('greenhouse_pipe_calculations');
                if (greenhousePipeCalculationsStr) {
                    const pipeCalculations = JSON.parse(greenhousePipeCalculationsStr);
                    const branchHeadLoss = pipeCalculations.branch?.headLoss || 0;
                    const mainHeadLoss = pipeCalculations.main?.headLoss || 0;
                    const totalPipeHeadLoss = branchHeadLoss + mainHeadLoss;
                    
                    // หา sprinkler pressure จาก localStorage (เหมือน CalculationSummary.tsx)
                    let sprinklerPressureBar = 2.5; // default
                    try {
                        const greenhouseSummaryDataStr = localStorage.getItem('greenhouseSummaryData');
                        if (greenhouseSummaryDataStr) {
                            const greenhouseSummaryData = JSON.parse(greenhouseSummaryDataStr);
                            if (greenhouseSummaryData?.sprinklerPressure) {
                                sprinklerPressureBar = greenhouseSummaryData.sprinklerPressure;
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing greenhouse summary data:', error);
                    }
                    
                    // ถ้าไม่เจอใน localStorage ให้ใช้ selectedSprinkler
                    if (sprinklerPressureBar === 2.5 && selectedSprinkler && selectedSprinkler.pressureBar) {
                        if (Array.isArray(selectedSprinkler.pressureBar)) {
                            sprinklerPressureBar = (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) / 2;
                        } else if (typeof selectedSprinkler.pressureBar === 'string' && selectedSprinkler.pressureBar.includes('-')) {
                            const parts = selectedSprinkler.pressureBar.split('-');
                            sprinklerPressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                        } else {
                            sprinklerPressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                        }
                    }
                    
                    const sprinklerHeadLoss = sprinklerPressureBar * 10;
                    return totalPipeHeadLoss + sprinklerHeadLoss;
                }
            } catch (error) {
                console.error('Error parsing greenhouse pipe calculations:', error);
            }
            return 0;
        } else if (projectMode === 'field-crop') {
            // ใช้ค่าเดียวกันกับ CalculationSummary.tsx - field-crop mode
            let fieldCropSprinklerHeadLoss = 0;
            
            if (fieldCropData && fieldCropData.irrigationSettings?.sprinkler_system?.pressure) {
                fieldCropSprinklerHeadLoss = fieldCropData.irrigationSettings.sprinkler_system.pressure * 10;
            }
            else if (selectedSprinkler && selectedSprinkler.pressureBar) {
                let pressureBar = 2.5; // default fallback
                if (Array.isArray(selectedSprinkler.pressureBar)) {
                    pressureBar = (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) / 2;
                } else if (typeof selectedSprinkler.pressureBar === 'string' && selectedSprinkler.pressureBar.includes('-')) {
                    const parts = selectedSprinkler.pressureBar.split('-');
                    pressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                } else {
                    pressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                }
                fieldCropSprinklerHeadLoss = pressureBar * 10;
            }
            else {
                fieldCropSprinklerHeadLoss = 2.5 * 10;
            }
            
            let fieldCropPipeHeadLoss = 0;
            try {
                const fieldCropPipeCalculationsStr = localStorage.getItem('field_crop_pipe_calculations');
                if (fieldCropPipeCalculationsStr) {
                    const fieldCropPipeCalculations = JSON.parse(fieldCropPipeCalculationsStr);
                    const branchHeadLoss = fieldCropPipeCalculations.branch?.headLoss || 0;
                    const secondaryHeadLoss = fieldCropPipeCalculations.secondary?.headLoss || 0;
                    const mainHeadLoss = fieldCropPipeCalculations.main?.headLoss || 0;
                    const emitterHeadLoss = fieldCropPipeCalculations.emitter?.headLoss || 0;
                    fieldCropPipeHeadLoss = branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;
                }
            } catch (error) {
                console.error('Error parsing field-crop pipe calculations:', error);
            }
            
            const totalPumpHead = fieldCropPipeHeadLoss + fieldCropSprinklerHeadLoss;
            return totalPumpHead;
        }
        return 0;
    }, [projectMode, cachedMaxPumpHead, fieldCropData, selectedSprinkler, results.headLoss]);


    const getMaxPumpHeadFromAllZones = () => {
        const basePumpHead = calculatePumpHead();
        return basePumpHead + (basePumpHead * 0.1); // เพิ่ม safety factor +10%
    };


    const checkPumpAdequacy = useCallback(
        (pump: any) => {
            const maxFlow = pump.maxFlow || 0;
            const maxHead = pump.maxHead || 0;

            const requiredFlowLPM =
                projectMode === 'garden'
                    ? gardenReq.requiredFlowLPM
                    : projectMode === 'greenhouse'
                      ? horticultureReq.requiredFlowLPM
                      : projectMode === 'field-crop'
                        ? fieldCropRequirements.requiredFlowLPM
                        : horticultureReq.requiredFlowLPM;
            
            const baseRequiredHeadM = calculatePumpHead();
            const requiredHeadM = baseRequiredHeadM + (baseRequiredHeadM * 0.1); // เพิ่ม safety factor +10%

            const isFlowAdequate = maxFlow >= requiredFlowLPM;
            const isHeadAdequate = maxHead >= requiredHeadM;
            return {
                isFlowAdequate,
                isHeadAdequate,
                flowRatio: requiredFlowLPM > 0 ? maxFlow / requiredFlowLPM : 0,
                headRatio: requiredHeadM > 0 ? maxHead / requiredHeadM : 0,
            };
        },
        [projectMode, gardenReq, horticultureReq, fieldCropRequirements, calculatePumpHead]
    );

    const getFilteredPumps = useCallback(() => {
        return analyzedPumps.sort((a, b) => {
            const adequacyA = checkPumpAdequacy(a);
            const adequacyB = checkPumpAdequacy(b);

            // ให้คะแนนตามความเหมาะสม: 4 = ดีที่สุด, 1 = แย่ที่สุด
            const scoreA =
                adequacyA.isFlowAdequate && adequacyA.isHeadAdequate
                    ? 4  // ทั้ง flow และ head เพียงพอ
                    : adequacyA.isFlowAdequate && !adequacyA.isHeadAdequate
                      ? 3  // flow เพียงพอ แต่ head ไม่เพียงพอ
                      : !adequacyA.isFlowAdequate && adequacyA.isHeadAdequate
                        ? 2  // head เพียงพอ แต่ flow ไม่เพียงพอ
                        : 1; // ทั้ง flow และ head ไม่เพียงพอ

            const scoreB =
                adequacyB.isFlowAdequate && adequacyB.isHeadAdequate
                    ? 4  // ทั้ง flow และ head เพียงพอ
                    : adequacyB.isFlowAdequate && !adequacyB.isHeadAdequate
                      ? 3  // flow เพียงพอ แต่ head ไม่เพียงพอ
                      : !adequacyB.isFlowAdequate && adequacyB.isHeadAdequate
                        ? 2  // head เพียงพอ แต่ flow ไม่เพียงพอ
                        : 1; // ทั้ง flow และ head ไม่เพียงพอ

            if (scoreA !== scoreB) {
                return scoreB - scoreA; // เรียงจากคะแนนสูงไปต่ำ
            }

            // ถ้าคะแนนเท่ากัน ให้เรียงตามราคา (ถูกที่สุดก่อน)
            return a.price - b.price;
        });
    }, [analyzedPumps, checkPumpAdequacy]);

    const sortedPumps = useMemo(() => getFilteredPumps(), [getFilteredPumps]);

    useEffect(() => {
        if (analyzedPumps.length > 0 && sortedPumps.length > 0 && !hasAutoSelected) {
            // Auto-select แค่ครั้งแรกเท่านั้น
            // หาปั๊มที่มีทั้ง flow และ head เพียงพอก่อน
            const fullyAdequatePump = sortedPumps.find(pump => {
                const adequacy = checkPumpAdequacy(pump);
                return adequacy.isFlowAdequate && adequacy.isHeadAdequate;
            });
            
            // ถ้าเจอปั๊มที่เหมาะสมทั้งคู่ ให้เลือกปั๊มนั้น
            if (fullyAdequatePump) {
                onPumpChange(fullyAdequatePump);
            } else {
                // ถ้าไม่มีปั๊มที่เหมาะสมทั้งคู่ ให้เลือกปั๊มแรก (ซึ่งเรียงตามความเหมาะสมแล้ว)
                const bestPump = sortedPumps[0];
                onPumpChange(bestPump);
            }
            
            // ตั้งค่า flag ว่าได้ auto-select แล้ว
            setHasAutoSelected(true);
        }
    }, [analyzedPumps, sortedPumps, hasAutoSelected, onPumpChange, checkPumpAdequacy]);

    // Reset auto-select flag เมื่อ analyzedPumps เปลี่ยน (เช่น เมื่อเปลี่ยนโซน)
    useEffect(() => {
        setHasAutoSelected(false);
    }, [analyzedPumps]);

    const getSelectionStatus = (pump: any) => {
        if (!pump) return null;
        
        // ตรวจสอบว่า pump นี้เป็น currentPump หรือไม่
        const isCurrentPump = currentPump && pump.id === currentPump.id;
        const isAutoSelected = pump.id === autoSelectedPump?.id;
        const isManuallySelected = selectedPump && pump.id === selectedPump.id;

        // ถ้ามี selectedPump และ pump นี้เป็น selectedPump ให้แสดง manual-selected
        if (isManuallySelected) {
            return t('👤 เลือกเอง');
        }
        // ถ้าไม่มี selectedPump และ pump นี้เป็น currentPump ให้แสดง auto-selected
        else if (!selectedPump && isCurrentPump) {
            return t('🤖 เลือกอัตโนมัติ');
        }
        // กรณีอื่นๆ ไม่แสดงอะไร
        else {
            return null;
        }
    };

    const getPumpGrouping = (pump: any) => {
        return t('ปั๊มน้ำ');
    };

    const formatRangeValue = (value: any) => {
        if (Array.isArray(value)) return `${value[0]}-${value[1]}`;
        return String(value);
    };

    const renderPumpImage = (pump: any) => {
        const imageUrl = pump.image_url || pump.image || pump.imageUrl;

        if (imageUrl) {
            return (
                <img
                    src={imageUrl}
                    alt={pump.name || 'Pump'}
                    className="h-auto max-h-[100px] w-[100px] cursor-pointer rounded border border-gray-500 object-contain transition-opacity hover:border-blue-400 hover:opacity-80"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                    onClick={() => openImageModal(imageUrl, pump.name || 'ปั๊มน้ำ')}
                    title={t('คลิกเพื่อดูรูปขนาดใหญ่')}
                />
            );
        }

        return (
            <div className="flex h-[60px] w-[85px] items-center justify-center rounded border border-gray-600 bg-gray-500 text-xs text-gray-300">
                
                {t('ไม่มีรูปปั๊ม')}
            </div>
        );
    };

    const renderAccessoryImage = (accessory: any) => {
        const imageUrl = accessory.image_url || accessory.image || accessory.imageUrl;

        if (imageUrl) {
            return (
                <img
                    src={imageUrl}
                    alt={accessory.name}
                    className="h-10 w-10 cursor-pointer rounded border border-gray-600 object-cover transition-opacity hover:border-blue-400 hover:opacity-80"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                    onClick={() => openImageModal(imageUrl, accessory.name)}
                    title={t('คลิกเพื่อดูรูปขนาดใหญ่')}
                />
            );
        }

        const getIconForType = (type: string) => {
            const icons = {
                foot_valve: '🔧',
                check_valve: '⚙️',
                ball_valve: '🔩',
                pressure_gauge: '📊',
            };
            return icons[type as keyof typeof icons] || '🔧';
        };

        return (
            <div className="flex h-10 w-10 items-center justify-center rounded border border-gray-600 bg-gray-600 text-sm">
                {getIconForType(accessory.accessory_type)}
            </div>
        );
    };

    return (
        <div className="rounded-lg bg-gray-700 p-6">
            <h3 className="mb-4 text-2xl font-bold text-red-500">{t('ปั๊มน้ำ')}</h3>

            <div className="mb-4 flex flex-row items-center space-x-6 rounded bg-gray-600 p-3">
                <h4 className="mr-4 whitespace-nowrap text-lg font-medium text-red-300">
                    ⚡ {t('ความต้องการปั๊ม:')}
                </h4>
                <div className="flex flex-row items-center space-x-4">
                    <span>
                        {t('อัตราการไหล:')}{' '}
                        <span className="font-bold text-blue-300">
                            {Number(
                                (projectMode === 'garden'
                                    ? gardenReq.requiredFlowLPM
                                    : projectMode === 'greenhouse'
                                      ? horticultureReq.requiredFlowLPM
                                      : projectMode === 'field-crop'
                                        ? fieldCropRequirements.requiredFlowLPM
                                        : horticultureReq.requiredFlowLPM
                                ).toFixed(2)
                            ).toLocaleString()}{' '}
                            {t('LPM')}
                        </span>
                    </span>
                    <span>
                        {t('Pump Head:')}{' '}
                        <span className="font-bold text-orange-300">
                            {(() => {
                                const basePumpHead = calculatePumpHead();
                                return (basePumpHead + (basePumpHead * 0.1)).toFixed(1);
                            })()}{' '}
                            {t('เมตร')}
                        </span>
                        <span className="ml-1 text-xs text-gray-400">(+ 10%)</span>
                    </span>
                </div>
            </div>

            <div className="mb-4">
                <SearchableDropdown
                    value={currentPump?.id || ''}
                    onChange={(value) => {
                        if (value === '') {
                            // ถ้าเลือก "-- ใช้การเลือกอัตโนมัติ --" ให้ใช้ autoSelectedPump
                            onPumpChange(autoSelectedPump || null);
                        } else {
                            const selected = analyzedPumps.find(
                                (p) => p.id === parseInt(value.toString())
                            );
                            onPumpChange(selected || null);
                        }
                    }}
                    options={[
                        { value: '', label: `-- ${t('ใช้การเลือกอัตโนมัติ')} --` },
                        ...(() => { 
                            const pumpOptions = sortedPumps.map((pump) => {
                                const group = getPumpGrouping(pump);
                                const isAuto = pump.id === autoSelectedPump?.id; // ตรวจสอบกับ autoSelectedPump
                                const adequacy = checkPumpAdequacy(pump);
                                const isSelected = pump.id === currentPump?.id;

                                const flowStatus = adequacy.isFlowAdequate ? '✅' : '❌';
                                const headStatus = adequacy.isHeadAdequate ? '✅' : '❌';
                                const flowRatio = adequacy.flowRatio.toFixed(1);
                                const headRatio = adequacy.headRatio.toFixed(1);
                                const statusText = `Flow:${flowStatus} ${flowRatio} Head:${headStatus} (${headRatio}x)`;

                                let suitabilityText = '';
                                if (adequacy.isFlowAdequate && adequacy.isHeadAdequate) {
                                    suitabilityText = '✅ ดี';
                                } else if (adequacy.isFlowAdequate || adequacy.isHeadAdequate) {
                                    suitabilityText = '⚠️ พอใช้';
                                } else {
                                    suitabilityText = '❌ ไม่เหมาะสม';
                                }

                                return {
                                    value: pump.id,
                                    label: `${isAuto ? '⭐ ' : ''}${pump.name || pump.productCode} - ${pump.powerHP}HP - ${pump.price?.toLocaleString()} ${t('บาท')} | ${statusText} | ${isAuto ? (adequacy.isFlowAdequate && adequacy.isHeadAdequate ? 'แนะนำ' : 'ไม่แนะนำ') : suitabilityText}`,
                                    searchableText: `${pump.productCode || ''} ${pump.name || ''} ${pump.brand || ''} ${pump.powerHP}HP ${(() => {
                                        if (adequacy.isFlowAdequate && adequacy.isHeadAdequate)
                                            return 'แนะนำ ดี';
                                        if (adequacy.isFlowAdequate || adequacy.isHeadAdequate)
                                            return 'พอใช้';
                                        return 'ไม่เหมาะสม';
                                    })()} flow head`,
                                    image:
                                        (pump as any).image_url ||
                                        pump.image ||
                                        (pump as any).imageUrl,
                                    productCode: pump.productCode,
                                    name: pump.name,
                                    brand: pump.brand,
                                    price: pump.price,
                                    unit: t('บาท'),
                                    isAutoSelected: isAuto,
                                    isSelected: isSelected,
                                    // แนะนำเฉพาะปั๊มที่ Flow และ Head เพียงพอ
                                    isRecommended: adequacy.isFlowAdequate && adequacy.isHeadAdequate,
                                    // ดี: Flow และ Head เพียงพอ แต่ไม่ใช่ auto-selected
                                    isGoodChoice: adequacy.isFlowAdequate && adequacy.isHeadAdequate && !isAuto, 
                                    // พอใช้: Flow หรือ Head เพียงพออย่างใดอย่างหนึ่ง
                                    isUsable: (adequacy.isFlowAdequate || adequacy.isHeadAdequate) &&
                                        !(adequacy.isFlowAdequate && adequacy.isHeadAdequate), 
                                    isFlowAdequate: adequacy.isFlowAdequate,
                                    isHeadAdequate: adequacy.isHeadAdequate,
                                    flowRatio: adequacy.flowRatio,
                                    headRatio: adequacy.headRatio,
                                    calculationDetails: `Flow: ${(pump.maxFlow || 0).toLocaleString()}/${(() => {
                                        if (projectMode === 'garden')
                                            return gardenReq.requiredFlowLPM.toFixed(0);
                                        if (projectMode === 'greenhouse')
                                            return horticultureReq.requiredFlowLPM.toFixed(0);
                                        if (projectMode === 'horticulture')
                                            return horticultureReq.requiredFlowLPM.toFixed(0);
                                        return requiredFlow.toFixed(0);
                                    })()} LPM | Head: ${(pump.maxHead || 0).toFixed(1)}/${(() => {
                                        const baseHead = calculatePumpHead();
                                        return (baseHead + (baseHead * 0.1)).toFixed(1);
                                    })()} ม.`,
                                };
                            });

                            
                            return pumpOptions.sort((a, b) => {
                                // 1. ปั๊มที่ถูกเลือกอยู่บนสุด
                                if (a.isSelected && !b.isSelected) return -1;
                                if (!a.isSelected && b.isSelected) return 1;
                                
                                // 2. ปั๊มที่แนะนำ (auto-selected) อยู่บนสุด
                                if (a.isAutoSelected && !b.isAutoSelected) return -1;
                                if (!a.isAutoSelected && b.isAutoSelected) return 1;

                                // 3. ปั๊มที่ Flow และ Head เพียงพอ (recommended)
                                if (a.isRecommended && !b.isRecommended) return -1;
                                if (!a.isRecommended && b.isRecommended) return 1;

                                // 4. ปั๊มที่ Flow หรือ Head เพียงพออย่างใดอย่างหนึ่ง (good choice)
                                if (a.isGoodChoice && !b.isGoodChoice) return -1;
                                if (!a.isGoodChoice && b.isGoodChoice) return 1;
                                if (a.isGoodChoice && b.isGoodChoice) {
                                    return (a.price || 0) - (b.price || 0);
                                }

                                // 5. ปั๊มที่พอใช้ (usable)
                                if (a.isUsable && !b.isUsable) return -1;
                                if (!a.isUsable && b.isUsable) return 1;
                                if (a.isUsable && b.isUsable) {
                                    return (a.price || 0) - (b.price || 0);
                                }

                                // 6. เรียงตามราคา
                                return (a.price || 0) - (b.price || 0);
                            });
                        })(),
                    ]}
                    placeholder={`-- ${t('ใช้การเลือกอัตโนมัติ')} --`}
                    searchPlaceholder={t('พิมพ์เพื่อค้นหาปั๊ม (ชื่อ, รหัสสินค้า, แบรนด์)...')}
                    className="w-full"
                />
            </div>

            {currentPump ? (
                <div className="rounded bg-gray-600 p-3">
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-medium text-white">{t('ปั๊มที่เลือก')}</h4>
                    </div>
                    <div className="grid grid-cols-3 items-center justify-between gap-3 text-sm">
                        <div className="flex items-center justify-center">
                            {renderPumpImage(currentPump)}
                        </div>

                        <div>
                            <p>
                                <strong>{t('รุ่น:')}</strong> {currentPump.productCode}
                            </p>
                            <p>
                                <strong>{t('ชื่อ:')}</strong>{' '}
                                {currentPump.name || currentPump.productCode}
                            </p>
                            <p>
                                <strong>{t('กำลัง:')}</strong>{' '}
                                {currentPump.powerHP != null
                                    ? currentPump.powerHP
                                    : (currentPump.powerKW * 1.341).toFixed(1)}{' '}
                                {t('HP')} ({t('kW')})
                                {currentPump.powerKW != null
                                    ? currentPump.powerKW
                                    : (currentPump.powerHP * 0.7457).toFixed(1)}{' '}
                                {t('kW')}
                            </p>
                            <p>
                                <strong>{t('เฟส:')}</strong> {currentPump.phase} {t('เฟส')}
                            </p>
                            <p>
                                <strong>{t('ท่อเข้า/ออก:')}</strong> {currentPump.inlet_size_inch}"/
                                {currentPump.outlet_size_inch}"
                            </p>
                            {currentPump.brand && (
                                <p>
                                    <strong>{t('แบรนด์:')}</strong> {currentPump.brand}
                                </p>
                            )}
                        </div>

                        <div>
                            <p>
                                <strong>{t('Flow Max:')}</strong> {currentPump.maxFlow || 'N/A'}{' '}
                                {t('LPM')}
                            </p>
                            <p>
                                <strong>{t('Head Max:')}</strong> {currentPump.maxHead || 'N/A'}{' '}
                                {t('เมตร')}
                            </p>
                            <p>
                                <strong>{t('S.D(ความลึกดูด):')}</strong>{' '}
                                {currentPump.suction_depth_m || 'N/A'} {t('เมตร')}
                            </p>
                            <p>
                                <strong>{t('ราคา:')}</strong> {currentPump.price?.toLocaleString()}{' '}
                                {t('บาท')}
                            </p>
                            {currentPump.weight_kg && (
                                <p>
                                    <strong>{t('น้ำหนัก:')}</strong> {currentPump.weight_kg}{' '}
                                    {t('kg')}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        {(() => {
                            const adequacy = evaluatePumpAdequacy(currentPump);
                            return (
                                <>
                                    <p>
                                        <strong>{t('Flow:')}</strong>{' '}
                                        <span
                                            className={`font-bold ${adequacy.isFlowAdequate ? 'text-green-300' : 'text-red-300'}`}
                                        >
                                            {adequacy.isFlowAdequate
                                                ? '✅ ' + t('เพียงพอ')
                                                : '❌ ' + t('ไม่เพียงพอ')}
                                        </span>
                                        <span className="ml-2 text-gray-400">
                                            ({adequacy.flowRatio.toFixed(1)}x)
                                        </span>
                                    </p>

                                    <p>
                                        <strong>{t('Head:')}</strong>{' '}
                                        <span
                                            className={`font-bold ${adequacy.isHeadAdequate ? 'text-green-300' : 'text-red-300'}`}
                                        >
                                            {adequacy.isHeadAdequate
                                                ? '✅ ' + t('เพียงพอ')
                                                : '❌ ' + t('ไม่เพียงพอ')}
                                        </span>
                                        <span className="ml-2 text-gray-400">
                                            ({adequacy.headRatio.toFixed(1)}x)
                                        </span>
                                    </p>
                                </>
                            );
                        })()}
                    </div>

                    {currentPump.description && (
                        <div className="mt-3 rounded bg-gray-800 p-2">
                            <p className="text-xs text-gray-300">
                                <strong>{t('รายละเอียด:')}</strong> {currentPump.description}
                            </p>
                        </div>
                    )}

                    {currentPump.pumpAccessories && currentPump.pumpAccessories.length > 0 && (
                        <div className="mt-3 rounded bg-purple-900 p-3">
                            <div className="flex items-center justify-between">
                                <h5 className="text-sm font-medium text-purple-300">
                                    🔧 {t('อุปกรณ์ประกอบ')} ({currentPump.pumpAccessories.length}{' '}
                                    {t('รายการ')})
                                </h5>
                                <button
                                    onClick={() => setShowAccessoriesModal(true)}
                                    className="rounded bg-purple-600 px-3 py-1 text-xs text-white transition-colors hover:bg-purple-500"
                                >
                                    {t('ดูอุปกรณ์')}
                                </button>
                            </div>
                            {currentPump.pumpAccessories.some((acc: any) => !acc.is_included) && (
                                <div className="mt-2 text-xs text-purple-200">
                                    <span>{t('ราคาอุปกรณ์เสริม:')}</span>{' '}
                                    <span className="font-medium text-yellow-300">
                                        +
                                        {currentPump.pumpAccessories
                                            .filter((acc: any) => !acc.is_included)
                                            .reduce(
                                                (sum: number, acc: any) =>
                                                    sum + (Number(acc.price) || 0),
                                                0
                                            )
                                            .toLocaleString()}{' '}
                                        {t('บาท')}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {(() => {
                        const adequacy = evaluatePumpAdequacy(currentPump);
                        return (
                            (!adequacy.isFlowAdequate || !adequacy.isHeadAdequate) && (
                                <div className="mt-3 rounded bg-red-900 p-2">
                                    <p className="text-sm text-red-300">
                                        ⚠️ <strong>{t('คำเตือน:')}</strong> {t('ปั๊มนี้')}
                                        {!adequacy.isFlowAdequate && ' อัตราการไหลไม่เพียงพอ'}
                                        {!adequacy.isFlowAdequate &&
                                            !adequacy.isHeadAdequate &&
                                            ' และ'}
                                        {!adequacy.isHeadAdequate && ' ' + t('ความสูงยกไม่เพียงพอ')}{' '}
                                        {t('สำหรับระบบนี้')}
                                    </p>
                                </div>
                            )
                        );
                    })()}
                </div>
            ) : (
                <div className="rounded bg-gray-600 p-4 text-center">
                    <p className="text-gray-300">{t('ไม่สามารถหาปั๊มที่เหมาะสมได้')}</p>
                    <p className="mt-1 text-sm text-gray-400">
                        {t('อาจไม่มีปั๊มที่เหมาะสมในระบบ')}
                    </p>
                </div>
            )}

            {showImageModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                    onClick={closeImageModal}
                >
                    <div
                        className="relative max-h-[90vh] max-w-[90vw] p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={closeImageModal}
                            className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                            title={t('ปิด')}
                        >
                            ✕
                        </button>
                        <img
                            src={modalImage.src}
                            alt={modalImage.alt}
                            className="max-h-[80vh] max-w-[80vw] rounded-lg shadow-2xl object-contain"
                            style={{ display: 'block', margin: '0 auto' }}
                        />
                        <div className="mt-2 text-center">
                            <p className="inline-block rounded bg-black bg-opacity-50 px-2 py-1 text-sm text-white">
                                {modalImage.alt}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {showAccessoriesModal && currentPump && currentPump.pumpAccessories && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                    onClick={() => setShowAccessoriesModal(false)}
                >
                    <div
                        className="relative mx-4 max-h-[90vh] w-full max-w-[90vw] overflow-hidden rounded-lg bg-gray-800 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between bg-purple-900 px-4 py-3">
                            <h3 className="text-lg font-medium text-white">
                                🔧 {t('อุปกรณ์ประกอบ')} - {currentPump.name}
                            </h3>
                            <button
                                onClick={() => setShowAccessoriesModal(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                                title={t('ปิด')}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4">
                            {currentPump.pumpAccessories.length > 5 && (
                                <div className="mb-3 text-center text-xs text-gray-400">
                                    📜 {t('มีอุปกรณ์')} {currentPump.pumpAccessories.length}{' '}
                                    {t('รายการ - เลื่อนเพื่อดูเพิ่มเติม')}
                                </div>
                            )}
                            <div className="scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 max-h-[400px] space-y-3 overflow-y-auto pr-2">
                                {currentPump.pumpAccessories
                                    .sort(
                                        (a: any, b: any) =>
                                            (a.sort_order || 0) - (b.sort_order || 0)
                                    )
                                    .map((accessory: any, index: number) => (
                                        <div
                                            key={accessory.id || index}
                                            className="flex items-center justify-between rounded bg-gray-700 p-3"
                                        >
                                            <div className="flex items-center space-x-4">
                                                {renderAccessoryImage(accessory)}
                                                <div className="text-sm">
                                                    <p className="font-medium text-white">
                                                        {accessory.name}
                                                    </p>
                                                    <p className="capitalize text-gray-300">
                                                        {accessory.accessory_type?.replace(
                                                            '_',
                                                            ' '
                                                        )}
                                                        {accessory.size && ` • ${accessory.size}`}
                                                    </p>
                                                    {accessory.specifications &&
                                                        Object.keys(accessory.specifications)
                                                            .length > 0 && (
                                                            <div className="mt-1 text-xs text-gray-400">
                                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                                    {Object.entries(
                                                                        accessory.specifications
                                                                    ).map(([key, value]) => (
                                                                        <div key={key}>
                                                                            <span className="font-medium">
                                                                                {key}:
                                                                            </span>{' '}
                                                                            <span>
                                                                                {String(value)}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    {accessory.description && (
                                                        <p className="mt-1 text-xs text-gray-400">
                                                            {accessory.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div
                                                    className={`text-sm font-medium ${accessory.is_included ? 'text-green-300' : 'text-yellow-300'}`}
                                                >
                                                    {accessory.is_included ? (
                                                        <span>✅ {t('รวมในชุด')}</span>
                                                    ) : (
                                                        <span>
                                                            💰 +
                                                            {Number(
                                                                accessory.price || 0
                                                            ).toLocaleString()}{' '}
                                                            {t('บาท')}
                                                        </span>
                                                    )}
                                                </div>
                                                {!accessory.is_included && (
                                                    <div className="mt-1 text-xs text-gray-400">
                                                        ({t('แยกขาย')})
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>

                            {currentPump.pumpAccessories.some((acc: any) => !acc.is_included) && (
                                <div className="mt-4 rounded bg-purple-800 p-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-purple-200">
                                            {t('รวมราคาอุปกรณ์เสริม:')}
                                        </span>
                                        <span className="font-medium text-yellow-300">
                                            +
                                            {currentPump.pumpAccessories
                                                .filter((acc: any) => !acc.is_included)
                                                .reduce(
                                                    (sum: number, acc: any) =>
                                                        sum + (Number(acc.price) || 0),
                                                    0
                                                )
                                                .toLocaleString()}{' '}
                                            {t('บาท')}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PumpSelector;
