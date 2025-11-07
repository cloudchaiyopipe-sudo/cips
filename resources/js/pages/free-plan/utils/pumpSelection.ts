// Pump Selection Utilities
export interface TDHCalculationDetails {
    // 2. การคำนวณ TDH
    staticHead?: number; // ความสูงคงที่ (m) - ถ้ามี
    frictionLosses: {
        mainLoss: number; // Pressure loss จาก main pipe (m)
        subMainLoss: number; // Pressure loss จาก subMain pipe (m)
        lateralLoss: number; // Pressure loss จาก lateral pipe (m)
        totalFrictionLoss: number; // รวม friction losses (m)
    };
    minorLosses: number; // Minor losses (fitting losses, connection losses) (m)
    pressureRequirement: number; // Pressure requirement สำหรับ sprinkler (m) = pressure * 10
    totalDynamicHead: number; // TDH รวม (m)
    
    // 3. การคำนวณกำลังปั๊ม
    hydraulicPower: number; // Hydraulic power (kW) = Flow × Head × 9.81 / 3600
    efficiency: number; // Pump efficiency (default 0.6 = 60%)
    brakePower: number; // Brake power (kW) = Hydraulic power / Efficiency
    powerHP: number; // Power in HP = Brake power / 0.746
}

export interface PumpRecommendation {
    flowRate: number;
    head: number; // TDH (Total Dynamic Head) in meters - ใช้ค่าจาก PE หรือ PVC (เลือกค่าที่สูงที่สุด - worst-case)
    power: number; // Power in HP - ใช้ค่าจาก PE หรือ PVC (เลือกค่าที่สูงที่สุด - worst-case)
    reason: string;
    specifications: string;
    calculationDetails?: {
        // 1. ระบบอัตราการไหล
        systemFlowRate: number; // LPM
        
        // 2. การคำนวณ TDH แยกตาม pipe type (PE และ PVC)
        pe?: TDHCalculationDetails; // การคำนวณ TDH สำหรับท่อ PE
        pvc?: TDHCalculationDetails; // การคำนวณ TDH สำหรับท่อ PVC
    };
}

export interface PumpCalculationInput {
    flowRate: number; // อัตราการไหลรวมของระบบ (LPM)
    pressure: number; // แรงดันที่ต้องการสำหรับ sprinkler (Bar)
    pipePressureLosses?: {
        pe?: {
            mainLoss?: number; // Pressure loss จาก main pipe PE (m)
            subMainLoss?: number; // Pressure loss จาก subMain pipe PE (m)
            lateralLoss?: number; // Pressure loss จาก lateral pipe PE (m)
        };
        pvc?: {
            mainLoss?: number; // Pressure loss จาก main pipe PVC (m)
            subMainLoss?: number; // Pressure loss จาก subMain pipe PVC (m)
            lateralLoss?: number; // Pressure loss จาก lateral pipe PVC (m)
        };
    };
    staticHead?: number; // ความสูงคงที่จากแหล่งน้ำถึงจุดสูงสุด (m) - optional
    minorLossFactor?: number; // ปัจจัยสำหรับ minor losses (default 0.05 = 5% ของ friction loss)
}

// Helper function สำหรับคำนวณ TDH จาก pressure losses
function calculateTDH(
    mainLoss: number,
    subMainLoss: number,
    lateralLoss: number,
    pressureRequirement: number,
    staticHead: number,
    minorLossFactor: number
): TDHCalculationDetails {
    const totalFrictionLoss = mainLoss + subMainLoss + lateralLoss;
    const minorLosses = totalFrictionLoss * minorLossFactor;
    const totalDynamicHead = staticHead + totalFrictionLoss + minorLosses + pressureRequirement;
    
    // คำนวณกำลังปั๊ม
    return {
        staticHead: staticHead,
        frictionLosses: {
            mainLoss: Math.round(mainLoss * 100) / 100,
            subMainLoss: Math.round(subMainLoss * 100) / 100,
            lateralLoss: Math.round(lateralLoss * 100) / 100,
            totalFrictionLoss: Math.round(totalFrictionLoss * 100) / 100
        },
        minorLosses: Math.round(minorLosses * 100) / 100,
        pressureRequirement: Math.round(pressureRequirement * 100) / 100,
        totalDynamicHead: Math.round(totalDynamicHead * 100) / 100,
        
        // คำนวณกำลังปั๊ม
        hydraulicPower: 0, // จะคำนวณทีหลังเมื่อมี flow rate
        efficiency: 0.6,
        brakePower: 0, // จะคำนวณทีหลังเมื่อมี flow rate
        powerHP: 0 // จะคำนวณทีหลังเมื่อมี flow rate
    };
}

// Helper function สำหรับคำนวณกำลังปั๊ม
function calculatePumpPower(flowRate: number, tdh: number, efficiency: number = 0.6): {
    hydraulicPower: number;
    brakePower: number;
    powerHP: number;
} {
    const flowRateM3PerSec = (flowRate / 1000) / 60; // แปลง LPM เป็น m³/s
    const hydraulicPowerKW = (flowRateM3PerSec * tdh * 9.81); // kW
    const brakePowerKW = hydraulicPowerKW / efficiency;
    const powerHP = brakePowerKW / 0.746;
    const finalPower = Math.max(powerHP, 0.1); // ขั้นต่ำ 0.1 HP
    
    return {
        hydraulicPower: Math.round(hydraulicPowerKW * 1000) / 1000,
        brakePower: Math.round(brakePowerKW * 1000) / 1000,
        powerHP: Math.round(finalPower * 100) / 100
    };
}

export const calculatePumpRequirements = (
    flowRate: number, 
    pressure: number,
    pipePressureLosses?: {
        pe?: {
            mainLoss?: number;
            subMainLoss?: number;
            lateralLoss?: number;
        };
        pvc?: {
            mainLoss?: number;
            subMainLoss?: number;
            lateralLoss?: number;
        };
    },
    staticHead: number = 0,
    minorLossFactor: number = 0.05 // Default 5% ของ friction loss
): PumpRecommendation => {
    // 1. คำนวณอัตราการไหลของระบบ
    const systemFlowRate = flowRate; // LPM
    
    console.log('📊 Pump Calculation - Step 1: System Flow Rate');
    console.log(`   System Flow Rate: ${systemFlowRate} LPM`);
    
    // 2.3 Pressure Requirement สำหรับ sprinkler
    // แปลงจาก Bar เป็น meter head (1 Bar = 10 m)
    const pressureRequirement = pressure * 10;
    
    // 2.4 Static Head (ความสูงคงที่ - ถ้ามี)
    const staticHeadM = staticHead || 0;
    
    // 2. คำนวณ Total Dynamic Head (TDH) แยกตาม pipe type (PE และ PVC)
    let peCalculation: TDHCalculationDetails | undefined;
    let pvcCalculation: TDHCalculationDetails | undefined;
    
    // คำนวณ TDH สำหรับ PE
    if (pipePressureLosses?.pe) {
        const peTDH = calculateTDH(
            pipePressureLosses.pe.mainLoss || 0,
            pipePressureLosses.pe.subMainLoss || 0,
            pipePressureLosses.pe.lateralLoss || 0,
            pressureRequirement,
            staticHeadM,
            minorLossFactor
        );
        const pePower = calculatePumpPower(systemFlowRate, peTDH.totalDynamicHead, 0.6);
        peCalculation = {
            ...peTDH,
            ...pePower
        };
        
        console.log('📊 Pump Calculation - Step 2: Total Dynamic Head (TDH) - PE');
        console.log(`   PE - Total TDH: ${peCalculation.totalDynamicHead.toFixed(2)} m`);
    }
    
    // คำนวณ TDH สำหรับ PVC
    if (pipePressureLosses?.pvc) {
        const pvcTDH = calculateTDH(
            pipePressureLosses.pvc.mainLoss || 0,
            pipePressureLosses.pvc.subMainLoss || 0,
            pipePressureLosses.pvc.lateralLoss || 0,
            pressureRequirement,
            staticHeadM,
            minorLossFactor
        );
        const pvcPower = calculatePumpPower(systemFlowRate, pvcTDH.totalDynamicHead, 0.6);
        pvcCalculation = {
            ...pvcTDH,
            ...pvcPower
        };
        
        console.log('📊 Pump Calculation - Step 2: Total Dynamic Head (TDH) - PVC');
        console.log(`   PVC - Total TDH: ${pvcCalculation.totalDynamicHead.toFixed(2)} m`);
    }
    
    // เลือกค่า TDH และ Power ที่สูงที่สุด (worst-case) สำหรับการแสดงผลหลัก
    // เพื่อให้แน่ใจว่าปั๊มที่เลือกมาจะแรงพอ ไม่ว่าผู้ใช้จะเลือกใช้ท่อชนิดไหนก็ตาม
    let selectedTDH = 0;
    let selectedPower = 0;
    
    if (peCalculation && pvcCalculation) {
        // ถ้ามีทั้ง PE และ PVC ให้เลือกค่าที่สูงที่สุด (worst-case)
        selectedTDH = Math.max(peCalculation.totalDynamicHead, pvcCalculation.totalDynamicHead);
        selectedPower = selectedTDH === peCalculation.totalDynamicHead 
            ? peCalculation.powerHP 
            : pvcCalculation.powerHP;
    } else if (peCalculation) {
        selectedTDH = peCalculation.totalDynamicHead;
        selectedPower = peCalculation.powerHP;
    } else if (pvcCalculation) {
        selectedTDH = pvcCalculation.totalDynamicHead;
        selectedPower = pvcCalculation.powerHP;
    } else {
        // Fallback: ถ้าไม่มีข้อมูลท่อ ให้คำนวณแบบเดิม
        selectedTDH = staticHeadM + pressureRequirement;
        const fallbackPower = calculatePumpPower(systemFlowRate, selectedTDH, 0.6);
        selectedPower = fallbackPower.powerHP;
    }
    
    // สร้างข้อความ reason และ specifications
    let reason = '';
    let specifications = '';
    
    if (flowRate >= 200) {
        reason = `High Flow Rate System (${Math.round(flowRate)} LPM, TDH: ${selectedTDH.toFixed(1)}m)`;
        specifications = 'High Pressure Pump 3-5 HP';
    } else if (flowRate >= 100) {
        reason = `Medium Flow Rate System (${Math.round(flowRate)} LPM, TDH: ${selectedTDH.toFixed(1)}m)`;
        specifications = 'Medium Pressure Pump 1.5-3 HP';
    } else if (flowRate >= 50) {
        reason = `Medium Flow Rate System (${Math.round(flowRate)} LPM, TDH: ${selectedTDH.toFixed(1)}m)`;
        specifications = 'Medium Pressure Pump 1-2 HP';
    } else if (flowRate > 0) {
        reason = `Low Flow Rate System (${Math.round(flowRate)} LPM, TDH: ${selectedTDH.toFixed(1)}m)`;
        specifications = 'Low Pressure Pump 0.5-1 HP';
    } else {
        reason = 'No Flow Rate Data';
        specifications = 'Small Pump 0.1-0.5 HP';
    }
    
    return {
        flowRate: Math.round(systemFlowRate),
        head: Math.round(selectedTDH * 10) / 10, // TDH ในหน่วย m (เลือกค่าที่สูงที่สุด - worst-case)
        power: Math.round(selectedPower * 10) / 10, // Power ในหน่วย HP (เลือกค่าที่สูงที่สุด - worst-case)
        reason: reason,
        specifications: specifications,
        calculationDetails: {
            // Step 1: ระบบอัตราการไหล
            systemFlowRate: systemFlowRate,
            
            // Step 2: การคำนวณ TDH แยกตาม pipe type
            pe: peCalculation,
            pvc: pvcCalculation
        }
    };
};
