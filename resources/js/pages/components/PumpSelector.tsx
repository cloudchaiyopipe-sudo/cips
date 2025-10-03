/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// resources\js\pages\components\PumpSelector.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalculationResults, IrrigationInput } from '../types/interfaces';
import { useLanguage } from '@/contexts/LanguageContext';
import SearchableDropdown from './SearchableDropdown';
import { getEnhancedFieldCropData, FieldCropData } from '../../utils/fieldCropData';
interface PumpSelectorProps {
    results: CalculationResults;
    selectedPump?: any;
    onPumpChange: (pump: any) => void;
    zoneOperationGroups?: ZoneOperationGroup[];
    zoneInputs?: { [zoneId: string]: IrrigationInput };
    simultaneousZonesCount?: number;
    selectedZones?: string[];
    allZoneResults?: any[];
    projectSummary?: any;
    zoneOperationMode?: string;
    projectMode?: 'horticulture' | 'garden' | 'field-crop' | 'greenhouse';
    greenhouseData?: any; // เพิ่มสำหรับ greenhouse mode
    fieldCropData?: any; // เพิ่มสำหรับ field-crop mode
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
}) => {
    const [showImageModal, setShowImageModal] = useState(false);
    const [showAccessoriesModal, setShowAccessoriesModal] = useState(false);
    const [modalImage, setModalImage] = useState({ src: '', alt: '' });
    const { t } = useLanguage();

    // ประกาศตัวแปรที่จำเป็นก่อน
    const requiredFlow = results.flows.main;
    const requiredHead = results.pumpHeadRequired;

    // คำนวณความต้องการตามเงื่อนไขใหม่สำหรับ horticulture, garden และ greenhouse mode
    const getHorticultureRequirements = () => {
        if (
            projectMode !== 'horticulture' &&
            projectMode !== 'garden' &&
            projectMode !== 'greenhouse'
        ) {
            return {
                requiredFlowLPM: requiredFlow,
                minRequiredHead: requiredHead,
                qHeadSpray: 0,
            };
        }

        // สำหรับ garden mode ใช้ข้อมูลจาก garden statistics
        if (projectMode === 'garden') {
            // ดึงข้อมูลจาก localStorage หรือ props
            const gardenDataStr = localStorage.getItem('garden_planner_data');
            if (!gardenDataStr) {
                return {
                    requiredFlowLPM: requiredFlow,
                    minRequiredHead: requiredHead,
                    qHeadSpray: 0,
                };
            }

            try {
                const gardenData = JSON.parse(gardenDataStr);
                const gardenStatsStr = localStorage.getItem('garden_statistics');
                if (!gardenStatsStr) {
                    return {
                        requiredFlowLPM: requiredFlow,
                        minRequiredHead: requiredHead,
                        qHeadSpray: 0,
                    };
                }

                const gardenStats = JSON.parse(gardenStatsStr);

                // คำนวณความต้องการน้ำรวมจากทุกโซน
                let totalWaterRequirement = 0;
                if (gardenStats.zones && gardenStats.zones.length > 0) {
                    // ดึงข้อมูลรูปแบบการเปิดโซนจาก garden_planner_data
                    const gardenPlannerDataStr = localStorage.getItem('garden_planner_data');
                    let simultaneousZones = gardenStats.zones.length; // default: เปิดทุกโซนพร้อมกัน

                    if (gardenPlannerDataStr) {
                        try {
                            const gardenPlannerData = JSON.parse(gardenPlannerDataStr);
                            if (gardenPlannerData.zoneOperationMode === 'sequential') {
                                simultaneousZones = 1; // เปิดทีละโซน
                            } else if (gardenPlannerData.zoneOperationMode === 'group') {
                                simultaneousZones = gardenPlannerData.simultaneousZones || 1;
                            }
                        } catch (e) {
                            console.error('Error parsing garden planner data:', e);
                        }
                    }

                    // คำนวณความต้องการน้ำตามรูปแบบการเปิดโซน
                    if (simultaneousZones >= gardenStats.zones.length) {
                        // เปิดทุกโซนพร้อมกัน
                        totalWaterRequirement = gardenStats.zones.reduce(
                            (total: number, zone: any) => {
                                return total + zone.sprinklerFlowRate * zone.sprinklerCount;
                            },
                            0
                        );
                    } else {
                        // หาโซนที่ใช้น้ำมากที่สุด
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
                    minRequiredHead: requiredHead,
                    qHeadSpray: gardenStats.zones?.[0]?.sprinklerFlowRate || 0,
                };
            } catch (error) {
                console.error('Error parsing garden data:', error);
                return {
                    requiredFlowLPM: requiredFlow,
                    minRequiredHead: requiredHead,
                    qHeadSpray: 0,
                };
            }
        }

        // สำหรับ greenhouse mode ใช้ข้อมูลจาก greenhouse data
        if (projectMode === 'greenhouse') {
            try {
                // ดึงข้อมูลจาก localStorage
                const greenhouseSystemDataStr = localStorage.getItem('greenhouseSystemData');
                if (!greenhouseSystemDataStr) {
                    return {
                        requiredFlowLPM: requiredFlow,
                        minRequiredHead: requiredHead,
                        qHeadSpray: 0,
                    };
                }

                const greenhouseSystemData = JSON.parse(greenhouseSystemDataStr);
                const plotPipeData = greenhouseSystemData.plotPipeData || [];

                // ดึงข้อมูลรูปแบบการเปิดโซนจาก product page
                const productDataStr = localStorage.getItem('product_data');
                let zoneOperationMode = 'sequential'; // default: เปิดทีละโซน

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
                    // เปิดพร้อมกันทุกโซน: รวมความต้องการน้ำทุกแปลง
                    totalWaterRequirement = plotPipeData.reduce(
                        (total: number, plot: any) => total + (plot.totalFlowRate || 0),
                        0
                    );
                } else {
                    // เปิดทีละโซน: ใช้แปลงที่ต้องการน้ำมากที่สุด
                    totalWaterRequirement = Math.max(
                        ...plotPipeData.map((plot: any) => plot.totalFlowRate || 0)
                    );
                }

                // คำนวณ Pump Head ให้ตรงกับ CalculationSummary.tsx
                // ใช้ค่าคงที่ที่ไม่เปลี่ยนตามโซน
                const getGreenhousePumpHead = () => {
                    // ดึงข้อมูลหัวฉีดจาก greenhouse planning data
                    let sprinklerHeadLoss = 25; // ค่าเริ่มต้น (2.5 bar = 25 เมตร)
                    try {
                        const greenhousePlanningDataStr =
                            localStorage.getItem('greenhousePlanningData');
                        if (greenhousePlanningDataStr) {
                            const planningData = JSON.parse(greenhousePlanningDataStr);
                            const sprinklerPressureBar = planningData.sprinklerPressure || 2.5;
                            sprinklerHeadLoss = sprinklerPressureBar * 10; // ใช้ x10 เหมือน CalculationSummary.tsx
                        }
                    } catch (e) {
                        console.error('Error loading sprinkler pressure:', e);
                    }

                    // ใช้ค่าคงที่สำหรับ Pump Head - ไม่เปลี่ยนตามโซน
                    // ค่านี้ควรเป็นค่าสูงสุดที่เคยคำนวณได้จากทุกโซน
                    let maxPipeHeadLoss = 0;

                    // ดึงค่าสูงสุดที่เก็บไว้ หรือใช้ค่าปัจจุบัน
                    const maxHeadLossStr = localStorage.getItem('greenhouse_max_head_loss');
                    if (maxHeadLossStr) {
                        try {
                            const maxHeadLossData = JSON.parse(maxHeadLossStr);
                            maxPipeHeadLoss = maxHeadLossData.totalHeadLoss || 0;
                        } catch (e) {
                            console.error('Error loading max head loss:', e);
                        }
                    }

                    // ถ้าไม่มีค่าสูงสุดที่เก็บไว้ ให้ใช้ค่าปัจจุบัน
                    if (maxPipeHeadLoss === 0) {
                        const pipeCalculationsStr = localStorage.getItem(
                            'greenhouse_pipe_calculations'
                        );
                        if (pipeCalculationsStr) {
                            const pipeCalculations = JSON.parse(pipeCalculationsStr);
                            const branchHeadLoss = pipeCalculations.branch?.headLoss || 0;
                            const mainHeadLoss = pipeCalculations.main?.headLoss || 0;
                            maxPipeHeadLoss = branchHeadLoss + mainHeadLoss;
                        }
                    }

                    return maxPipeHeadLoss + sprinklerHeadLoss;
                };

                const maxPumpHead = getGreenhousePumpHead();

                return {
                    requiredFlowLPM: totalWaterRequirement || requiredFlow,
                    minRequiredHead: maxPumpHead || requiredHead,
                    qHeadSpray: 6.0, // ค่าเริ่มต้นสำหรับ greenhouse
                };
            } catch (error) {
                console.error('Error parsing greenhouse data:', error);
                return {
                    requiredFlowLPM: requiredFlow,
                    minRequiredHead: requiredHead,
                    qHeadSpray: 0,
                };
            }
        }

        const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
        if (!horticultureSystemDataStr) {
            return {
                requiredFlowLPM: requiredFlow,
                minRequiredHead: requiredHead,
                qHeadSpray: 0,
            };
        }

        try {
            const horticultureSystemData = JSON.parse(horticultureSystemDataStr);
            const { sprinklerConfig, zones } = horticultureSystemData;

            if (!sprinklerConfig || !zones) {
                return {
                    requiredFlowLPM: requiredFlow,
                    minRequiredHead: requiredHead,
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

            const minRequiredHead = qHeadSpray * 10;

            return {
                requiredFlowLPM,
                minRequiredHead,
                qHeadSpray,
            };
        } catch (error) {
            return {
                requiredFlowLPM: requiredFlow,
                minRequiredHead: requiredHead,
                qHeadSpray: 0,
            };
        }
    };

    const horticultureReq = getHorticultureRequirements();

    // Garden mode: ดึงข้อมูล flow requirement และ pump head
    // คำนวณ maxPumpHeadM แบบคงที่ (ไม่เปลี่ยนตามโซน)
    const [cachedMaxPumpHead, setCachedMaxPumpHead] = React.useState<number | null>(null);

    // Reset cachedMaxPumpHead เมื่อโหลดหน้าใหม่
    React.useEffect(() => {
        // รีเซ็ตค่าเมื่อโหลดครั้งแรก
        setCachedMaxPumpHead(null);
    }, []); // รันครั้งเดียวเมื่อ component mount

    // คำนวณ pump head ใหม่เมื่อมีข้อมูลครบหรือเปลี่ยนแปลง
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

                        // คำนวณ Head Loss รวมของทุกโซน
                        gardenStats.zones.forEach((zone: any, index: number) => {
                            // Head Loss ท่อ (เดียวกันทุกโซน)
                            const pipeHeadLoss =
                                (pipeCalculations.branch?.headLoss || 0) +
                                (pipeCalculations.secondary?.headLoss || 0) +
                                (pipeCalculations.main?.headLoss || 0) +
                                (pipeCalculations.emitter?.headLoss || 0);

                            // Head Loss หัวฉีดของโซนนี้
                            const sprinklerHeadLoss = (zone.sprinklerPressure || 2.5) * 10;

                            // Head Loss รวมของโซนนี้
                            const totalZoneHeadLoss = pipeHeadLoss + sprinklerHeadLoss;
                            allZoneHeadLoss.push(totalZoneHeadLoss);
                        });

                        // เลือกค่าสูงสุดมาเป็น Pump Head
                        const maxHead = Math.max(...allZoneHeadLoss);

                        // อัปเดตเฉพาะเมื่อค่าใหม่สูงกว่าค่าเดิม (keep max value)
                        if (cachedMaxPumpHead === null || maxHead > cachedMaxPumpHead) {
                            setCachedMaxPumpHead(maxHead);
                        }
                    } catch (error) {
                        console.error('Error parsing garden pipe calculations:', error);
                        setCachedMaxPumpHead(null);
                    }
                } else {
                    // ถ้าไม่มี pipe calculations ให้ใช้ sprinkler pressure ของโซนที่สูงที่สุด
                    const maxZonePressure = Math.max(
                        ...gardenStats.zones.map((zone: any) => zone.sprinklerPressure || 2.5)
                    );
                    const fallbackHead = maxZonePressure * 10;

                    // อัปเดตเฉพาะเมื่อค่าใหม่สูงกว่าค่าเดิม (keep max value)
                    if (cachedMaxPumpHead === null || fallbackHead > cachedMaxPumpHead) {
                        setCachedMaxPumpHead(fallbackHead);
                    }
                }
            } catch (error) {
                console.error('Error calculating cached pump head:', error);
                setCachedMaxPumpHead(null);
            }
        };

        // คำนวณทันที
        calculateMaxPumpHead();

        // ฟังการเปลี่ยนแปลงของ localStorage
        const handleStorageChange = () => {
            calculateMaxPumpHead();
        };

        window.addEventListener('storage', handleStorageChange);

        // Polling เพื่อตรวจสอบการเปลี่ยนแปลงของ localStorage (สำหรับ same-tab updates)
        let pollCount = 0;
        const maxPollCount = 10; // ตรวจสอบสูงสุด 10 ครั้ง (20 วินาที)

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
                    console.error('Error parsing pipe calculations during polling:', error);
                }
            }

            // หยุด polling หลังจาก 10 ครั้ง
            if (pollCount >= maxPollCount) {
                clearInterval(pollInterval);
            }
        }, 2000); // Check every 2 seconds

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(pollInterval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectMode]); // Note: cachedMaxPumpHead ใช้ใน comparison แต่ไม่ใส่ใน deps เพื่อหลีกเลี่ยง infinite loop

    const getFieldCropRequirements = () => {
        // Try to get field-crop data from props first, then from localStorage
        const fcData = fieldCropData || getEnhancedFieldCropData();
        if (fcData) {
            // Calculate flow requirement based on field-crop data
            const totalWaterRequirement = fcData.summary?.totalWaterRequirementPerDay || 0;
            const requiredFlowLPM = totalWaterRequirement / 60; // Convert to LPM

            // Calculate pump head based on field-crop pipe system
            const maxPipeLength = Math.max(
                fcData.pipes.stats.main.longest || 0,
                fcData.pipes.stats.submain.longest || 0,
                fcData.pipes.stats.lateral.longest || 0
            );

            // Estimate pump head based on pipe length and irrigation requirements
            const estimatedPumpHead = Math.max(20, maxPipeLength * 0.1 + 15); // Base head + pipe friction

            return {
                requiredFlowLPM: requiredFlowLPM,
                pumpHeadM: estimatedPumpHead,
            };
        }

        // Fallback to horticulture requirements if no field-crop data
        return {
            requiredFlowLPM: horticultureReq.requiredFlowLPM,
            pumpHeadM: (results.headLoss?.total || 0) + (results.pressureFromSprinkler || 0),
        };
    };

    const getGardenRequirements = () => {
        // Calculate fallback pump head locally to avoid hoisting issues
        const fallbackPumpHead = (() => {
            if (allZoneResults && allZoneResults.length > 1) {
                // คำนวณ Pump Head สำหรับแต่ละโซน แล้วหาค่าสูงสุด
                return Math.max(
                    ...allZoneResults.map((zone: any) => {
                        const zoneHeadLoss = zone.headLoss?.total || 0;
                        const zoneSprinklerFlow = zone.waterPerSprinklerLPM || 6.0;
                        const zoneSprinklerHeadLoss = zoneSprinklerFlow * 10;
                        return zoneHeadLoss + zoneSprinklerHeadLoss;
                    })
                );
            } else {
                // โซนเดียว ใช้การคำนวณปกติ
                return (results.headLoss?.total || 0) + (results.pressureFromSprinkler || 0);
            }
        })();

        if (projectMode === 'field-crop') {
            return getFieldCropRequirements();
        }

        if (projectMode !== 'garden') {
            return {
                requiredFlowLPM: horticultureReq.requiredFlowLPM,
                pumpHeadM: fallbackPumpHead,
            };
        }

        try {
            const gardenStatsStr = localStorage.getItem('garden_statistics');

            if (!gardenStatsStr) {
                return {
                    requiredFlowLPM: horticultureReq.requiredFlowLPM,
                    pumpHeadM: cachedMaxPumpHead || fallbackPumpHead,
                };
            }

            const gardenStats = JSON.parse(gardenStatsStr);
            let requiredFlowLPM = 0;

            if (gardenStats.zones && gardenStats.zones.length > 0) {
                // คำนวณ flow requirement
                if (
                    results.projectSummary?.operationMode === 'sequential' ||
                    results.projectSummary?.operationMode === 'single'
                ) {
                    // เปิดทีละโซน - ใช้ค่าของโซนที่มากที่สุด
                    requiredFlowLPM = Math.max(
                        ...gardenStats.zones.map(
                            (zone: any) => zone.sprinklerFlowRate * zone.sprinklerCount
                        )
                    );
                } else {
                    // เปิดพร้อมกันทุกโซน - รวมทุกโซน
                    requiredFlowLPM = gardenStats.zones.reduce((total: number, zone: any) => {
                        return total + zone.sprinklerFlowRate * zone.sprinklerCount;
                    }, 0);
                }
            }

            const finalPumpHead = cachedMaxPumpHead || fallbackPumpHead;

            return {
                requiredFlowLPM: requiredFlowLPM || horticultureReq.requiredFlowLPM,
                pumpHeadM: finalPumpHead,
            };
        } catch (error) {
            console.error('Error loading garden requirements:', error);
            return {
                requiredFlowLPM: horticultureReq.requiredFlowLPM,
                pumpHeadM: cachedMaxPumpHead || fallbackPumpHead,
            };
        }
    };

    const gardenReq = getGardenRequirements();

    // ประเมินความเพียงพอของปั๊มตามเงื่อนไขใหม่
    const evaluatePumpAdequacy = (pump: any) => {
        if (!pump) {
            return {
                isFlowAdequate: false,
                isHeadAdequate: false,
                flowRatio: 0,
                headRatio: 0,
            };
        }

        // ใช้ฟังก์ชันเดียวกันกับ dropdown เพื่อความสอดคล้อง
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

                // For field-crop and horticulture mode, waterPerTreeLiters is now in LPM
                let flowLPM = zoneInput.totalTrees * zoneInput.waterPerTreeLiters;

                // Fallback for field-crop mode if flow is 0
                if (projectMode === 'field-crop' && flowLPM === 0) {
                    try {
                        const fieldCropSystemDataStr = localStorage.getItem('fieldCropSystemData');
                        if (fieldCropSystemDataStr) {
                            const fieldCropSystemData = JSON.parse(fieldCropSystemDataStr);
                            if (fieldCropSystemData?.sprinklerConfig?.totalFlowRatePerMinute) {
                                flowLPM =
                                    fieldCropSystemData.sprinklerConfig.totalFlowRatePerMinute;
                                console.log(
                                    '✅ Using totalFlowRatePerMinute from fieldCropSystemData for pump calculation:',
                                    flowLPM
                                );
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing fieldCropSystemData in PumpSelector:', error);
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

    const currentPump = selectedPump || results.autoSelectedPump;
    const autoSelectedPump = results.autoSelectedPump;
    const analyzedPumps = useMemo(() => results.analyzedPumps || [], [results.analyzedPumps]);

    // คำนวณ Pump Head เหมือนใน CalculationSummary.tsx
    const calculatePumpHead = () => {
        // ดึงท่อที่เลือกปัจจุบัน
        const actualBranchPipe = results.autoSelectedBranchPipe;
        const actualSecondaryPipe = results.autoSelectedSecondaryPipe;
        const actualMainPipe = results.autoSelectedMainPipe;
        const actualEmitterPipe = results.autoSelectedEmitterPipe;

        // รวม Head Loss จากท่อทุกประเภท
        const branchHeadLoss = actualBranchPipe?.headLoss || 0;
        const secondaryHeadLoss = actualSecondaryPipe?.headLoss || 0;
        const mainHeadLoss = actualMainPipe?.headLoss || 0;
        const emitterHeadLoss = actualEmitterPipe?.headLoss || 0;
        const totalPipeHeadLoss =
            branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;

        // คำนวณ Head Loss หัวฉีด (แรงดัน(บาร์) * 10)
        let sprinklerPressureBar = 2.5; // default

        if (projectMode === 'horticulture') {
            // สำหรับ horticulture mode ใช้ข้อมูลจาก horticultureSystemData
            try {
                const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
                if (horticultureSystemDataStr) {
                    const horticultureSystemData = JSON.parse(horticultureSystemDataStr);
                    if (horticultureSystemData?.sprinklerConfig?.pressureBar) {
                        sprinklerPressureBar = horticultureSystemData.sprinklerConfig.pressureBar;
                    }
                }
            } catch (error) {
                console.error('Error parsing horticulture system data:', error);
            }
        } else if (projectMode === 'garden') {
            // สำหรับ garden mode ใช้ข้อมูลจาก gardenStats
            try {
                const gardenStatsStr = localStorage.getItem('garden_statistics');
                if (gardenStatsStr) {
                    const gardenStats = JSON.parse(gardenStatsStr);
                    if (gardenStats.zones && gardenStats.zones.length > 0) {
                        // ใช้แรงดันจากโซนแรก หรือค่าเฉลี่ย
                        sprinklerPressureBar = gardenStats.zones[0].sprinklerPressure || 2.5;
                    }
                }
            } catch (error) {
                console.error('Error parsing garden stats:', error);
            }
        } else if (projectMode === 'field-crop') {
            // สำหรับ field-crop mode ใช้ข้อมูลจาก fieldCropSystemData
            try {
                const fieldCropSystemDataStr = localStorage.getItem('fieldCropSystemData');
                if (fieldCropSystemDataStr) {
                    const fieldCropSystemData = JSON.parse(fieldCropSystemDataStr);
                    if (fieldCropSystemData?.sprinklerConfig?.pressureBar) {
                        sprinklerPressureBar = fieldCropSystemData.sprinklerConfig.pressureBar;
                    }
                }
            } catch (error) {
                console.error('Error parsing field crop system data:', error);
            }
        } else if (projectMode === 'greenhouse') {
            // สำหรับ greenhouse mode ใช้ข้อมูลจาก greenhouseData
            if (greenhouseData && greenhouseData.summary) {
                // ใช้ค่า default สำหรับ greenhouse
                sprinklerPressureBar = 2.5;
            }
        } else {
            // สำหรับ mode อื่นๆ ใช้ข้อมูลจาก results
            if (results.analyzedSprinklers && results.analyzedSprinklers.length > 0) {
                const firstSprinkler = results.analyzedSprinklers[0];
                if (firstSprinkler.pressureBar) {
                    sprinklerPressureBar = Array.isArray(firstSprinkler.pressureBar)
                        ? (firstSprinkler.pressureBar[0] + firstSprinkler.pressureBar[1]) / 2
                        : parseFloat(String(firstSprinkler.pressureBar));
                }
            }
        }

        const sprinklerHeadLoss = sprinklerPressureBar * 10;

        return totalPipeHeadLoss + sprinklerHeadLoss;
    };

    // สำหรับกรณีหลายโซน ให้หาค่าสูงสุด
    const getMaxPumpHeadFromAllZones = () => {
        if (allZoneResults && allZoneResults.length > 0) {
            // คำนวณ Pump Head สำหรับแต่ละโซน แล้วหาค่าสูงสุด (ใช้ค่าสูงสุดเสมอ)
            return Math.max(
                ...allZoneResults.map((zone: any) => {
                    const zoneHeadLoss = zone.headLoss?.total || 0;

                    // หา sprinkler pressure ที่ถูกต้องของโซนนี้
                    let zoneSprinklerPressure = 2.5; // default pressure (bar)

                    if (projectMode === 'horticulture') {
                        // ใช้ข้อมูลจาก horticultureSystemData
                        try {
                            const horticultureSystemDataStr =
                                localStorage.getItem('horticultureSystemData');
                            if (horticultureSystemDataStr) {
                                const horticultureSystemData =
                                    JSON.parse(horticultureSystemDataStr);
                                if (horticultureSystemData?.sprinklerConfig?.pressureBar) {
                                    zoneSprinklerPressure =
                                        horticultureSystemData.sprinklerConfig.pressureBar;
                                }
                            }
                        } catch (error) {
                            console.error('Error parsing horticulture system data:', error);
                        }
                    } else {
                        // สำหรับ mode อื่นๆ ใช้ค่า default หรือจาก zone data
                        if (zone.sprinklerPressure) {
                            zoneSprinklerPressure = zone.sprinklerPressure;
                        }
                    }

                    const zoneSprinklerHeadLoss = zoneSprinklerPressure * 10; // pressure (bar) × 10 = head loss (m)
                    return zoneHeadLoss + zoneSprinklerHeadLoss;
                })
            );
        } else {
            // ไม่มี allZoneResults ใช้การคำนวณปกติ
            return calculatePumpHead();
        }
    };

    const actualPumpHead = getMaxPumpHeadFromAllZones();

    // ฟังก์ชันตรวจสอบความเหมาะสมของปั๊ม สำหรับ dropdown
    const checkPumpAdequacy = useCallback(
        (pump: any) => {
            const maxFlow = pump.maxFlow || 0;
            const maxHead = pump.maxHead || 0;

            // ใช้ค่าเดียวกันกับที่แสดงใน UI
            const requiredFlowLPM =
                projectMode === 'garden'
                    ? gardenReq.requiredFlowLPM
                    : projectMode === 'greenhouse'
                      ? horticultureReq.requiredFlowLPM
                      : horticultureReq.requiredFlowLPM;
            const requiredHeadM =
                projectMode === 'garden'
                    ? gardenReq.pumpHeadM
                    : projectMode === 'greenhouse'
                      ? horticultureReq.minRequiredHead
                      : actualPumpHead;

            const isFlowAdequate = maxFlow >= requiredFlowLPM;
            const isHeadAdequate = maxHead >= requiredHeadM;

            return {
                isFlowAdequate,
                isHeadAdequate,
                flowRatio: requiredFlowLPM > 0 ? maxFlow / requiredFlowLPM : 0,
                headRatio: requiredHeadM > 0 ? maxHead / requiredHeadM : 0,
            };
        },
        [projectMode, gardenReq, horticultureReq, actualPumpHead]
    );

    // แสดงปั๊มทั้งหมด - เรียงตามความเหมาะสมก่อน แล้วตามราคา
    const getFilteredPumps = useCallback(() => {
        return analyzedPumps.sort((a, b) => {
            const adequacyA = checkPumpAdequacy(a);
            const adequacyB = checkPumpAdequacy(b);

            // 1. เรียงตามความเหมาะสม: ดี > พอใช้ > ไม่เหมาะสม
            const scoreA =
                adequacyA.isFlowAdequate && adequacyA.isHeadAdequate
                    ? 3
                    : adequacyA.isFlowAdequate || adequacyA.isHeadAdequate
                      ? 2
                      : 1;
            const scoreB =
                adequacyB.isFlowAdequate && adequacyB.isHeadAdequate
                    ? 3
                    : adequacyB.isFlowAdequate || adequacyB.isHeadAdequate
                      ? 2
                      : 1;

            if (scoreA !== scoreB) {
                return scoreB - scoreA; // เรียงจากดีที่สุดไปแย่ที่สุด
            }

            // 2. ถ้าคะแนนเท่ากัน ให้เรียงตามราคา (ถูกที่สุดก่อน)
            return a.price - b.price;
        });
    }, [analyzedPumps, checkPumpAdequacy]);

    const sortedPumps = useMemo(() => getFilteredPumps(), [getFilteredPumps]);

    // Auto-select pump based on system requirements
    useEffect(() => {
        if (analyzedPumps.length > 0) {
            // ตรวจสอบว่าปั๊มที่เลือกอยู่เหมาะสมหรือไม่
            let shouldReselect = false;

            if (!selectedPump) {
                // หากยังไม่มีปั๊มที่เลือก ให้เลือกปั๊มที่เหมาะสม
                shouldReselect = true;
            } else {
                // ตรวจสอบว่าปั๊มที่เลือกอยู่เหมาะสมหรือไม่
                const currentAdequacy = checkPumpAdequacy(selectedPump);
                if (!(currentAdequacy.isFlowAdequate && currentAdequacy.isHeadAdequate)) {
                    // หากปั๊มที่เลือกอยู่ไม่เหมาะสม ให้หาปั๊มที่เหมาะสมกว่า
                    shouldReselect = true;
                }
            }

            if (shouldReselect) {
                console.log('Should reselect pump. Current selected:', selectedPump?.name);
                console.log(
                    'Available pumps:',
                    sortedPumps.map((p) => ({
                        name: p.name,
                        price: p.price,
                        maxFlow: p.maxFlow,
                        maxHead: p.maxHead,
                        adequacy: checkPumpAdequacy(p),
                    }))
                );

                // 1. หาปั๊มที่เหมาะสมที่สุด (เพียงพอทั้ง Flow และ Head) ที่ราคาถูกที่สุด
                const suitablePumps = sortedPumps.filter((pump) => {
                    const adequacy = checkPumpAdequacy(pump);
                    return adequacy.isFlowAdequate && adequacy.isHeadAdequate;
                });

                if (suitablePumps.length > 0) {
                    // เลือกปั๊มที่เหมาะสม ราคาถูกที่สุด
                    const bestPump = suitablePumps[0];
                    if (bestPump && bestPump.id !== selectedPump?.id) {
                        console.log(
                            'Auto-selecting suitable pump:',
                            bestPump.name,
                            'Price:',
                            bestPump.price
                        );
                        onPumpChange(bestPump);
                        return;
                    }
                } else {
                    console.log('No suitable pumps found (Flow ✅ + Head ✅)');
                }

                // 2. หากไม่มีปั๊มที่เหมาะสม ให้เลือกปั๊มที่ Head หรือ Flow เพียงพอแค่อย่างเดียว ราคาถูกที่สุด
                const partialAdequatePumps = sortedPumps.filter((pump) => {
                    const adequacy = checkPumpAdequacy(pump);
                    return adequacy.isFlowAdequate || adequacy.isHeadAdequate;
                });

                if (partialAdequatePumps.length > 0) {
                    // เลือกปั๊มที่เพียงพอแค่อย่างเดียว ราคาถูกที่สุด
                    const bestPartialPump = partialAdequatePumps[0];
                    if (bestPartialPump && bestPartialPump.id !== selectedPump?.id) {
                        onPumpChange(bestPartialPump);
                        return;
                    }
                }

                // 3. หากยังไม่มี ให้เลือกปั๊มราคาถูกที่สุด
                if (sortedPumps.length > 0) {
                    const cheapestPump = sortedPumps[0];
                    if (cheapestPump && cheapestPump.id !== selectedPump?.id) {
                        onPumpChange(cheapestPump);
                        return;
                    }
                }
            }
        }
    }, [selectedPump, analyzedPumps, onPumpChange, sortedPumps, checkPumpAdequacy]);

    const getSelectionStatus = (pump: any) => {
        if (!pump) return null;
        const isAutoSelected = pump.id === autoSelectedPump?.id;

        if (isAutoSelected) {
            return t('🤖 เลือกอัตโนมัติ');
        } else {
            return t('👤 เลือกเอง');
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
                <img
                    src="/images/water-pump.png"
                    alt="Water Pump"
                    className="h-6 w-6 object-contain"
                />
                {t('ปั๊ม')}
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
                    ⚡ {t('ความต้องการ:')}
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
                                      : horticultureReq.requiredFlowLPM
                                ).toFixed(2)
                            ).toLocaleString()}{' '}
                            {t('LPM')}
                        </span>
                        {projectMode === 'garden' && (
                            <span className="ml-2 text-xs text-green-400">(จาก garden input)</span>
                        )}
                        {projectMode === 'greenhouse' && (
                            <span className="ml-2 text-xs text-green-400">
                                (จาก greenhouse zones)
                            </span>
                        )}
                    </span>
                    <span>
                        {t('Pump Head:')}{' '}
                        <span className="font-bold text-orange-300">
                            {(() => {
                                const displayValue =
                                    projectMode === 'garden'
                                        ? gardenReq.pumpHeadM
                                        : projectMode === 'greenhouse'
                                          ? horticultureReq.minRequiredHead
                                          : actualPumpHead;
                                return Number(displayValue.toFixed(2)).toLocaleString();
                            })()}{' '}
                            {t('เมตร')}
                        </span>
                        {projectMode === 'garden' && (
                            <span className="ml-2 text-xs text-green-400">(จาก Head Loss รวม)</span>
                        )}
                        {projectMode === 'greenhouse' && (
                            <span className="ml-2 text-xs text-green-400">
                                (ท่อเมนหลัก + ท่อย่อย + หัวฉีด)
                            </span>
                        )}
                    </span>
                </div>
            </div>

            <div className="mb-4">
                <SearchableDropdown
                    value={currentPump?.id || ''}
                    onChange={(value) => {
                        const selected = analyzedPumps.find(
                            (p) => p.id === parseInt(value.toString())
                        );
                        onPumpChange(selected || null);
                    }}
                    options={[
                        { value: '', label: `-- ${t('ใช้การเลือกอัตโนมัติ')} --` },
                        ...(() => {
                            // สร้าง options จาก pumps - แสดงปั๊มทั้งหมดแต่เรียงตามความเหมาะสม
                            const pumpOptions = sortedPumps.map((pump) => {
                                const group = getPumpGrouping(pump);
                                const isAuto = pump.id === currentPump?.id; // ปั๊มที่เลือกอยู่คือปั๊มที่แนะนำ
                                const adequacy = checkPumpAdequacy(pump);
                                const isSelected = pump.id === currentPump?.id;

                                // สร้าง label พร้อมสถานะความเหมาะสม
                                const flowStatus = adequacy.isFlowAdequate ? '✅' : '❌';
                                const headStatus = adequacy.isHeadAdequate ? '✅' : '❌';
                                const flowRatio = adequacy.flowRatio.toFixed(1);
                                const headRatio = adequacy.headRatio.toFixed(1);
                                const statusText = `Flow:${flowStatus} ${flowRatio} Head:${headStatus} (${headRatio}x)`;

                                // กำหนดสถานะความเหมาะสม
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
                                    label: `${isAuto ? '🤖 ⭐ ' : ''}${pump.name || pump.productCode} - ${pump.powerHP}HP - ${pump.price?.toLocaleString()} ${t('บาท')} | ${statusText} | ${isAuto ? 'แนะนำ' : suitabilityText}`,
                                    searchableText: `${pump.productCode || ''} ${pump.name || ''} ${pump.brand || ''} ${pump.powerHP}HP ${(() => {
                                        if (isAuto) return 'แนะนำ';
                                        if (adequacy.isFlowAdequate && adequacy.isHeadAdequate)
                                            return 'ดี';
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
                                    // เพิ่มข้อมูลความเหมาะสม
                                    isRecommended: isAuto, // แนะนำ = ตัวที่เลือกอัตโนมัติเท่านั้น
                                    isGoodChoice:
                                        adequacy.isFlowAdequate && adequacy.isHeadAdequate, // ดี = Head และ Flow เพียงพอทั้งคู่
                                    isUsable:
                                        (adequacy.isFlowAdequate || adequacy.isHeadAdequate) &&
                                        !(adequacy.isFlowAdequate && adequacy.isHeadAdequate), // พอใช้ = เพียงพอแค่ตัวเดียว
                                    // เพิ่มข้อมูล Flow/Head adequacy สำหรับ dropdown
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
                                        if (projectMode === 'garden')
                                            return gardenReq.pumpHeadM.toFixed(1);
                                        if (projectMode === 'greenhouse')
                                            return horticultureReq.minRequiredHead.toFixed(1);
                                        if (projectMode === 'horticulture')
                                            return horticultureReq.minRequiredHead.toFixed(1);
                                        return actualPumpHead.toFixed(1);
                                    })()} ม.`,
                                };
                            });

                            // เรียงลำดับตามเงื่อนไข:
                            // 1. แนะนำ (ตัวที่เลือกอัตโนมัติ) - อยู่บนสุด
                            // 2. ดี (Head และ Flow เพียงพอทั้งคู่) - ราคาถูกก่อน
                            // 3. พอใช้ (เพียงพอแค่ตัวเดียว) - ราคาถูกก่อน
                            // 4. ไม่เหมาะสม (ไม่เพียงพอทั้งคู่) - ราคาถูกก่อน
                            return pumpOptions.sort((a, b) => {
                                // 1. แนะนำ (ตัวที่เลือกอัตโนมัติ) - อยู่บนสุด
                                if (a.isRecommended && !b.isRecommended) return -1;
                                if (!a.isRecommended && b.isRecommended) return 1;

                                // 2. ดี (Head และ Flow เพียงพอทั้งคู่) - ราคาถูกก่อน
                                if (a.isGoodChoice && !b.isGoodChoice) return -1;
                                if (!a.isGoodChoice && b.isGoodChoice) return 1;
                                if (a.isGoodChoice && b.isGoodChoice) {
                                    return (a.price || 0) - (b.price || 0);
                                }

                                // 3. พอใช้ (เพียงพอแค่ตัวเดียว) - ราคาถูกก่อน
                                if (a.isUsable && !b.isUsable) return -1;
                                if (!a.isUsable && b.isUsable) return 1;
                                if (a.isUsable && b.isUsable) {
                                    return (a.price || 0) - (b.price || 0);
                                }

                                // 4. ไม่เหมาะสม (ไม่เพียงพอทั้งคู่) - ราคาถูกก่อน
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

                    <div className="mb-3 rounded bg-blue-900 p-2">
                        <p className="text-sm text-blue-300">{getSelectionStatus(currentPump)}</p>
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
                            className="max-h-full max-w-full rounded-lg shadow-2xl"
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
                        className="relative mx-4 max-h-[90vh] w-full max-w-[800px] overflow-hidden rounded-lg bg-gray-800 shadow-2xl"
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
