// Pipe Selection Utilities
import { irrigationData } from './lossValue';

export interface PipeRecommendation {
    sizeMM: number;
    sizeInch: string;
    reason: string;
    pressureLoss?: number; // Pressure loss in meters
    hf?: number; // Head loss per 100m
    adjustmentFactor?: number; // F value
    calculationDetails?: {
        flowRate: number;
        length: number;
        outlets: number;
        selectedPipeType: string;
    };
}

export interface PipeRecommendations {
    main: PipeRecommendation;
    subMain: PipeRecommendation;
    lateral: PipeRecommendation;
}

// Interface สำหรับเก็บผลการคำนวณทั้ง PE และ PVC
export interface PipeTypeRecommendation {
    pe?: PipeRecommendation;
    pvc?: PipeRecommendation;
}

export interface PipeTypeRecommendations {
    main: PipeTypeRecommendation;
    subMain: PipeTypeRecommendation;
    lateral: PipeTypeRecommendation;
}

// ฟังก์ชันหา HF (Head Loss) จากตาราง
function findHeadLoss(
    pipeTable: { ids: number[]; data: { [key: number]: (number | null)[] }; sizes?: number[] },
    flowRate: number,
    pipeSizeIndex: number
): number | null {
    // หา flow rate ที่ใกล้เคียงที่สุด (มากกว่าหรือเท่ากับ)
    const flowRates = Object.keys(pipeTable.data)
        .map(Number)
        .sort((a, b) => a - b);
    let selectedFlow = flowRates.find((f) => f >= flowRate);

    // ถ้าไม่เจอ ให้ใช้ค่าสูงสุด
    if (!selectedFlow) {
        selectedFlow = flowRates[flowRates.length - 1];
    }

    const hfArray = pipeTable.data[selectedFlow];
    if (!hfArray || pipeSizeIndex >= hfArray.length) {
        return null;
    }

    const hf = hfArray[pipeSizeIndex];
    return hf === null ? null : hf;
}

// ฟังก์ชันหา F (Adjustment Factor) จากจำนวนทางออก
function getAdjustmentFactor(outlets: number): number {
    const factors = irrigationData.adjustmentFactors;
    const outletKeys = Object.keys(factors)
        .map(Number)
        .sort((a, b) => a - b);

    // หาค่าที่ใกล้เคียงที่สุด (มากกว่าหรือเท่ากับ)
    let selectedOutlet = outletKeys.find((o) => o >= outlets);

    // ถ้าไม่เจอ ให้ใช้ค่าสูงสุด
    if (!selectedOutlet) {
        selectedOutlet = outletKeys[outletKeys.length - 1];
    }

    // ถ้า outlets น้อยกว่า 1 ให้ใช้ค่าสำหรับ 1 outlet
    if (outlets < 1) {
        return factors[1];
    }

    return factors[selectedOutlet];
}

// ฟังก์ชันคำนวณ Pressure Loss และเลือกขนาดท่อที่เหมาะสม (สำหรับ pipe type เดียว)
function calculateOptimalPipeSize(
    flowRate: number,
    length: number,
    outlets: number,
    pipeTypeKey: string, // เช่น 'PE_PN6_3', 'PVC_5'
    pipeTypeName: string, // สำหรับแสดงผล เช่น 'PE LDPE PN 6.3'
    maxPressureLoss: number = 20 // กำหนดค่าสูงสุดเป็น 20m (ประมาณ 2 bar)
): PipeRecommendation | null {
    if (flowRate <= 0 || length <= 0) {
        return {
            sizeMM: 0,
            sizeInch: '0"',
            reason: 'Invalid input data',
            pressureLoss: 0,
        };
    }

    // เลือกตารางท่อตาม pipeTypeKey
    const selectedTable =
        irrigationData.pipeHeadLossTables[
            pipeTypeKey as keyof typeof irrigationData.pipeHeadLossTables
        ];

    if (!selectedTable) {
        return {
            sizeMM: 0,
            sizeInch: '0"',
            reason: `ไม่พบตารางข้อมูลสำหรับ ${pipeTypeKey}`,
            pressureLoss: 0,
        };
    }

    // หา F (Adjustment Factor)
    const adjustmentFactor = getAdjustmentFactor(outlets);

    // หาขนาดท่อที่เล็กที่สุดที่เหมาะสม (minimum suitable size)
    // วนจากขนาดเล็กไปใหญ่ เพื่อหาขนาดที่เล็กที่สุดที่ pressure loss ไม่เกินค่าสูงสุด
    let bestSize: {
        sizeMM: number;
        sizeOriginal: number;
        sizeInch: string;
        index: number;
        hf: number;
        pressureLoss: number;
    } | null = null;

    // ตรวจสอบว่า selectedTable มี sizes หรือไม่
    const hasSizes = 'sizes' in selectedTable && Array.isArray(selectedTable.sizes);
    const isPVC = pipeTypeKey.startsWith('PVC');

    for (let i = 0; i < selectedTable.ids.length; i++) {
        const hf = findHeadLoss(selectedTable, flowRate, i);

        if (hf === null || hf === undefined) continue;

        // คำนวณ Pressure Loss ตามสูตรใหม่
        // Pressure Loss = (HF / 10) × Length × F
        const pressureLoss = (hf / 10) * length * adjustmentFactor;

        // ถ้า pressure loss ไม่เกินค่าสูงสุด นี่คือขนาดที่เล็กที่สุดที่เหมาะสม
        if (pressureLoss <= maxPressureLoss) {
            // ใช้ sizes ถ้ามี ไม่เช่นนั้นใช้ ids
            let pipeSizeMM: number;
            let sizeOriginal: number;
            let sizeInchStr: string;

            if (hasSizes) {
                sizeOriginal = selectedTable.sizes[i];
                // สำหรับ PVC sizes เป็นนิ้ว ต้องแปลงเป็นมิลลิเมตร
                pipeSizeMM = isPVC ? sizeOriginal * 25.4 : sizeOriginal;
                // สำหรับ PVC ใช้ค่าเดิมจากตารางโดยตรง (แสดงทศนิยมที่ถูกต้อง)
                // สำหรับ PE แปลงจาก mm เป็นนิ้ว
                if (isPVC) {
                    // แสดงทศนิยม 2 ตำแหน่ง แต่ตัด .00 ออก
                    const formatted = sizeOriginal.toFixed(2);
                    sizeInchStr = formatted.replace(/\.?0+$/, '');
                } else {
                    sizeInchStr = (sizeOriginal / 25.4).toFixed(1);
                }
            } else {
                sizeOriginal = selectedTable.ids[i];
                pipeSizeMM = sizeOriginal;
                sizeInchStr = (sizeOriginal / 25.4).toFixed(1);
            }

            bestSize = {
                sizeMM: pipeSizeMM,
                sizeOriginal: sizeOriginal,
                sizeInch: sizeInchStr,
                index: i,
                hf: hf,
                pressureLoss: pressureLoss,
            };
            // หาเจอขนาดแรกที่เหมาะสมแล้ว (ขนาดเล็กที่สุด) ให้หยุดการค้นหา
            break;
        }
    }

    // ถ้าไม่เจอที่เหมาะสม ให้ใช้ขนาดที่ใหญ่ที่สุด
    if (!bestSize) {
        const largestIndex = selectedTable.ids.length - 1;
        const hf = findHeadLoss(selectedTable, flowRate, largestIndex);

        if (hf !== null && hf !== undefined) {
            // ใช้ sizes ถ้ามี ไม่เช่นนั้นใช้ ids
            let largestSize: number;
            let sizeOriginal: number;
            let sizeInchStr: string;

            if (hasSizes) {
                sizeOriginal = selectedTable.sizes[largestIndex];
                // สำหรับ PVC sizes เป็นนิ้ว ต้องแปลงเป็นมิลลิเมตร
                largestSize = isPVC ? sizeOriginal * 25.4 : sizeOriginal;
                // สำหรับ PVC ใช้ค่าเดิมจากตารางโดยตรง (แสดงทศนิยมที่ถูกต้อง)
                // สำหรับ PE แปลงจาก mm เป็นนิ้ว
                if (isPVC) {
                    // แสดงทศนิยม 2 ตำแหน่ง แต่ตัด .00 ออก
                    const formatted = sizeOriginal.toFixed(2);
                    sizeInchStr = formatted.replace(/\.?0+$/, '');
                } else {
                    sizeInchStr = (sizeOriginal / 25.4).toFixed(1);
                }
            } else {
                sizeOriginal = selectedTable.ids[largestIndex];
                largestSize = sizeOriginal;
                sizeInchStr = (sizeOriginal / 25.4).toFixed(1);
            }

            // ใช้สูตรใหม่: (HF / 10) × Length × F
            const pressureLoss = (hf / 10) * length * adjustmentFactor;

            // ตรวจสอบว่า pressure loss เกิน maxPressureLoss หรือไม่
            // ถ้าเกิน แสดงว่า pipe type นี้ไม่เหมาะสม ต้องเปลี่ยนชนิดท่อ
            if (pressureLoss > maxPressureLoss) {
                return {
                    sizeMM: 0,
                    sizeInch: '0"',
                    reason: `ไม่สามารถหาขนาดท่อที่เหมาะสมได้: Pressure Loss (${pressureLoss.toFixed(2)}m) เกินค่าสูงสุดที่อนุญาต (${maxPressureLoss.toFixed(2)}m) แม้ใช้ขนาดที่ใหญ่ที่สุด (${sizeInchStr}") ของ ${pipeTypeName}. กรุณาพิจารณาเปลี่ยนชนิดท่อหรือเพิ่มแรงดันน้ำ`,
                    pressureLoss: pressureLoss,
                };
            }

            bestSize = {
                sizeMM: largestSize,
                sizeOriginal: sizeOriginal,
                sizeInch: sizeInchStr,
                index: largestIndex,
                hf: hf,
                pressureLoss: pressureLoss,
            };
        } else {
            // ถ้าไม่สามารถหาได้จากตาราง ให้คืนค่า error
            return {
                sizeMM: 0,
                sizeInch: '0"',
                reason: 'ไม่สามารถคำนวณขนาดท่อได้จากตาราง (Flow rate หรือขนาดท่อเกินตาราง)',
                pressureLoss: 0,
            };
        }
    }

    // ตรวจสอบอีกครั้งว่า pressure loss ไม่เกิน maxPressureLoss
    // (กรณีที่ bestSize ถูกตั้งค่าแล้ว แต่ต้องตรวจสอบอีกครั้งเพื่อความแน่ใจ)
    if (bestSize.pressureLoss > maxPressureLoss) {
        return {
            sizeMM: 0,
            sizeInch: '0"',
            reason: `ไม่สามารถหาขนาดท่อที่เหมาะสมได้: Pressure Loss (${bestSize.pressureLoss.toFixed(2)}m) เกินค่าสูงสุดที่อนุญาต (${maxPressureLoss.toFixed(2)}m) แม้ใช้ขนาดที่ใหญ่ที่สุด (${bestSize.sizeInch}") ของ ${pipeTypeName}. กรุณาพิจารณาเปลี่ยนชนิดท่อหรือเพิ่มแรงดันน้ำ`,
            pressureLoss: bestSize.pressureLoss,
        };
    }

    // ใช้ค่า sizeInch ที่คำนวณไว้แล้ว
    const sizeInch = bestSize.sizeInch;

    // สร้าง reason พร้อมแสดง maxPressureLoss
    const reason = `Pressure Loss: ${bestSize.pressureLoss.toFixed(2)}m / Max: ${maxPressureLoss.toFixed(2)}m (Formula: (HF/10) × Length × F = (${bestSize.hf.toFixed(3)}/10) × ${length.toFixed(1)} × ${adjustmentFactor.toFixed(3)})`;

    return {
        sizeMM: bestSize.sizeMM,
        sizeInch: `${sizeInch}"`,
        reason: reason,
        pressureLoss: bestSize.pressureLoss,
        hf: bestSize.hf,
        adjustmentFactor: adjustmentFactor,
        calculationDetails: {
            flowRate: flowRate,
            length: length,
            outlets: outlets,
            selectedPipeType: pipeTypeKey,
        },
    };
}

// ฟังก์ชันหาขนาดท่อที่ใหญ่ที่สุดจากตารางที่ >= ขนาดที่ต้องการ
function findMinimumSizeFromTable(
    pipeTypeKey: string,
    minSizeMM: number
): { sizeMM: number; sizeInch: string } | null {
    const selectedTable =
        irrigationData.pipeHeadLossTables[
            pipeTypeKey as keyof typeof irrigationData.pipeHeadLossTables
        ];

    if (!selectedTable) return null;

    const hasSizes = 'sizes' in selectedTable && Array.isArray(selectedTable.sizes);
    const isPVC = pipeTypeKey.startsWith('PVC');

    // หาขนาดที่ใหญ่ที่สุดที่ >= minSizeMM
    let bestSize: { sizeMM: number; sizeInch: string } | null = null;

    for (let i = 0; i < selectedTable.ids.length; i++) {
        let pipeSizeMM: number;
        let sizeInchStr: string;

        if (hasSizes) {
            const sizeOriginal = selectedTable.sizes[i];
            pipeSizeMM = isPVC ? sizeOriginal * 25.4 : sizeOriginal;

            if (isPVC) {
                const formatted = sizeOriginal.toFixed(2);
                sizeInchStr = formatted.replace(/\.?0+$/, '');
            } else {
                sizeInchStr = (sizeOriginal / 25.4).toFixed(1);
            }
        } else {
            pipeSizeMM = selectedTable.ids[i];
            sizeInchStr = (pipeSizeMM / 25.4).toFixed(1);
        }

        if (pipeSizeMM >= minSizeMM) {
            bestSize = { sizeMM: pipeSizeMM, sizeInch: sizeInchStr };
            break; // หาเจอขนาดแรกที่ >= minSizeMM แล้ว
        }
    }

    // ถ้าไม่เจอ ให้ใช้ขนาดที่ใหญ่ที่สุด
    if (!bestSize) {
        const largestIndex = selectedTable.ids.length - 1;
        if (hasSizes) {
            const sizeOriginal = selectedTable.sizes[largestIndex];
            const pipeSizeMM = isPVC ? sizeOriginal * 25.4 : sizeOriginal;
            let sizeInchStr: string;
            if (isPVC) {
                const formatted = sizeOriginal.toFixed(2);
                sizeInchStr = formatted.replace(/\.?0+$/, '');
            } else {
                sizeInchStr = (sizeOriginal / 25.4).toFixed(1);
            }
            bestSize = { sizeMM: pipeSizeMM, sizeInch: sizeInchStr };
        } else {
            const pipeSizeMM = selectedTable.ids[largestIndex];
            bestSize = { sizeMM: pipeSizeMM, sizeInch: (pipeSizeMM / 25.4).toFixed(1) };
        }
    }

    return bestSize;
}

// ฟังก์ชันบังคับให้ขนาดท่อเป็นไปตามลำดับชั้น: main >= subMain >= lateral
function enforcePipeSizeHierarchy(result: PipeTypeRecommendations): PipeTypeRecommendations {
    // กำหนด pipe type keys สำหรับแต่ละประเภท
    const mainPEKey = 'PE_PN6_3';
    const mainPVCKey = 'PVC_5';
    const subMainPEKey = 'PE_PN4';
    const subMainPVCKey = 'PVC_5';

    // 1. เริ่มจาก lateral (เล็กที่สุด)
    const lateralSizePE = result.lateral.pe?.sizeMM || 0;
    const lateralSizePVC = result.lateral.pvc?.sizeMM || 0;

    // 2. subMain ต้อง >= lateral
    const minSubMainSizePE = Math.max(lateralSizePE, result.subMain.pe?.sizeMM || 0);
    const minSubMainSizePVC = Math.max(lateralSizePVC, result.subMain.pvc?.sizeMM || 0);

    // 3. main ต้อง >= subMain
    const minMainSizePE = Math.max(minSubMainSizePE, result.main.pe?.sizeMM || 0);
    const minMainSizePVC = Math.max(minSubMainSizePVC, result.main.pvc?.sizeMM || 0);

    // ปรับขนาดท่อให้เป็นไปตามลำดับชั้น
    const adjustedResult: PipeTypeRecommendations = {
        lateral: { ...result.lateral },
        subMain: { ...result.subMain },
        main: { ...result.main },
    };

    // ปรับ subMain PE
    if (result.subMain.pe && minSubMainSizePE > result.subMain.pe.sizeMM) {
        const newSize = findMinimumSizeFromTable(subMainPEKey, minSubMainSizePE);
        if (newSize) {
            adjustedResult.subMain.pe = {
                ...result.subMain.pe,
                sizeMM: newSize.sizeMM,
                sizeInch: `${newSize.sizeInch}"`,
                reason: `${result.subMain.pe.reason} (ปรับให้ >= lateral: ${lateralSizePE}mm)`,
            };
        }
    }

    // ปรับ subMain PVC
    if (result.subMain.pvc && minSubMainSizePVC > result.subMain.pvc.sizeMM) {
        const newSize = findMinimumSizeFromTable(subMainPVCKey, minSubMainSizePVC);
        if (newSize) {
            adjustedResult.subMain.pvc = {
                ...result.subMain.pvc,
                sizeMM: newSize.sizeMM,
                sizeInch: `${newSize.sizeInch}"`,
                reason: `${result.subMain.pvc.reason} (ปรับให้ >= lateral: ${lateralSizePVC}mm)`,
            };
        }
    }

    // ปรับ main PE
    if (result.main.pe && minMainSizePE > result.main.pe.sizeMM) {
        const newSize = findMinimumSizeFromTable(mainPEKey, minMainSizePE);
        if (newSize) {
            adjustedResult.main.pe = {
                ...result.main.pe,
                sizeMM: newSize.sizeMM,
                sizeInch: `${newSize.sizeInch}"`,
                reason: `${result.main.pe.reason} (ปรับให้ >= subMain: ${minSubMainSizePE}mm)`,
            };
        }
    }

    // ปรับ main PVC
    if (result.main.pvc && minMainSizePVC > result.main.pvc.sizeMM) {
        const newSize = findMinimumSizeFromTable(mainPVCKey, minMainSizePVC);
        if (newSize) {
            adjustedResult.main.pvc = {
                ...result.main.pvc,
                sizeMM: newSize.sizeMM,
                sizeInch: `${newSize.sizeInch}"`,
                reason: `${result.main.pvc.reason} (ปรับให้ >= subMain: ${minSubMainSizePVC}mm)`,
            };
        }
    }

    return adjustedResult;
}

// ฟังก์ชันคำนวณ maxPressureLoss ตามสัดส่วนที่กำหนด
// คำนวณแบบ cascade: lateral → subMain → main
// สรุป: Loss รวมทั้งหมด (lateral + subMain + main) ต้องไม่เกิน 20% ของ head loss
// เช่น แรงดัน 2 bar = 20m head, loss รวมต้องไม่เกิน 4m
// การคำนวณ:
// 1. Lateral: คำนวณก่อน - ใช้ได้ 40% ของ totalLossMax (อัตราส่วน 40:60 กับ subMain)
// 2. SubMain: รวม loss ของ lateral ที่เชื่อมกับมัน - ใช้ได้ 60% ของ totalLossMax
// 3. Main: รวม loss ของ lateral + subMain - ใช้ได้ 20% ของ head - (lateralLoss + subMainLoss)
// เงื่อนไข: loss ของ lateral ต้องไม่มากกว่า loss ของ subMain (ไม่รวม lateral)
function calculateMaxPressureLoss(
    waterPressure: number,
    pipeType: string,
    previousLosses?: {
        lateralLoss?: number;
        subMainLoss?: number;
    }
): number {
    // คำนวณ total head จากแรงดัน (1 Bar = 10 m Head)
    const totalHead = waterPressure * 10;

    // Total loss ต้องไม่เกิน 20% ของ head
    const totalLossMax = totalHead * 0.2; // เช่น 2 bar = 20m * 0.2 = 4m

    if (pipeType === 'lateral') {
        // Lateral: คำนวณก่อน - ใช้ได้ 40% ของ totalLossMax (อัตราส่วน 40:60 กับ subMain)
        return totalLossMax * 0.4; // 4m * 0.4 = 1.6m
    } else if (pipeType === 'subMain') {
        // SubMain: รวม loss ของ lateral ที่เชื่อมกับมัน
        // ใช้ได้ 60% ของ totalLossMax
        const lateralLoss = previousLosses?.lateralLoss || 0;
        const subMainMaxAllocation = totalLossMax * 0.6; // 4m * 0.6 = 2.4m
        // ใช้ค่าที่น้อยกว่าระหว่าง subMainMaxAllocation กับ remainingLoss
        const remainingLoss = totalLossMax - lateralLoss; // 4m - lateralLoss
        return Math.max(0, Math.min(subMainMaxAllocation, remainingLoss));
    } else {
        // Main: รวม loss ของ lateral + subMain
        // ใช้ได้ 20% ของ head - (lateralLoss + subMainLoss)
        const lateralLoss = previousLosses?.lateralLoss || 0;
        const subMainLoss = previousLosses?.subMainLoss || 0;
        const usedLoss = lateralLoss + subMainLoss;
        const remainingLoss = totalLossMax - usedLoss; // 4m - (lateral + subMain)
        // ต้องไม่เป็นลบ
        return Math.max(0, remainingLoss);
    }
}

// ฟังก์ชันคำนวณทั้ง PE และ PVC สำหรับ pipe type หนึ่ง
function calculatePipeSizeForType(
    flowRate: number,
    longestLength: number, // ใช้ความยาวท่อที่ยาวที่สุดของแต่ละชนิด
    pipeType: string, // 'main', 'subMain', 'lateral'
    outlets: number = 1,
    waterPressure: number = 2.0, // แรงดันน้ำในหน่วย Bar
    previousLosses?: {
        lateralLoss?: number;
        subMainLoss?: number;
    }
): PipeTypeRecommendation {
    const result: PipeTypeRecommendation = {};

    // คำนวณ maxPressureLoss ตามสัดส่วนแบบ cascade
    const maxPressureLoss = calculateMaxPressureLoss(waterPressure, pipeType, previousLosses);

    // กำหนดตารางที่ใช้สำหรับแต่ละ pipe type
    let peTableKey: string;
    let peTableName: string;
    let pvcTableKey: string;
    let pvcTableName: string;

    if (pipeType === 'main') {
        peTableKey = 'PE_PN6_3';
        peTableName = 'PE LDPE PN 6.3';
        pvcTableKey = 'PVC_5';
        pvcTableName = 'PVC Class 5';
    } else if (pipeType === 'subMain') {
        peTableKey = 'PE_PN4';
        peTableName = 'PE LDPE PN 4';
        pvcTableKey = 'PVC_5';
        pvcTableName = 'PVC Class 5';
    } else {
        // lateral
        peTableKey = 'PE_PN2_5';
        peTableName = 'PE LDPE PN 2.5';
        pvcTableKey = 'PVC_5';
        pvcTableName = 'PVC Class 5';
    }

    // คำนวณ PE (ใช้ความยาวท่อที่ยาวที่สุด)
    const peResult = calculateOptimalPipeSize(
        flowRate,
        longestLength,
        outlets,
        peTableKey,
        peTableName,
        maxPressureLoss
    );
    if (peResult && peResult.sizeMM > 0) {
        result.pe = peResult;
    }

    // คำนวณ PVC (ใช้ความยาวท่อที่ยาวที่สุด)
    const pvcResult = calculateOptimalPipeSize(
        flowRate,
        longestLength,
        outlets,
        pvcTableKey,
        pvcTableName,
        maxPressureLoss
    );
    if (pvcResult && pvcResult.sizeMM > 0) {
        result.pvc = pvcResult;
    }

    return result;
}

// ฟังก์ชันหลักสำหรับคำนวณขนาดท่อ (ใช้ข้อมูลจาก zone และตารางเท่านั้น) - เก็บไว้สำหรับ backward compatibility
export const calculatePipeSize = (
    flowRate: number,
    length: number,
    pipeType: string,
    outlets: number = 1,
    waterPressure: number = 2.0 // Default 2 Bar
): PipeRecommendation => {
    const typeResult = calculatePipeSizeForType(flowRate, length, pipeType, outlets, waterPressure);
    // Return PE ถ้ามี ไม่เช่นนั้น return PVC
    return (
        typeResult.pe ||
        typeResult.pvc || {
            sizeMM: 0,
            sizeInch: '0"',
            reason: 'ไม่สามารถคำนวณขนาดท่อได้',
            pressureLoss: 0,
        }
    );
};

// ฟังก์ชันสำหรับคำนวณข้อเสนอแนะทั้งหมด (ใช้ flow rate ของ zone ที่เลือก)
// คำนวณแบบ cascade: lateral → subMain → main
export const calculatePipeRecommendations = (
    zoneFlowRate: number, // Flow rate ของ zone ที่เลือก
    lateralFlowRate: number, // Flow rate ต่อ sprinkler
    waterPressure: number, // แรงดันน้ำในหน่วย Bar
    zoneData?: {
        mainLongestLength?: number; // ความยาวท่อเมนที่ยาวที่สุด
        subMainLongestLength?: number; // ความยาวท่อเมนย่อยที่ยาวที่สุด
        lateralLongestLength?: number; // ความยาวท่อย่อยที่ยาวที่สุด
        mainLength?: number; // สำหรับ backward compatibility
        subMainLength?: number; // สำหรับ backward compatibility
        lateralLength?: number; // สำหรับ backward compatibility
        mainOutlets?: number;
        subMainOutlets?: number;
        lateralOutlets?: number;
    }
): PipeRecommendations => {
    // ใช้ longestLength ถ้ามี ไม่เช่นนั้นใช้ length (backward compatibility)
    const mainLongestLength = zoneData?.mainLongestLength || zoneData?.mainLength || 50;
    const subMainLongestLength = zoneData?.subMainLongestLength || zoneData?.subMainLength || 30;
    const lateralLongestLength = zoneData?.lateralLongestLength || zoneData?.lateralLength || 20;

    // ใช้ calculatePipeRecommendationsWithTypes เพื่อคำนวณแบบ cascade
    const pipeTypeRecs = calculatePipeRecommendationsWithTypes(
        zoneFlowRate,
        lateralFlowRate,
        waterPressure,
        {
            mainLongestLength,
            subMainLongestLength,
            lateralLongestLength,
            mainOutlets: zoneData?.mainOutlets,
            subMainOutlets: zoneData?.subMainOutlets,
            lateralOutlets: zoneData?.lateralOutlets,
        }
    );

    // ใช้ PE เป็นค่าเริ่มต้น (backward compatibility)
    return {
        main: pipeTypeRecs.main.pe ||
            pipeTypeRecs.main.pvc || {
                sizeMM: 0,
                sizeInch: '0"',
                reason: 'ไม่สามารถคำนวณขนาดท่อได้',
                pressureLoss: 0,
            },
        subMain: pipeTypeRecs.subMain.pe ||
            pipeTypeRecs.subMain.pvc || {
                sizeMM: 0,
                sizeInch: '0"',
                reason: 'ไม่สามารถคำนวณขนาดท่อได้',
                pressureLoss: 0,
            },
        lateral: pipeTypeRecs.lateral.pe ||
            pipeTypeRecs.lateral.pvc || {
                sizeMM: 0,
                sizeInch: '0"',
                reason: 'ไม่สามารถคำนวณขนาดท่อได้',
                pressureLoss: 0,
            },
    };
};

// ฟังก์ชันใหม่สำหรับคำนวณข้อเสนอแนะทั้งหมดพร้อมทั้ง PE และ PVC
// คำนวณแบบ cascade: lateral → subMain → main
export const calculatePipeRecommendationsWithTypes = (
    zoneFlowRate: number, // Flow rate ของ zone ที่เลือก
    lateralFlowRate: number, // Flow rate ต่อ sprinkler
    waterPressure: number, // แรงดันน้ำในหน่วย Bar
    zoneData?: {
        mainLongestLength?: number; // ความยาวท่อเมนที่ยาวที่สุด
        subMainLongestLength?: number; // ความยาวท่อเมนย่อยที่ยาวที่สุด
        lateralLongestLength?: number; // ความยาวท่อย่อยที่ยาวที่สุด
        mainOutlets?: number; // จำนวนทางออกของท่อเมน (จำนวน subMain ที่เชื่อมกับ main)
        subMainOutlets?: number; // จำนวนทางออกของท่อเมนย่อย (จำนวน lateral ที่เชื่อมกับ subMain)
        lateralOutlets?: number; // จำนวนทางออกของท่อย่อย (จำนวน sprinklers ใน lateral line)
        // Flow rates สำหรับท่อที่ยาวที่สุด
        lateralLongestFlowRate?: number; // Flow rate ที่ท่อ lateral ที่ยาวที่สุดรับ
        subMainLongestFlowRate?: number; // Flow rate รวมที่ท่อ subMain ที่ยาวที่สุดรับ (จาก lateral ทั้งหมดที่เชื่อมกับมัน)
        mainLongestFlowRate?: number; // Flow rate รวมที่ท่อ main ที่ยาวที่สุดรับ (จาก subMain ทั้งหมดที่เชื่อมกับมัน)
    }
): PipeTypeRecommendations => {
    // ใช้ความยาวท่อที่ยาวที่สุดของแต่ละชนิด (ต้องส่งมาจาก longestPipes)
    const mainLongestLength = zoneData?.mainLongestLength || 50; // Default 50m
    const subMainLongestLength = zoneData?.subMainLongestLength || 30; // Default 30m
    const lateralLongestLength = zoneData?.lateralLongestLength || 20; // Default 20m
    const mainOutlets = zoneData?.mainOutlets || 1;
    const subMainOutlets = zoneData?.subMainOutlets || 1;
    const lateralOutlets = zoneData?.lateralOutlets || 1;

    // คำนวณ flow rate สำหรับท่อที่ยาวที่สุดแต่ละประเภท
    // ⚠️ สำคัญ: การคำนวณ fallback นี้เป็นเพียงการประมาณการ (estimation) ที่อาจจะ overestimate
    // ควรส่งค่า lateralLongestFlowRate, subMainLongestFlowRate, และ mainLongestFlowRate
    // ที่เป็นผลรวมที่แท้จริง (Actual Sum) จากส่วนที่เรียกใช้เสมอ

    // 1. Lateral ที่ยาวที่สุด: รับ flow rate จาก sprinklers ใน lateral line นั้น
    // Flow rate = flow rate ต่อ sprinkler × จำนวน sprinklers (lateralOutlets)
    // ⚠️ Fallback: สมมติว่าทุก sprinkler ใน lateral line มี flow rate เท่ากัน
    // ซึ่งอาจจะ overestimate ถ้า lateral line ที่ยาวที่สุดมี sprinklers น้อยกว่าค่าเฉลี่ย
    const lateralLongestFlowRate =
        zoneData?.lateralLongestFlowRate || lateralFlowRate * lateralOutlets;

    if (!zoneData?.lateralLongestFlowRate) {
        console.warn(
            `⚠️ [Pipe Selection] Using fallback calculation for lateralLongestFlowRate: ${lateralLongestFlowRate.toFixed(2)} LPM (${lateralFlowRate.toFixed(2)} × ${lateralOutlets}). ` +
                `This may overestimate. Please provide actual lateralLongestFlowRate from zone data.`
        );
    }

    // 2. SubMain ที่ยาวที่สุด: รับ flow rate รวมจาก lateral ทั้งหมดที่เชื่อมกับมัน
    // Flow rate = flow rate ของ lateral × จำนวน lateral ที่เชื่อม (subMainOutlets)
    // ⚠️ Fallback: สมมติว่าทุก lateral ที่เชื่อมกับ subMain มี flow rate เท่ากับ lateral ที่ยาวที่สุด
    // ซึ่งอาจจะ overestimate ถ้า lateral อื่นๆ มี flow rate น้อยกว่า
    const subMainLongestFlowRate =
        zoneData?.subMainLongestFlowRate || lateralLongestFlowRate * subMainOutlets;

    if (!zoneData?.subMainLongestFlowRate) {
        console.warn(
            `⚠️ [Pipe Selection] Using fallback calculation for subMainLongestFlowRate: ${subMainLongestFlowRate.toFixed(2)} LPM (${lateralLongestFlowRate.toFixed(2)} × ${subMainOutlets}). ` +
                `This may overestimate. Please provide actual subMainLongestFlowRate from zone data.`
        );
    }

    // 3. Main ที่ยาวที่สุด: รับ flow rate รวมจาก subMain ทั้งหมดที่เชื่อมกับมัน
    // Flow rate = flow rate ของ subMain × จำนวน subMain ที่เชื่อม (mainOutlets)
    // ⚠️ Fallback: สมมติว่าทุก subMain ที่เชื่อมกับ main มี flow rate เท่ากับ subMain ที่ยาวที่สุด
    // ซึ่งอาจจะ overestimate ถ้า subMain อื่นๆ มี flow rate น้อยกว่า
    const mainLongestFlowRate =
        zoneData?.mainLongestFlowRate || subMainLongestFlowRate * mainOutlets;

    if (!zoneData?.mainLongestFlowRate) {
        console.warn(
            `⚠️ [Pipe Selection] Using fallback calculation for mainLongestFlowRate: ${mainLongestFlowRate.toFixed(2)} LPM (${subMainLongestFlowRate.toFixed(2)} × ${mainOutlets}). ` +
                `This may overestimate. Please provide actual mainLongestFlowRate from zone data.`
        );
    }

    // ขั้นตอนที่ 1: คำนวณ Lateral ก่อน (ใช้ได้ max 0.8m)
    // ใช้ flow rate ของ lateral ที่ยาวที่สุด: lateralLongestFlowRate
    // สูตร: (HF/10) × longestLength × F
    const lateralResult = calculatePipeSizeForType(
        lateralLongestFlowRate,
        lateralLongestLength,
        'lateral',
        lateralOutlets,
        waterPressure
    );

    // เก็บ pressure loss จาก lateral แยกตาม PE และ PVC
    const lateralLossPE = lateralResult.pe?.pressureLoss || 0;
    const lateralLossPVC = lateralResult.pvc?.pressureLoss || 0;

    // ใช้ค่า loss ที่น้อยกว่า (best-case) ในการคำนวณ maxPressureLoss สำหรับ subMain
    // เพื่อให้ subMain และ main pipe มีโอกาสหาขนาดที่เหมาะสมได้
    let lateralLossForCalculation = Math.min(lateralLossPE, lateralLossPVC);

    // ขั้นตอนที่ 2: คำนวณ SubMain โดยรวม loss ของ lateral ที่เชื่อมกับมัน
    // ท่อเมนย่อยจะรับภาระจากท่อย่อย
    // ใช้ flow rate ของ subMain ที่ยาวที่สุด: subMainLongestFlowRate (รวมจาก lateral ทั้งหมดที่เชื่อมกับมัน)
    const subMainResult = calculatePipeSizeForType(
        subMainLongestFlowRate,
        subMainLongestLength,
        'subMain',
        subMainOutlets,
        waterPressure,
        { lateralLoss: lateralLossForCalculation }
    );

    // เก็บ loss ของ subMain เองก่อน (ไม่รวม lateral) แยกตาม PE และ PVC
    const subMainLossSelfPE = subMainResult.pe?.pressureLoss || 0;
    const subMainLossSelfPVC = subMainResult.pvc?.pressureLoss || 0;

    // ใช้ค่า loss ที่น้อยกว่า (best-case) ในการคำนวณ maxPressureLoss สำหรับ main
    const subMainLossSelfForCalculation = Math.min(subMainLossSelfPE, subMainLossSelfPVC);

    // ตรวจสอบเงื่อนไข: loss ของ lateral ต้องไม่มากกว่า loss ของ subMain (ไม่รวม lateral)
    // ถ้า lateralLossForCalculation > subMainLossSelfForCalculation ให้ปรับ lateralLossForCalculation
    if (
        lateralLossForCalculation > subMainLossSelfForCalculation &&
        subMainLossSelfForCalculation > 0
    ) {
        lateralLossForCalculation = subMainLossSelfForCalculation;
    }

    // subMain loss รวม = loss ของ subMain เอง + loss ของ lateral (แยกตาม PE และ PVC)
    const subMainLossPE = subMainLossSelfPE + lateralLossPE;
    const subMainLossPVC = subMainLossSelfPVC + lateralLossPVC;

    // ใช้ค่า loss ที่น้อยกว่า (best-case) ในการคำนวณ maxPressureLoss สำหรับ main
    const subMainLossForCalculation = Math.min(subMainLossPE, subMainLossPVC);

    // อัปเดต pressureLoss ในผลลัพธ์ให้รวม loss จาก lateral
    if (subMainResult.pe) {
        subMainResult.pe.pressureLoss = subMainLossPE;
    }
    if (subMainResult.pvc) {
        subMainResult.pvc.pressureLoss = subMainLossPVC;
    }

    // ขั้นตอนที่ 3: คำนวณ Main โดยรวม loss ของ lateral + subMain
    // ท่อเมนจะรับภาระจากท่อเมนย่อยด้วย
    // ใช้ flow rate ของ main ที่ยาวที่สุด: mainLongestFlowRate (รวมจาก subMain ทั้งหมดที่เชื่อมกับมัน)
    // ใช้ค่า loss ที่น้อยกว่า (best-case) ในการคำนวณ maxPressureLoss สำหรับ main
    const mainResult = calculatePipeSizeForType(
        mainLongestFlowRate,
        mainLongestLength,
        'main',
        mainOutlets,
        waterPressure,
        { lateralLoss: lateralLossForCalculation, subMainLoss: subMainLossForCalculation }
    );

    // เก็บ loss ของ main เองก่อน (ไม่รวม lateral + subMain) แยกตาม PE และ PVC
    const mainLossSelfPE = mainResult.pe?.pressureLoss || 0;
    const mainLossSelfPVC = mainResult.pvc?.pressureLoss || 0;

    // main loss รวม = loss ของ main เอง + loss ของ subMain (subMainLoss รวม lateral แล้ว)
    // ไม่ต้องบวก lateralLoss อีกเพราะ subMainLoss รวม lateral อยู่แล้ว
    const mainLossPE = mainLossSelfPE + subMainLossPE;
    const mainLossPVC = mainLossSelfPVC + subMainLossPVC;

    // ใช้ค่า loss ที่สูงที่สุด (worst-case) สำหรับการคำนวณ TDH เพื่อให้แน่ใจว่าปั๊มจะแรงพอ
    const mainLoss = Math.max(mainLossPE, mainLossPVC);

    // อัปเดต pressureLoss ในผลลัพธ์ให้รวม loss จาก lateral + subMain
    if (mainResult.pe) {
        mainResult.pe.pressureLoss = mainLossPE;
    }
    if (mainResult.pvc) {
        mainResult.pvc.pressureLoss = mainLossPVC;
    }

    // ตรวจสอบว่า loss รวมทั้งหมดไม่เกิน 20% ของ head loss
    // ใช้ค่า worst-case (Math.max) สำหรับการตรวจสอบ
    const totalHead = waterPressure * 10; // แปลง bar เป็น meter head
    const totalLossMax = totalHead * 0.2; // 20% ของ head loss
    const totalLoss = mainLoss; // mainLoss รวม lateral + subMain แล้ว (worst-case)

    // คำนวณ worst-case loss สำหรับการแสดงผล
    const lateralLossWorstCase = Math.max(lateralLossPE, lateralLossPVC);
    const subMainLossWorstCase = Math.max(subMainLossPE, subMainLossPVC);

    // ถ้า loss รวมเกินค่าสูงสุด ให้แจ้งเตือน (แต่ยังคงใช้ผลลัพธ์ที่คำนวณได้)
    // ระบบจะเลือกขนาดท่อที่เล็กที่สุดที่เหมาะสมแล้ว ดังนั้นถ้า loss ยังเกิน
    // อาจต้องเพิ่มแรงดันน้ำหรือปรับปรุงการออกแบบระบบ
    if (totalLoss > totalLossMax) {
        console.warn(
            `⚠️ Total pressure loss (worst-case: ${totalLoss.toFixed(2)}m) exceeds maximum allowed (${totalLossMax.toFixed(2)}m = 20% of ${totalHead.toFixed(2)}m head)`
        );
        console.warn(`   - Lateral loss (worst-case): ${lateralLossWorstCase.toFixed(2)}m`);
        console.warn(
            `   - SubMain loss (worst-case, รวม lateral): ${subMainLossWorstCase.toFixed(2)}m`
        );
        console.warn(`   - Main loss (worst-case, รวม lateral + subMain): ${mainLoss.toFixed(2)}m`);
        console.warn(
            `   💡 Suggestion: Consider increasing water pressure or using larger pipe sizes.`
        );
    } else {
        console.log(
            `✅ Total pressure loss (worst-case) is within limit: ${totalLoss.toFixed(2)}m / ${totalLossMax.toFixed(2)}m (20% of ${totalHead.toFixed(2)}m head)`
        );
        console.log(`   - Lateral loss (worst-case): ${lateralLossWorstCase.toFixed(2)}m`);
        console.log(
            `   - SubMain loss (worst-case, รวม lateral): ${subMainLossWorstCase.toFixed(2)}m`
        );
        console.log(`   - Main loss (worst-case, รวม lateral + subMain): ${mainLoss.toFixed(2)}m`);
    }

    // สร้างผลลัพธ์เริ่มต้น
    const initialResult: PipeTypeRecommendations = {
        main: mainResult,
        subMain: subMainResult,
        lateral: lateralResult,
    };

    // บังคับให้ขนาดท่อเป็นไปตามลำดับชั้น: main >= subMain >= lateral
    const adjustedResult = enforcePipeSizeHierarchy(initialResult);

    return adjustedResult;
};
