export interface SprinklerConfig {
    flowRatePerMinute: number;
    pressureBar: number;
    radiusMeters: number;
    createdAt: string;
    updatedAt: string;
}

export interface SprinklerFormData {
    flowRatePerMinute: string;
    pressureBar: string;
    radiusMeters: string;
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
            return JSON.parse(storedData);
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

export const calculateTotalFlowRate = (plantCount: number, flowRatePerMinute: number): number => {
    if (plantCount <= 0 || flowRatePerMinute <= 0) return 0;
    return plantCount * flowRatePerMinute;
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

export const calculateSprinklerCoverage = (radiusMeters: number): number => {
    return Math.PI * Math.pow(radiusMeters, 2);
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

    const radius = parseFloat(config.radiusMeters);
    if (!config.radiusMeters || isNaN(radius) || radius <= 0) {
        errors.radiusMeters = 'กรุณากรอกรัศมีที่ถูกต้อง (มากกว่า 0)';
    } else if (radius > 100) {
        errors.radiusMeters = 'รัศมีสูงเกินไป (ควรน้อยกว่า 100 เมตร)';
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

export const formatRadius = (radius: number): string => {
    if (radius >= 1000) {
        return `${(radius / 1000).toFixed(2)} กม.`;
    }
    return `${radius.toFixed(1)} ม.`;
};

export const generateSprinklerSummary = (config: SprinklerConfig, plantCount: number) => {
    const totalFlowRate = calculateTotalFlowRate(plantCount, config.flowRatePerMinute);
    const dailyUsage = calculateDailyWaterUsage(totalFlowRate);
    const coverage = calculateSprinklerCoverage(config.radiusMeters);

    return {
        plantCount,
        flowRatePerPlant: config.flowRatePerMinute,
        totalFlowRate,
        totalFlowRatePerHour: calculateHourlyFlowRate(totalFlowRate),
        dailyWaterUsage: dailyUsage,
        pressure: config.pressureBar,
        radius: config.radiusMeters,
        coveragePerSprinkler: coverage,
        formattedFlowRate: formatFlowRate(totalFlowRate),
        formattedPressure: formatPressure(config.pressureBar),
        formattedRadius: formatRadius(config.radiusMeters),
    };
};

export const DEFAULT_SPRINKLER_CONFIG: Omit<SprinklerConfig, 'createdAt' | 'updatedAt'> = {
    flowRatePerMinute: 2.5,
    pressureBar: 2.0,
    radiusMeters: 4,
};

export default {
    saveSprinklerConfig,
    loadSprinklerConfig,
    clearSprinklerConfig,
    calculateTotalFlowRate,
    calculateHourlyFlowRate,
    calculateDailyWaterUsage,
    calculateSprinklerCoverage,
    validateSprinklerConfig,
    formatFlowRate,
    formatPressure,
    formatRadius,
    generateSprinklerSummary,
    DEFAULT_SPRINKLER_CONFIG,
};
