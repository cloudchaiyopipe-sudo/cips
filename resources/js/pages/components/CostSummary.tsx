/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {
    AnalyzedPipe,
    CalculationResults,
    IrrigationInput,
    SprinklerSetItem,
} from '../types/interfaces';
import { HorticultureProjectData } from '../../utils/horticultureUtils';
import { GardenPlannerData } from '../../utils/homeGardenData';
import { GardenStatistics } from '../../utils/gardenStatistics';
import { calculatePipeRolls, getPipeLengthM, getPipePrice } from '../utils/calculations';
import { useLanguage } from '../../contexts/LanguageContext';
import { getEnhancedFieldCropData, FieldCropData } from '../../utils/fieldCropData';
import { loadSprinklerConfig } from '../../utils/sprinklerUtils';

interface CostSummaryProps {
    results: CalculationResults;
    zoneSprinklers: { [zoneId: string]: any };
    selectedPipes: {
        [zoneId: string]: { branch?: any; secondary?: any; main?: any; emitter?: any };
    };
    selectedPump: any;
    activeZoneId: string;
    projectData?: HorticultureProjectData | null;
    gardenData?: GardenPlannerData | null;
    gardenStats?: GardenStatistics | null;
    zoneInputs: { [zoneId: string]: IrrigationInput };
    onQuotationClick: () => void;
    projectMode?: 'horticulture' | 'garden' | 'field-crop' | 'greenhouse';
    showPump?: boolean;
    fieldCropData?: any;
    greenhouseData?: any;
    sprinklerEquipmentSets?: { [zoneId: string]: any };
    connectionEquipments?: { [zoneId: string]: any[] };
}

interface SprinklerSummary {
    [sprinklerId: string]: {
        sprinkler: any;
        quantity: number;
        zones: string[];
        totalCost: number;
    };
}

interface PipeSummary {
    branch: {
        [pipeId: string]: {
            pipe: any;
            totalLength: number;
            quantity: number;
            zones: string[];
            totalCost: number;
            includesExtra?: boolean;
            extraLength?: number;
        };
    };
    secondary: {
        [pipeId: string]: {
            pipe: any;
            totalLength: number;
            quantity: number;
            zones: string[];
            totalCost: number;
            includesExtra?: boolean;
            extraLength?: number;
        };
    };
    main: {
        [pipeId: string]: {
            pipe: any;
            totalLength: number;
            quantity: number;
            zones: string[];
            totalCost: number;
            includesExtra?: boolean;
            extraLength?: number;
        };
    };
    emitter: {
        [pipeId: string]: {
            pipe: any;
            totalLength: number;
            quantity: number;
            zones: string[];
            totalCost: number;
            includesExtra?: boolean;
            extraLength?: number;
        };
    };
}

/** สร้าง key เดียวกันสำหรับท่อเดียวกัน */
function getPipeKey(pipe: any): string {
    if (!pipe) return 'unknown';
    return String(pipe.id ?? pipe.productCode ?? (pipe as any).product_code ?? 'unknown');
}

const CostSummary: React.FC<CostSummaryProps> = ({
    results,
    zoneSprinklers,
    selectedPipes,
    selectedPump,
    activeZoneId,
    projectData,
    gardenData,
    gardenStats,
    zoneInputs,
    onQuotationClick,
    projectMode = 'horticulture',
    showPump = true,
    fieldCropData,
    greenhouseData,
    sprinklerEquipmentSets = {},
    connectionEquipments = {},
}) => {
    const { t } = useLanguage();

    // ฟังก์ชันแปลง zoneId เป็นชื่อโซนที่ถูกต้อง
    const getZoneName = (zoneId: string): string => {
        if (projectMode === 'garden' && gardenStats) {
            const zone = gardenStats.zones.find((z) => z.zoneId === zoneId);
            return zone?.zoneName || zoneId;
        }
        if (projectMode === 'field-crop' && fieldCropData) {
            const zone = fieldCropData.zones.info.find((z: any) => String(z.id) === String(zoneId));
            return zone?.name || zoneId;
        }
        if (projectMode === 'greenhouse' && greenhouseData) {
            const plot = greenhouseData.summary.plotStats.find((p: any) => p.plotId === zoneId);
            return plot?.plotName || zoneId;
        }

        const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
        if (horticultureSystemDataStr) {
            try {
                const horticultureSystemData = JSON.parse(horticultureSystemDataStr);
                if (horticultureSystemData && horticultureSystemData.zones) {
                    const zone = horticultureSystemData.zones.find((z: any) => z.id === zoneId);
                    if (zone?.name) {
                        return zone.name;
                    }
                }
            } catch (error) {
                console.error('Error parsing horticultureSystemData:', error);
            }
        }

        const zone = projectData?.zones.find((z) => z.id === zoneId);
        return zone?.name || zoneId;
    };

    // ฟังก์ชันแปลงชื่อโซนเป็น "โซน 1,2,3,4"
    const formatZoneNames = (zoneNames: string[]): string => {
        if (!zoneNames || zoneNames.length === 0) return '';

        // ดึงตัวเลขลำดับโซน (1-3 หลัก) จากชื่อโซน
        const zoneNumbers: number[] = [];

        zoneNames.forEach((zoneName) => {
            // ลบข้อมูลในวงเล็บออก (เช่น "โซน 1 (area...)" -> "โซน 1")
            const cleanedName = zoneName.split(' (')[0].trim();

            // หาเลขลำดับโซนที่อยู่หลังคำว่า "โซน" หรือ pattern ที่เหมาะสม
            // 1. ลองหาจาก pattern "โซน {เลข 1-3 หลัก}"
            let match = cleanedName.match(/โซน\s*(\d{1,3})\b/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > 0 && num <= 999 && !zoneNumbers.includes(num)) {
                    zoneNumbers.push(num);
                    return;
                }
            }

            // 2. ลองหาจาก pattern "Zone {เลข 1-3 หลัก}" (ภาษาอังกฤษ)
            match = cleanedName.match(/Zone\s*(\d{1,3})\b/i);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > 0 && num <= 999 && !zoneNumbers.includes(num)) {
                    zoneNumbers.push(num);
                    return;
                }
            }

            // 3. ถ้าไม่มี pattern ที่ชัดเจน ให้ข้าม (ไม่ใช้ ID ที่ยาว)
            // ไม่ดึงเลขจากชื่อโซนที่ไม่มี pattern ที่ชัดเจน เพราะอาจเป็น ID
        });

        // ถ้ามีตัวเลข ให้เรียงลำดับและแสดงเป็น "โซน 1,2,3,4"
        if (zoneNumbers.length > 0) {
            zoneNumbers.sort((a, b) => a - b);
            return `โซน ${zoneNumbers.join(',')}`;
        }

        // ถ้าไม่มีตัวเลข ให้ใช้ชื่อโซนเดิม
        return zoneNames.join(', ');
    };

    const getItemName = () => {
        switch (projectMode) {
            case 'garden':
                return t('หัวฉีด');
            case 'field-crop':
                return t('จุดปลูก');
            case 'greenhouse':
                return t('หัวฉีด');
            default:
                return t('ต้นไม้');
        }
    };

    const getEquipmentName = () => {
        switch (projectMode) {
            case 'garden':
                return t('หัวฉีด');
            case 'field-crop':
                return t('หัวฉีด');
            case 'greenhouse':
                return t('หัวฉีด');
            default:
                return t('หัวฉีด');
        }
    };

    const getAreaUnit = () => {
        return t('ไร่');
    };

    const formatArea = (area: number | undefined | null) => {
        const safeArea = area || 0;
        return `${safeArea.toFixed(1)} ไร่`;
    };

    const getProjectIcon = () => {
        switch (projectMode) {
            case 'garden':
                return '🏡';
            case 'field-crop':
                return '🌾';
            case 'greenhouse':
                return '🏠';
            default:
                return '🌿';
        }
    };

    const calculateTotalCosts = () => {
        let totalSprinklerCost = 0;
        let totalBranchPipeCost = 0;
        let totalSecondaryPipeCost = 0;
        let totalMainPipeCost = 0;
        let totalEmitterPipeCost = 0;

        const sprinklerSummary: SprinklerSummary = {};
        const pipeSummary: PipeSummary = { branch: {}, secondary: {}, main: {}, emitter: {} };
        let extraPipeSummary: any = null;

        const processExtraPipe = (
            zoneId: string,
            zoneInput: IrrigationInput,
            sprinklerCount: number
        ) => {
            if (
                zoneInput.extraPipePerSprinkler &&
                zoneInput.extraPipePerSprinkler.pipeId &&
                zoneInput.extraPipePerSprinkler.lengthPerHead > 0
            ) {
                const extraPipeId = zoneInput.extraPipePerSprinkler.pipeId;
                const extraLength = sprinklerCount * zoneInput.extraPipePerSprinkler.lengthPerHead;

                const zonePipes = selectedPipes[zoneId] || {};
                // ✅ ใช้เฉพาะท่อที่เลือกไว้สำหรับโซนนี้เท่านั้น (ไม่ใช้ fallback จาก results.autoSelected*)
                const branchPipe = zonePipes.branch;
                const secondaryPipe = zonePipes.secondary;
                const mainPipe = zonePipes.main;

                if (branchPipe && (branchPipe.id === extraPipeId || branchPipe.productCode === extraPipeId || (branchPipe as any).product_code === extraPipeId)) {
                    const key = getPipeKey(branchPipe);
                    if (!pipeSummary.branch[key]) {
                        pipeSummary.branch[key] = {
                            pipe: branchPipe,
                            totalLength: 0,
                            quantity: 0,
                            zones: [],
                            totalCost: 0,
                            includesExtra: true,
                            extraLength: 0,
                        };
                    }
                    pipeSummary.branch[key].extraLength =
                        (pipeSummary.branch[key].extraLength || 0) + extraLength;
                    pipeSummary.branch[key].includesExtra = true;
                    return true;
                }

                if (secondaryPipe && (secondaryPipe.id === extraPipeId || secondaryPipe.productCode === extraPipeId || (secondaryPipe as any).product_code === extraPipeId)) {
                    const key = getPipeKey(secondaryPipe);
                    if (!pipeSummary.secondary[key]) {
                        pipeSummary.secondary[key] = {
                            pipe: secondaryPipe,
                            totalLength: 0,
                            quantity: 0,
                            zones: [],
                            totalCost: 0,
                            extraLength: 0,
                        };
                    }
                    pipeSummary.secondary[key].extraLength =
                        (pipeSummary.secondary[key].extraLength || 0) + extraLength;
                    return true;
                }

                if (mainPipe && (mainPipe.id === extraPipeId || mainPipe.productCode === extraPipeId || (mainPipe as any).product_code === extraPipeId)) {
                    const key = getPipeKey(mainPipe);
                    if (!pipeSummary.main[key]) {
                        pipeSummary.main[key] = {
                            pipe: mainPipe,
                            totalLength: 0,
                            quantity: 0,
                            zones: [],
                            totalCost: 0,
                            extraLength: 0,
                        };
                    }
                    pipeSummary.main[key].extraLength =
                        (pipeSummary.main[key].extraLength || 0) + extraLength;
                    return true;
                }

                let pipe: AnalyzedPipe | undefined;
                if (results.analyzedBranchPipes) {
                    pipe = results.analyzedBranchPipes.find((p) => p.id === extraPipeId);
                }
                if (!pipe && results.analyzedSecondaryPipes) {
                    pipe = results.analyzedSecondaryPipes.find((p) => p.id === extraPipeId);
                }
                if (!pipe && results.analyzedMainPipes) {
                    pipe = results.analyzedMainPipes.find((p) => p.id === extraPipeId);
                }

                if (pipe) {
                    if (!extraPipeSummary) {
                        extraPipeSummary = {
                            pipe,
                            totalLength: extraLength,
                            zones: [getZoneName(zoneId)],
                        };
                    } else if (extraPipeSummary.pipe.id === extraPipeId) {
                        extraPipeSummary.totalLength += extraLength;
                        const zoneName = getZoneName(zoneId);
                        if (!extraPipeSummary.zones.includes(zoneName)) {
                            extraPipeSummary.zones.push(zoneName);
                        }
                    }
                }

                return false;
            }

            // ไม่ต้อง process ท่อจาก zoneInput.sprinklerEquipmentSet อีกแล้ว
            // เพราะจะคำนวณจาก sprinklerEquipmentSets prop ที่ส่งมาแทน (ใช้ข้อมูลจาก localStorage)
            // เพื่อให้ตรงกับ QuotationDocument.tsx

            return false;
        };

        if (projectMode === 'garden' && gardenStats && gardenData) {
            gardenStats.zones.forEach((zone) => {
                // ⚠️ ใช้ zone.zoneId จริงๆ ไม่ใช้ hardcoded 'main-area'
                const effectiveZoneId = zone.zoneId;
                const zonePipes = selectedPipes[effectiveZoneId] || {};
                const zoneInput = zoneInputs[effectiveZoneId];

                // ⚠️ สำหรับ garden mode: ใช้ข้อมูลจาก gardenData.sprinklers โดยตรง แทนที่จะใช้ auto-selected sprinkler
                // เพื่อให้แสดงหลายชื่อแยกกัน (ตาม Planner จริงๆ)
                const zoneSprinklersFromPlanner = gardenData.sprinklers?.filter(
                    (s: any) => s.zoneId === effectiveZoneId
                ) || [];

                if (zoneSprinklersFromPlanner.length > 0) {
                    // Group by sprinkler type (name)
                    const sprinklersByType = new Map<string, { type: any; count: number }>();
                    
                    zoneSprinklersFromPlanner.forEach((s: any) => {
                        const key = s.type.nameTH || s.type.nameEN || 'Sprinkler';
                        const existing = sprinklersByType.get(key);
                        
                        if (existing) {
                            existing.count += 1;
                        } else {
                            sprinklersByType.set(key, {
                                type: s.type,
                                count: 1,
                            });
                        }
                    });

                    // Add each sprinkler type to summary
                    sprinklersByType.forEach(({ type, count }) => {
                        // Find matching equipment from analyzedSprinklers
                        const matchingEquipment = results.analyzedSprinklers?.find((eq: any) => {
                            const eqName = eq.name || '';
                            const typeName = type.nameTH || type.nameEN || '';
                            return eqName === typeName || 
                                   Math.abs((eq.waterVolumeLitersPerMinute || 0) - type.flowRate) < 0.5 &&
                                   Math.abs((eq.pressureBar || 0) - type.pressure) < 0.5;
                        });

                        if (matchingEquipment) {
                            const sprinklerCost = matchingEquipment.price * count;
                            totalSprinklerCost += sprinklerCost;

                            const key = `${matchingEquipment.id}`;
                            if (!sprinklerSummary[key]) {
                                sprinklerSummary[key] = {
                                    sprinkler: matchingEquipment,
                                    quantity: 0,
                                    zones: [],
                                    totalCost: 0,
                                };
                            }
                            sprinklerSummary[key].quantity += count;
                            if (!sprinklerSummary[key].zones.includes(getZoneName(effectiveZoneId))) {
                                sprinklerSummary[key].zones.push(getZoneName(effectiveZoneId));
                            }
                            sprinklerSummary[key].totalCost += sprinklerCost;
                        }
                    });
                }

                const branchLength = zoneInput && Number(zoneInput.totalBranchPipeM) > 0
                    ? Number(zoneInput.totalBranchPipeM)
                    : (zone.totalPipeLength ?? 0);
                if (zoneInput) {
                    const sprinklerCount = zoneInput?.totalTrees || zone.sprinklerCount || 0;
                    processExtraPipe(effectiveZoneId, zoneInput, sprinklerCount);
                }

                // ✅ ท่อ branch: ใช้ zoneInput.totalBranchPipeM หรือ fallback จาก zone.totalPipeLength
                const branchPipe = zonePipes.branch;
                if (branchPipe && branchLength > 0) {
                    const key = getPipeKey(branchPipe);
                    if (!pipeSummary.branch[key]) {
                        pipeSummary.branch[key] = {
                            pipe: branchPipe,
                            totalLength: 0,
                            quantity: 0,
                            zones: [],
                            totalCost: 0,
                        };
                    }
                    pipeSummary.branch[key].totalLength += branchLength;
                    pipeSummary.branch[key].zones.push(getZoneName(effectiveZoneId));
                }

                if (zoneInput) {
                    const secondaryPipe = zonePipes.secondary;
                    if (secondaryPipe && zoneInput.totalSecondaryPipeM > 0) {
                        const key = getPipeKey(secondaryPipe);
                        if (!pipeSummary.secondary[key]) {
                            pipeSummary.secondary[key] = {
                                pipe: secondaryPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.secondary[key].totalLength += zoneInput.totalSecondaryPipeM;
                        pipeSummary.secondary[key].zones.push(getZoneName(effectiveZoneId));
                    }

                    const mainPipe = zonePipes.main;
                    if (mainPipe && zoneInput.totalMainPipeM > 0) {
                        const key = getPipeKey(mainPipe);
                        if (!pipeSummary.main[key]) {
                            pipeSummary.main[key] = {
                                pipe: mainPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.main[key].totalLength += zoneInput.totalMainPipeM;
                        pipeSummary.main[key].zones.push(getZoneName(effectiveZoneId));
                    }
                }
            });
        } else if (projectMode === 'field-crop' && fieldCropData) {
            fieldCropData.zones.info.forEach((zone: any) => {
                const zoneId = String(zone.id);
                const zoneSprinkler = zoneSprinklers[zoneId] ?? zoneSprinklers[zone.id];
                const zonePipes = selectedPipes[zoneId] || selectedPipes[zone.id] || {};
                const zoneInput = zoneInputs[zoneId] ?? zoneInputs[zone.id];

                if (zoneSprinkler) {
                    let sprinklerQuantity = 0;

                    if (
                        projectMode === 'field-crop' &&
                        fieldCropData?.zoneSummaries &&
                        (fieldCropData.zoneSummaries[zoneId] ?? fieldCropData.zoneSummaries[zone.id])
                    ) {
                        const zoneSummary = fieldCropData.zoneSummaries[zoneId] ?? fieldCropData.zoneSummaries[zone.id];
                        if (
                            zoneSummary.totalIrrigationPoints &&
                            zoneSummary.totalIrrigationPoints > 0
                        ) {
                            sprinklerQuantity = zoneSummary.totalIrrigationPoints;
                        } else if (zoneSummary.sprinklerCount && zoneSummary.sprinklerCount > 0) {
                            sprinklerQuantity = zoneSummary.sprinklerCount;
                        }
                    }

                    if (sprinklerQuantity === 0) {
                        sprinklerQuantity =
                            zoneInput?.totalTrees ||
                            zone.sprinklerCount ||
                            Math.ceil((zone.totalPlantingPoints || 100) / 10);
                    }
                    const sprinklerCost = (zoneSprinkler.price ?? 0) * sprinklerQuantity;
                    totalSprinklerCost += sprinklerCost;

                    const key = `${zoneSprinkler.id}`;
                    if (!sprinklerSummary[key]) {
                        sprinklerSummary[key] = {
                            sprinkler: zoneSprinkler,
                            quantity: 0,
                            zones: [],
                            totalCost: 0,
                        };
                    }
                    sprinklerSummary[key].quantity += sprinklerQuantity;
                    sprinklerSummary[key].zones.push(getZoneName(zoneId));
                    sprinklerSummary[key].totalCost += sprinklerCost;
                }

                if (zoneInput) {
                    let sprinklerCount = 0;

                    if (
                        projectMode === 'field-crop' &&
                        fieldCropData?.zoneSummaries &&
                        (fieldCropData.zoneSummaries[zoneId] ?? fieldCropData.zoneSummaries[zone.id])
                    ) {
                        const zoneSummary = fieldCropData.zoneSummaries[zoneId] ?? fieldCropData.zoneSummaries[zone.id];
                        if (
                            zoneSummary.totalIrrigationPoints &&
                            zoneSummary.totalIrrigationPoints > 0
                        ) {
                            sprinklerCount = zoneSummary.totalIrrigationPoints;
                        } else if (zoneSummary.sprinklerCount && zoneSummary.sprinklerCount > 0) {
                            sprinklerCount = zoneSummary.sprinklerCount;
                        }
                    }

                    if (sprinklerCount === 0) {
                        sprinklerCount =
                            zoneInput?.totalTrees ||
                            zone.sprinklerCount ||
                            Math.ceil((zone.totalPlantingPoints || 100) / 10);
                    }
                    processExtraPipe(zoneId, zoneInput, sprinklerCount);

                    // field-crop: ใช้เฉพาะท่อที่ผู้ใช้เลือก (ไม่ fallback autoSelected*) รวมความยาวทุกโซนแล้ว ceil ครั้งเดียว
                    const branchPipe = zonePipes.branch;
                    const totalBranchM = Number(zoneInput.totalBranchPipeM) || 0;
                    if (branchPipe && totalBranchM > 0) {
                        const key = getPipeKey(branchPipe);
                        if (!pipeSummary.branch[key]) {
                            pipeSummary.branch[key] = {
                                pipe: branchPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.branch[key].totalLength += totalBranchM;
                        pipeSummary.branch[key].zones.push(getZoneName(zoneId));
                    }

                    const secondaryPipe = zonePipes.secondary;
                    const totalSecondaryM = Number(zoneInput.totalSecondaryPipeM) || 0;
                    if (secondaryPipe && totalSecondaryM > 0) {
                        const key = getPipeKey(secondaryPipe);
                        if (!pipeSummary.secondary[key]) {
                            pipeSummary.secondary[key] = {
                                pipe: secondaryPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.secondary[key].totalLength += totalSecondaryM;
                        pipeSummary.secondary[key].zones.push(getZoneName(zoneId));
                    }

                    const mainPipe = zonePipes.main;
                    const totalMainM = Number(zoneInput.totalMainPipeM) || 0;
                    if (mainPipe && totalMainM > 0) {
                        const key = getPipeKey(mainPipe);
                        if (!pipeSummary.main[key]) {
                            pipeSummary.main[key] = {
                                pipe: mainPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.main[key].totalLength += totalMainM;
                        pipeSummary.main[key].zones.push(getZoneName(zoneId));
                    }

                    const emitterPipe = zonePipes.emitter;
                    const totalEmitterM = Number(zoneInput.totalEmitterPipeM) || 0;
                    if (emitterPipe && totalEmitterM > 0) {
                        const key = getPipeKey(emitterPipe);
                        if (!pipeSummary.emitter[key]) {
                            pipeSummary.emitter[key] = {
                                pipe: emitterPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.emitter[key].totalLength += totalEmitterM;
                        pipeSummary.emitter[key].zones.push(getZoneName(zoneId));
                    }
                }
            });
        } else if (projectMode === 'greenhouse' && greenhouseData) {
            greenhouseData.summary.plotStats.forEach((plot: any) => {
                const zoneSprinkler = zoneSprinklers[plot.plotId];
                const zonePipes = selectedPipes[plot.plotId] || {};
                const zoneInput = zoneInputs[plot.plotId];

                if (zoneSprinkler) {
                    const sprinklerQuantity =
                        plot.equipmentCount.sprinklers || plot.production.totalPlants || 100;
                    const sprinklerCost = zoneSprinkler.price * sprinklerQuantity;
                    totalSprinklerCost += sprinklerCost;

                    const key = `${zoneSprinkler.id}`;
                    if (!sprinklerSummary[key]) {
                        sprinklerSummary[key] = {
                            sprinkler: zoneSprinkler,
                            quantity: 0,
                            zones: [],
                            totalCost: 0,
                        };
                    }
                    sprinklerSummary[key].quantity += sprinklerQuantity;
                    sprinklerSummary[key].zones.push(getZoneName(plot.plotId));
                    sprinklerSummary[key].totalCost += sprinklerCost;
                }

                if (zoneInput) {
                    const sprinklerCount =
                        plot.equipmentCount.sprinklers || plot.production.totalPlants || 100;
                    processExtraPipe(plot.plotId, zoneInput, sprinklerCount);

                    // ✅ ใช้เฉพาะท่อที่เลือกไว้สำหรับโซนนี้เท่านั้น (ไม่ใช้ fallback จาก results.autoSelected*)
                    const branchPipe = zonePipes.branch;
                    if (branchPipe && zoneInput.totalBranchPipeM > 0) {
                        const key = getPipeKey(branchPipe);
                        if (!pipeSummary.branch[key]) {
                            pipeSummary.branch[key] = {
                                pipe: branchPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.branch[key].totalLength += zoneInput.totalBranchPipeM;
                        pipeSummary.branch[key].zones.push(getZoneName(plot.plotId));
                    }

                    const secondaryPipe = zonePipes.secondary;
                    if (secondaryPipe && zoneInput.totalSecondaryPipeM > 0) {
                        const key = getPipeKey(secondaryPipe);
                        if (!pipeSummary.secondary[key]) {
                            pipeSummary.secondary[key] = {
                                pipe: secondaryPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.secondary[key].totalLength += zoneInput.totalSecondaryPipeM;
                        pipeSummary.secondary[key].zones.push(getZoneName(plot.plotId));
                    }

                    const mainPipe = zonePipes.main;
                    if (mainPipe && zoneInput.totalMainPipeM > 0) {
                        const key = getPipeKey(mainPipe);
                        if (!pipeSummary.main[key]) {
                            pipeSummary.main[key] = {
                                pipe: mainPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.main[key].totalLength += zoneInput.totalMainPipeM;
                        pipeSummary.main[key].zones.push(getZoneName(plot.plotId));
                    }

                    const emitterPipe = zonePipes.emitter;
                    if (
                        emitterPipe &&
                        zoneInput.totalEmitterPipeM &&
                        zoneInput.totalEmitterPipeM > 0
                    ) {
                        const key = getPipeKey(emitterPipe);
                        if (!pipeSummary.emitter[key]) {
                            pipeSummary.emitter[key] = {
                                pipe: emitterPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.emitter[key].totalLength += zoneInput.totalEmitterPipeM;
                        pipeSummary.emitter[key].zones.push(getZoneName(plot.plotId));
                    }
                }
            });
        } else if (
            projectMode === 'horticulture' ||
            (projectData?.useZones && projectData.zones.length > 1) ||
            Object.keys(zoneInputs).length > 1 ||
            Object.keys(zoneSprinklers).length > 1
        ) {
            // โหมด horticulture: ใช้ zone ids จาก zoneInputs/zoneSprinklers/selectedPipes เพื่อให้
            // เปิดจากโฟลเดอร์ (โหลดจาก DB) แสดงท่อ/สปริงเกอร์ทุกโซนที่บันทึกไว้โดยไม่ต้องเปิดแต่ละโซน
            const allZoneIds =
                projectMode === 'horticulture'
                    ? Array.from(
                          new Set([
                              ...Object.keys(zoneInputs),
                              ...Object.keys(zoneSprinklers),
                              ...Object.keys(selectedPipes),
                          ])
                      ).filter((id) => id && id !== 'unknown')
                    : (projectData?.useZones && projectData.zones.length > 1
                          ? projectData.zones.map((z: any) => z.id)
                          : Object.keys(zoneInputs).length > 0
                            ? Object.keys(zoneInputs)
                            : Object.keys(zoneSprinklers));

            const zonesToProcess =
                projectMode === 'horticulture'
                    ? allZoneIds.map((zoneId) => ({
                          id: zoneId,
                          plantCount:
                              zoneInputs[zoneId]?.totalTrees ??
                              (projectData?.zones as any[])?.find((z: any) => z.id === zoneId)?.plantCount ??
                              (projectData?.zones as any[])?.find((z: any) => z.id === zoneId)?.plants?.length ??
                              0,
                      }))
                    : (projectData?.useZones && projectData.zones.length > 1
                          ? projectData.zones
                          : allZoneIds.map((zoneId) => ({
                                id: zoneId,
                                plantCount: zoneInputs[zoneId]?.totalTrees || 0,
                            })));

            // โหมด horticulture ออกแบบครั้งแรก: ใช้ results.autoSelected* เป็น fallback เมื่อโซนยังไม่ได้เลือกท่อ
            const effectiveBranchPipe = (zonePipes: typeof selectedPipes[string]) =>
                zonePipes?.branch ?? results.autoSelectedBranchPipe;
            const effectiveSecondaryPipe = (zonePipes: typeof selectedPipes[string]) =>
                zonePipes?.secondary ?? results.autoSelectedSecondaryPipe;
            const effectiveMainPipe = (zonePipes: typeof selectedPipes[string]) =>
                zonePipes?.main ?? results.autoSelectedMainPipe;
            const effectiveEmitterPipe = (zonePipes: typeof selectedPipes[string]) =>
                zonePipes?.emitter ?? results.autoSelectedEmitterPipe;

            zonesToProcess.forEach((zone: any) => {
                const zoneSprinkler = zoneSprinklers[zone.id];
                const zonePipes = selectedPipes[zone.id] || {};
                const zoneInput = zoneInputs[zone.id];

                if (zoneSprinkler) {
                    // ใช้ zoneInput.totalTrees ถ้ามี ถ้าไม่มีให้ใช้ zone.plantCount
                    let sprinklerQuantity = zoneInput?.totalTrees || zone.plantCount || 0;
                    if (projectMode === 'horticulture') {
                        const config = loadSprinklerConfig();
                        const sprinklersPerTree = config?.sprinklersPerTree || 1;
                        sprinklerQuantity = sprinklerQuantity * sprinklersPerTree;
                    }
                    const sprinklerCost = zoneSprinkler.price * sprinklerQuantity;
                    totalSprinklerCost += sprinklerCost;

                    const key = `${zoneSprinkler.id}`;
                    if (!sprinklerSummary[key]) {
                        sprinklerSummary[key] = {
                            sprinkler: zoneSprinkler,
                            quantity: 0,
                            zones: [],
                            totalCost: 0,
                        };
                    }
                    sprinklerSummary[key].quantity += sprinklerQuantity;
                    sprinklerSummary[key].zones.push(getZoneName(zone.id));
                    sprinklerSummary[key].totalCost += sprinklerCost;
                } else if (projectMode === 'horticulture' && zoneInput && (zoneInput.totalTrees ?? zone.plantCount) > 0) {
                    // ออกแบบครั้งแรก: โซนมี zoneInput แต่ยังไม่มี zoneSprinkler ให้รวมจำนวนต้นไว้ (จะแสดงใน totalSprinklers ผ่าน results)
                    // ไม่เพิ่ม cost เพราะยังไม่มีสินค้าสปริงเกอร์ที่เลือก
                }

                if (zoneInput) {
                    // ใช้ zoneInput.totalTrees ถ้ามี ถ้าไม่มีให้ใช้ zone.plantCount
                    let sprinklerCount = zoneInput.totalTrees || zone.plantCount || 0;
                    if (projectMode === 'horticulture') {
                        const config = loadSprinklerConfig();
                        const sprinklersPerTree = config?.sprinklersPerTree || 1;
                        sprinklerCount = sprinklerCount * sprinklersPerTree;
                    }
                    processExtraPipe(zone.id, zoneInput, sprinklerCount);

                    // โหมด horticulture ออกแบบครั้งแรก: ใช้ท่อที่เลือกหรือ fallback เป็น results.autoSelected* เพื่อให้รายการครบทุกโซน
                    const branchPipe = projectMode === 'horticulture' ? effectiveBranchPipe(zonePipes) : zonePipes.branch;
                    const totalBranchM = Number(zoneInput.totalBranchPipeM) || 0;
                    if (branchPipe && totalBranchM > 0) {
                        const key = getPipeKey(branchPipe);
                        if (!pipeSummary.branch[key]) {
                            pipeSummary.branch[key] = {
                                pipe: branchPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.branch[key].totalLength += totalBranchM;
                        pipeSummary.branch[key].zones.push(getZoneName(zone.id));
                    }

                    const secondaryPipe = projectMode === 'horticulture' ? effectiveSecondaryPipe(zonePipes) : zonePipes.secondary;
                    const totalSecondaryM = Number(zoneInput.totalSecondaryPipeM) || 0;
                    if (secondaryPipe && totalSecondaryM > 0) {
                        const key = getPipeKey(secondaryPipe);
                        if (!pipeSummary.secondary[key]) {
                            pipeSummary.secondary[key] = {
                                pipe: secondaryPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.secondary[key].totalLength += totalSecondaryM;
                        pipeSummary.secondary[key].zones.push(getZoneName(zone.id));
                    }

                    const mainPipe = projectMode === 'horticulture' ? effectiveMainPipe(zonePipes) : zonePipes.main;
                    const totalMainM = Number(zoneInput.totalMainPipeM) || 0;
                    if (mainPipe && totalMainM > 0) {
                        const key = getPipeKey(mainPipe);
                        if (!pipeSummary.main[key]) {
                            pipeSummary.main[key] = {
                                pipe: mainPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.main[key].totalLength += totalMainM;
                        pipeSummary.main[key].zones.push(getZoneName(zone.id));
                    }

                    const emitterPipe = projectMode === 'horticulture' ? effectiveEmitterPipe(zonePipes) : zonePipes.emitter;
                    const totalEmitterM = Number(zoneInput.totalEmitterPipeM) || 0;
                    if (emitterPipe && totalEmitterM > 0) {
                        const key = getPipeKey(emitterPipe);
                        if (!pipeSummary.emitter[key]) {
                            pipeSummary.emitter[key] = {
                                pipe: emitterPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.emitter[key].totalLength += totalEmitterM;
                        pipeSummary.emitter[key].zones.push(getZoneName(zone.id));
                    }
                }
            });
        } else {
            Object.keys(zoneInputs).forEach((zoneId) => {
                const zoneSprinkler = zoneSprinklers[zoneId];
                const zonePipes = selectedPipes[zoneId] || {};
                const zoneInput = zoneInputs[zoneId];

                if (zoneSprinkler && zoneInput) {
                    const sprinklerQuantity = zoneInput.totalTrees || results.totalSprinklers || 0;
                    const sprinklerCost = zoneSprinkler.price * sprinklerQuantity;
                    totalSprinklerCost += sprinklerCost;

                    const key = `${zoneSprinkler.id}`;
                    if (!sprinklerSummary[key]) {
                        sprinklerSummary[key] = {
                            sprinkler: zoneSprinkler,
                            quantity: 0,
                            zones: [],
                            totalCost: 0,
                        };
                    }
                    sprinklerSummary[key].quantity += sprinklerQuantity;
                    sprinklerSummary[key].zones.push(getZoneName(zoneId));
                    sprinklerSummary[key].totalCost += sprinklerCost;
                }

                if (zoneInput) {
                    const sprinklerCount = zoneInput.totalTrees || results.totalSprinklers || 0;
                    processExtraPipe(zoneId, zoneInput, sprinklerCount);

                    // ใช้ท่อที่เลือกหรือ fallback เป็น results.autoSelected* เพื่อให้ท่อไม่หายเมื่อโซนยังไม่มี selection
                    const branchPipe = zonePipes.branch ?? results.autoSelectedBranchPipe;
                    const totalBranchM = Number(zoneInput.totalBranchPipeM) || 0;
                    if (branchPipe && totalBranchM > 0) {
                        const key = getPipeKey(branchPipe);
                        if (!pipeSummary.branch[key]) {
                            pipeSummary.branch[key] = {
                                pipe: branchPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.branch[key].totalLength += totalBranchM;
                        pipeSummary.branch[key].zones.push(getZoneName(zoneId));
                    }

                    const secondaryPipe = zonePipes.secondary ?? results.autoSelectedSecondaryPipe;
                    const totalSecondaryM = Number(zoneInput.totalSecondaryPipeM) || 0;
                    if (secondaryPipe && totalSecondaryM > 0) {
                        const key = getPipeKey(secondaryPipe);
                        if (!pipeSummary.secondary[key]) {
                            pipeSummary.secondary[key] = {
                                pipe: secondaryPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.secondary[key].totalLength += totalSecondaryM;
                        pipeSummary.secondary[key].zones.push(getZoneName(zoneId));
                    }

                    const mainPipe = zonePipes.main ?? results.autoSelectedMainPipe;
                    const totalMainM = Number(zoneInput.totalMainPipeM) || 0;
                    if (mainPipe && totalMainM > 0) {
                        const key = getPipeKey(mainPipe);
                        if (!pipeSummary.main[key]) {
                            pipeSummary.main[key] = {
                                pipe: mainPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.main[key].totalLength += totalMainM;
                        pipeSummary.main[key].zones.push(getZoneName(zoneId));
                    }

                    const emitterPipe = zonePipes.emitter ?? results.autoSelectedEmitterPipe;
                    const totalEmitterM = Number(zoneInput.totalEmitterPipeM) || 0;
                    if (emitterPipe && totalEmitterM > 0) {
                        const key = getPipeKey(emitterPipe);
                        if (!pipeSummary.emitter[key]) {
                            pipeSummary.emitter[key] = {
                                pipe: emitterPipe,
                                totalLength: 0,
                                quantity: 0,
                                zones: [],
                                totalCost: 0,
                            };
                        }
                        pipeSummary.emitter[key].totalLength += totalEmitterM;
                        pipeSummary.emitter[key].zones.push(getZoneName(zoneId));
                    }
                }
            });
        }

        const setPipeQuantityAndCost = (item: { pipe: any; totalLength: number; extraLength?: number; quantity: number; totalCost: number }) => {
            const totalLength = item.totalLength + (item.extraLength || 0);
            const lenM = getPipeLengthM(item.pipe);
            const price = getPipePrice(item.pipe);
            if (lenM <= 0) {
                item.quantity = 0;
                item.totalCost = 0;
                return 0;
            }
            item.quantity = calculatePipeRolls(totalLength, lenM);
            item.totalCost = price * item.quantity;
            return item.totalCost;
        };

        Object.values(pipeSummary.branch).forEach((item) => {
            totalBranchPipeCost += setPipeQuantityAndCost(item);
        });

        Object.values(pipeSummary.secondary).forEach((item) => {
            totalSecondaryPipeCost += setPipeQuantityAndCost(item);
        });

        Object.values(pipeSummary.main).forEach((item) => {
            totalMainPipeCost += setPipeQuantityAndCost(item);
        });

        Object.values(pipeSummary.emitter).forEach((item) => {
            totalEmitterPipeCost += setPipeQuantityAndCost(item);
        });

        let extraPipeCost = 0;
        if (extraPipeSummary) {
            const lenM = getPipeLengthM(extraPipeSummary.pipe);
            if (lenM > 0) {
                extraPipeSummary.quantity = calculatePipeRolls(
                    extraPipeSummary.totalLength,
                    lenM
                );
                extraPipeSummary.totalCost = getPipePrice(extraPipeSummary.pipe) * extraPipeSummary.quantity;
            } else {
                extraPipeSummary.quantity = 0;
                extraPipeSummary.totalCost = 0;
            }
            extraPipeCost = extraPipeSummary.totalCost;
        }

        if (
            (!projectData?.useZones || projectData.zones.length === 1) &&
            (!gardenStats || gardenStats.zones.length === 1) &&
            (!fieldCropData || fieldCropData.zones.info.length === 1) &&
            (!greenhouseData || greenhouseData.summary.plotStats.length === 1)
        ) {
            totalBranchPipeCost = 0;
            totalSecondaryPipeCost = 0;
            totalMainPipeCost = 0;
            totalEmitterPipeCost = 0;

            Object.values(pipeSummary.branch).forEach((item) => {
                totalBranchPipeCost += setPipeQuantityAndCost(item);
            });

            Object.values(pipeSummary.secondary).forEach((item) => {
                totalSecondaryPipeCost += setPipeQuantityAndCost(item);
            });

            Object.values(pipeSummary.main).forEach((item) => {
                totalMainPipeCost += setPipeQuantityAndCost(item);
            });

            Object.values(pipeSummary.emitter).forEach((item) => {
                totalEmitterPipeCost += setPipeQuantityAndCost(item);
            });
        }

        let pumpCost = 0;
        let pumpAccessoriesCost = 0;
        if (showPump) {
            const effectivePump = selectedPump || results.autoSelectedPump;
            
            if (effectivePump) {
                pumpCost = effectivePump.price || 0;

                if (effectivePump.pumpAccessories && effectivePump.pumpAccessories.length > 0) {
                    // ดึง selectedGroupId จาก localStorage (เหมือนกับ QuotationDocument.tsx)
                    const getStoredSelectedGroupId = (pumpId: number | undefined): number | string | null => {
                        if (!pumpId) return null;
                        try {
                            const stored = localStorage.getItem(`pump_${pumpId}_selectedGroupId`);
                            return stored ? (isNaN(Number(stored)) ? stored : Number(stored)) : null;
                        } catch {
                            return null;
                        }
                    };
                    
                    // ดึง selectedGroupId จาก localStorage
                    const selectedGroupId = getStoredSelectedGroupId(effectivePump.id);
                    
                    // ไม่กรอง is_included ที่นี่ เพราะต้องดูที่ group_items ข้างใน (เหมือน QuotationDocument)
                    pumpAccessoriesCost = effectivePump.pumpAccessories
                        .reduce((sum: number, accessory: any) => {
                            // ถ้าเป็นกลุ่ม (มี group_id และ group_items) ให้คำนวณจากรายการอุปกรณ์ในกลุ่ม
                            if (accessory.group_id && accessory.group_items && accessory.group_items.length > 0) {
                                // กรองเฉพาะกลุ่มที่เลือก (ถ้ามี selectedGroupId) หรือรวมทุกกลุ่ม (ถ้าไม่มี selectedGroupId)
                                if (selectedGroupId && accessory.group_id !== selectedGroupId) {
                                    return sum; // ข้ามกลุ่มที่ไม่ใช่กลุ่มที่เลือก
                                }
                                
                                // สำหรับกลุ่ม ให้คำนวณจาก group_items โดยดูที่แต่ละ item (เหมือน QuotationDocument)
                                const groupItemsCost = accessory.group_items.reduce((itemSum: number, item: any) => {
                                    const itemPrice = Number(item.unit_price || item.total_price || item.equipment?.price || 0);
                                    const itemQuantity = Number(item.quantity || 1);
                                    
                                    // แสดงเฉพาะรายการที่มีราคา > 0 หรือไม่ใช่ is_included (เหมือน QuotationDocument)
                                    if (itemPrice > 0 || !accessory.is_included) {
                                        return itemSum + (itemPrice * itemQuantity);
                                    }
                                    return itemSum;
                                }, 0);
                                
                                return sum + groupItemsCost;
                            } else {
                                // ถ้าเป็นอุปกรณ์เดี่ยว ให้เช็ค is_included ที่นี่
                                if (!accessory.is_included || (accessory.price && accessory.price > 0)) {
                                    const price = Number(accessory.price) || 0;
                                    const quantity = Number(accessory.quantity) || 1;
                                    return sum + (price * quantity);
                                }
                                return sum;
                            }
                        }, 0);
                }
            }
        }
        let sprinklerEquipmentSetsCost = 0;
        
        if (sprinklerEquipmentSets && Object.keys(sprinklerEquipmentSets).length > 0) {
            Object.entries(sprinklerEquipmentSets).forEach(([zoneId, equipmentSet]: [string, any]) => {
                // ตรวจสอบว่า equipmentSet มี selectedItems หรือ groups จริงๆ หรือไม่ (เหมือน QuotationDocument.tsx)
                if (!equipmentSet) {
                    return; // ข้ามถ้าไม่มีข้อมูล
                }
                
                // ตรวจสอบว่ามี selectedGroupId (ต้องไม่เป็น null หรือไม่มี)
                if (!equipmentSet.selectedGroupId || equipmentSet.selectedGroupId === null || equipmentSet.selectedGroupId === '') {
                    return; // ข้ามถ้าไม่ได้เลือกกลุ่ม
                }
                
                // ตรวจสอบว่ามี selectedItems และมีความยาว > 0 (เหมือน QuotationDocument.tsx)
                const hasValidSelectedItems = equipmentSet.selectedItems && Array.isArray(equipmentSet.selectedItems) && equipmentSet.selectedItems.length > 0;
                
                // ตรวจสอบว่ามี groups และมีความยาว > 0
                const hasValidGroups = equipmentSet.groups && Array.isArray(equipmentSet.groups) && equipmentSet.groups.length > 0;
                
                // ถ้าไม่มีทั้ง selectedItems และ groups ที่ valid ให้ข้าม
                if (!hasValidSelectedItems && !hasValidGroups) {
                    return;
                }
                
                // หาจำนวนสปริงเกอร์ของโซนนี้
                let totalSprinklers = 0;
                
                if (projectMode === 'garden' && gardenStats) {
                    const zone = gardenStats.zones.find((z: any) => z.zoneId === zoneId);
                    if (zone) {
                        // ⚠️ ใช้ zone.zoneId จริงๆ ไม่ใช้ hardcoded 'main-area'
                        const effectiveZoneId = zoneId;
                        const zoneInput = zoneInputs[effectiveZoneId];
                        totalSprinklers = zoneInput?.totalTrees || zone.sprinklerCount || 0;
                    }
                } else if (projectMode === 'field-crop' && fieldCropData) {
                    const zone = fieldCropData.zones?.info?.find((z: any) => String(z.id) === String(zoneId));
                    if (zone) {
                        const zoneSummary = fieldCropData.zoneSummaries?.[String(zoneId)] ?? fieldCropData.zoneSummaries?.[zoneId];
                        if (zoneSummary?.totalIrrigationPoints && zoneSummary.totalIrrigationPoints > 0) {
                            totalSprinklers = zoneSummary.totalIrrigationPoints;
                        } else if (zoneSummary?.sprinklerCount && zoneSummary.sprinklerCount > 0) {
                            totalSprinklers = zoneSummary.sprinklerCount;
                        } else {
                            const zoneInput = zoneInputs[String(zoneId)] ?? zoneInputs[zoneId];
                            totalSprinklers = zoneInput?.totalTrees || zone.sprinklerCount || 0;
                        }
                    }
                } else if (projectMode === 'greenhouse' && greenhouseData) {
                    const plot = greenhouseData.summary?.plotStats?.find((p: any) => p.plotId === zoneId);
                    if (plot) {
                        totalSprinklers = plot.equipmentCount?.sprinklers || plot.production?.totalPlants || 0;
                    }
                } else {
                    // horticulture mode
                    const zoneInput = zoneInputs[zoneId];
                    if (zoneInput) {
                        totalSprinklers = zoneInput.totalTrees || 0;
                        if (projectMode === 'horticulture') {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            totalSprinklers = totalSprinklers * sprinklersPerTree;
                        }
                    } else {
                        // Fallback: ใช้ results.totalSprinklers
                        totalSprinklers = results.totalSprinklers || 0;
                        if (projectMode === 'horticulture') {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            totalSprinklers = totalSprinklers * sprinklersPerTree;
                        }
                    }
                }

                if (equipmentSet.selectedItems) {
                    equipmentSet.selectedItems.forEach((item: any) => {
                        // ตรวจสอบว่า item.equipment มีจริงๆ หรือไม่ (เหมือน QuotationDocument.tsx)
                        if (item.equipment) {
                            // กรอง pipe ออก เพราะ pipe ถูกนับใน pipeSummary หรือ extraPipeSummary แล้ว
                            const categoryName = item.equipment.category?.name?.toLowerCase();
                            const isPipe = categoryName === 'pipe' || categoryName?.includes('pipe');
                            
                            if (!isPipe) {
                                // item.quantity เป็น quantity per head ต้องคูณกับจำนวนสปริงเกอร์
                                const quantityPerHead = item.quantity || 0;
                                const totalQuantity = quantityPerHead * totalSprinklers;
                                
                                // ตรวจสอบว่า totalQuantity > 0 (เหมือน QuotationDocument.tsx)
                                if (totalQuantity > 0) {
                                    const itemCost =
                                        (item.unit_price || item.equipment?.price || 0) * totalQuantity;
                                    sprinklerEquipmentSetsCost += itemCost;
                                }
                            }
                        }
                    });
                } else if (equipmentSet.groups) {
                    const selectedGroupId = equipmentSet.selectedGroupId;
                    equipmentSet.groups.forEach((group: any) => {
                        if (selectedGroupId != null && selectedGroupId !== '' && group.group_id != null && group.group_id !== selectedGroupId) return;
                        if (group.items) {
                            group.items.forEach((item: any) => {
                                // ตรวจสอบว่า item.equipment มีจริงๆ หรือไม่ (เหมือน QuotationDocument.tsx)
                                if (item.equipment) {
                                    // กรอง pipe ออก เพราะ pipe ถูกนับใน pipeSummary หรือ extraPipeSummary แล้ว
                                    const categoryName = item.equipment.category?.name?.toLowerCase();
                                    const isPipe = categoryName === 'pipe' || categoryName?.includes('pipe');
                                    
                                    if (!isPipe) {
                                        // item.quantity เป็น quantity per head ต้องคูณกับจำนวนสปริงเกอร์
                                        const quantityPerHead = item.quantity || 0;
                                        const totalQuantity = quantityPerHead * totalSprinklers;
                                        
                                        // ตรวจสอบว่า totalQuantity > 0 (เหมือน QuotationDocument.tsx)
                                        if (totalQuantity > 0) {
                                            sprinklerEquipmentSetsCost +=
                                                (item.unit_price || item.equipment?.price || 0) * totalQuantity;
                                        }
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }

        let connectionEquipmentsCost = 0;
        if (connectionEquipments && Object.keys(connectionEquipments).length > 0) {
            Object.values(connectionEquipments).forEach((equipments: any[]) => {
                if (equipments && equipments.length > 0) {
                    equipments.forEach((equipment: any) => {
                        // ตรวจสอบว่า equipment.equipment และ equipment.count > 0 (เหมือน QuotationDocument.tsx)
                        if (equipment.equipment && equipment.count > 0) {
                            connectionEquipmentsCost +=
                                (equipment.equipment?.price || 0) * (equipment.count || 0);
                        }
                    });
                }
            });
        }

        // โหมด garden: ราคาข้อต่อจาก GardenConnectorEquipmentsSelector (localStorage)
        const GARDEN_CONNECTOR_STORAGE_KEY = 'gardenConnectorEquipmentSelections';
        if (projectMode === 'garden' && gardenStats?.summary?.connectorSummary) {
            const summary = gardenStats.summary.connectorSummary;
            const byWays = summary.byWays || {};
            const straightCouplers = summary.straightCouplers ?? 0;
            try {
                const saved = localStorage.getItem(GARDEN_CONNECTOR_STORAGE_KEY);
                const selections = saved ? JSON.parse(saved) : {};
                Object.entries(byWays).forEach(([ways, count]) => {
                    if (Number(count) <= 0) return;
                    const key = `way-${ways}`;
                    const sel = selections[key];
                    const equipment = sel?.equipment;
                    const price = equipment?.price ?? equipment?.price_per_unit ?? 0;
                    connectionEquipmentsCost += (Number(price) || 0) * Number(count);
                });
                if (straightCouplers > 0) {
                    const sel = selections['straight'];
                    const equipment = sel?.equipment;
                    const price = equipment?.price ?? equipment?.price_per_unit ?? 0;
                    connectionEquipmentsCost += (Number(price) || 0) * straightCouplers;
                }
            } catch (_) {
                /* ignore */
            }
        }

        const totalCost =
            totalSprinklerCost +
            totalBranchPipeCost +
            totalSecondaryPipeCost +
            totalMainPipeCost +
            totalEmitterPipeCost +
            extraPipeCost +
            pumpCost +
            pumpAccessoriesCost +
            sprinklerEquipmentSetsCost +
            connectionEquipmentsCost;

        return {
            totalSprinklerCost,
            totalBranchPipeCost,
            totalSecondaryPipeCost,
            totalMainPipeCost,
            totalEmitterPipeCost,
            pumpCost,
            pumpAccessoriesCost,
            totalCost,
            sprinklerSummary,
            pipeSummary,
            extraPipeSummary,
            extraPipeCost,
            sprinklerEquipmentSetsCost,
            connectionEquipmentsCost,
        };
    };

    const costs = calculateTotalCosts();
    const effectivePump = selectedPump || results.autoSelectedPump;

    // ✅ บันทึก totalCost ลง localStorage สำหรับใช้ตอนบันทึกโครงการ
    React.useEffect(() => {
        if (costs.totalCost) {
            localStorage.setItem('calculatedTotalCost', costs.totalCost.toString());
        }
        if (typeof window !== 'undefined' && localStorage.getItem('DEBUG_PRICE_COMPARE') === '1') {
            console.log('[PriceCompare] CostSummary total', { totalCost: costs.totalCost.toFixed(2) });
            const breakdown = {
                totalSprinklerCost: costs.totalSprinklerCost,
                totalBranchPipeCost: costs.totalBranchPipeCost,
                totalSecondaryPipeCost: costs.totalSecondaryPipeCost,
                totalMainPipeCost: costs.totalMainPipeCost,
                totalEmitterPipeCost: costs.totalEmitterPipeCost,
                extraPipeCost: costs.extraPipeCost,
                pumpCost: costs.pumpCost,
                pumpAccessoriesCost: costs.pumpAccessoriesCost,
                sprinklerEquipmentSetsCost: costs.sprinklerEquipmentSetsCost,
                connectionEquipmentsCost: costs.connectionEquipmentsCost,
            };
            localStorage.setItem('DEBUG_COST_BREAKDOWN', JSON.stringify(breakdown));
        }
    }, [costs.totalCost]);

    const getSelectionStatus = (equipment: any, type: string, isAuto: boolean) => {
        if (!equipment) return `❌ ${t('ไม่มี')}${type}`;

        if (isAuto) {
            if (equipment.isRecommended) return `🤖⭐ ${type} ${t('ที่แนะนำ')} (อัตโนมัติ)`;
            if (equipment.isGoodChoice) return `🤖✅ ${type} ${t('ตัวเลือกดี')} (อัตโนมัติ)`;
            if (equipment.isUsable) return `🤖⚡ ${type} ${t('ใช้ได้')} (อัตโนมัติ)`;
            return `🤖⚠️ ${type} ${t('ที่ดีที่สุดที่มี')} (อัตโนมัติ)`;
        } else {
            return `👤 ${type} ${t('ที่เลือกเอง')}`;
        }
    };

    const uniqueSprinklers = Object.keys(costs.sprinklerSummary).length;
    const uniqueBranchPipes = Object.keys(costs.pipeSummary.branch).length;
    const uniqueSecondaryPipes = Object.keys(costs.pipeSummary.secondary).length;
    const uniqueMainPipes = Object.keys(costs.pipeSummary.main).length;
    const uniqueEmitterPipes = Object.keys(costs.pipeSummary.emitter).length;

    const totalPipeRolls =
        Object.values(costs.pipeSummary.branch).reduce((sum, item) => sum + item.quantity, 0) +
        Object.values(costs.pipeSummary.secondary).reduce((sum, item) => sum + item.quantity, 0) +
        Object.values(costs.pipeSummary.main).reduce((sum, item) => sum + item.quantity, 0) +
        Object.values(costs.pipeSummary.emitter).reduce((sum, item) => sum + item.quantity, 0) +
        ((costs as any).extraPipeSummary?.quantity || 0);

    const totalSprinklerHeads = Object.values(costs.sprinklerSummary).reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    const systemMode = (() => {
        if (projectMode === 'horticulture' && projectData?.useZones && projectData.zones.length > 1)
            return t('หลายโซน');
        if (projectMode === 'garden' && gardenStats && gardenStats.zones.length > 1)
            return t('หลายโซน');
        if (projectMode === 'field-crop' && fieldCropData && fieldCropData.zones.info.length > 1)
            return t('หลายโซน');
        if (
            projectMode === 'greenhouse' &&
            greenhouseData &&
            greenhouseData.summary.plotStats.length > 1
        )
            return t('หลายโซน');
        return t('โซนเดียว');
    })();

    const getTotalArea = () => {
        if (projectMode === 'garden' && gardenStats) {
            return gardenStats.summary.totalArea / 1600;
        }
        if (projectMode === 'field-crop' && fieldCropData) {
            return fieldCropData.area.sizeInRai;
        }
        if (projectMode === 'greenhouse' && greenhouseData) {
            return greenhouseData.summary.totalPlotArea;
        }
        return projectData?.totalArea ? projectData.totalArea / 1600 : 0;
    };

    const getTotalZones = () => {
        if (projectMode === 'garden' && gardenStats) return gardenStats.zones.length;
        if (projectMode === 'field-crop' && fieldCropData) return fieldCropData.zones.info.length;
        if (projectMode === 'greenhouse' && greenhouseData)
            return greenhouseData.summary.plotStats.length;
        return projectData?.zones.length || 0;
    };

    const totalArea = getTotalArea();
    const totalZones = getTotalZones();

    const getProjectSummary = () => {
        if (projectMode === 'field-crop') {
            const fcData = fieldCropData || getEnhancedFieldCropData();
            if (fcData) {
                let totalWaterNeed = fcData.summary?.totalWaterRequirementPerDay || 0;
                try {
                    const fieldCropSystemDataStr = localStorage.getItem('fieldCropSystemData');
                    if (fieldCropSystemDataStr) {
                        const fieldCropSystemData = JSON.parse(fieldCropSystemDataStr);
                        if (fieldCropSystemData?.sprinklerConfig?.totalFlowRatePerMinute) {
                            totalWaterNeed =
                                fieldCropSystemData.sprinklerConfig.totalFlowRatePerMinute * 30;
                        }
                    }
                } catch (error) {
                    console.error('Error parsing fieldCropSystemData in getProjectSummary:', error);
                }

                let totalSprinklers = 0;
                let totalIrrigationPoints = 0;

                if (fcData.zoneSummaries) {
                    const sprinklerCounts = Object.values(fcData.zoneSummaries).map(
                        (zoneSummary: any) => {
                            return (
                                zoneSummary.totalIrrigationPoints || zoneSummary.sprinklerCount || 0
                            );
                        }
                    );
                    totalSprinklers = sprinklerCounts.reduce((sum, count) => sum + count, 0);
                    totalIrrigationPoints = totalSprinklers;
                }

                if (totalSprinklers === 0) {
                    totalSprinklers = fcData.summary?.totalPlantingPoints || 0;
                    totalIrrigationPoints = fcData.irrigation?.totalCount || 0;
                }

                return {
                    totalWaterNeed: totalWaterNeed,
                    totalProduction: fcData.summary?.totalEstimatedYield || 0,
                    totalIncome: fcData.summary?.totalEstimatedIncome || 0,
                    totalSprinklers: totalSprinklers,
                    totalIrrigationPoints: totalIrrigationPoints,
                    irrigationByType: fcData.irrigation?.byType || {},
                    waterUnit: 'ลิตร/ครั้ง',
                    productionUnit: 'กก.',
                };
            }
        }

        if (projectMode === 'greenhouse' && greenhouseData) {
            return {
                totalWaterNeed:
                    greenhouseData.summary?.overallProduction?.waterRequirementPerIrrigation || 0,
                totalProduction: greenhouseData.summary?.overallProduction?.estimatedYield || 0,
                totalIncome: greenhouseData.summary?.overallProduction?.estimatedIncome || 0,
                totalSprinklers:
                    greenhouseData.summary?.overallEquipmentCount?.sprinklers ||
                    greenhouseData.summary?.overallProduction?.totalPlants ||
                    greenhouseData.summary?.plotStats?.reduce(
                        (sum, plot) => sum + (plot.production?.totalPlants || 0),
                        0
                    ) ||
                    0,
                waterUnit: 'ลิตร/ครั้ง',
                productionUnit: 'กก.',
            };
        }

        return null;
    };

    const projectSummary = getProjectSummary();

    return (
        <div className="rounded-lg bg-gray-700 p-6">
            <h2 className="mb-4 text-2xl font-bold text-yellow-400">
                💰 {t('สรุปอุปกรณ์ทั้งหมด')} {getProjectIcon()}
            </h2>

            {uniqueSprinklers > 0 && (
                <div className="mb-4 rounded bg-green-900 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-green-300">
                        💧 {t('รายละเอียดหัวฉีด')}
                    </h3>
                    <div className="space-y-2">
                        {Object.values(costs.sprinklerSummary)
                            .sort((a, b) => {
                                const zoneA = (a.zones[0] || '').toString().toLowerCase();
                                const zoneB = (b.zones[0] || '').toString().toLowerCase();
                                if (zoneA < zoneB) return -1;
                                if (zoneA > zoneB) return 1;
                                return 0;
                            })
                            .map((item, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between rounded bg-green-800 p-2"
                                >
                                    <div className="flex items-center space-x-3">
                                        {item.sprinkler.image ? (
                                            <img
                                                src={item.sprinkler.image}
                                                alt=""
                                                className="h-10 w-10"
                                            />
                                        ) : (
                                            <p className="flex h-10 w-10 items-center justify-center bg-gray-500 text-center align-middle text-xs text-gray-300">
                                                {t('ไม่มีรูป')}
                                            </p>
                                        )}
                                        <div className="text-sm">
                                            <p className="font-medium text-white">
                                                {item.sprinkler.name}
                                            </p>
                                            <p className="text-green-200">
                                                {item.sprinkler.productCode} |{' '}
                                                {Number(
                                                    (item.sprinkler.price || 0).toFixed(2)
                                                ).toLocaleString('th-TH')}{' '}
                                                {t('บาท')}/{t('หัว')}
                                            </p>
                                            <p className="text-xs text-green-300">
                                                {t('ใช้ในโซน:')} {formatZoneNames(item.zones)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right text-sm">
                                        <p className="text-green-200">
                                            {(item.quantity || 0).toLocaleString()} {t('หัว')}
                                        </p>
                                        <p className="font-bold text-white">
                                            {Number(
                                                (item.totalCost || 0).toFixed(2)
                                            ).toLocaleString('th-TH')}{' '}
                                            {t('บาท')}
                                        </p>
                                        <p className="text-xs text-green-300">
                                            {Number(
                                                (
                                                    (Number(item.totalCost) || 0) /
                                                    (Number(item.quantity) || 1)
                                                ).toFixed(2)
                                            ).toLocaleString('th-TH')}{' '}
                                            {t('บาท')}/{t('หัว')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {(uniqueBranchPipes > 0 ||
                uniqueSecondaryPipes > 0 ||
                uniqueMainPipes > 0 ||
                uniqueEmitterPipes > 0 ||
                (costs as any).extraPipeSummary) && (
                <div className="mb-4 rounded bg-purple-900 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-purple-300">
                        🔧 {t('รายละเอียดท่อ:')}
                    </h3>
                    <div className="space-y-3">
                        {uniqueBranchPipes > 0 && (
                            <div>
                                <h4 className="mb-1 text-xs font-medium text-purple-200">
                                    {t('ท่อย่อย')} ({uniqueBranchPipes} {t('ชนิด')}):
                                </h4>
                                <div className="space-y-1">
                                    {Object.values(costs.pipeSummary.branch).map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between rounded bg-purple-800 p-2"
                                        >
                                            <div className="flex items-center space-x-3">
                                                {item.pipe.image ? (
                                                    <img
                                                        src={item.pipe.image}
                                                        alt=""
                                                        className="h-10 w-10"
                                                    />
                                                ) : (
                                                    <p className="flex h-10 w-10 items-center justify-center bg-gray-500 text-center align-middle text-xs text-gray-300">
                                                        {t('ไม่มีรูป')}
                                                    </p>
                                                )}
                                                <div className="text-sm">
                                                    <p className="font-medium text-white">
                                                        {item.pipe.name || item.pipe.productCode} -{' '}
                                                        {item.pipe.sizeMM}mm
                                                        {item.includesExtra && (
                                                            <span className="ml-1 text-yellow-400">
                                                                +{t('Riser')}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-purple-200">
                                                        <span>
                                                            {item.zones.join(', ')}
                                                            <span className="mx-1 text-xs text-red-500">
                                                                |
                                                            </span>
                                                        </span>
                                                        {Number(
                                                            (getPipePrice(item.pipe)).toFixed(2)
                                                        ).toLocaleString('th-TH')}{' '}
                                                        {t('บาท/ม้วน')} ({getPipeLengthM(item.pipe)}{' '}
                                                        {t('ม./ม้วน')}){' '}
                                                        <span className="mx-1 text-xs text-red-500">
                                                            |
                                                        </span>{' '}
                                                        {t('รวมความยาว:')}{' '}
                                                        {(item.totalLength || 0).toLocaleString()}{' '}
                                                        {t('ม.')}
                                                        {item.extraLength &&
                                                            item.extraLength > 0 && (
                                                                <span className="text-yellow-300">
                                                                    {' '}
                                                                    (+ {t('Riser')}{' '}
                                                                    {(
                                                                        item.extraLength || 0
                                                                    ).toFixed(1)}{' '}
                                                                    ม.)
                                                                </span>
                                                            )}{' '}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right text-sm">
                                                <p className="text-purple-200">
                                                    {item.quantity} {t('ม้วน')}
                                                </p>
                                                <p className="font-bold text-white">
                                                    {Number(
                                                        (item.totalCost || 0).toFixed(2)
                                                    ).toLocaleString('th-TH')}{' '}
                                                    {t('บาท')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {uniqueSecondaryPipes > 0 && (
                            <div>
                                <h4 className="mb-1 text-xs font-medium text-purple-200">
                                    {t('ท่อเมนรอง')} ({uniqueSecondaryPipes} {t('ชนิด')}):
                                </h4>
                                <div className="space-y-1">
                                    {Object.values(costs.pipeSummary.secondary).map(
                                        (item, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between rounded bg-purple-800 p-2"
                                            >
                                                <div className="flex items-center space-x-3">
                                                    {item.pipe.image ? (
                                                        <img
                                                            src={item.pipe.image}
                                                            alt=""
                                                            className="h-10 w-10"
                                                        />
                                                    ) : (
                                                        <p className="flex h-10 w-10 items-center justify-center bg-gray-500 text-center align-middle text-xs text-gray-300">
                                                            {t('ไม่มีรูป')}
                                                        </p>
                                                    )}
                                                    <div className="text-sm">
                                                        <p className="font-medium text-white">
                                                            {item.pipe.name ||
                                                                item.pipe.productCode}{' '}
                                                            - {item.pipe.sizeMM}mm
                                                        </p>
                                                        <p className="text-xs text-purple-200">
                                                            <span>
                                                                {item.zones.join(', ')}
                                                                <span className="mx-1 text-xs text-red-500">
                                                                    |
                                                                </span>
                                                            </span>
                                                            {Number(
                                                                (getPipePrice(item.pipe)).toFixed(2)
                                                            ).toLocaleString('th-TH')}{' '}
                                                            {t('บาท/ม้วน')} ({getPipeLengthM(item.pipe)}{' '}
                                                            {t('ม./ม้วน')}){' '}
                                                            <span className="mx-1 text-xs text-red-500">
                                                                |
                                                            </span>{' '}
                                                            {t('รวมความยาว:')}{' '}
                                                            {(
                                                                item.totalLength || 0
                                                            ).toLocaleString()}{' '}
                                                            {t('ม.')}
                                                            {item.extraLength &&
                                                                item.extraLength > 0 && (
                                                                    <span className="text-yellow-300">
                                                                        {' '}
                                                                        (+ {t('Riser')}{' '}
                                                                        {(
                                                                            item.extraLength || 0
                                                                        ).toFixed(1)}{' '}
                                                                        ม.)
                                                                    </span>
                                                                )}{' '}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right text-sm">
                                                    <p className="text-purple-200">
                                                        {item.quantity} {t('ม้วน')}
                                                    </p>
                                                    <p className="font-bold text-white">
                                                        {Number(
                                                            (item.totalCost || 0).toFixed(2)
                                                        ).toLocaleString('th-TH')}{' '}
                                                        {t('บาท')}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        )}

                        {uniqueMainPipes > 0 && (
                            <div>
                                <h4 className="mb-1 text-xs font-medium text-purple-200">
                                    {t('ท่อเมนหลัก')} ({uniqueMainPipes} {t('ชนิด')}):
                                </h4>
                                <div className="space-y-1">
                                    {Object.values(costs.pipeSummary.main).map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between rounded bg-purple-800 p-2"
                                        >
                                            <div className="flex items-center space-x-3">
                                                {item.pipe.image ? (
                                                    <img
                                                        src={item.pipe.image}
                                                        alt=""
                                                        className="h-10 w-10"
                                                    />
                                                ) : (
                                                    <p className="flex h-10 w-10 items-center justify-center bg-gray-500 text-center align-middle text-xs text-gray-300">
                                                        {t('ไม่มีรูป')}
                                                    </p>
                                                )}
                                                <div className="text-sm">
                                                    <p className="font-medium text-white">
                                                        {item.pipe.name || item.pipe.productCode} -{' '}
                                                        {item.pipe.sizeMM}mm
                                                    </p>
                                                    <p className="text-xs text-purple-200">
                                                        <span>
                                                            {item.zones.join(', ')}
                                                            <span className="mx-1 text-xs text-red-500">
                                                                |
                                                            </span>
                                                        </span>
                                                        {Number(
                                                            (getPipePrice(item.pipe)).toFixed(2)
                                                        ).toLocaleString('th-TH')}{' '}
                                                        {t('บาท/ม้วน')} ({getPipeLengthM(item.pipe)}{' '}
                                                        {t('ม./ม้วน')}){' '}
                                                        <span className="mx-1 text-xs text-red-500">
                                                            |
                                                        </span>{' '}
                                                        {t('รวมความยาว:')}{' '}
                                                        {(item.totalLength || 0).toLocaleString()}{' '}
                                                        {t('ม.')}
                                                        {item.extraLength &&
                                                            item.extraLength > 0 && (
                                                                <span className="text-yellow-300">
                                                                    {' '}
                                                                    (+ {t('Riser')}{' '}
                                                                    {(
                                                                        item.extraLength || 0
                                                                    ).toFixed(1)}{' '}
                                                                    ม.)
                                                                </span>
                                                            )}{' '}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right text-sm">
                                                <p className="text-purple-200">
                                                    {item.quantity} {t('ม้วน')}
                                                </p>
                                                <p className="font-bold text-white">
                                                    {Number(
                                                        (item.totalCost || 0).toFixed(2)
                                                    ).toLocaleString('th-TH')}{' '}
                                                    {t('บาท')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {uniqueEmitterPipes > 0 && (
                            <div>
                                <h4 className="mb-1 text-xs font-medium text-purple-200">
                                    {t('ท่อย่อยแยก')} ({uniqueEmitterPipes} {t('ชนิด')}):
                                </h4>
                                <div className="space-y-1">
                                    {Object.values(costs.pipeSummary.emitter).map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between rounded bg-purple-800 p-2"
                                        >
                                            <div className="flex items-center space-x-3">
                                                {item.pipe.image ? (
                                                    <img
                                                        src={item.pipe.image}
                                                        alt=""
                                                        className="h-10 w-10"
                                                    />
                                                ) : (
                                                    <p className="flex h-10 w-10 items-center justify-center bg-gray-500 text-center align-middle text-xs text-gray-300">
                                                        {t('ไม่มีรูป')}
                                                    </p>
                                                )}
                                                <div className="text-sm">
                                                    <p className="font-medium text-white">
                                                        {item.pipe.name || item.pipe.productCode} -{' '}
                                                        {item.pipe.sizeMM}mm
                                                    </p>
                                                    <p className="text-xs text-purple-200">
                                                        <span>
                                                            {item.zones.join(', ')}
                                                            <span className="mx-1 text-xs text-red-500">
                                                                |
                                                            </span>
                                                        </span>
                                                        {Number(
                                                            (getPipePrice(item.pipe)).toFixed(2)
                                                        ).toLocaleString('th-TH')}{' '}
                                                        {t('บาท/ม้วน')} ({getPipeLengthM(item.pipe)}{' '}
                                                        {t('ม./ม้วน')}){' '}
                                                        <span className="mx-1 text-xs text-red-500">
                                                            |
                                                        </span>{' '}
                                                        {t('รวมความยาว:')}{' '}
                                                        {(item.totalLength || 0).toLocaleString()}{' '}
                                                        {t('ม.')}
                                                        {item.extraLength &&
                                                            item.extraLength > 0 && (
                                                                <span className="text-yellow-300">
                                                                    {' '}
                                                                    (+ {t('Riser')}{' '}
                                                                    {(
                                                                        item.extraLength || 0
                                                                    ).toFixed(1)}{' '}
                                                                    ม.)
                                                                </span>
                                                            )}{' '}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right text-sm">
                                                <p className="text-purple-200">
                                                    {item.quantity} {t('ม้วน')}
                                                </p>
                                                <p className="font-bold text-white">
                                                    {Number(
                                                        (item.totalCost || 0).toFixed(2)
                                                    ).toLocaleString('th-TH')}{' '}
                                                    {t('บาท')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(costs as any).extraPipeSummary && (
                            <div className="mt-2 rounded bg-blue-900 p-2">
                                <h4 className="mb-1 text-xs font-medium text-blue-200">
                                    {t('ท่อเสริมตั้งสปริงเกอร์')}
                                </h4>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center space-x-3">
                                        {(costs as any).extraPipeSummary.pipe.image ? (
                                            <img
                                                src={(costs as any).extraPipeSummary.pipe.image}
                                                alt=""
                                                className="h-10 w-10"
                                            />
                                        ) : (
                                            <p className="flex h-10 w-10 items-center justify-center bg-gray-500 text-center align-middle text-xs text-gray-300">
                                                {t('ไม่มีรูป')}
                                            </p>
                                        )}
                                        <div className="flex flex-col">
                                            <p className="font-medium text-white">
                                                {(costs as any).extraPipeSummary.pipe.name ||
                                                    (costs as any).extraPipeSummary.pipe
                                                        .productCode}{' '}
                                                - {(costs as any).extraPipeSummary.pipe.sizeMM}mm
                                            </p>
                                            <p className="text-xs text-blue-200">
                                                {t('รวมความยาว:')}{' '}
                                                {(
                                                    (costs as any).extraPipeSummary?.totalLength ||
                                                    0
                                                ).toLocaleString()}{' '}
                                                {t('ม.')} | {t('ใช้ในโซน:')}{' '}
                                                {(costs as any).extraPipeSummary.zones.join(', ')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-blue-200">
                                            {(costs as any).extraPipeSummary.quantity} {t('ม้วน')}
                                        </p>
                                        <p className="font-bold text-white">
                                            {Number(
                                                (
                                                    (costs as any).extraPipeSummary?.totalCost || 0
                                                ).toFixed(2)
                                            ).toLocaleString('th-TH')}{' '}
                                            {t('บาท')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded bg-gray-600 p-4">
                    <h4 className="font-medium text-green-300">
                        💧 {getEquipmentName()} {t('ทั้งหมด')}
                    </h4>
                    <p className="text-sm">
                        {uniqueSprinklers} {t('ชนิด')} | {t('รวม')}{' '}
                        {(totalSprinklerHeads || 0).toLocaleString()} {t('หัว')}
                    </p>
                    {systemMode === 'หลายโซน' && (
                        <p className="text-sm">
                            ({totalZones} {projectMode === 'greenhouse' ? t('แปลง') : t('โซน')})
                        </p>
                    )}
                    <p className="text-sm">
                        {totalSprinklerHeads > 0
                            ? 'ราคา ' +
                              Number(
                                  (costs.totalSprinklerCost / totalSprinklerHeads).toFixed(2)
                              ).toLocaleString('th-TH')
                            : 0}{' '}
                        {t('บาท')}/{t('หัว')}
                    </p>
                    <p className="text-xl font-bold">
                        ราคา{' '}
                        {Number((costs.totalSprinklerCost || 0).toFixed(2)).toLocaleString('th-TH')}{' '}
                        {t('บาท')}
                    </p>
                </div>

                {showPump && (
                    <div className="rounded bg-gray-600 p-4">
                        <h4 className="font-medium text-red-300">⚡ {t('ปั๊มน้ำ')}</h4>
                        <p className="text-sm">
                            {effectivePump
                                ? effectivePump.name || effectivePump.productCode
                                : t('ไม่มีข้อมูล')}
                        </p>
                        <p className="text-xl font-bold">
                            ราคา {Number((costs.pumpCost || 0).toFixed(2)).toLocaleString('th-TH')}{' '}
                            {t('บาท')}
                        </p>
                        {costs.pumpAccessoriesCost > 0 && (
                            <div className="mt-2 text-sm">
                                <p className="text-purple-300">
                                    {t('อุปกรณ์ประกอบ')}: +
                                    {Number(
                                        (costs.pumpAccessoriesCost || 0).toFixed(2)
                                    ).toLocaleString('th-TH')}{' '}
                                    {t('บาท')}
                                </p>
                            </div>
                        )}
                        {(() => {
                            // ดึง selectedGroupId จาก localStorage (เหมือนกับ PumpSelector.tsx)
                            const getStoredSelectedGroupId = (pumpId: number | undefined): number | string | null => {
                                if (!pumpId) return null;
                                try {
                                    const stored = localStorage.getItem(`pump_${pumpId}_selectedGroupId`);
                                    return stored ? (isNaN(Number(stored)) ? stored : Number(stored)) : null;
                                } catch {
                                    return null;
                                }
                            };
                            
                            // หาราคาของกลุ่มที่เลือก (ไม่ใช่กลุ่มแรก)
                            let selectedGroupCost = 0;
                            let selectedGroupName = '';
                            
                            if (effectivePump?.pumpAccessories && effectivePump.pumpAccessories.length > 0) {
                                // ดึง selectedGroupId จาก localStorage
                                const selectedGroupId = getStoredSelectedGroupId(effectivePump.id);
                                
                                // หากลุ่มที่เลือก (ถ้ามี) หรือกลุ่มแรก (fallback)
                                const selectedGroup = selectedGroupId
                                    ? effectivePump.pumpAccessories.find((acc: any) => 
                                        acc.group_id && acc.group_id > 0 && acc.group_id === selectedGroupId
                                    )
                                    : effectivePump.pumpAccessories.find((acc: any) => 
                                        acc.group_id && acc.group_id > 0
                                    );
                                
                                if (selectedGroup && selectedGroup.group_items && selectedGroup.group_items.length > 0) {
                                    selectedGroupName = selectedGroup.group?.name || selectedGroup.name || t('อุปกรณ์โรงปั๊ม');
                                    selectedGroupCost = selectedGroup.group_items.reduce((sum: number, item: any) => {
                                        const itemPrice = Number(item.unit_price || item.total_price || item.equipment?.price || 0);
                                        const itemQuantity = Number(item.quantity || 1);
                                        return sum + (itemPrice * itemQuantity);
                                    }, 0);
                                }
                            }
                            
                            return selectedGroupCost > 0 ? (
                                <div className="mt-2 border-t border-gray-500 pt-2">
                                    <p className="text-sm font-semibold text-yellow-300">
                                        {selectedGroupName || t('อุปกรณ์โรงปั๊ม')}:{' '}
                                        {Number(selectedGroupCost.toFixed(2)).toLocaleString('th-TH')}{' '}
                                        {t('บาท')}
                                    </p>
                                </div>
                            ) : null;
                        })()}
                    </div>
                )}

                <div className="rounded bg-gray-600 p-4">
                    <h4 className="font-medium text-purple-300">🔧 {t('ท่อทั้งหมด')}</h4>
                    <div className="space-y-1 text-sm">
                        <p>
                            {t('ท่อย่อย:')}{' '}
                            {Number((costs.totalBranchPipeCost || 0).toFixed(2)).toLocaleString(
                                'th-TH'
                            )}{' '}
                            {t('บาท')}
                            <span className="text-xs text-gray-400">
                                {' '}
                                (
                                {Object.values(costs.pipeSummary.branch).reduce(
                                    (sum, item) => sum + item.quantity,
                                    0
                                )}{' '}
                                {t('ม้วน')})
                            </span>
                        </p>
                        {costs.totalSecondaryPipeCost > 0 && (
                            <p>
                                {t('ท่อรอง:')}{' '}
                                {Number(
                                    (costs.totalSecondaryPipeCost || 0).toFixed(2)
                                ).toLocaleString('th-TH')}{' '}
                                {t('บาท')}
                                <span className="text-xs text-gray-400">
                                    {' '}
                                    (
                                    {Object.values(costs.pipeSummary.secondary).reduce(
                                        (sum, item) => sum + item.quantity,
                                        0
                                    )}{' '}
                                    {t('ม้วน')})
                                </span>
                            </p>
                        )}
                        {costs.totalMainPipeCost > 0 && (
                            <p>
                                {t('ท่อหลัก:')}{' '}
                                {Number((costs.totalMainPipeCost || 0).toFixed(2)).toLocaleString(
                                    'th-TH'
                                )}{' '}
                                {t('บาท')}
                                <span className="text-xs text-gray-400">
                                    {' '}
                                    (
                                    {Object.values(costs.pipeSummary.main).reduce(
                                        (sum, item) => sum + item.quantity,
                                        0
                                    )}{' '}
                                    {t('ม้วน')})
                                </span>
                            </p>
                        )}
                        {costs.totalEmitterPipeCost > 0 && (
                            <p>
                                {t('ท่อย่อยแยก:')}{' '}
                                {Number(
                                    (costs.totalEmitterPipeCost || 0).toFixed(2)
                                ).toLocaleString('th-TH')}{' '}
                                {t('บาท')}
                                <span className="text-xs text-gray-400">
                                    {' '}
                                    (
                                    {Object.values(costs.pipeSummary.emitter).reduce(
                                        (sum, item) => sum + item.quantity,
                                        0
                                    )}{' '}
                                    {t('ม้วน')})
                                </span>
                            </p>
                        )}
                        {(costs as any).extraPipeCost > 0 && (
                            <p>
                                {t('ท่อเสริม:')}{' '}
                                {Number(
                                    ((costs as any).extraPipeCost || 0).toFixed(2)
                                ).toLocaleString('th-TH')}{' '}
                                {t('บาท')}
                                <span className="text-xs text-gray-400">
                                    {' '}
                                    ({(costs as any).extraPipeSummary?.quantity} ม้วน)
                                </span>
                            </p>
                        )}
                    </div>
                    <p className="text-xl font-bold">
                        รวม{' '}
                        {Number(
                            (
                                (costs.totalBranchPipeCost || 0) +
                                (costs.totalSecondaryPipeCost || 0) +
                                (costs.totalMainPipeCost || 0) +
                                (costs.totalEmitterPipeCost || 0) +
                                ((costs as any).extraPipeCost || 0)
                            ).toFixed(2)
                        ).toLocaleString('th-TH')}{' '}
                        {t('บาท')}
                    </p>
                </div>

                {/* Sprinkler Equipment Sets */}
                {costs.sprinklerEquipmentSetsCost > 0 && (
                    <div className="rounded bg-gray-600 p-4">
                        <h4 className="font-medium text-yellow-300">
                            🎯 {t('อุปกรณ์เสริมสปริงเกอร์')}
                        </h4>
                        <div className="space-y-1 text-sm">
                            {Object.entries(sprinklerEquipmentSets).map(
                                ([zoneId, equipmentSet]) => (
                                    <div key={zoneId} className="border-l-2 border-yellow-400 pl-2">
                                        <p className="text-xs text-gray-300">
                                            {projectMode === 'greenhouse' ? t('แปลง') : t('โซน')}{' '}
                                            {zoneId}:
                                        </p>
                                        {equipmentSet.groups?.map(
                                            (group: any, groupIndex: number) => (
                                                <div key={groupIndex} className="ml-2">
                                                    {group.items?.map(
                                                        (item: any, itemIndex: number) => (
                                                            <p key={itemIndex} className="text-xs">
                                                                •{' '}
                                                                {item.equipment?.name ||
                                                                    item.equipment?.product_code}
                                                                <span className="text-gray-400">
                                                                    ({item.quantity} {t('ชิ้น')} ×{' '}
                                                                    {Number(
                                                                        (
                                                                            item.unit_price || 0
                                                                        ).toFixed(2)
                                                                    ).toLocaleString('th-TH')}{' '}
                                                                    {t('บาท')})
                                                                </span>
                                                            </p>
                                                        )
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </div>
                                )
                            )}
                        </div>
                        <p className="text-xl font-bold">
                            ราคา{' '}
                            {Number(
                                (costs.sprinklerEquipmentSetsCost || 0).toFixed(2)
                            ).toLocaleString('th-TH')}{' '}
                            {t('บาท')}
                        </p>
                    </div>
                )}

                {/* Connection Equipment */}
                {costs.connectionEquipmentsCost > 0 ? (
                    <div className="rounded bg-gray-600 p-4">
                        <h4 className="font-medium text-orange-300">🔗 {t('อุปกรณ์ข้อต่อท่อ')}</h4>
                        <p className="text-xl font-bold">
                            ราคา{' '}
                            {Number(
                                (costs.connectionEquipmentsCost || 0).toFixed(2)
                            ).toLocaleString('th-TH')}{' '}
                            {t('บาท')}
                        </p>
                    </div>
                ) : null}

                <div className="flex flex-col items-center justify-center rounded bg-gradient-to-r from-green-600 to-blue-600 p-4">
                    <h4 className="font-medium text-white">
                        💎 {t('รวมทั้งหมด')} {getProjectIcon()}
                        {projectMode === 'field-crop'
                            ? t(' (พืชไร่)')
                            : projectMode === 'greenhouse'
                              ? t(' (โรงเรือน)')
                              : ''}
                    </h4>
                    <p className="text-sm text-green-100">
                        {t('ราคาสุทธิ')} ({t('ไม่รวม VAT')})
                    </p>
                    <div className="mt-2 flex items-center justify-center">
                        <div className="flex items-center justify-center">
                            <p className="text-2xl font-bold text-white">
                                {Number((Number(costs.totalCost) || 0).toFixed(2)).toLocaleString(
                                    'th-TH'
                                )}{' '}
                                {t('บาท')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <p className="text-sm mt-4 text-red-400">** หมายเหตุ : ราคานี้เป็นเพียงแค่ราคาสินค้า ยังไม่รวมค่าติดตั้ง และราคาสินค้าเป็นเพียงราคาประมาณการซึ่งราคาอาจจะเปลี่ยนแปลงไปตามแหล่งที่ซื้อและช่วงโปรโมชั่น **</p>

            <div className="mt-4 text-center">
                <button
                    onClick={onQuotationClick}
                    className="rounded bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-3 text-lg font-bold text-white hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={(costs.totalCost || 0) === 0}
                >
                    📋 {t('ดูรายการสินค้า')}
                </button>
                {(costs.totalCost || 0) === 0 && (
                    <p className="mt-2 text-sm text-red-400">
                        {t('กรุณาเลือก')}
                        {getEquipmentName()}
                        {t('เพื่อให้ระบบคำนวณราคา')}
                    </p>
                )}
            </div>
        </div>
    );
};

export default CostSummary;
