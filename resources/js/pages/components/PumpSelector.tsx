/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    const [showPumpCalculatorModal, setShowPumpCalculatorModal] = useState(false);
    const [showAddAccessoryModal, setShowAddAccessoryModal] = useState(false);
    const [modalImage, setModalImage] = useState({ src: '', alt: '' });
    const [hasAutoSelected, setHasAutoSelected] = useState(false);
    const [userPumpFlow, setUserPumpFlow] = useState<string>('');
    const [userPumpHead, setUserPumpHead] = useState<string>('');
    const [calculationResult, setCalculationResult] = useState<{
        isFlowAdequate: boolean;
        isHeadAdequate: boolean;
        flowRatio: number;
        headRatio: number;
    } | null>(null);
    // State สำหรับจัดการอุปกรณ์ที่เพิ่ม/ลบชั่วคราว
    const [removedAccessoryIds, setRemovedAccessoryIds] = useState<Set<number>>(new Set());
    const [addedAccessories, setAddedAccessories] = useState<any[]>([]);
    const [availableAccessories, setAvailableAccessories] = useState<any[]>([]);
    const [isLoadingAccessories, setIsLoadingAccessories] = useState(false);
    const [searchTerm, setSearchTerm] = useState<string>(''); // สำหรับ showAddAccessoryModal
    const [searchTermAccessories, setSearchTermAccessories] = useState<string>(''); // สำหรับ showAccessoriesModal
    // เก็บ selectedGroupId ใน localStorage เพื่อไม่ให้ reset เมื่อเปลี่ยน tab
    const getStoredSelectedGroupId = (pumpId: number | undefined): number | string | null => {
        if (!pumpId) return null;
        try {
            const stored = localStorage.getItem(`pump_${pumpId}_selectedGroupId`);
            return stored ? (isNaN(Number(stored)) ? stored : Number(stored)) : null;
        } catch {
            return null;
        }
    };
    
    const storeSelectedGroupId = (pumpId: number | undefined, groupId: number | string | null) => {
        if (!pumpId) return;
        try {
            if (groupId) {
                localStorage.setItem(`pump_${pumpId}_selectedGroupId`, String(groupId));
            } else {
                localStorage.removeItem(`pump_${pumpId}_selectedGroupId`);
            }
        } catch {
            // Ignore localStorage errors
        }
    };
    
    const [selectedGroupId, setSelectedGroupId] = useState<number | string | null>(null); // สำหรับเลือกกลุ่ม
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
            const horticulturePumpHead =
                maxPumpHeadForProjectMode !== undefined ? maxPumpHeadForProjectMode : 0;

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
                    const sprinklerFlow =
                        zoneSummary.sprinklerCount *
                        (fcData.irrigationSettings?.sprinkler_system?.flow || 30);
                    const pivotFlow =
                        zoneSummary.pivotCount *
                        (fcData.irrigationSettings?.pivot_system?.flow || 50);
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

    const handleCalculateUserPump = () => {
        const flow = parseFloat(userPumpFlow);
        const head = parseFloat(userPumpHead);

        if (isNaN(flow) || isNaN(head) || flow <= 0 || head <= 0) {
            alert(t('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง'));
            return;
        }

        const requiredFlowLPM =
            projectMode === 'garden'
                ? gardenReq.requiredFlowLPM
                : projectMode === 'greenhouse'
                    ? horticultureReq.requiredFlowLPM
                    : projectMode === 'field-crop'
                        ? fieldCropRequirements.requiredFlowLPM
                        : horticultureReq.requiredFlowLPM;

        const requiredHeadM = maxPumpHeadWithSafety;

        const isFlowAdequate = flow >= requiredFlowLPM;
        const isHeadAdequate = head >= requiredHeadM;

        setCalculationResult({
            isFlowAdequate,
            isHeadAdequate,
            flowRatio: requiredFlowLPM > 0 ? flow / requiredFlowLPM : 0,
            headRatio: requiredHeadM > 0 ? head / requiredHeadM : 0,
        });
    };

    const resetCalculator = () => {
        setUserPumpFlow('');
        setUserPumpHead('');
        setCalculationResult(null);
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
    
    // Initialize selectedGroupId จาก localStorage เมื่อ component mount หรือ pump เปลี่ยน
    // ใช้ useRef เพื่อป้องกันการ reset เมื่อ component remount
    const hasInitializedRef = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (currentPump?.id) {
            const currentPumpId = currentPump.id;
            // ถ้า pump เปลี่ยน หรือยังไม่ได้ initialize ให้โหลดจาก localStorage
            if (hasInitializedRef.current !== currentPumpId) {
                const storedGroupId = getStoredSelectedGroupId(currentPumpId);
                if (storedGroupId !== null) {
                    setSelectedGroupId(storedGroupId);
                } else if (currentPump?.pumpAccessories) {
                    // ถ้าไม่มีใน localStorage ให้ใช้กลุ่มแรก
                    const groupAccessories = currentPump.pumpAccessories.filter((acc: any) => 
                        acc.group_id && acc.group_id > 0
                    );
                    if (groupAccessories.length > 0) {
                        const firstGroupId = groupAccessories[0]?.group_id || null;
                        setSelectedGroupId(firstGroupId);
                        storeSelectedGroupId(currentPumpId, firstGroupId);
                    }
                }
                hasInitializedRef.current = currentPumpId;
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPump?.id]);

    // ใช้ useRef เพื่อป้องกันการเรียก fetch ซ้ำๆ
    const isFetchingRef = useRef(false);
    const lastFetchTimeRef = useRef(0);
    const modalOpenedRef = useRef(false);

    // ฟังก์ชันสำหรับดึงข้อมูลอุปกรณ์ประกอบปั๊มทั้งหมด
    const fetchAvailableAccessories = useCallback(async () => {
        // ป้องกันการเรียกซ้ำภายใน 2 วินาที
        const now = Date.now();
        if (isFetchingRef.current || (now - lastFetchTimeRef.current < 2000)) {
            return;
        }

        isFetchingRef.current = true;
        lastFetchTimeRef.current = now;
        setIsLoadingAccessories(true);

        try {
            // ดึงข้อมูลจาก equipments ที่มี category name = 'pump_equipment'
            const endpoints = [
                '/api/equipments/by-category/pump_equipment',
                '/api/equipments/by-category/pump-equipment',
                '/api/equipments/pump-equipments', // fallback
            ];

            let data: any[] = [];

            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint);
                    if (response.ok) {
                        const responseData = await response.json();
                        if (responseData && Array.isArray(responseData) && responseData.length > 0) {
                            data = responseData;
                            break; // ถ้าได้ข้อมูลแล้ว ให้หยุด loop
                        }
                    }
                } catch (err) {
                    // Ignore errors
                }
            }

            // แปลงข้อมูลให้มีรูปแบบที่สม่ำเสมอ (ไม่กรองออก เพื่อให้เพิ่มได้เรื่อยๆ)
            // แต่ต้องตรวจสอบว่าเพิ่มไปแล้วหรือยัง
            const currentAccessoryIds = new Set<number | string>();

            // ตรวจสอบใน currentPump.pumpAccessories (อุปกรณ์ที่มีอยู่แล้วในระบบ)
            // ใช้ equipment_id เป็นหลัก เพราะมันชี้ไปยัง equipment.id ใน equipments table
            if (currentPump?.pumpAccessories) {
                currentPump.pumpAccessories.forEach((acc: any) => {
                    // ใช้ equipment_id เป็นหลัก (ชี้ไปยัง equipment.id)
                    const id = acc.equipment_id || acc.id;
                    if (id) currentAccessoryIds.add(id);
                });
            }

            // ตรวจสอบใน addedAccessories (อุปกรณ์ที่เพิ่มชั่วคราว)
            // ใช้ originalId หรือ equipment_id เป็นหลัก
            addedAccessories.forEach((acc: any) => {
                // ใช้ originalId (เก็บ equipment.id ไว้) หรือ equipment_id
                const id = acc.originalId || acc.equipment_id || acc.id;
                if (id) currentAccessoryIds.add(id);
            });

            const formatted = data.map((equipment: any) => {
                // สำหรับ equipment จาก equipments table (ใช้ toCalculationFormat)
                // equipment.id จะเป็น ID ของ equipment ใน equipments table
                const equipmentId = equipment.id;
                // ตรวจสอบว่า equipment.id ตรงกับ pumpAccessory.equipment_id หรือไม่
                const isAlreadyAdded = equipmentId ? currentAccessoryIds.has(equipmentId) : false;

                return {
                    id: equipment.id,
                    equipment_id: equipment.id, // ใช้ id เป็น equipment_id
                    product_code: equipment.product_code || equipment.productCode,
                    name: equipment.name,
                    image: equipment.image || equipment.image_url || equipment.imageUrl,
                    image_url: equipment.image_url || equipment.imageUrl || equipment.image,
                    size: equipment.size, // อาจไม่มีใน equipment
                    price: equipment.price || 0,
                    quantity: 1, // default quantity สำหรับ equipment
                    is_included: false, // default สำหรับ equipment ที่เพิ่มใหม่
                    sort_order: 0, // default sort order
                    accessory_type: equipment.category?.name || 'other', // ใช้ category name
                    specifications: equipment.attributes_raw || {}, // ใช้ attributes
                    description: equipment.description || '',
                    brand: equipment.brand,
                    isAlreadyAdded: isAlreadyAdded,
                };
            });

            setAvailableAccessories(formatted);
        } catch (error) {
            console.error('Error fetching accessories:', error);
            setAvailableAccessories([]);
        } finally {
            setIsLoadingAccessories(false);
            isFetchingRef.current = false;
        }
    }, [currentPump?.pumpAccessories, addedAccessories]);

    // ฟังก์ชันสำหรับลบอุปกรณ์ชั่วคราว
    const handleRemoveAccessory = (accessoryId: number) => {
        setRemovedAccessoryIds((prev) => new Set([...prev, accessoryId]));
    };

    // ฟังก์ชันสำหรับลบ temporary accessory (อุปกรณ์ที่เพิ่มใหม่)
    const handleRemoveTemporaryAccessory = useCallback((accessory: any) => {
        // ลบออกจาก addedAccessories โดยใช้ id เป็นหลัก (temp ID)
        // useEffect ที่มีอยู่แล้วจะอัพเดต isAlreadyAdded และ saveAccessoriesChanges ให้อัตโนมัติ
        setAddedAccessories((prev) => {
            // ใช้ String() เพื่อให้แน่ใจว่าเปรียบเทียบได้ถูกต้อง
            const accessoryIdToRemove = String(accessory.id);
            return prev.filter((acc: any) => {
                // เปรียบเทียบ id โดยตรง (สำหรับ temporary items)
                return String(acc.id) !== accessoryIdToRemove;
            });
        });
    }, []);

    // ฟังก์ชันสำหรับยกเลิกการลบ
    const handleRestoreAccessory = (accessoryId: number) => {
        setRemovedAccessoryIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(accessoryId);
            return newSet;
        });
    };

    // ฟังก์ชันสำหรับอัพเดตจำนวนอุปกรณ์
    const handleUpdateQuantity = useCallback((accessoryId: string | number, newQuantity: number, isTemporary: boolean) => {
        // ตรวจสอบว่าเป็นจำนวนที่ถูกต้อง (อย่างน้อย 1)
        const quantity = Math.max(1, Math.floor(newQuantity) || 1);

        if (isTemporary) {
            // อัพเดตใน addedAccessories โดยใช้ id เป็นหลัก
            setAddedAccessories((prev) => {
                const accessoryIdStr = String(accessoryId);
                return prev.map((acc: any) => {
                    // เปรียบเทียบ id โดยตรง (สำหรับ temporary items)
                    if (String(acc.id) === accessoryIdStr) {
                        return { ...acc, quantity: quantity };
                    }
                    return acc;
                });
            });
        } else {
            // ถ้าเป็น accessory เดิม ต้องอัพเดตใน currentPump.pumpAccessories
            // แต่เนื่องจาก currentPump มาจาก props ต้องอัพเดตผ่าน onPumpChange
            if (currentPump?.pumpAccessories) {
                const updatedAccessories = currentPump.pumpAccessories.map((acc: any) =>
                    String(acc.id) === String(accessoryId)
                        ? { ...acc, quantity: quantity }
                        : acc
                );

                const updatedPump = {
                    ...currentPump,
                    pumpAccessories: updatedAccessories,
                };

                onPumpChange(updatedPump);
            }
        }
    }, [currentPump, onPumpChange]);

    // ฟังก์ชันสำหรับเพิ่มอุปกรณ์ชั่วคราว
    const handleAddAccessory = (accessory: any) => {
        // ใช้ equipment_id เป็นหลัก (ชี้ไปยัง equipment.id ใน equipments table)
        const accessoryId = accessory.equipment_id || accessory.id;

        if (!accessoryId) {
            return;
        }

        // ตรวจสอบว่าเพิ่มแล้วหรือยัง (ใช้ equipment_id เป็นหลัก)
        // ตรวจสอบทั้งใน currentPump.pumpAccessories และ addedAccessories
        const existingOriginalIds = new Set<number | string>();

        // ตรวจสอบใน currentPump.pumpAccessories
        // ใช้ equipment_id เป็นหลัก เพราะมันชี้ไปยัง equipment.id
        if (currentPump?.pumpAccessories) {
            currentPump.pumpAccessories.forEach((acc: any) => {
                const id = acc.equipment_id || acc.id;
                if (id) existingOriginalIds.add(id);
            });
        }

        // ตรวจสอบใน addedAccessories (ใช้ originalId หรือ equipment_id)
        addedAccessories.forEach((acc: any) => {
            // originalId เก็บ equipment.id ไว้, หรือใช้ equipment_id
            const id = acc.originalId || acc.equipment_id || acc.id;
            if (id) existingOriginalIds.add(id);
        });

        if (existingOriginalIds.has(accessoryId)) {
            // ถ้าเพิ่มแล้ว ให้ข้าม
            return;
        }

        // สร้าง unique ID สำหรับอุปกรณ์ชั่วคราว (ใช้ timestamp + random)
        const uniqueId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const newAccessory = {
            ...accessory,
            id: uniqueId,
            originalId: accessoryId, // เก็บ ID เดิมไว้ (สำคัญมาก!)
            quantity: accessory.quantity || 1,
            price: accessory.price || 0,
            is_included: accessory.is_included ?? false,
            sort_order: accessory.sort_order || 0,
            isTemporary: true, // ระบุว่าเป็นอุปกรณ์ชั่วคราว
        };

        setAddedAccessories((prev) => {
            // ตรวจสอบอีกครั้งก่อนเพิ่ม (ป้องกัน race condition)
            // ใช้ originalId หรือ equipment_id เป็นหลัก
            const alreadyExists = prev.some(
                (acc: any) => (acc.originalId || acc.equipment_id || acc.id) === accessoryId
            );
            if (alreadyExists) {
                return prev; // ถ้ามีอยู่แล้ว ไม่ต้องเพิ่ม
            }
            return [...prev, newAccessory];
        });

        // อัพเดต isAlreadyAdded ใน availableAccessories
        setAvailableAccessories((prev) =>
            prev.map((acc: any) => {
                const accId = acc.id || acc.equipment_id;
                if (accId === accessoryId) {
                    return { ...acc, isAlreadyAdded: true };
                }
                return acc;
            })
        );
        // ไม่ปิด modal เพื่อให้เพิ่มได้เรื่อยๆ
    };

    // คำนวณรายการอุปกรณ์ที่แสดง (รวมที่เพิ่ม ลบที่ลบ)
    const getDisplayedAccessories = useMemo(() => {
        if (!currentPump?.pumpAccessories) {
            // ถ้าไม่มี pumpAccessories ให้แสดงแค่ addedAccessories
            return addedAccessories.sort(
                (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
            );
        }

        const original = currentPump.pumpAccessories.filter(
            (acc: any) => {
                // กรอง removed accessories
                if (removedAccessoryIds.has(acc.id)) {
                    return false;
                }
                // กรอง temporary accessories ที่ไม่มีใน addedAccessories
                if (acc.isTemporary || (typeof acc.id === 'string' && acc.id.startsWith('temp_'))) {
                    const existsInAdded = addedAccessories.some((a: any) => String(a.id) === String(acc.id));
                    if (!existsInAdded) {
                        return false;
                    }
                }
                return true;
            }
        );

        // กรอง duplicate โดยใช้ originalId
        const originalIds = new Set(
            original.map((acc: any) => acc.id || acc.equipment_id).filter(Boolean)
        );

        // กรอง addedAccessories ที่มี originalId ซ้ำกับ original
        const uniqueAdded = addedAccessories.filter((acc: any) => {
            const originalId = acc.originalId || acc.id || acc.equipment_id;
            return !originalIds.has(originalId);
        });

        // รวมและเรียงลำดับ
        const combined = [...original, ...uniqueAdded];

        // กรอง duplicate ใน addedAccessories เอง (กรณีที่เพิ่มซ้ำ)
        const seenOriginalIds = new Set<number | string>();
        const deduplicated = combined.filter((acc: any) => {
            const originalId = acc.originalId || acc.id || acc.equipment_id;
            if (!originalId) return true; // ถ้าไม่มี ID ให้แสดง
            if (seenOriginalIds.has(originalId)) {
                return false; // ถ้าเจอซ้ำ ให้ข้าม
            }
            seenOriginalIds.add(originalId);
            return true;
        });

        // Enrich ข้อมูล accessories ที่มี equipment_id แต่ไม่มี image_url
        // โดยดึงข้อมูลจาก availableAccessories หรือ addedAccessories
        const enriched = deduplicated.map((acc: any) => {
            // ถ้ามี image_url อยู่แล้ว ไม่ต้อง enrich
            if (acc.image_url || acc.image || acc.imageUrl) {
                return acc;
            }

            // หา equipment_id
            const equipmentId = acc.equipment_id || acc.originalId;
            if (!equipmentId) {
                return acc;
            }

            // หาจาก availableAccessories
            const availableAcc = availableAccessories.find((a: any) => 
                a.id === equipmentId || a.equipment_id === equipmentId
            );
            if (availableAcc && (availableAcc.image_url || availableAcc.image || availableAcc.imageUrl)) {
                return {
                    ...acc,
                    image_url: availableAcc.image_url || availableAcc.image || availableAcc.imageUrl,
                    image: availableAcc.image || availableAcc.image_url || availableAcc.imageUrl,
                    imageUrl: availableAcc.imageUrl || availableAcc.image_url || availableAcc.image,
                };
            }

            // หาจาก addedAccessories
            const addedAcc = addedAccessories.find((a: any) => 
                (a.originalId === equipmentId || a.equipment_id === equipmentId) &&
                (a.image_url || a.image || a.imageUrl)
            );
            if (addedAcc) {
                return {
                    ...acc,
                    image_url: addedAcc.image_url || addedAcc.image || addedAcc.imageUrl,
                    image: addedAcc.image || addedAcc.image_url || addedAcc.imageUrl,
                    imageUrl: addedAcc.imageUrl || addedAcc.image_url || addedAcc.image,
                };
            }

            return acc;
        });

        const sorted = enriched.sort(
            (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
        );

        return sorted;
    }, [currentPump?.pumpAccessories, removedAccessoryIds, addedAccessories, availableAccessories]);

    // เมื่อเปิด modal ให้ดึงข้อมูลอุปกรณ์ (เรียกแค่ครั้งเดียวเมื่อเปิด modal)
    useEffect(() => {
        if (showAddAccessoryModal && !modalOpenedRef.current) {
            modalOpenedRef.current = true;
            isFetchingRef.current = false;
            lastFetchTimeRef.current = 0;
            setSearchTerm(''); // Reset search เมื่อเปิด modal
            fetchAvailableAccessories();
        } else if (!showAddAccessoryModal) {
            modalOpenedRef.current = false;
            setSearchTerm(''); // Reset search เมื่อปิด modal
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showAddAccessoryModal]);

    // เมื่อเปิด modal "🔧 อุปกรณ์โรงปั๊มน้ำ" ให้ fetch equipment data สำหรับ accessories ที่ไม่มี image_url
    useEffect(() => {
        if (!showAccessoriesModal || !currentPump?.pumpAccessories) {
            return;
        }

        // หา accessories ที่มี equipment_id แต่ไม่มี image_url
        const accessoriesNeedingData = currentPump.pumpAccessories.filter((acc: any) => {
            const hasImage = acc.image_url || acc.image || acc.imageUrl;
            const hasEquipmentId = acc.equipment_id;
            return !hasImage && hasEquipmentId;
        });

        if (accessoriesNeedingData.length === 0) {
            return;
        }

        // Fetch equipment data สำหรับ accessories ที่ต้องการ
        const fetchEquipmentData = async () => {
            const equipmentIds = accessoriesNeedingData
                .map((acc: any) => acc.equipment_id)
                .filter(Boolean);

            if (equipmentIds.length === 0) {
                return;
            }

            try {
                // Fetch equipment data จาก API
                const responses = await Promise.all(
                    equipmentIds.map(async (id: number) => {
                        try {
                            const response = await fetch(`/api/equipments/${id}`);
                            if (response.ok) {
                                const data = await response.json();
                                return data;
                            }
                            return null;
                        } catch (error) {
                            console.error(`Error fetching equipment ${id}:`, error);
                            return null;
                        }
                    })
                );

                const equipmentDataMap = new Map();
                responses.forEach((data) => {
                    if (data && data.id) {
                        equipmentDataMap.set(data.id, data);
                    }
                });

                // อัพเดต availableAccessories ด้วยข้อมูลที่ได้
                if (equipmentDataMap.size > 0) {
                    setAvailableAccessories((prev) => {
                        const existingIds = new Set(prev.map((a: any) => a.id || a.equipment_id));
                        const newItems = Array.from(equipmentDataMap.values())
                            .filter((eq: any) => !existingIds.has(eq.id))
                            .map((equipment: any) => ({
                                id: equipment.id,
                                equipment_id: equipment.id,
                                product_code: equipment.product_code || equipment.productCode,
                                name: equipment.name,
                                image: equipment.image || equipment.image_url || equipment.imageUrl,
                                image_url: equipment.image_url || equipment.imageUrl || equipment.image,
                                imageUrl: equipment.imageUrl || equipment.image_url || equipment.image,
                                price: equipment.price || 0,
                                quantity: 1,
                                is_included: false,
                                sort_order: 0,
                                accessory_type: equipment.category?.name || 'other',
                                specifications: equipment.attributes_raw || {},
                                description: equipment.description || '',
                                brand: equipment.brand,
                                isAlreadyAdded: false,
                            }));

                        return [...prev, ...newItems];
                    });
                }
            } catch (error) {
                console.error('Error fetching equipment data:', error);
            }
        };

        fetchEquipmentData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showAccessoriesModal, currentPump?.pumpAccessories]);

    // สร้าง dependency string สำหรับ useEffect
    const addedAccessoriesIds = useMemo(() => {
        return JSON.stringify(addedAccessories.map((a: any) => a.originalId || a.equipment_id || a.id).sort());
    }, [addedAccessories]);

    // อัพเดต isAlreadyAdded เมื่อ addedAccessories หรือ currentPump เปลี่ยน
    useEffect(() => {
        if (availableAccessories.length > 0) {
            const currentAccessoryIds = new Set<number | string>();

            // ตรวจสอบใน currentPump.pumpAccessories (อุปกรณ์ที่มีอยู่แล้วในระบบ)
            // ใช้ equipment_id เป็นหลัก เพราะมันชี้ไปยัง equipment.id
            if (currentPump?.pumpAccessories) {
                currentPump.pumpAccessories.forEach((acc: any) => {
                    const id = acc.equipment_id || acc.id;
                    if (id) currentAccessoryIds.add(id);
                });
            }

            // ตรวจสอบใน addedAccessories (อุปกรณ์ที่เพิ่มชั่วคราว)
            // ใช้ originalId (เก็บ equipment.id ไว้) หรือ equipment_id
            addedAccessories.forEach((acc: any) => {
                const id = acc.originalId || acc.equipment_id || acc.id;
                if (id) currentAccessoryIds.add(id);
            });

            setAvailableAccessories((prev) =>
                prev.map((acc: any) => {
                    // ใช้ equipment_id เป็นหลัก (ชี้ไปยัง equipment.id)
                    const accId = acc.equipment_id || acc.id;
                    return {
                        ...acc,
                        isAlreadyAdded: accId ? currentAccessoryIds.has(accId) : false,
                    };
                })
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addedAccessoriesIds, currentPump?.pumpAccessories?.length]);

    // อัพเดต pumpAccessories ใน currentPump เมื่อมีการเปลี่ยนแปลง
    // ใช้ useRef เพื่อเก็บค่า previous state และป้องกัน infinite loop
    const prevAccessoriesRef = useRef<{
        removedSize: number;
        addedLength: number;
        displayedIds: string;
        quantitiesHash: string;
    }>({
        removedSize: 0,
        addedLength: 0,
        displayedIds: '',
        quantitiesHash: '',
    });

    // ฟังก์ชันสำหรับบันทึกค่าและอัพเดต currentPump
    const saveAccessoriesChanges = useCallback(() => {
        if (!currentPump) return;

        // สร้าง string จาก IDs เพื่อเปรียบเทียบ
        const displayedIds = getDisplayedAccessories
            .map((acc: any) => acc.id || acc.equipment_id)
            .sort()
            .join(',');

        // สร้าง hash ของ quantities เพื่อตรวจสอบการเปลี่ยนแปลง
        // สำหรับ temporary items ให้ใช้ quantity จาก addedAccessories
        const quantitiesHash = getDisplayedAccessories
            .map((acc: any) => {
                let quantity = acc.quantity || 1;
                // สำหรับ temporary items ให้ใช้ quantity จาก addedAccessories
                if (acc.isTemporary || (typeof acc.id === 'string' && acc.id.startsWith('temp_'))) {
                    const addedAcc = addedAccessories.find((a: any) => String(a.id) === String(acc.id));
                    if (addedAcc) {
                        quantity = addedAcc.quantity || quantity;
                    }
                }
                return `${acc.id || acc.equipment_id}:${quantity}`;
            })
            .sort()
            .join(',');

        const hasChanges =
            removedAccessoryIds.size !== prevAccessoriesRef.current.removedSize ||
            addedAccessories.length !== prevAccessoriesRef.current.addedLength ||
            displayedIds !== prevAccessoriesRef.current.displayedIds ||
            quantitiesHash !== prevAccessoriesRef.current.quantitiesHash;

        // อัพเดตเฉพาะเมื่อมีการเปลี่ยนแปลงจริงๆ
        if (hasChanges) {
            // สร้าง pumpAccessories ที่มี quantity ที่ถูกต้องจาก addedAccessories
            // และกรอง temporary accessories ที่ไม่มีใน addedAccessories ออก
            const updatedAccessories = getDisplayedAccessories
                .filter((acc: any) => {
                    // ถ้าเป็น temporary accessory ต้องมีใน addedAccessories ถึงจะแสดง
                    if (acc.isTemporary || (typeof acc.id === 'string' && acc.id.startsWith('temp_'))) {
                        const existsInAdded = addedAccessories.some((a: any) => String(a.id) === String(acc.id));
                        if (!existsInAdded) {
                            return false; // กรองออก
                        }
                    }
                    return true; // แสดง
                })
                .map((acc: any) => {
                    // สำหรับ temporary items ให้ใช้ quantity จาก addedAccessories ที่อัพเดตแล้ว
                    if (acc.isTemporary || (typeof acc.id === 'string' && acc.id.startsWith('temp_'))) {
                        const addedAcc = addedAccessories.find((a: any) => String(a.id) === String(acc.id));
                        if (addedAcc) {
                            return {
                                ...acc,
                                quantity: addedAcc.quantity || acc.quantity || 1,
                            };
                        }
                    }
                    return acc;
                });

            const updatedPump = {
                ...currentPump,
                pumpAccessories: updatedAccessories,
            };

            // อัพเดต ref ก่อนเรียก onPumpChange เพื่อป้องกัน infinite loop
            prevAccessoriesRef.current = {
                removedSize: removedAccessoryIds.size,
                addedLength: addedAccessories.length,
                displayedIds: displayedIds,
                quantitiesHash: quantitiesHash,
            };

            onPumpChange(updatedPump);
        }
    }, [currentPump, getDisplayedAccessories, removedAccessoryIds.size, addedAccessories, onPumpChange]);

    // ตรวจสอบ quantity changes ใน addedAccessories
    const addedAccessoriesQuantitiesHash = useMemo(() => {
        return addedAccessories
            .map((acc: any) => `${acc.id}:${acc.quantity || 1}`)
            .sort()
            .join(',');
    }, [addedAccessories]);

    useEffect(() => {
        saveAccessoriesChanges();
        // ใช้เฉพาะ dependencies ที่จำเป็น เพื่อป้องกัน infinite loop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [removedAccessoryIds.size, addedAccessories.length, addedAccessoriesQuantitiesHash, currentPump?.id, saveAccessoriesChanges]);

    // บันทึกค่าเมื่อปิด modal
    useEffect(() => {
        if (!showAccessoriesModal) {
            // เมื่อปิด modal ให้บันทึกการเปลี่ยนแปลง
            // ใช้ setTimeout เพื่อให้แน่ใจว่า state อัพเดตแล้ว
            setTimeout(() => {
                saveAccessoriesChanges();
            }, 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showAccessoriesModal]);

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
                        horticultureSprinklerHeadLoss =
                            horticultureSystemData.sprinklerConfig.pressureBar * 10;
                    }
                }
            } catch (error) {
                console.error('Error parsing horticulture system data:', error);
            }

            if (
                horticultureSprinklerHeadLoss === 2.5 * 10 &&
                selectedSprinkler &&
                selectedSprinkler.pressureBar
            ) {
                let pressureBar = 2.5; // default fallback
                if (Array.isArray(selectedSprinkler.pressureBar)) {
                    pressureBar =
                        (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) / 2;
                } else if (
                    typeof selectedSprinkler.pressureBar === 'string' &&
                    selectedSprinkler.pressureBar.includes('-')
                ) {
                    const parts = selectedSprinkler.pressureBar.split('-');
                    pressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                } else {
                    pressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                }
                horticultureSprinklerHeadLoss = pressureBar * 10;
            }

            let horticulturePipeHeadLoss = 0;
            try {
                const horticulturePipeCalculationsStr = localStorage.getItem(
                    'horticulture_pipe_calculations'
                );
                if (horticulturePipeCalculationsStr) {
                    const horticulturePipeCalculations = JSON.parse(
                        horticulturePipeCalculationsStr
                    );
                    const branchHeadLoss = horticulturePipeCalculations.branch?.headLoss || 0;
                    const secondaryHeadLoss = horticulturePipeCalculations.secondary?.headLoss || 0;
                    const mainHeadLoss = horticulturePipeCalculations.main?.headLoss || 0;
                    const emitterHeadLoss = horticulturePipeCalculations.emitter?.headLoss || 0;
                    horticulturePipeHeadLoss =
                        branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;
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

            const totalPumpHead =
                horticulturePipeHeadLoss + horticultureSprinklerHeadLoss + staticHeadM;
            return totalPumpHead;
        } else if (projectMode === 'garden') {
            // สำหรับ garden mode ให้ใช้ cachedMaxPumpHead หรือ fallback
            return cachedMaxPumpHead !== null ? cachedMaxPumpHead : 0;
        } else if (projectMode === 'greenhouse') {
            // ใช้ค่าเดียวกันกับ CalculationSummary.tsx - greenhouse mode
            try {
                const greenhousePipeCalculationsStr = localStorage.getItem(
                    'greenhouse_pipe_calculations'
                );
                if (greenhousePipeCalculationsStr) {
                    const pipeCalculations = JSON.parse(greenhousePipeCalculationsStr);
                    const branchHeadLoss = pipeCalculations.branch?.headLoss || 0;
                    const mainHeadLoss = pipeCalculations.main?.headLoss || 0;
                    const totalPipeHeadLoss = branchHeadLoss + mainHeadLoss;

                    // หา sprinkler pressure จาก localStorage (เหมือน CalculationSummary.tsx)
                    let sprinklerPressureBar = 2.5; // default
                    try {
                        const greenhouseSummaryDataStr =
                            localStorage.getItem('greenhouseSummaryData');
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
                    if (
                        sprinklerPressureBar === 2.5 &&
                        selectedSprinkler &&
                        selectedSprinkler.pressureBar
                    ) {
                        if (Array.isArray(selectedSprinkler.pressureBar)) {
                            sprinklerPressureBar =
                                (selectedSprinkler.pressureBar[0] +
                                    selectedSprinkler.pressureBar[1]) /
                                2;
                        } else if (
                            typeof selectedSprinkler.pressureBar === 'string' &&
                            selectedSprinkler.pressureBar.includes('-')
                        ) {
                            const parts = selectedSprinkler.pressureBar.split('-');
                            sprinklerPressureBar =
                                (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                        } else {
                            sprinklerPressureBar = parseFloat(
                                String(selectedSprinkler.pressureBar)
                            );
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
                fieldCropSprinklerHeadLoss =
                    fieldCropData.irrigationSettings.sprinkler_system.pressure * 10;
            } else if (selectedSprinkler && selectedSprinkler.pressureBar) {
                let pressureBar = 2.5; // default fallback
                if (Array.isArray(selectedSprinkler.pressureBar)) {
                    pressureBar =
                        (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) / 2;
                } else if (
                    typeof selectedSprinkler.pressureBar === 'string' &&
                    selectedSprinkler.pressureBar.includes('-')
                ) {
                    const parts = selectedSprinkler.pressureBar.split('-');
                    pressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                } else {
                    pressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                }
                fieldCropSprinklerHeadLoss = pressureBar * 10;
            } else {
                fieldCropSprinklerHeadLoss = 2.5 * 10;
            }

            let fieldCropPipeHeadLoss = 0;
            try {
                const fieldCropPipeCalculationsStr = localStorage.getItem(
                    'field_crop_pipe_calculations'
                );
                if (fieldCropPipeCalculationsStr) {
                    const fieldCropPipeCalculations = JSON.parse(fieldCropPipeCalculationsStr);
                    const branchHeadLoss = fieldCropPipeCalculations.branch?.headLoss || 0;
                    const secondaryHeadLoss = fieldCropPipeCalculations.secondary?.headLoss || 0;
                    const mainHeadLoss = fieldCropPipeCalculations.main?.headLoss || 0;
                    const emitterHeadLoss = fieldCropPipeCalculations.emitter?.headLoss || 0;
                    fieldCropPipeHeadLoss =
                        branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;
                }
            } catch (error) {
                console.error('Error parsing field-crop pipe calculations:', error);
            }

            const totalPumpHead = fieldCropPipeHeadLoss + fieldCropSprinklerHeadLoss;
            return totalPumpHead;
        }
        return 0;
    }, [projectMode, cachedMaxPumpHead, fieldCropData, selectedSprinkler, results.headLoss]);

    // ใช้ useState เพื่อเก็บค่าสูงสุดที่คำนวณแล้ว (ไม่เปลี่ยนตามโซนที่เลือก)
    const [maxPumpHeadWithSafety, setMaxPumpHeadWithSafety] = useState<number>(0);

    // คำนวณและเก็บค่าสูงสุดจากทุกโซน (ไม่เปลี่ยนตามโซนที่เลือก) - เหมือนกับอัตราการไหล
    // ใช้ maxPumpHeadForProjectMode (ค่าสูงสุดจากทุกโซน + 10%) เป็นหลัก
    useEffect(() => {
        let calculatedHead = 0;
        let source = '';

        // 1. ใช้ maxPumpHeadForProjectMode ที่ส่งมา (ค่าสูงสุดจากทุกโซน + 10% แล้ว) - เป็นหลัก
        //    ค่านี้มาจาก maxPumpHeadForAllZones ใน product.tsx ซึ่งเก็บค่าสูงสุดไว้แล้ว
        if (maxPumpHeadForProjectMode !== undefined && maxPumpHeadForProjectMode > 0) {
            calculatedHead = maxPumpHeadForProjectMode;
            source = 'maxPumpHeadForProjectMode (prop - max from all zones)';
        }
        // 2. คำนวณจาก allZoneResults โดยตรง - หาค่าสูงสุดจากทุกโซน + 10%
        else if (allZoneResults && allZoneResults.length > 0) {
            const maxHead = Math.max(...allZoneResults.map((zone: any) => zone.totalHead || 0));
            if (maxHead > 0) {
                calculatedHead = maxHead + maxHead * 0.1;
                source = 'calculated from allZoneResults';
            }
        }
        // 3. Fallback: ใช้ calculatePumpHead() + 10% (เฉพาะกรณีที่ไม่มีข้อมูลอื่น)
        else {
            const actualPumpHead = calculatePumpHead();
            calculatedHead = actualPumpHead + actualPumpHead * 0.1;
            source = 'calculated from calculatePumpHead() (fallback)';
        }

        // อัพเดตเสมอเมื่อค่าเปลี่ยน (ไม่ว่าจะเพิ่มขึ้นหรือลดลง)
        // เพราะ maxPumpHeadForProjectMode ถูกคำนวณใหม่จากทุกโซนที่ยังมีอยู่
        setMaxPumpHeadWithSafety((prevValue) => {
            if (calculatedHead !== prevValue) {
                return calculatedHead;
            }
            return prevValue;
        });
    }, [
        // ใช้ maxPumpHeadForProjectMode เป็น dependency หลัก (ค่าสูงสุดจากทุกโซน)
        maxPumpHeadForProjectMode ?? 0,
        // ใช้ค่าสูงสุดจาก allZoneResults เป็น dependency (จะเปลี่ยนเฉพาะเมื่อค่าจริงๆ เปลี่ยน)
        allZoneResults && allZoneResults.length > 0
            ? Math.max(...allZoneResults.map((z: any) => z.totalHead || 0))
            : 0,
        // ไม่ใช้ calculatePumpHead เป็น dependency เพราะจะทำให้เปลี่ยนตามโซน
    ]);

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

            // ใช้ค่าสูงสุดจากทุกโซน (เหมือนกับอัตราการไหล)
            const requiredHeadM = maxPumpHeadWithSafety;

            const isFlowAdequate = maxFlow >= requiredFlowLPM;
            const isHeadAdequate = maxHead >= requiredHeadM;
            return {
                isFlowAdequate,
                isHeadAdequate,
                flowRatio: requiredFlowLPM > 0 ? maxFlow / requiredFlowLPM : 0,
                headRatio: requiredHeadM > 0 ? maxHead / requiredHeadM : 0,
            };
        },
        [projectMode, gardenReq, horticultureReq, fieldCropRequirements, maxPumpHeadWithSafety]
    );

    const getFilteredPumps = useCallback(() => {
        return analyzedPumps.sort((a, b) => {
            const adequacyA = checkPumpAdequacy(a);
            const adequacyB = checkPumpAdequacy(b);

            // ให้คะแนนตามความเหมาะสม: 4 = ดีที่สุด, 1 = แย่ที่สุด
            const scoreA =
                adequacyA.isFlowAdequate && adequacyA.isHeadAdequate
                    ? 4 // ทั้ง flow และ head เพียงพอ
                    : adequacyA.isFlowAdequate && !adequacyA.isHeadAdequate
                        ? 3 // flow เพียงพอ แต่ head ไม่เพียงพอ
                        : !adequacyA.isFlowAdequate && adequacyA.isHeadAdequate
                            ? 2 // head เพียงพอ แต่ flow ไม่เพียงพอ
                            : 1; // ทั้ง flow และ head ไม่เพียงพอ

            const scoreB =
                adequacyB.isFlowAdequate && adequacyB.isHeadAdequate
                    ? 4 // ทั้ง flow และ head เพียงพอ
                    : adequacyB.isFlowAdequate && !adequacyB.isHeadAdequate
                        ? 3 // flow เพียงพอ แต่ head ไม่เพียงพอ
                        : !adequacyB.isFlowAdequate && adequacyB.isHeadAdequate
                            ? 2 // head เพียงพอ แต่ flow ไม่เพียงพอ
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
        // ✅ ตรวจสอบว่าผู้ใช้ได้เลือกปั๊มเองหรือยัง (selectedPump จาก props)
        // ถ้าผู้ใช้เลือกเองแล้ว ไม่ต้อง auto-select ใหม่
        const userHasSelectedPump = selectedPump && selectedPump.id;
        
        if (analyzedPumps.length > 0 && sortedPumps.length > 0 && !hasAutoSelected && !userHasSelectedPump) {
            // Auto-select แค่ครั้งแรกเท่านั้น และเฉพาะเมื่อผู้ใช้ยังไม่ได้เลือกปั๊มเอง
            // หาปั๊มที่มีทั้ง flow และ head เพียงพอก่อน
            const fullyAdequatePump = sortedPumps.find((pump) => {
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
    }, [analyzedPumps, sortedPumps, hasAutoSelected, onPumpChange, checkPumpAdequacy, selectedPump]);

    // ✅ Reset auto-select flag เมื่อ analyzedPumps เปลี่ยน (เช่น เมื่อเปลี่ยนโซน)
    // แต่ต้องไม่ reset ถ้าผู้ใช้ได้เลือกปั๊มเองแล้ว
    useEffect(() => {
        const userHasSelectedPump = selectedPump && selectedPump.id;
        // Reset เฉพาะเมื่อผู้ใช้ยังไม่ได้เลือกปั๊มเอง
        if (!userHasSelectedPump) {
            setHasAutoSelected(false);
        }
    }, [analyzedPumps, selectedPump]);

    // ใช้ useRef เพื่อเก็บค่า pump id ก่อนหน้า
    const prevPumpIdRef = useRef<number | undefined>(undefined);
    
    // Reset selectedGroupId เมื่อ currentPump เปลี่ยน (เฉพาะเมื่อ pump เปลี่ยนจริงๆ)
    useEffect(() => {
        const currentPumpId = currentPump?.id;
        const prevPumpId = prevPumpIdRef.current;
        
        // ถ้า pump id เปลี่ยนจริงๆ (เปลี่ยนปั๊ม) ให้ reset selectedGroupId
        if (currentPumpId !== prevPumpId) {
            prevPumpIdRef.current = currentPumpId;
            
            if (currentPump?.pumpAccessories) {
                const groupAccessories = currentPump.pumpAccessories.filter((acc: any) => 
                    acc.group_id && acc.group_id > 0
                );
                if (groupAccessories.length > 0) {
                    // โหลดค่า selectedGroupId จาก localStorage หรือใช้กลุ่มแรก
                    const storedGroupId = getStoredSelectedGroupId(currentPumpId);
                    const groupExists = storedGroupId && groupAccessories.some((acc: any) => acc.group_id === storedGroupId);
                    const defaultGroupId = groupExists ? storedGroupId : (groupAccessories[0]?.group_id || null);
                    setSelectedGroupId(defaultGroupId);
                    storeSelectedGroupId(currentPumpId, defaultGroupId);
                } else {
                    setSelectedGroupId(null);
                    storeSelectedGroupId(currentPumpId, null);
                }
            } else {
                setSelectedGroupId(null);
                storeSelectedGroupId(currentPumpId, null);
            }
        }
        // ไม่ต้องทำอะไรถ้า pump id ไม่เปลี่ยน (ไม่ reset selectedGroupId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPump?.id]); // ใช้แค่ currentPump?.id เพื่อไม่ให้ reset เมื่อ pumpAccessories เปลี่ยน
    
    // บันทึก selectedGroupId ลง localStorage เมื่อมีการเปลี่ยนแปลง
    useEffect(() => {
        if (currentPump?.id && selectedGroupId !== null) {
            storeSelectedGroupId(currentPump.id, selectedGroupId);
        }
    }, [selectedGroupId, currentPump?.id]);

    const requiredHorsepower = useMemo(() => {
        const requiredFlowLPM =
            projectMode === 'garden'
                ? gardenReq.requiredFlowLPM
                : projectMode === 'greenhouse'
                    ? horticultureReq.requiredFlowLPM
                    : projectMode === 'field-crop'
                        ? fieldCropRequirements.requiredFlowLPM
                        : horticultureReq.requiredFlowLPM;

        const requiredHeadM = maxPumpHeadWithSafety;

        // ถ้าไม่มีค่าหรือเป็น 0 ให้ return 0
        if (!requiredFlowLPM || !requiredHeadM || requiredFlowLPM === 0 || requiredHeadM === 0) {
            return 0;
        }

        // สูตรคำนวณกำลังปั๊ม: Power (HP) = (Flow (LPM) × Head (m)) / (4500 × efficiency)
        // ใช้ efficiency = 0.6 (60%) เป็นค่าเริ่มต้น
        const efficiency = 0.6;
        const powerHP = (requiredFlowLPM * requiredHeadM) / (4500 * efficiency);

        // ปัดขึ้นเป็นจำนวนเต็ม (เพราะต้องใช้ปั๊มอย่างน้อยเท่านี้)
        return Math.ceil(powerHP);
    }, [
        projectMode,
        gardenReq.requiredFlowLPM,
        horticultureReq.requiredFlowLPM,
        fieldCropRequirements.requiredFlowLPM,
        maxPumpHeadWithSafety,
    ]);

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

    // Component สำหรับแสดงรูปภาพอุปกรณ์ที่ handle error ได้ดี
    const AccessoryImage: React.FC<{
        accessory: any;
        size: 'small' | 'normal';
        onImageClick?: (url: string, name: string) => void;
        showPlaceholder?: boolean;
    }> = ({ accessory, size, onImageClick, showPlaceholder = true }) => {
        const [imageError, setImageError] = useState(false);
        const [imageLoading, setImageLoading] = useState(true);
        const imageUrl = accessory.image_url || accessory.image || accessory.imageUrl;
        const imageSize = size === 'small' ? 'h-16 w-16' : 'w-full h-full';
        const accessoryKey = accessory.id || accessory.equipment_id || accessory.originalId || 'acc';

        // Reset error state when imageUrl or accessory changes
        useEffect(() => {
            setImageError(false);
            setImageLoading(true);
        }, [imageUrl, accessoryKey]);

        const getIconForType = (type: string) => {
            const icons = {
                foot_valve: '🔧',
                check_valve: '⚙️',
                ball_valve: '🔩',
                pressure_gauge: '📊',
            };
            return icons[type as keyof typeof icons] || '🔧';
        };

        const iconSize = size === 'small' ? 'h-16 w-16' : 'w-full h-full';

        // ถ้าไม่มี imageUrl หรือ error และต้องการแสดง placeholder
        if ((!imageUrl || imageError) && showPlaceholder) {
            return (
                <div className={`flex ${iconSize} items-center justify-center rounded border border-gray-600 bg-gray-600 text-sm flex-shrink-0`}>
                    {getIconForType(accessory.accessory_type)}
                </div>
            );
        }

        // ถ้าไม่มี imageUrl และไม่ต้องการแสดง placeholder ให้ return null
        if (!imageUrl || imageError) {
            return null;
        }

        return (
            <img
                key={`img_${accessoryKey}_${imageUrl}`}
                src={imageUrl}
                alt={accessory.name || 'Accessory'}
                className={`${imageSize} cursor-pointer rounded border border-gray-600 object-contain transition-opacity hover:border-blue-400 hover:opacity-80 flex-shrink-0 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                onError={(e) => {
                    console.warn('Image failed to load:', imageUrl, accessory);
                    setImageError(true);
                    setImageLoading(false);
                }}
                onLoad={() => {
                    setImageLoading(false);
                }}
                onClick={(e) => {
                    e.stopPropagation(); // ป้องกันไม่ให้ event bubble ขึ้นไปยัง parent
                    if (onImageClick && imageUrl) {
                        onImageClick(imageUrl, accessory.name || 'Accessory');
                    }
                }}
                title={t('คลิกเพื่อดูรูปขนาดใหญ่')}
            />
        );
    };

    const renderAccessoryImage = (accessory: any, size: 'small' | 'normal' = 'normal', showPlaceholder: boolean = true) => {
        const imageUrl = accessory.image_url || accessory.image || accessory.imageUrl;
        
        // ถ้าไม่มี imageUrl และไม่ต้องการแสดง placeholder ให้ return null
        if (!imageUrl && !showPlaceholder) {
            return null;
        }
        
        const componentKey = `acc_img_${accessory.id || accessory.equipment_id || accessory.originalId || 'acc'}_${imageUrl || 'noimg'}`;
        
        return (
            <AccessoryImage
                key={componentKey}
                accessory={accessory}
                size={size}
                onImageClick={openImageModal}
                showPlaceholder={showPlaceholder}
            />
        );
    };

    return (
        <div className="rounded-lg bg-gray-700 p-6">
            <div className="flex flex-row items-center justify-between">
                <h3 className="mb-4 text-2xl font-bold text-red-500">{t('ปั๊มน้ำ')}</h3>
                <button
                    onClick={() => {
                        resetCalculator();
                        setShowPumpCalculatorModal(true);
                    }}
                    className="ml-auto mb-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                    {t('คำนวณปั๊มน้ำของคุณ')}
                </button>
            </div>

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
                            {maxPumpHeadWithSafety.toFixed(1)} {t('เมตร')}
                        </span>
                        <span className="ml-1 text-xs text-gray-400"></span>
                    </span>
                    {requiredHorsepower > 0 && (
                        <span>
                            {t('ต้องการปั๊มอย่างน้อย')}{' '}
                            <span className="font-bold text-yellow-300">
                                {requiredHorsepower}
                                {t('HP')}
                            </span>
                        </span>
                    )}
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
                                    isRecommended:
                                        adequacy.isFlowAdequate && adequacy.isHeadAdequate,
                                    // ดี: Flow และ Head เพียงพอ แต่ไม่ใช่ auto-selected
                                    isGoodChoice:
                                        adequacy.isFlowAdequate &&
                                        adequacy.isHeadAdequate &&
                                        !isAuto,
                                    // พอใช้: Flow หรือ Head เพียงพออย่างใดอย่างหนึ่ง
                                    isUsable:
                                        (adequacy.isFlowAdequate || adequacy.isHeadAdequate) &&
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
                                    })()} LPM | Head: ${(pump.maxHead || 0).toFixed(1)}/${maxPumpHeadWithSafety.toFixed(1)} ม.`,
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
                <div className="rounded-lg bg-gray-600 p-4 shadow-lg">
                    {/* Main Content - Shopee Style Layout */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {/* Left Side - Large Image */}
                        <div>
                            <div className="relative flex items-center justify-center rounded-lg bg-white p-3 shadow-md min-h-[300px] min-w-0" style={{ minHeight: 300, maxHeight: 350 }}>
                                {(() => {
                                    const imageUrl = currentPump.image_url || currentPump.image || currentPump.imageUrl;
                                    if (imageUrl) {
                                        return (
                                            <img
                                                src={imageUrl}
                                                alt={currentPump.name || 'ปั๊มน้ำ'}
                                                className="h-auto max-h-[350px] w-full cursor-pointer rounded-lg object-contain transition-transform hover:scale-105"
                                                style={{ maxHeight: 350, minHeight: 300 }}
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                                onClick={() => openImageModal(imageUrl, currentPump.name || 'ปั๊มน้ำ')}
                                                title={t('คลิกเพื่อดูรูปขนาดใหญ่')}
                                            />
                                        );
                                    }
                                    return (
                                        <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-gray-200 text-gray-500">
                                            <div className="text-center">
                                                <svg
                                                    className="mx-auto h-16 w-16 text-gray-400"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                    />
                                                </svg>
                                                <p className="mt-2 text-xs">{t('ไม่มีรูปปั๊ม')}</p>
                                            </div>
                                        </div>
                                    );
                                })()}
                                <button
                                    onClick={() => {
                                        const imageUrl = currentPump.image_url || currentPump.image || currentPump.imageUrl;
                                        if (imageUrl) {
                                            openImageModal(imageUrl, currentPump.name || 'ปั๊มน้ำ');
                                        }
                                    }}
                                    className="absolute bottom-3 right-3 rounded-full bg-blue-600 px-3 py-1.5 text-xs text-white shadow-lg transition-colors hover:bg-blue-700"
                                    title={t('ดูรูปขนาดใหญ่')}
                                >
                                    🔍 {t('ขยาย')}
                                </button>
                            </div>
                            {/* Description */}
                            {currentPump.description && (
                                <div className="mt-4 rounded-lg bg-gray-700 p-4">
                                    <h5 className="mb-2 text-base font-semibold text-white">
                                        {t('รายละเอียดสินค้า')}
                                    </h5>
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                        {currentPump.description}
                                    </p>
                                </div>
                            )}
                            {/* Price Section */}
                            <div className="rounded-lg mt-2 bg-gradient-to-r from-green-900/50 to-emerald-900/50 p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-base text-gray-300">{t('ราคาสินค้า:')}</span>
                                    <span className="text-base font-bold text-gray-50">
                                        ฿{currentPump.price?.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side - Product Details */}
                        <div className="space-y-4">
                            {/* Product Info */}
                            <div className="rounded-lg bg-gray-700 p-4">
                                <h5 className="mb-3 text-base font-semibold text-white">
                                    {t('ข้อมูลสินค้า')}
                                </h5>
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('รหัสสินค้า:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {currentPump.productCode}
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('ชื่อ:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {currentPump.name || currentPump.productCode}
                                        </span>
                                    </div>
                                    {currentPump.brand && (
                                        <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                            <span className="font-medium text-gray-400">
                                                {t('แบรนด์:')}
                                            </span>
                                            <span className="text-right text-white">
                                                {currentPump.brand}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('กำลัง:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {currentPump.powerHP != null
                                                ? currentPump.powerHP
                                                : (currentPump.powerKW * 1.341).toFixed(1)}{' '}
                                            {t('HP')} (
                                            {currentPump.powerKW != null
                                                ? currentPump.powerKW
                                                : (currentPump.powerHP * 0.7457).toFixed(1)}{' '}
                                            {t('kW')})
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('เฟส:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {currentPump.phase} {t('เฟส')}
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('ท่อเข้า/ออก:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {currentPump.inlet_size_inch}"/{currentPump.outlet_size_inch}"
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('อัตราการไหลสูงสุด:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {currentPump.maxFlow || 'N/A'} {t('ลิตรต่อนาที')}
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('แรงส่งสูงสุด:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {currentPump.maxHead || 'N/A'} {t('เมตร')}
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('แรงดูดสูงสุด:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {currentPump.suction_depth_m || 'N/A'} {t('เมตร')}
                                        </span>
                                    </div>
                                    {currentPump.weight_kg && (
                                        <div className="flex items-start justify-between text-sm">
                                            <span className="font-medium text-gray-400">
                                                {t('น้ำหนัก:')}
                                            </span>
                                            <span className="text-right text-white">
                                                {currentPump.weight_kg} {t('kg')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Adequacy Status */}
                            <div className="rounded-lg bg-gray-700 p-4">
                                <h5 className="mb-3 text-base font-semibold text-white">
                                    {t('สถานะความเหมาะสม')}
                                </h5>
                                <div className="space-y-2">
                                    {(() => {
                                        const adequacy = evaluatePumpAdequacy(currentPump);
                                        return (
                                            <>
                                                <div className="flex items-center justify-between border-b border-gray-600 pb-2 text-sm">
                                                    <span className="font-medium text-gray-400">
                                                        {t('Flow:')}
                                                    </span>
                                                    <span
                                                        className={`font-bold ${adequacy.isFlowAdequate
                                                                ? 'text-green-300'
                                                                : 'text-red-300'
                                                            }`}
                                                    >
                                                        {adequacy.isFlowAdequate
                                                            ? '✅ ' + t('เพียงพอ')
                                                            : '❌ ' + t('ไม่เพียงพอ')}
                                                        <span className="ml-2 text-gray-400">
                                                            ({adequacy.flowRatio.toFixed(1)}x)
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="font-medium text-gray-400">
                                                        {t('Head:')}
                                                    </span>
                                                    <span
                                                        className={`font-bold ${adequacy.isHeadAdequate
                                                                ? 'text-green-300'
                                                                : 'text-red-300'
                                                            }`}
                                                    >
                                                        {adequacy.isHeadAdequate
                                                            ? '✅ ' + t('เพียงพอ')
                                                            : '❌ ' + t('ไม่เพียงพอ')}
                                                        <span className="ml-2 text-gray-400">
                                                            ({adequacy.headRatio.toFixed(1)}x)
                                                        </span>
                                                    </span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>



                    {currentPump.pumpAccessories && currentPump.pumpAccessories.length > 0 && (() => {
                        // กรองเฉพาะ accessories ที่มี group_id (เป็นกลุ่ม)
                        const groupAccessories = currentPump.pumpAccessories.filter((acc: any) => 
                            acc.group_id && acc.group_id > 0
                        );

                        // ถ้าไม่มี groupAccessories ให้แสดงแบบเดิม
                        if (groupAccessories.length === 0) {
                            return (
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
                                                            sum +
                                                            Number(acc.price || 0) *
                                                            (acc.quantity || 1),
                                                        0
                                                    )
                                                    .toLocaleString()}{' '}
                                                {t('บาท')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // ใช้ selectedGroupId โดยตรง (ไม่ใช้ fallback เพื่อไม่ให้ reset dropdown)
                        // ถ้า selectedGroupId เป็น null ให้ใช้กลุ่มแรกเป็น default เฉพาะในการหา selectedGroup
                        const effectiveGroupId = selectedGroupId ?? (groupAccessories[0]?.group_id || null);

                        // หากลุ่มที่เลือก
                        const selectedGroup = groupAccessories.find((acc: any) => 
                            acc.group_id === effectiveGroupId
                        );

                        // ดึงรายการอุปกรณ์ของกลุ่มที่เลือก
                        const selectedGroupItems = selectedGroup?.group_items || selectedGroup?.group?.items || [];

                        return (
                            <div className="mt-3 rounded bg-purple-900 p-3">
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-sm font-medium text-purple-300">
                                        🔧 {t('อุปกรณ์ประกอบ')} ({groupAccessories.length}{' '}
                                        {t('กลุ่ม')})
                                    </h5>
                                    <button
                                        onClick={() => setShowAccessoriesModal(true)}
                                        className="rounded bg-purple-600 px-3 py-1 text-xs text-white transition-colors hover:bg-purple-500"
                                    >
                                        {t('ดูอุปกรณ์')}
                                    </button>
                                </div>

                                {/* 2 คอลัมน์ */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* คอลัมน์แรก: แสดงเฉพาะรูปภาพเต็มพื้นที่แนวตั้ง */}
                                    <div className="flex flex-col h-full min-h-[380px] max-h-[400px]">
                                        {/* ช่องเลือกกลุ่ม */}
                                        <div className="mb-3">
                                            <label className="text-xs font-medium text-purple-200 block mb-1">
                                                {t('เลือกกลุ่มอุปกรณ์:')}
                                            </label>
                                            <select
                                                value={selectedGroupId || ''}
                                                onChange={(e) => {
                                                    const groupId = e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : null;
                                                    setSelectedGroupId(groupId);
                                                }}
                                                className="w-full rounded border border-gray-600 bg-gray-700 p-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                            >
                                                {groupAccessories.map((acc: any) => {
                                                    const groupId = acc.group_id;
                                                    const groupName = acc.group?.name || acc.name || `${t('กลุ่มที่')} ${groupId}`;
                                                    
                                                    // คำนวณราคารวมจากรายการอุปกรณ์ในกลุ่ม (ใช้ข้อมูลล่าสุด)
                                                    const groupItems = acc.group_items || acc.group?.items || [];
                                                    const calculatedGroupPrice = groupItems.length > 0
                                                        ? groupItems.reduce((sum: number, item: any) => {
                                                              const itemPrice = Number(item.unit_price || item.total_price || item.equipment?.price || 0);
                                                              const itemQuantity = Number(item.quantity || 1);
                                                              return sum + (itemPrice * itemQuantity);
                                                          }, 0)
                                                        : (acc.price || acc.group?.total_price || 0);
                                                    
                                                    return (
                                                        <option key={groupId} value={groupId}>
                                                            {groupName} - {calculatedGroupPrice.toLocaleString()} {t('บาท')}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        {/* ส่วนแสดงรูปภาพ */}
                                        <div className="flex-1 flex items-center justify-center min-h-0">
                                            {selectedGroup && (selectedGroup.group?.image || selectedGroup.image) ? (
                                                <img
                                                    src={selectedGroup.group?.image || selectedGroup.image}
                                                    alt={selectedGroup.group?.name || selectedGroup.name}
                                                    className="h-full w-full object-contain rounded border border-gray-600 bg-gray-800 cursor-pointer transition-opacity hover:opacity-80"
                                                    onError={e => {
                                                        (e.target as HTMLImageElement).style.display = "none";
                                                    }}
                                                    onClick={() => {
                                                        const imageUrl = selectedGroup.group?.image || selectedGroup.image;
                                                        const imageName = selectedGroup.group?.name || selectedGroup.name || t('รูปภาพกลุ่มอุปกรณ์');
                                                        if (imageUrl) {
                                                            openImageModal(imageUrl, imageName);
                                                        }
                                                    }}
                                                    title={t('คลิกเพื่อดูรูปขนาดใหญ่')}
                                                />
                                            ) : (
                                                <div 
                                                    className="flex items-center justify-center rounded border border-gray-600 bg-gray-700 text-xs text-gray-400 w-full h-full"
                                                >
                                                    {t('ไม่มีรูป')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* คอลัมน์ที่สอง: รายการอุปกรณ์ของกลุ่ม */}
                                    <div className="flex flex-col h-full min-h-[380px] max-h-[400px]">
                                        <label className="text-xs font-medium text-purple-200">
                                            {t('รายการอุปกรณ์ในกลุ่ม:')} ({selectedGroupItems.length}) {t('รายการ')}
                                        </label>
                                        <div
                                            className="rounded bg-gray-800 p-3 border border-gray-600 flex-1"
                                            style={{
                                                minHeight: 0,
                                                height: '100%',
                                                overflowY: selectedGroupItems.length > 5 ? 'auto' : 'visible',
                                            }}
                                        >
                                            {selectedGroupItems.length > 0 ? (
                                                <div className="space-y-2">
                                                    {selectedGroupItems.map((item: any, index: number) => {
                                                        const equipment = item.equipment || item;
                                                        const itemImage = equipment?.image || equipment?.image_url || equipment?.imageUrl || '';
                                                        const itemName = equipment?.name || item.name || '';
                                                        const itemPrice = item.unit_price || item.total_price || equipment?.price || 0;
                                                        const itemQuantity = item.quantity || 1;
                                                        const itemTotalPrice = itemPrice * itemQuantity;

                                                        return (
                                                            <div
                                                                key={item.id || index}
                                                                className="flex items-center space-x-3 p-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                                                            >
                                                                {itemImage ? (
                                                                    <img
                                                                        src={itemImage}
                                                                        alt={itemName}
                                                                        className="w-12 h-12 object-contain rounded border border-gray-600 flex-shrink-0 cursor-pointer transition-opacity hover:opacity-80"
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                                        }}
                                                                        onClick={() => {
                                                                            if (itemImage) {
                                                                                openImageModal(itemImage, itemName);
                                                                            }
                                                                        }}
                                                                        title={t('คลิกเพื่อดูรูปขนาดใหญ่')}
                                                                    />
                                                                ) : (
                                                                    <div className="w-12 h-12 flex items-center justify-center rounded border border-gray-600 bg-gray-600 text-xs text-gray-400 flex-shrink-0">
                                                                        {t('ไม่มีรูป')}
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-white truncate">
                                                                        {itemName}
                                                                    </p>
                                                                    <p className="text-xs text-gray-400">
                                                                        {t('จำนวน:')} {itemQuantity} {t('ชิ้น')}
                                                                    </p>
                                                                    <p className="text-xs text-purple-300">
                                                                        {itemPrice.toLocaleString()} {t('บาท')} × {itemQuantity} = {itemTotalPrice.toLocaleString()} {t('บาท')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center py-4 text-gray-400 text-sm">
                                                    {t('ไม่มีรายการอุปกรณ์ในกลุ่มนี้')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* แสดงราคารวม */}
                                {selectedGroup && !selectedGroup.is_included && (
                                    <div className="mt-3 text-xs text-purple-200 border-t border-purple-700 pt-2">
                                        <span>{t('ราคาอุปกรณ์เสริม:')}</span>{' '}
                                        <span className="font-medium text-yellow-300">
                                            +
                                            {(() => {
                                                // คำนวณราคารวมจากรายการอุปกรณ์ในกลุ่ม (ใช้ข้อมูลล่าสุด)
                                                const calculatedPrice = selectedGroupItems.length > 0
                                                    ? selectedGroupItems.reduce((sum: number, item: any) => {
                                                          const itemPrice = Number(item.unit_price || item.total_price || item.equipment?.price || 0);
                                                          const itemQuantity = Number(item.quantity || 1);
                                                          return sum + (itemPrice * itemQuantity);
                                                      }, 0)
                                                    : (selectedGroup.price || 0);
                                                return calculatedPrice.toLocaleString();
                                            })()}{' '}
                                            {t('บาท')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

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
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75"
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
                            className="max-h-[80vh] max-w-[80vw] rounded-lg object-contain shadow-2xl"
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

            {showAccessoriesModal && currentPump && currentPump.pumpAccessories && (() => {
                // กรองเฉพาะ accessories ที่มี group_id (เป็นกลุ่ม)
                const groupAccessories = currentPump.pumpAccessories.filter((acc: any) => 
                    acc.group_id && acc.group_id > 0
                );

                // หากลุ่มที่เลือก
                const currentGroupId = selectedGroupId || (groupAccessories[0]?.group_id || null);
                const selectedGroup = groupAccessories.find((acc: any) => 
                    acc.group_id === currentGroupId
                );

                // ดึงรายการอุปกรณ์ของกลุ่มที่เลือก
                const selectedGroupItems = selectedGroup?.group_items || selectedGroup?.group?.items || [];

                return (
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
                                    🔧 {selectedGroup?.group?.name || selectedGroup?.name || t('อุปกรณ์โรงปั๊มน้ำ')} - {currentPump.name}
                                </h3>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={async () => {
                                            // บันทึกการเปลี่ยนแปลงก่อนปิด modal
                                            // ใช้ setTimeout เพื่อให้แน่ใจว่า state อัพเดตแล้ว
                                            await new Promise(resolve => setTimeout(resolve, 50));
                                            saveAccessoriesChanges();
                                            // รออีกนิดเพื่อให้ onPumpChange ทำงาน
                                            await new Promise(resolve => setTimeout(resolve, 50));
                                            setShowAccessoriesModal(false);
                                        }}
                                        className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                                        title={t('ปิด')}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            <div className="p-4">
                                {/* Search input */}
                                <div className="mb-3">
                                    <input
                                        type="text"
                                        value={searchTermAccessories}
                                        onChange={(e) => setSearchTermAccessories(e.target.value)}
                                        placeholder={t('พิมพ์เพื่อค้นหาอุปกรณ์...')}
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 max-h-[500px] overflow-y-auto pr-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        {selectedGroupItems
                                            .filter((item: any) => {
                                                if (!searchTermAccessories) return true;
                                                const search = searchTermAccessories.toLowerCase();
                                                const equipment = item.equipment || item;
                                                const itemName = equipment?.name || item.name || '';
                                                return itemName.toLowerCase().includes(search);
                                            })
                                            .map((item: any, index: number) => {
                                                const equipment = item.equipment || item;
                                                const itemImage = equipment?.image || equipment?.image_url || equipment?.imageUrl || '';
                                                const itemName = equipment?.name || item.name || '';
                                                const itemPrice = item.unit_price || item.total_price || equipment?.price || 0;
                                                const itemQuantity = item.quantity || 1;
                                                const itemTotalPrice = itemPrice * itemQuantity;

                                                return (
                                                    <div
                                                        key={item.id || index}
                                                        className="flex items-center space-x-3 p-3 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                                                    >
                                                        {itemImage ? (
                                                            <img
                                                                src={itemImage}
                                                                alt={itemName}
                                                                className="w-16 h-16 object-contain rounded border border-gray-600 flex-shrink-0 cursor-pointer"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                }}
                                                                onClick={() => {
                                                                    if (itemImage) {
                                                                        openImageModal(itemImage, itemName);
                                                                    }
                                                                }}
                                                                title={t('คลิกเพื่อดูรูปขนาดใหญ่')}
                                                            />
                                                        ) : (
                                                            <div className="w-16 h-16 flex items-center justify-center rounded border border-gray-600 bg-gray-600 text-xs text-gray-400 flex-shrink-0">
                                                                {t('ไม่มีรูป')}
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white">
                                                                {itemName}
                                                            </p>
                                                            <p className="text-xs text-gray-400">
                                                                {t('จำนวน:')} {itemQuantity} {t('ชิ้น')}
                                                            </p>
                                                            <p className="text-xs text-purple-300">
                                                                {itemPrice.toLocaleString()} {t('บาท')} × {itemQuantity} = {itemTotalPrice.toLocaleString()} {t('บาท')}
                                                            </p>
                                                            {equipment?.description && (
                                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                                    {equipment.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>

                                {/* แสดงราคารวม */}
                                {selectedGroupItems.length > 0 && (
                                    <div className="mt-4 rounded bg-purple-800 p-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-purple-200">
                                                {t('ราคารวมทั้งหมด:')}
                                            </span>
                                            <span className="font-medium text-yellow-300">
                                                {selectedGroupItems.reduce((sum: number, item: any) => {
                                                    const itemPrice = item.unit_price || item.total_price || item.equipment?.price || 0;
                                                    const itemQuantity = item.quantity || 1;
                                                    return sum + (itemPrice * itemQuantity);
                                                }, 0).toLocaleString()} {t('บาท')}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {showAddAccessoryModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                    onClick={() => {
                        modalOpenedRef.current = false;
                        setShowAddAccessoryModal(false);
                    }}
                >
                    <div
                        className="relative mx-4 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-gray-800 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between bg-green-900 px-4 py-3">
                            <h3 className="text-lg font-medium text-white">
                                ➕ {t('เพิ่มอุปกรณ์โรงปั๊ม')}
                            </h3>
                            <button
                                onClick={() => setShowAddAccessoryModal(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                                title={t('ปิด')}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-4">
                            {/* Search Input */}
                            <div className="mb-4">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={t('พิมพ์เพื่อค้นหาอุปกรณ์...')}
                                    className="w-full rounded border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {isLoadingAccessories ? (
                                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                                    <div className="text-gray-400">{t('กำลังโหลด...')}</div>
                                    <div className="text-xs text-gray-500">
                                        {t('กำลังดึงข้อมูลอุปกรณ์จากระบบ...')}
                                    </div>
                                </div>
                            ) : availableAccessories.filter((acc: any) => {
                                if (!searchTerm) return true;
                                const search = searchTerm.toLowerCase();
                                return (
                                    acc.name?.toLowerCase().includes(search) ||
                                    acc.product_code?.toLowerCase().includes(search) ||
                                    acc.size?.toLowerCase().includes(search) ||
                                    acc.accessory_type?.toLowerCase().includes(search)
                                );
                            }).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                                    <div className="text-gray-400 text-center">
                                        {t('ไม่พบอุปกรณ์ที่สามารถเพิ่มได้')}
                                    </div>
                                    <div className="text-xs text-gray-500 text-center max-w-md">
                                        {t('อาจไม่มีอุปกรณ์ในระบบ หรืออุปกรณ์ทั้งหมดถูกเพิ่มแล้ว')}
                                        <br />
                                        {t('กรุณาตรวจสอบ Console (F12) เพื่อดูข้อมูลเพิ่มเติม')}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsLoadingAccessories(false);
                                            fetchAvailableAccessories();
                                        }}
                                        className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500"
                                    >
                                        🔄 {t('ลองใหม่')}
                                    </button>
                                </div>
                            ) : (
                                <div className="scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 max-h-[500px] overflow-y-auto pr-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {availableAccessories
                                        .filter((acc: any) => {
                                            if (!searchTerm) return true;
                                            const search = searchTerm.toLowerCase();
                                            return (
                                                acc.name?.toLowerCase().includes(search) ||
                                                acc.product_code?.toLowerCase().includes(search) ||
                                                acc.size?.toLowerCase().includes(search) ||
                                                acc.accessory_type?.toLowerCase().includes(search)
                                            );
                                        })
                                        .map((accessory: any, index: number) => {
                                            const uniqueKey = accessory.id
                                                ? `acc_${accessory.id}_${index}`
                                                : `acc_temp_${index}_${Date.now()}`;

                                            return (
                                                <div
                                                    key={uniqueKey}
                                                    className={`flex items-center justify-between rounded p-3 transition-all ${accessory.isAlreadyAdded
                                                            ? 'bg-gray-800 border-2 border-gray-600 cursor-not-allowed opacity-40'
                                                            : 'bg-gray-700 hover:bg-gray-600 cursor-pointer opacity-100'
                                                        }`}
                                                    onClick={() => {
                                                        if (!accessory.isAlreadyAdded) {
                                                            handleAddAccessory(accessory);
                                                        }
                                                    }}
                                                >
                                                    <div className={`flex items-center space-x-4 flex-1 ${accessory.isAlreadyAdded ? 'opacity-50' : ''}`}>
                                                        {renderAccessoryImage(accessory, 'small')}
                                                        <div className="text-sm">
                                                            <div className="flex items-center space-x-2">
                                                                <p className={`font-medium ${accessory.isAlreadyAdded ? 'text-gray-500 line-through' : 'text-white'}`}>
                                                                    {accessory.name}
                                                                </p>
                                                                {accessory.isAlreadyAdded && (
                                                                    <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">
                                                                        {t('เพิ่มไปแล้ว')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* <p className={`capitalize ${accessory.isAlreadyAdded ? 'text-gray-500' : 'text-gray-300'}`}>
                                                                {accessory.accessory_type?.replace(
                                                                    '_',
                                                                    ' '
                                                                )}
                                                                {accessory.size && ` • ${accessory.size}`}
                                                            </p> */}
                                                            {accessory.description && (
                                                                <p className={`mt-1 text-xs ${accessory.isAlreadyAdded ? 'text-gray-600' : 'text-gray-400'}`}>
                                                                    {accessory.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className={`text-right ${accessory.isAlreadyAdded ? 'opacity-50' : ''}`}>
                                                        <div className="text-sm">
                                                            <div className={accessory.isAlreadyAdded ? 'text-gray-500' : 'text-gray-400'}>
                                                                {t('ราคา:')}{' '}
                                                                <span className={`font-medium ${accessory.isAlreadyAdded ? 'text-gray-500' : 'text-green-300'}`}>
                                                                    {Number(accessory.price || 0).toLocaleString()}{' '}
                                                                    {t('บาท')}
                                                                </span>
                                                            </div>
                                                            {accessory.quantity && (
                                                                <div className={`text-xs mt-1 ${accessory.isAlreadyAdded ? 'text-gray-600' : 'text-gray-400'}`}>
                                                                    {t('จำนวน:')} {accessory.quantity}{' '}
                                                                    {t('ชิ้น')}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {accessory.isAlreadyAdded ? (
                                                            <div className="mt-2 rounded bg-gray-600 px-3 py-1 text-sm text-gray-400 cursor-not-allowed">
                                                                ✅ {t('เพิ่มไปแล้ว')}
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAddAccessory(accessory);
                                                                }}
                                                                className="mt-2 rounded bg-green-600 px-3 py-1 text-sm text-white transition-colors hover:bg-green-500"
                                                            >
                                                                ➕ {t('เพิ่ม')}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showPumpCalculatorModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                    onClick={() => {
                        setShowPumpCalculatorModal(false);
                        resetCalculator();
                    }}
                >
                    <div
                        className="relative mx-4 w-full max-w-2xl rounded-lg bg-gray-800 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between bg-blue-900 px-6 py-4">
                            <h3 className="text-xl font-bold text-white">
                                {t('คำนวณปั๊มน้ำของคุณ')}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowPumpCalculatorModal(false);
                                    resetCalculator();
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
                                title={t('ปิด')}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6">
                            {/* แสดงความต้องการปั๊ม */}
                            <div className="mb-6 rounded bg-gray-700 p-4">
                                <h4 className="mb-3 text-lg font-medium text-red-300">
                                    ⚡ {t('ความต้องการปั๊ม:')}
                                </h4>
                                <div className="flex flex-col space-y-2 text-sm">
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
                                            {maxPumpHeadWithSafety.toFixed(1)} {t('เมตร')}
                                        </span>
                                    </span>
                                </div>
                            </div>

                            {/* ช่องกรอกข้อมูล */}
                            <div className="mb-6 space-y-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-white">
                                        {t('อัตราการไหลสูงสุดของปั๊ม (Flow)')} ({t('LPM')})
                                    </label>
                                    <input
                                        type="number"
                                        value={userPumpFlow}
                                        onChange={(e) => setUserPumpFlow(e.target.value)}
                                        placeholder={t('กรุณากรอกอัตราการไหล')}
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-white">
                                        {t('แรงส่งสูงสุด (Pump Head)')} ({t('เมตร')})
                                    </label>
                                    <input
                                        type="number"
                                        value={userPumpHead}
                                        onChange={(e) => setUserPumpHead(e.target.value)}
                                        placeholder={t('กรุณากรอกแรงส่งสูงสุด')}
                                        className="w-full rounded border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        min="0"
                                        step="0.1"
                                    />
                                </div>
                            </div>

                            {/* ปุ่มคำนวณ */}
                            <div className="mb-6">
                                <button
                                    onClick={handleCalculateUserPump}
                                    className="w-full rounded bg-green-600 px-6 py-3 text-lg font-medium text-white transition-colors hover:bg-green-500"
                                >
                                    {t('คำนวณ')}
                                </button>
                            </div>

                            {/* แสดงผลการคำนวณ */}
                            {calculationResult && (
                                <div className="space-y-4">
                                    <div className="rounded bg-gray-700 p-4">
                                        <h5 className="mb-3 text-lg font-medium text-white">
                                            {t('ผลการคำนวณ:')}
                                        </h5>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-300">{t('Flow:')}</span>
                                                <span
                                                    className={`font-bold ${calculationResult.isFlowAdequate
                                                            ? 'text-green-300'
                                                            : 'text-red-300'
                                                        }`}
                                                >
                                                    {calculationResult.isFlowAdequate
                                                        ? '✅ ' + t('เพียงพอ')
                                                        : '❌ ' + t('ไม่เพียงพอ')}
                                                    <span className="ml-2 text-gray-400">
                                                        ({calculationResult.flowRatio.toFixed(1)}x)
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-300">{t('Head:')}</span>
                                                <span
                                                    className={`font-bold ${calculationResult.isHeadAdequate
                                                            ? 'text-green-300'
                                                            : 'text-red-300'
                                                        }`}
                                                >
                                                    {calculationResult.isHeadAdequate
                                                        ? '✅ ' + t('เพียงพอ')
                                                        : '❌ ' + t('ไม่เพียงพอ')}
                                                    <span className="ml-2 text-gray-400">
                                                        ({calculationResult.headRatio.toFixed(1)}x)
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* คำแนะนำ */}
                                    {(!calculationResult.isFlowAdequate ||
                                        !calculationResult.isHeadAdequate) && (
                                            <div className="rounded bg-yellow-900 p-4">
                                                <h5 className="mb-2 text-sm font-medium text-yellow-300">
                                                    {t('คำแนะนำ:')}
                                                </h5>
                                                <ul className="list-inside list-disc space-y-1 text-xs text-yellow-200">
                                                    {!calculationResult.isFlowAdequate && (
                                                        <li>
                                                            {t(
                                                                'ถ้า Flow ไม่พอ ต้องกลับไปแบ่งโซนใหม่'
                                                            )}
                                                        </li>
                                                    )}
                                                    {!calculationResult.isHeadAdequate && (
                                                        <li>
                                                            {t(
                                                                'ถ้า Head ไม่พอ ให้กลับไปวางท่อใหม่ หรือปรับขนาดท่อให้ใหญ่ขึ้น'
                                                            )}
                                                        </li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}

                                    {/* ข้อความแนะนำเพิ่มเติม */}
                                    <div className="rounded bg-blue-900 p-4">
                                        <p className="text-sm text-blue-200">
                                            {t(
                                                'แต่ถ้าลูกค้ายังไม่มีปั๊มน้ำให้ดูตามที่เราแนะนำให้ได้ หรือเลือกซื้อปั๊มน้ำตาม ⚡ ความต้องการปั๊ม ที่แนะนำได้เลยครับ'
                                            )}
                                        </p>
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

