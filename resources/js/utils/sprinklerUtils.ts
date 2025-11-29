export interface SprinklerConfig {
    flowRatePerMinute: number;
    pressureBar: number;
    sprinklersPerTree: number; // จำนวนสปริงเกอร์ต่อต้นไม้ 1 ต้น
    createdAt: string;
    updatedAt: string;
}

export interface SprinklerFormData {
    flowRatePerMinute: string;
    pressureBar: string;
    sprinklersPerTree: string;
}

export const SPRINKLER_STORAGE_KEY = 'sprinklerConfig';

export const saveSprinklerConfig = (
    config: Omit<SprinklerConfig, 'createdAt' | 'updatedAt'>
): boolean => {
    try {
        const now = new Date().toISOString();
        const configWithTimestamp: SprinklerConfig = {
            ...config,
            createdAt: now,
            updatedAt: now,
        };

        localStorage.setItem(SPRINKLER_STORAGE_KEY, JSON.stringify(configWithTimestamp));
        return true;
    } catch (error) {
        console.error('❌ Error saving sprinkler config:', error);
        return false;
    }
};

export const loadSprinklerConfig = (): SprinklerConfig | null => {
    try {
        const storedData = localStorage.getItem(SPRINKLER_STORAGE_KEY);
        if (storedData) {
            const config = JSON.parse(storedData);
            // ตรวจสอบว่ามี sprinklersPerTree หรือไม่ (สำหรับ config เก่า)
            if (config && typeof config.sprinklersPerTree === 'undefined') {
                config.sprinklersPerTree = 1; // ตั้งค่า default เป็น 1 สำหรับ config เก่า
            }
            return config;
        }
        return null;
    } catch (error) {
        console.error('❌ Error loading sprinkler config:', error);
        return null;
    }
};

export const clearSprinklerConfig = (): void => {
    try {
        localStorage.removeItem(SPRINKLER_STORAGE_KEY);
    } catch (error) {
        console.error('❌ Error clearing sprinkler config:', error);
    }
};

export const calculateTotalFlowRate = (
    plantCount: number,
    flowRatePerMinute: number,
    sprinklersPerTree: number = 1
): number => {
    if (plantCount <= 0 || flowRatePerMinute <= 0) return 0;
    return plantCount * flowRatePerMinute * sprinklersPerTree;
};

export const calculateHourlyFlowRate = (flowRatePerMinute: number): number => {
    return flowRatePerMinute * 60;
};

export const calculateDailyWaterUsage = (
    flowRatePerMinute: number,
    hoursPerDay: number = 2
): number => {
    return flowRatePerMinute * 60 * hoursPerDay;
};

export const validateSprinklerConfig = (
    config: SprinklerFormData
): {
    isValid: boolean;
    errors: { [key: string]: string };
} => {
    const errors: { [key: string]: string } = {};

    const flowRate = parseFloat(config.flowRatePerMinute);
    if (!config.flowRatePerMinute || isNaN(flowRate) || flowRate <= 0) {
        errors.flowRatePerMinute = 'กรุณากรอกอัตราการไหลที่ถูกต้อง (มากกว่า 0)';
    } else if (flowRate > 1000) {
        errors.flowRatePerMinute = 'อัตราการไหลสูงเกินไป (ควรน้อยกว่า 1,000 ลิตร/นาที)';
    }

    const pressure = parseFloat(config.pressureBar);
    if (!config.pressureBar || isNaN(pressure) || pressure <= 0) {
        errors.pressureBar = 'กรุณากรอกแรงดันที่ถูกต้อง (มากกว่า 0)';
    } else if (pressure > 50) {
        errors.pressureBar = 'แรงดันสูงเกินไป (ควรน้อยกว่า 50 บาร์)';
    }

    const sprinklersPerTree = parseFloat(config.sprinklersPerTree || '1');
    if (config.sprinklersPerTree && (isNaN(sprinklersPerTree) || sprinklersPerTree <= 0)) {
        errors.sprinklersPerTree = 'กรุณากรอกจำนวนสปริงเกอร์ต่อต้นไม้ที่ถูกต้อง (มากกว่า 0)';
    } else if (sprinklersPerTree > 100) {
        errors.sprinklersPerTree = 'จำนวนสปริงเกอร์ต่อต้นไม้สูงเกินไป (ควรน้อยกว่า 100)';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
};

export const formatFlowRate = (flowRate: number): string => {
    return `${flowRate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ลิตร/นาที`;
};

export const formatFlowRatePerHour = (flowRate: number): string => {
    return `${flowRate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ลิตร/ชั่วโมง`;
};

export const formatPressure = (pressure: number): string => {
    return `${pressure.toFixed(1)} บาร์`;
};

export const generateSprinklerSummary = (config: SprinklerConfig, plantCount: number) => {
    const sprinklersPerTree = config.sprinklersPerTree || 1;
    const totalSprinklers = plantCount * sprinklersPerTree;
    const totalFlowRate = calculateTotalFlowRate(
        plantCount,
        config.flowRatePerMinute,
        sprinklersPerTree
    );
    const dailyUsage = calculateDailyWaterUsage(totalFlowRate);

    return {
        plantCount,
        sprinklersPerTree,
        totalSprinklers,
        flowRatePerPlant: config.flowRatePerMinute,
        totalFlowRate,
        totalFlowRatePerHour: calculateHourlyFlowRate(totalFlowRate),
        dailyWaterUsage: dailyUsage,
        pressure: config.pressureBar,
        formattedFlowRate: formatFlowRate(totalFlowRate),
        formattedPressure: formatPressure(config.pressureBar),
    };
};

export const DEFAULT_SPRINKLER_CONFIG: Omit<SprinklerConfig, 'createdAt' | 'updatedAt'> = {
    flowRatePerMinute: 2.5,
    pressureBar: 2.0,
    sprinklersPerTree: 1, // จำนวนสปริงเกอร์ต่อต้นไม้ 1 ต้น (ค่าเริ่มต้น)
};

export default {
    saveSprinklerConfig,
    loadSprinklerConfig,
    clearSprinklerConfig,
    calculateTotalFlowRate,
    calculateHourlyFlowRate,
    calculateDailyWaterUsage,
    validateSprinklerConfig,
    formatFlowRate,
    formatPressure,
    generateSprinklerSummary,
    DEFAULT_SPRINKLER_CONFIG,
};
