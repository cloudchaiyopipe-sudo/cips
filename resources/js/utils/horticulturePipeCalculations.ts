/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPipeData, getPipeDataWithSmartSize } from '../pages/components/PipeFrictionLoss';
import { PressureLossCorrectionFactorTableData } from '../pages/components/PressureLossCorrectionFactorTable';

export interface BestPipeInfo {
    id: string;
    length: number;
    count: number; // จำนวนทางออก
    sprinklerCount?: number; // จำนวนหัวฉีดทั้งหมด (สำหรับ branch pipe)
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
        if (!Array.isArray(sizeData) || sizeData.length === 0) return null;

        const firstRow = sizeData[0];
        const lastRow = sizeData[sizeData.length - 1];

        // ถ้า design flow ต่ำกว่าค่าในตาราง (เช่น เลือกท่อ 200mm แต่ไหลแค่ 60 L/min) อย่าใช้แถวแรกของตาราง (2200 L/min)
        // ให้ extrapolate: pressure loss แปรผันประมาณกับ flow^2
        if (flowRate < firstRow.flow) {
            const ratio = flowRate / firstRow.flow;
            const pressureLossScaled = firstRow.pressureLoss * ratio * ratio;
            return {
                pressureLoss: pressureLossScaled,
                actualFlow: flowRate,
                actualSize: selectedSize,
                sizeInfo: {
                    isExactSizeMatch: sizeInfo.isExactMatch,
                    sizeReason: sizeInfo.reason,
                },
            };
        }

        let selectedFlow = sizeData.find((data) => data.flow >= flowRate);

        if (!selectedFlow) {
            selectedFlow = lastRow;
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
        console.error('Error finding pressure loss:', error);
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
    pipeTypeOrSelectedPipeType: string,
    pressureClass: string,
    pipeSize: string,
    actualPipeType?: string // ประเภทท่อจริง (branch, secondary, main, emitter)
): PipeCalculationResult | null {
    try {
        let actualPressureClass = pressureClass;
        let pressureNote = '';

        let pipeData = getPipeData(pipeTypeOrSelectedPipeType, pressureClass);
        if (!pipeData) {
            if (pipeTypeOrSelectedPipeType.toUpperCase() === 'PE') {
                actualPressureClass = 'PN6.3';
                pipeData = getPipeData(pipeTypeOrSelectedPipeType, actualPressureClass);
                if (!pipeData) {
                    actualPressureClass = 'PN63';
                    pipeData = getPipeData(pipeTypeOrSelectedPipeType, actualPressureClass);
                }
                if (actualPressureClass !== pressureClass) {
                    pressureNote = ` (ใช้ ${actualPressureClass} แทน ${pressureClass})`;
                }
            } else if (pipeTypeOrSelectedPipeType.toUpperCase() === 'PVC') {
                actualPressureClass = 'Class8.5';
                pipeData = getPipeData(pipeTypeOrSelectedPipeType, actualPressureClass);
                if (!pipeData) {
                    actualPressureClass = 'Class85';
                    pipeData = getPipeData(pipeTypeOrSelectedPipeType, actualPressureClass);
                }
                if (actualPressureClass !== pressureClass) {
                    pressureNote = ` (ใช้ ${actualPressureClass} แทน ${pressureClass})`;
                }
            }
        }

        const pressureLossResult = findPressureLoss(
            pipeTypeOrSelectedPipeType,
            actualPressureClass,
            pipeSize,
            bestPipeInfo.waterFlowRate
        );

        if (!pressureLossResult) {
            return null;
        }

        // สำหรับ branch pipe ใช้ sprinklerCount แทน count (ถ้ามี)
        // ใช้ actualPipeType ถ้ามี ถ้าไม่มีให้ตรวจสอบจาก pipeTypeOrSelectedPipeType
        const isBranchPipe =
            actualPipeType === 'branch' ||
            (actualPipeType === undefined &&
                (pipeTypeOrSelectedPipeType === 'branch' ||
                    pipeTypeOrSelectedPipeType.toLowerCase().includes('branch')));
        const outletCount =
            isBranchPipe && bestPipeInfo.sprinklerCount
                ? bestPipeInfo.sprinklerCount
                : bestPipeInfo.count;

        const correctionResult = findCorrectionFactor(outletCount);

        const headLoss =
            (pressureLossResult.pressureLoss / 10) *
            bestPipeInfo.length *
            correctionResult.correctionFactor;

        const sizeNote =
            pressureLossResult.sizeInfo && !pressureLossResult.sizeInfo.isExactSizeMatch
                ? ` (ใช้ ${pressureLossResult.actualSize} แทน ${pipeSize})`
                : '';

        const pipeTypeDisplay = actualPipeType || pipeTypeOrSelectedPipeType;
        const calculationDetails = [
            `ใช้ ${pipeTypeDisplay} ${actualPressureClass} ขนาด ${pressureLossResult.actualSize}${pressureNote}${sizeNote}`,
            `อัตราการไหล: ${bestPipeInfo.waterFlowRate.toFixed(1)} L/min → ใช้ค่า ${pressureLossResult.actualFlow} L/min`,
            `ค่า pressureLoss: ${pressureLossResult.pressureLoss}`,
            `จำนวนทางออก: ${outletCount} → ใช้ค่า ${correctionResult.actualOutletCount}`,
            `ค่า correctionFactor: ${correctionResult.correctionFactor}`,
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
        console.error('Error calculating new head loss:', error);
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
            reason: 'เกิดข้อผิดพลาดในการตรวจสอบ: ' + error,
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
                `${pipe.sizeMM}mm`,
                pipeType // ส่ง pipeType เพื่อให้ใช้ sprinklerCount สำหรับ branch pipe
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
        console.error('Error selecting best pipe:', error);
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
 * เลือกท่อที่ดีที่สุดตาม Head Loss เป้าหมาย
 * @param availablePipes รายการท่อที่มีให้เลือก
 * @param pipeType ประเภทท่อ
 * @param bestPipeInfo ข้อมูลท่อที่ต้องการน้ำมากที่สุด
 * @param selectedPipeType ประเภทวัสดุท่อ (PE/PVC)
 * @param selectedPipeSizes ขนาดท่อที่เลือกไว้แล้ว
 * @param head20Percent ค่า 20% ของ Head จากแรงดันหัวฉีด (เมตร)
 * @param options preferSmallestValidPipe: เมื่อ true เลือกท่อที่เล็กที่สุดที่ headLoss <= max (สำหรับ field-crop เพื่อไม่ให้เลือกท่อใหญ่เกินจำเป็น)
 */
export function selectBestPipeByHeadLoss(
    availablePipes: any[],
    pipeType: string,
    bestPipeInfo: BestPipeInfo,
    selectedPipeType: string,
    selectedPipeSizes: SelectedPipeSizes,
    head20Percent: number,
    options?: { preferSmallestValidPipe?: boolean }
): any | null {
    const preferSmallestValidPipe = options?.preferSmallestValidPipe === true;
    if (!availablePipes.length || !bestPipeInfo) {
        return null;
    }

    const validPipes = availablePipes.filter((pipe) => {
        return validatePipeSizeHierarchy(pipeType, pipe.sizeMM, selectedPipeSizes);
    });

    if (!validPipes.length) {
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
            `${pipe.sizeMM}mm`,
            pipeType // ส่ง pipeType เพื่อให้ใช้ sprinklerCount สำหรับ branch pipe
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

    const maxAllowed = pipeType === 'main' ? head20Percent : head20Percent;
    const validCandidatesByLimit = candidates.filter((c) => c.headLoss <= maxAllowed);

    let bestCandidates: Array<{ pipe: any; headLoss: number; calculation: any }>;

    // โหมด field-crop: ในกลุ่มที่ head loss ผ่าน ใช้ "ใกล้เป้า" ก่อน แล้วค่อยท่อเล็ก (ไม่เลือกท่อใหญ่เกินที่ head loss ต่ำมาก)
    const sizeAsc = (a: any, b: any) => Number(a.pipe?.sizeMM ?? 0) - Number(b.pipe?.sizeMM ?? 0);
    if (preferSmallestValidPipe) {
        if (validCandidatesByLimit.length > 0) {
            // มีท่อที่ผ่าน: เลือกที่ head loss ใกล้ targetHeadLossValue (40%/60%/100%) ก่อน แล้วค่อยขนาดเล็ก
            bestCandidates = [...validCandidatesByLimit].sort((a, b) => {
                const diffA = Math.abs(a.headLoss - targetHeadLossValue);
                const diffB = Math.abs(b.headLoss - targetHeadLossValue);
                if (diffA !== diffB) return diffA - diffB;
                const sizeDiff = sizeAsc(a, b);
                if (sizeDiff !== 0) return sizeDiff;
                return a.headLoss - b.headLoss;
            });
        } else {
            // ไม่มีท่อที่ผ่าน: เลือกท่อที่เกินเกณฑ์น้อยที่สุด แล้วค่อยขนาดเล็ก
            bestCandidates = [...candidates].sort((a, b) => {
                const excessA = Math.max(0, a.headLoss - maxAllowed);
                const excessB = Math.max(0, b.headLoss - maxAllowed);
                if (excessA !== excessB) return excessA - excessB;
                const sizeDiff = sizeAsc(a, b);
                if (sizeDiff !== 0) return sizeDiff;
                return a.headLoss - b.headLoss;
            });
        }
    } else if (isMaxLimitMode) {
        const validCandidates = validCandidatesByLimit;

        if (validCandidates.length > 0) {
            const minDiff = Math.min(
                ...validCandidates.map((c) => Math.abs(c.headLoss - targetHeadLossValue))
            );
            bestCandidates = validCandidates.filter(
                (c) => Math.abs(c.headLoss - targetHeadLossValue) === minDiff
            );
        } else {
            const minDiff = Math.min(
                ...candidates.map((c) => Math.abs(c.headLoss - head20Percent))
            );
            bestCandidates = candidates.filter(
                (c) => Math.abs(c.headLoss - head20Percent) === minDiff
            );
        }

        bestCandidates.sort((a, b) => {
            const priceA = a.pipe.price || 0;
            const priceB = b.pipe.price || 0;
            if (priceA !== priceB) return priceA - priceB;
            return Number(a.pipe.sizeMM ?? 0) - Number(b.pipe.sizeMM ?? 0);
        });
    } else {
        const minDiff = Math.min(
            ...candidates.map((c) => Math.abs(c.headLoss - targetHeadLossValue))
        );
        bestCandidates = candidates.filter(
            (c) => Math.abs(c.headLoss - targetHeadLossValue) === minDiff
        );
        bestCandidates.sort((a, b) => {
            const priceA = a.pipe.price || 0;
            const priceB = b.pipe.price || 0;
            if (priceA !== priceB) return priceA - priceB;
            return Number(a.pipe.sizeMM ?? 0) - Number(b.pipe.sizeMM ?? 0);
        });
    }

    const bestPipe = bestCandidates[0]?.pipe ?? null;

    if (bestPipe) return bestPipe;

    // Fallback: อย่าใช้ validPipes[0] เพราะลำดับจาก API อาจเป็นท่อใหญ่สุด — เลือกท่อที่ขนาดเล็กที่สุด
    const sorted = [...validPipes].sort(
        (a, b) => Number(a.sizeMM ?? 0) - Number(b.sizeMM ?? 0)
    );
    return sorted[0] ?? null;
}
