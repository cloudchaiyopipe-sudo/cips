/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPipeData, getPipeDataWithSmartSize } from '../pages/components/PipeFrictionLoss';
import { PressureLossCorrectionFactorTableData } from '../pages/components/PressureLossCorrectionFactorTable';

export interface BestPipeInfo {
    id: string;
    length: number;
    count: number; // จำนวนทางออก
    waterFlowRate: number; // ใช้น้ำ L/min
    details?: any;
}

export interface PipeCalculationResult {
    headLoss: number; // ค่า head loss ที่คำนวณได้
    pressureLoss: number; // ค่า X
    correctionFactor: number; // ค่า Y
    pipeLength: number; // ความยาวท่อ
    flowRate: number; // อัตราการไหลที่ใช้
    outletCount: number; // จำนวนทางออกที่ใช้
    calculationDetails: string; // รายละเอียดการคำนวณ
    actualSize?: string; // ขนาดท่อที่ใช้จริงในการคำนวณ
    sizeInfo?: {
        isExactSizeMatch: boolean;
        sizeReason: string;
    };
}

export interface SprinklerPressureInfo {
    pressureBar: number;
    headM: number;
    head20PercentM: number;
}

export interface SelectedPipeSizes {
    main?: number;
    secondary?: number;
    branch?: number;
    emitter?: number;
}

/**
 * หาค่า pressureLoss (X) จากข้อมูลท่อ
 * @param pipeType ประเภทท่อ เช่น "PE", "PVC"
 * @param pressureClass แรงดัน เช่น "PN4", "Class5"
 * @param pipeSize ขนาดท่อ เช่น "25mm"
 * @param flowRate อัตราการไหล L/min
 * @returns ค่า pressureLoss หรือ null ถ้าหาไม่พบ
 */
export function findPressureLoss(
    pipeType: string,
    pressureClass: string,
    pipeSize: string,
    flowRate: number
): {
    pressureLoss: number;
    actualFlow: number;
    actualSize: string;
    sizeInfo?: {
        isExactSizeMatch: boolean;
        sizeReason: string;
    };
} | null {
    try {
        const smartPipeResult = getPipeDataWithSmartSize(pipeType, pressureClass, pipeSize);

        if (!smartPipeResult || !smartPipeResult.data) {
            return null;
        }

        const { data: pipeData, selectedSize, sizeInfo } = smartPipeResult;

        const sizeData = pipeData[selectedSize];

        let selectedFlow = sizeData.find((data) => data.flow >= flowRate);

        if (!selectedFlow) {
            selectedFlow = sizeData[sizeData.length - 1];
        }

        return {
            pressureLoss: selectedFlow.pressureLoss,
            actualFlow: selectedFlow.flow,
            actualSize: selectedSize,
            sizeInfo: {
                isExactSizeMatch: sizeInfo.isExactMatch,
                sizeReason: sizeInfo.reason,
            },
        };
    } catch (error) {
        return null;
    }
}

/**
 * หาค่า CorrectionFactor (Y) จากจำนวนทางออก
 * @param outletCount จำนวนทางออก
 * @returns ค่า CorrectionFactor
 */
export function findCorrectionFactor(outletCount: number): {
    correctionFactor: number;
    actualOutletCount: number;
} {
    let selectedEntry = PressureLossCorrectionFactorTableData[0];

    for (const entry of PressureLossCorrectionFactorTableData) {
        if (entry.NumberofOutlets <= outletCount) {
            selectedEntry = entry;
        } else {
            break;
        }
    }

    return {
        correctionFactor: selectedEntry.CorrectionFactor,
        actualOutletCount: selectedEntry.NumberofOutlets,
    };
}

/**
 * คำนวณ head loss ด้วยสูตรใหม่: (X/10) * ความยาวท่อ * Y
 * @param bestPipeInfo ข้อมูลท่อที่ต้องการน้ำมากที่สุด
 * @param pipeType ประเภทท่อ
 * @param pressureClass แรงดัน
 * @param pipeSize ขนาดท่อ
 * @returns ผลการคำนวณ
 */
export function calculateNewHeadLoss(
    bestPipeInfo: BestPipeInfo,
    pipeType: string,
    pressureClass: string,
    pipeSize: string
): PipeCalculationResult | null {
    try {
        let actualPressureClass = pressureClass;
        let pressureNote = '';

        let pipeData = getPipeData(pipeType, pressureClass);
        if (!pipeData) {
            if (pipeType.toUpperCase() === 'PE') {
                actualPressureClass = 'PN6.3';
                pipeData = getPipeData(pipeType, actualPressureClass);
                if (!pipeData) {
                    actualPressureClass = 'PN63';
                    pipeData = getPipeData(pipeType, actualPressureClass);
                }
                if (actualPressureClass !== pressureClass) {
                    pressureNote = ` (ใช้ ${actualPressureClass} แทน ${pressureClass})`;
                }
            } else if (pipeType.toUpperCase() === 'PVC') {
                actualPressureClass = 'Class8.5';
                pipeData = getPipeData(pipeType, actualPressureClass);
                if (!pipeData) {
                    actualPressureClass = 'Class85';
                    pipeData = getPipeData(pipeType, actualPressureClass);
                }
                if (actualPressureClass !== pressureClass) {
                    pressureNote = ` (ใช้ ${actualPressureClass} แทน ${pressureClass})`;
                }
            }
        }

        const pressureLossResult = findPressureLoss(
            pipeType,
            actualPressureClass,
            pipeSize,
            bestPipeInfo.waterFlowRate
        );

        if (!pressureLossResult) {
            return null;
        }

        const correctionResult = findCorrectionFactor(bestPipeInfo.count);

        const headLoss =
            (pressureLossResult.pressureLoss / 10) *
            bestPipeInfo.length *
            correctionResult.correctionFactor;

        const sizeNote =
            pressureLossResult.sizeInfo && !pressureLossResult.sizeInfo.isExactSizeMatch
                ? ` (ใช้ ${pressureLossResult.actualSize} แทน ${pipeSize})`
                : '';

        const calculationDetails = [
            `ใช้ ${pipeType} ${actualPressureClass} ขนาด ${pressureLossResult.actualSize}${pressureNote}${sizeNote}`,
            `อัตราการไหล: ${bestPipeInfo.waterFlowRate.toFixed(1)} L/min → ใช้ค่า ${pressureLossResult.actualFlow} L/min`,
            `ค่า X (pressureLoss): ${pressureLossResult.pressureLoss}`,
            `จำนวนทางออก: ${bestPipeInfo.count} → ใช้ค่า ${correctionResult.actualOutletCount}`,
            `ค่า Y (correctionFactor): ${correctionResult.correctionFactor}`,
            `ความยาวท่อ: ${bestPipeInfo.length.toFixed(1)} ม.`,
            `สูตร: (${pressureLossResult.pressureLoss}/10) × ${bestPipeInfo.length.toFixed(1)} × ${correctionResult.correctionFactor} = ${headLoss.toFixed(3)} ม.`,
        ].join('\n');

        return {
            headLoss,
            pressureLoss: pressureLossResult.pressureLoss,
            correctionFactor: correctionResult.correctionFactor,
            pipeLength: bestPipeInfo.length,
            flowRate: pressureLossResult.actualFlow,
            outletCount: correctionResult.actualOutletCount,
            calculationDetails,
            actualSize: pressureLossResult.actualSize,
            sizeInfo: pressureLossResult.sizeInfo,
        };
    } catch (error) {
        return null;
    }
}

/**
 * คำนวณข้อมูลแรงดันหัวฉีด
 * @param sprinkler ข้อมูลหัวฉีด
 * @returns ข้อมูลแรงดัน
 */
export function calculateSprinklerPressure(sprinkler: any): SprinklerPressureInfo | null {
    if (!sprinkler || !sprinkler.pressureBar) {
        return null;
    }

    let pressureBar: number;

    if (Array.isArray(sprinkler.pressureBar)) {
        pressureBar = (sprinkler.pressureBar[0] + sprinkler.pressureBar[1]) / 2;
    } else if (typeof sprinkler.pressureBar === 'string' && sprinkler.pressureBar.includes('-')) {
        const parts = sprinkler.pressureBar.split('-');
        pressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
    } else {
        pressureBar = parseFloat(String(sprinkler.pressureBar));
    }

    const headM = pressureBar * 10;
    const head20PercentM = headM * 0.2;

    return {
        pressureBar,
        headM,
        head20PercentM,
    };
}

/**
 * ตรวจสอบว่าท่อผ่านเงื่อนไขการเลือกหรือไม่
 * @param pipe ข้อมูลท่อ
 * @param pipeType ประเภทท่อ (branch, secondary, main, emitter)
 * @param sprinklerPressure ข้อมูลแรงดันหัวฉีด
 * @param selectedPipes ท่อที่เลือกไว้ในโซนเดียวกัน
 * @returns true ถ้าผ่านเงื่อนไข
 */
export function validatePipeSelection(
    pipe: any,
    pipeType: 'branch' | 'secondary' | 'main' | 'emitter',
    sprinklerPressure: SprinklerPressureInfo,
    selectedPipes: { [key: string]: any } = {}
): { isValid: boolean; reason?: string } {
    try {
        if (typeof pipe.pn !== 'number' || typeof sprinklerPressure.pressureBar !== 'number') {
            return {
                isValid: false,
                reason: 'ข้อมูลแรงดันไม่ถูกต้อง',
            };
        }

        if (pipe.pn < sprinklerPressure.pressureBar) {
            return {
                isValid: false,
                reason: `แรงดันท่อ (${pipe.pn} บาร์) ต่ำกว่าแรงดันหัวฉีด (${sprinklerPressure.pressureBar.toFixed(1)} บาร์)`,
            };
        }

        if (pipeType === 'branch' || pipeType === 'emitter') {
            const sizeMM = pipe.sizeMM || (pipe.sizeInch ? parseFloat(pipe.sizeInch) * 25.4 : 0);
            if (sizeMM > 32) {
                return {
                    isValid: false,
                    reason: `ท่อ${pipeType === 'branch' ? 'ย่อย' : 'ย่อยแยก'}ต้องมีขนาด ≤ 32mm (ขนาดปัจจุบัน: ${sizeMM}mm)`,
                };
            }
        }

        if (pipeType === 'secondary' || pipeType === 'main') {
            const branchPipe = selectedPipes.branch;
            if (branchPipe && pipe.sizeMM <= branchPipe.sizeMM) {
                return {
                    isValid: false,
                    reason: `ท่อเมน${pipeType === 'secondary' ? 'รอง' : 'หลัก'}ต้องมีขนาดมากกว่าท่อย่อย (${branchPipe.sizeMM}mm)`,
                };
            }

            if (pipeType === 'main') {
                const secondaryPipe = selectedPipes.secondary;
                if (secondaryPipe && pipe.sizeMM <= secondaryPipe.sizeMM) {
                    return {
                        isValid: false,
                        reason: `ท่อเมนหลักต้องมีขนาดมากกว่าท่อเมนรอง (${secondaryPipe.sizeMM}mm)`,
                    };
                }
            }
        }

        return { isValid: true };
    } catch (error) {
        return {
            isValid: false,
            reason: 'เกิดข้อผิดพลาดในการตรวจสอบ',
        };
    }
}

/**
 * เลือกท่อที่เหมาะสมที่สุดตามเงื่อนไข
 * @param pipes รายการท่อทั้งหมด
 * @param pipeType ประเภทท่อ
 * @param sprinklerPressure ข้อมูลแรงดันหัวฉีด
 * @param bestPipeInfo ข้อมูลท่อที่ต้องการน้ำมากที่สุด
 * @param selectedPipes ท่อที่เลือกไว้ในโซนเดียวกัน
 * @returns ท่อที่เลือก
 */
export function selectBestPipe(
    pipes: any[],
    pipeType: 'branch' | 'secondary' | 'main' | 'emitter',
    sprinklerPressure: SprinklerPressureInfo,
    bestPipeInfo: BestPipeInfo,
    selectedPipes: { [key: string]: any } = {}
): any | null {
    try {
        const validPipes = pipes.filter((pipe) => {
            const validation = validatePipeSelection(
                pipe,
                pipeType,
                sprinklerPressure,
                selectedPipes
            );
            return validation.isValid;
        });

        if (validPipes.length === 0) {
            return null;
        }

        const pipesWithCalculation = validPipes.map((pipe) => {
            const calculation = calculateNewHeadLoss(
                bestPipeInfo,
                pipe.pipeType || 'PE',
                `PN${pipe.pn}`,
                `${pipe.sizeMM}mm`
            );

            return {
                ...pipe,
                calculation,
                hasWarning: calculation
                    ? calculation.headLoss > sprinklerPressure.head20PercentM
                    : false,
            };
        });

        const sortedPipes = pipesWithCalculation.sort((a, b) => {
            if (a.hasWarning !== b.hasWarning) {
                return a.hasWarning ? 1 : -1;
            }

            if (a.pn !== b.pn) {
                return a.pn - b.pn;
            }

            if (a.sizeMM !== b.sizeMM) {
                return a.sizeMM - b.sizeMM;
            }

            return (a.price || 0) - (b.price || 0);
        });

        return sortedPipes[0];
    } catch (error) {
        return null;
    }
}

/**
 * สร้าง summary ของการคำนวณสำหรับแสดงผล
 * @param calculations การคำนวณของแต่ละท่อ
 * @param sprinklerPressure ข้อมูลแรงดันหัวฉีด
 * @returns ข้อมูลสำหรับแสดงผล
 */
export function createCalculationSummary(
    calculations: { [pipeType: string]: PipeCalculationResult | null },
    sprinklerPressure: SprinklerPressureInfo
) {
    const summary = {
        sprinklerPressure,
        pipeCalculations: calculations,
        warnings: [] as string[],
        totalHeadLoss: 0,
    };

    Object.values(calculations).forEach((calc) => {
        if (calc) {
            summary.totalHeadLoss += calc.headLoss;
        }
    });

    const mainCalc = calculations.main;
    const branchSecondaryTotal =
        (calculations.branch?.headLoss || 0) + (calculations.secondary?.headLoss || 0);

    if (mainCalc && mainCalc.headLoss > sprinklerPressure.head20PercentM) {
        summary.warnings.push(
            `⚠️ ท่อเมนหลัก: ${mainCalc.headLoss.toFixed(3)}ม. มากกว่า 20% Head หัวฉีด (${sprinklerPressure.head20PercentM.toFixed(1)}ม.)`
        );
    }

    if (branchSecondaryTotal > sprinklerPressure.head20PercentM) {
        summary.warnings.push(
            `⚠️ ท่อย่อย+ท่อเมนรอง: ${branchSecondaryTotal.toFixed(3)}ม. มากกว่า 20% Head หัวฉีด (${sprinklerPressure.head20PercentM.toFixed(1)}ม.)`
        );
    }

    return summary;
}

/**
 * ตรวจสอบว่าขนาดท่อเป็นไปตามลำดับชั้นหรือไม่
 * @param pipeType ประเภทท่อปัจจุบัน
 * @param currentSizeMM ขนาดท่อปัจจุบัน
 * @param selectedPipeSizes ขนาดท่อที่เลือกไว้แล้ว
 * @returns true ถ้าขนาดถูกต้องตามลำดับชั้น
 */
export function validatePipeSizeHierarchy(
    pipeType: string,
    currentSizeMM: number,
    selectedPipeSizes: SelectedPipeSizes
): boolean {
    const mainSize = selectedPipeSizes.main || 0;
    const secondarySize = selectedPipeSizes.secondary || 0;
    const branchSize = selectedPipeSizes.branch || 0;
    const emitterSize = selectedPipeSizes.emitter || 0;

    switch (pipeType) {
        case 'main': {
            return currentSizeMM >= Math.max(secondarySize, branchSize, emitterSize);
        }

        case 'secondary': {
            const isSmaller = mainSize === 0 || currentSizeMM <= mainSize;
            const isLarger = currentSizeMM >= Math.max(branchSize, emitterSize);
            return isSmaller && isLarger;
        }

        case 'branch':
        case 'emitter': {
            const hasLargerPipes = mainSize > 0 || secondarySize > 0;
            const isSmallerThanLargerPipes =
                !hasLargerPipes || currentSizeMM <= Math.max(mainSize || 0, secondarySize || 0);
            return isSmallerThanLargerPipes;
        }

        default:
            return true;
    }
}

/**
 * เลือกท่อที่ดีที่สุดตาม Head Loss เป้าหมาย 1.9 ม.
 * @param availablePipes รายการท่อที่มีให้เลือก
 * @param pipeType ประเภทท่อ
 * @param bestPipeInfo ข้อมูลท่อที่ต้องการน้ำมากที่สุด
 * @param selectedPipeType ประเภทวัสดุท่อ (PE/PVC)
 * @param selectedPipeSizes ขนาดท่อที่เลือกไว้แล้ว
 * @param head20Percent ค่า 20% ของ Head จากแรงดันหัวฉีด (เมตร)
 * @param targetHeadLoss [เลิกใช้แล้ว] เก็บไว้เพื่อ backward compatibility
 * @returns ท่อที่เหมาะสมที่สุด
 */
export function selectBestPipeByHeadLoss(
    availablePipes: any[],
    pipeType: string,
    bestPipeInfo: BestPipeInfo,
    selectedPipeType: string,
    selectedPipeSizes: SelectedPipeSizes,
    head20Percent: number
): any | null {
    if (!availablePipes.length || !bestPipeInfo) {
        return null;
    }

    const validPipes = availablePipes.filter((pipe) => {
        return validatePipeSizeHierarchy(pipeType, pipe.sizeMM, selectedPipeSizes);
    });

    if (!validPipes.length) {
        // ถ้าไม่มีท่อที่ผ่าน hierarchy validation ให้ return null
        return null;
    }

    let targetHeadLossValue: number;
    let isMaxLimitMode = false;

    switch (pipeType) {
        case 'main':
            targetHeadLossValue = head20Percent;
            isMaxLimitMode = true; // ห้ามเกิน head20Percent และให้เลือกตัวที่ใกล้เคียงที่สุด
            break;
        case 'secondary':
            targetHeadLossValue = head20Percent * 0.6; // ใกล้เคียง 60% ของ head20Percent
            isMaxLimitMode = true; // ห้ามเกิน head20Percent
            break;
        case 'branch':
        case 'emitter':
            targetHeadLossValue = head20Percent * 0.4; // ใกล้เคียง 40% ของ head20Percent
            isMaxLimitMode = true; // ห้ามเกิน head20Percent
            break;
        default:
            targetHeadLossValue = head20Percent * 0.4;
            isMaxLimitMode = true;
    }

    const candidates: Array<{ pipe: any; headLoss: number; calculation: any }> = [];

    for (const pipe of validPipes) {
        const actualPressureClass = selectedPipeType === 'PE' ? `PN${pipe.pn}` : `Class${pipe.pn}`;

        const calculation = calculateNewHeadLoss(
            bestPipeInfo,
            selectedPipeType,
            actualPressureClass,
            `${pipe.sizeMM}mm`
        );

        if (calculation && calculation.headLoss >= 0) {
            candidates.push({
                pipe,
                headLoss: calculation.headLoss,
                calculation,
            });
        }
    }

    if (candidates.length === 0) {
        return null;
    }

    let bestCandidates: Array<{ pipe: any; headLoss: number; calculation: any }>;

    if (isMaxLimitMode) {
        // ห้ามเกิน head20Percent สำหรับทุกประเภท
        const maxAllowed = pipeType === 'main' ? head20Percent : head20Percent;
        const validCandidates = candidates.filter((c) => c.headLoss <= maxAllowed);

        if (validCandidates.length > 0) {
            // เลือกที่ใกล้เคียง targetHeadLossValue มากที่สุด
            const minDiff = Math.min(
                ...validCandidates.map((c) => Math.abs(c.headLoss - targetHeadLossValue))
            );
            bestCandidates = validCandidates.filter(
                (c) => Math.abs(c.headLoss - targetHeadLossValue) === minDiff
            );
        } else {
            // ถ้าไม่มีท่อที่ผ่านเกณฑ์ maxAllowed ให้เลือกที่ใกล้เคียง head20Percent มากที่สุด
            const minDiff = Math.min(
                ...candidates.map((c) => Math.abs(c.headLoss - head20Percent))
            );
            bestCandidates = candidates.filter(
                (c) => Math.abs(c.headLoss - head20Percent) === minDiff
            );
        }
    } else {
        const minDiff = Math.min(
            ...candidates.map((c) => Math.abs(c.headLoss - targetHeadLossValue))
        );
        bestCandidates = candidates.filter(
            (c) => Math.abs(c.headLoss - targetHeadLossValue) === minDiff
        );
    }

    bestCandidates.sort((a, b) => {
        const priceA = a.pipe.price || 0;
        const priceB = b.pipe.price || 0;
        if (priceA !== priceB) {
            return priceA - priceB;
        }
        return a.pipe.sizeMM - b.pipe.sizeMM;
    });

    const bestPipe = bestCandidates[0]?.pipe || null;

    return bestPipe || validPipes[0];
}
