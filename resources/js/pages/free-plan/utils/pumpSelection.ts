// Pump Selection Utilities
export interface PumpRecommendation {
    flowRate: number;
    head: number;
    power: number;
    reason: string;
    specifications: string;
}

export const calculatePumpRequirements = (flowRate: number, pressure: number): PumpRecommendation => {
    // ตรวจสอบข้อมูลพื้นฐาน
    console.log('Pump calculation inputs:', { flowRate, pressure });
    
    // คำนวณ Head จากแรงดัน (1 Bar = 10 m Head)
    const head = pressure * 10;
    
    // คำนวณกำลังปั๊ม (Power = Flow × Head × 9.81 / 3600 / Efficiency)
    // สมมติ efficiency = 0.6 (60%)
    const efficiency = 0.6;
    const power = (flowRate * head * 9.81) / (3600 * efficiency);
    
    // แปลงเป็น HP (1 HP = 746 W)
    const powerHP = power / 746;
    
    console.log('Pump calculation details:', { head, power, powerHP });
    
    let reason = '';
    let specifications = '';
    
    // ใช้กำลังที่คำนวณได้จริง หรือใช้ค่าขั้นต่ำ
    const finalPower = Math.max(powerHP, 0.1); // ขั้นต่ำ 0.1 HP
    
    if (flowRate >= 200) {
        reason = 'High Flow Rate (≥200 LPM)';
        specifications = 'High Pressure Pump 3-5 HP';
    } else if (flowRate >= 100) {
        reason = 'Medium Flow Rate (100-200 LPM)';
        specifications = 'Medium Pressure Pump 1.5-3 HP';
    } else if (flowRate >= 50) {
        reason = 'Medium Flow Rate (50-100 LPM)';
        specifications = 'Medium Pressure Pump 1-2 HP';
    } else if (flowRate > 0) {
        reason = 'Low Flow Rate (<50 LPM)';
        specifications = 'Low Pressure Pump 0.5-1 HP';
    } else {
        reason = 'No Flow Rate Data';
        specifications = 'Small Pump 0.1-0.5 HP';
    }
    
    return {
        flowRate: Math.round(flowRate),
        head: Math.round(head * 10) / 10,
        power: Math.round(finalPower * 10) / 10,
        reason: reason,
        specifications: specifications
    };
};
