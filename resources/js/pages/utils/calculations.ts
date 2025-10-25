/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const calculatePipeRolls = (totalLength: number, rollLength: number): number => {
    return Math.ceil(totalLength / rollLength);
};

export const getAdjustedC = (pipeType: string, age: number): number => {
    const baseC =
        {
            'HDPE PE 100': 140,
            'HDPE PE 80': 135,
            LDPE: 130,
            PE: 135,
            PVC: 140, 
            'PE-RT': 138,
            'Flexible PE': 125,
            Steel: 120,
            Galvanized: 110,
        }[pipeType] || 135; 

    const degradationRate = pipeType.includes('PVC')
        ? 0.3
        : pipeType.includes('HDPE')
          ? 0.4
          : pipeType.includes('PE')
            ? 0.5
            : 1.0;

    return Math.max(110, baseC - age * degradationRate);
};

export const getMinorLossCoefficient = (
    sectionType: string,
    velocity: number,
    fittingCount: { elbows?: number; tees?: number; valves?: number } = {}
): number => {
    let totalK = 0;

    const baseK = {
        branch: 0.2, 
        secondary: 0.15, 
        main: 0.1, 
    };

    totalK += baseK[sectionType as keyof typeof baseK] || 0.15;

    totalK += (fittingCount.elbows || 0) * 0.9; 
    totalK += (fittingCount.tees || 0) * 1.8; 
    totalK += (fittingCount.valves || 0) * 0.2; 

    if (!Object.keys(fittingCount).length) {
        if (sectionType === 'branch') {
            totalK += 0.5; 
        } else if (sectionType === 'secondary') {
            totalK += 0.3; 
        } else if (sectionType === 'main') {
            totalK += 0.2; 
        }
    }

    return Math.min(totalK, 3.0);
};

export const calculateImprovedHeadLoss = (
    flow_lpm: number,
    diameter_mm: number,
    length_m: number,
    pipeType: string,
    sectionType: string,
    pipeAgeYears: number,
    fittingCount?: { elbows?: number; tees?: number; valves?: number }
) => {
    if (flow_lpm <= 0 || diameter_mm <= 0 || length_m <= 0) {
        return {
            major: 0,
            minor: 0,
            total: 0,
            velocity: 0,
            velocityHead: 0,
            C: 140,
            K: 0,
        };
    }

    const validatedFlow = Math.min(Math.max(flow_lpm, 0.1), 50000); 
    const validatedDiameter = Math.min(Math.max(diameter_mm, 10), 1000); 
    const validatedLength = Math.min(Math.max(length_m, 0.1), 5000); 

    const Q_m3s = validatedFlow / 60000; 
    const D_m = validatedDiameter / 1000; 
    const C = getAdjustedC(pipeType, pipeAgeYears);

    const A = Math.PI * Math.pow(D_m / 2, 2);
    const velocity = A > 0 ? Q_m3s / A : 0;

    let majorLoss = 0;
    if (Q_m3s > 0 && D_m > 0) {
        majorLoss =
            (10.67 * validatedLength * Math.pow(Q_m3s, 1.852)) /
            (Math.pow(C, 1.852) * Math.pow(D_m, 4.87));
    }

    const velocityHead = Math.pow(velocity, 2) / (2 * 9.81);

    const K = getMinorLossCoefficient(sectionType, velocity, fittingCount);
    let minorLoss = K * velocityHead;

    minorLoss = Math.min(minorLoss, majorLoss * 1.5);

    if (validatedLength < 20) {
        minorLoss = minorLoss * 1.2;
    } else if (validatedLength < 50) {
        minorLoss = minorLoss * 1.0; 
    }

    const totalLoss = majorLoss + minorLoss;

    return {
        major: formatNumber(majorLoss, 3),
        minor: formatNumber(minorLoss, 3),
        total: formatNumber(totalLoss, 3),
        velocity: formatNumber(velocity, 3),
        velocityHead: formatNumber(velocityHead, 3),
        C: formatNumber(C, 0),
        K: formatNumber(K, 2),
    };
};

export const checkVelocity = (velocity: number, section: string): string => {
    if (velocity > 3.0)
        return `🔴 ${section}: ความเร็วสูงเกินไป (${velocity.toFixed(3)} m/s) - เสี่ยง water hammer และการสึกหรอ`;
    if (velocity > 2.5)
        return `🟡 ${section}: ความเร็วสูง (${velocity.toFixed(3)} m/s) - ควรพิจารณาเพิ่มขนาดท่อ`;
    if (velocity < 0.3 && velocity > 0)
        return `🔵 ${section}: ความเร็วต่ำ (${velocity.toFixed(3)} m/s) - อาจมีการตกตะกอน`;
    if (velocity >= 0.6 && velocity <= 2.0)
        return `🟢 ${section}: ความเร็วเหมาะสม (${velocity.toFixed(3)} m/s) - อยู่ในช่วงที่แนะนำ`;
    if (velocity >= 0.4 && velocity <= 2.5)
        return `🟡 ${section}: ความเร็วใช้ได้ (${velocity.toFixed(3)} m/s) - ยังอยู่ในเกณฑ์ยอมรับได้`;
    return `🟡 ${section}: ความเร็วอยู่นอกช่วงที่แนะนำ (${velocity.toFixed(3)} m/s) - ควรตรวจสอบการออกแบบ`;
};

export const getVelocityScore = (velocity: number): number => {
    if (velocity >= 0.6 && velocity <= 2.0) return 100; 
    if (velocity >= 0.4 && velocity <= 2.5) return 80; 
    if (velocity >= 0.3 && velocity <= 3.0) return 60; 
    if (velocity > 3.0) return 20; 
    if (velocity < 0.3) return 30; 
    return 40; 
};

export const calculateOptimalPipeSize = (
    flow_lpm: number,
    targetVelocity: number = 1.2, 
    maxVelocity: number = 2.0 
): { optimal: number; acceptable: number } => {
    const Q_m3s = flow_lpm / 60000;
    
    const optimalArea = Q_m3s / targetVelocity;
    const optimalDiameter = Math.sqrt((4 * optimalArea) / Math.PI) * 1000; 

    
    const acceptableArea = Q_m3s / maxVelocity;
    const acceptableDiameter = Math.sqrt((4 * acceptableArea) / Math.PI) * 1000; 

    const minPipeSize = 20; 

    return {
        optimal: Math.max(optimalDiameter, minPipeSize),
        acceptable: Math.max(acceptableDiameter, minPipeSize),
    };
};

export const getSizeScore = (pipeSize: number, optimalSize: number, flowLPM: number): number => {
    const sizeRatio = pipeSize / optimalSize;
    const standardSizes = [16, 20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 200, 250, 315];
    const isStandardSize = standardSizes.includes(pipeSize);

    let score = 0;

    if (sizeRatio >= 0.85 && sizeRatio <= 1.2) score = 35;
    else if (sizeRatio >= 0.7 && sizeRatio <= 1.5) score = 30;
    else if (sizeRatio >= 0.6 && sizeRatio <= 1.8) score = 25;
    else if (sizeRatio >= 0.5 && sizeRatio <= 2.2) score = 15;
    else score = 5;

    if (isStandardSize) score += 5;

    if (sizeRatio > 2.0) score -= 5;
    if (sizeRatio < 0.6) score -= 8;

    return Math.max(0, score);
};

export const validateHeadLossRatio = (
    headLoss: number,
    totalHead: number
): {
    isValid: boolean;
    ratio: number;
    recommendation: string;
    severity: 'good' | 'warning' | 'critical';
} => {
    if (totalHead <= 0) {
        return {
            isValid: false,
            ratio: 0,
            recommendation: 'ไม่สามารถคำนวณอัตราส่วน Head Loss ได้ เนื่องจาก Total Head = 0',
            severity: 'critical',
        };
    }

    const ratio = (headLoss / totalHead) * 100;

    if (ratio <= 15) {
        return {
            isValid: true,
            ratio,
            recommendation: `✅ Head Loss อยู่ในเกณฑ์ดีเยี่ยม (${ratio.toFixed(1)}%) - ระบบมีประสิทธิภาพสูง`,
            severity: 'good',
        };
    } else if (ratio <= 20) {
        return {
            isValid: true,
            ratio,
            recommendation: `⚠️ Head Loss อยู่ในเกณฑ์ยอมรับได้ (${ratio.toFixed(1)}%) - ยังอยู่ภายในขีดจำกัด 20%`,
            severity: 'warning',
        };
    } else if (ratio <= 25) {
        return {
            isValid: false,
            ratio,
            recommendation: `🚨 Head Loss สูงเกินไป (${ratio.toFixed(1)}%) - ควรเพิ่มขนาดท่อหรือลดระยะทาง`,
            severity: 'critical',
        };
    } else {
        return {
            isValid: false,
            ratio,
            recommendation: `🔴 Head Loss สูงมาก (${ratio.toFixed(1)}%) - ต้องปรับแก้การออกแบบทันที เพิ่มขนาดท่อ หรือลดการไหล`,
            severity: 'critical',
        };
    }
};

export const calculateSafetyFactor = (systemComplexity: string, totalZones: number): number => {
    let baseFactor = 1.08;

    if (systemComplexity === 'complex') baseFactor += 0.02;
    else if (systemComplexity === 'simple') baseFactor -= 0.02;

    if (totalZones > 5) baseFactor += 0.02;
    else if (totalZones > 3) baseFactor += 0.01;

    return formatNumber(Math.min(baseFactor, 1.15), 3);
};

export const calculatePumpRequirement = (
    zones: Array<{
        zoneId: string;
        flowLPM: number;
        headLoss: number;
        staticHead: number;
        pressureHead: number;
    }>,
    simultaneousZones: number = 1
): {
    requiredFlowLPM: number;
    requiredHeadM: number;
    selectedZones: string[];
    maxHeadZone: string;
    flowDistribution: Array<{ zoneId: string; flow: number; head: number }>;
} => {
    if (!zones || zones.length === 0) {
        return {
            requiredFlowLPM: 0,
            requiredHeadM: 0,
            selectedZones: [],
            maxHeadZone: '',
            flowDistribution: [],
        };
    }

    const zoneHeads = zones.map((zone) => ({
        ...zone,
        totalHead: zone.headLoss + zone.staticHead + zone.pressureHead,
    }));

    const sortedByHead = [...zoneHeads].sort((a, b) => b.totalHead - a.totalHead);

    const selectedZones = sortedByHead.slice(0, Math.min(simultaneousZones, zones.length));

    const requiredFlowLPM = selectedZones.reduce((sum, zone) => sum + zone.flowLPM, 0);

    const requiredHeadM = selectedZones.length > 0 ? selectedZones[0].totalHead : 0;

    return {
        requiredFlowLPM: formatNumber(requiredFlowLPM, 1),
        requiredHeadM: formatNumber(requiredHeadM, 1),
        selectedZones: selectedZones.map((z) => z.zoneId),
        maxHeadZone: selectedZones.length > 0 ? selectedZones[0].zoneId : '',
        flowDistribution: selectedZones.map((z) => ({
            zoneId: z.zoneId,
            flow: formatNumber(z.flowLPM, 1),
            head: formatNumber(z.totalHead, 1),
        })),
    };
};

export const getCostEfficiencyScore = (pipe: any, pipeType: string): number => {
    const costPerMeterPerMM = pipe.price / (pipe.lengthM * pipe.sizeMM);

    const thresholds = {
        branch: { excellent: 0.5, good: 1.2, average: 2.5 },
        secondary: { excellent: 1.2, good: 2.5, average: 5.0 },
        main: { excellent: 2.5, good: 5.0, average: 10.0 },
    }[pipeType] || { excellent: 1.2, good: 2.5, average: 5.0 };

    if (costPerMeterPerMM <= thresholds.excellent) return 15;
    if (costPerMeterPerMM <= thresholds.good) return 12;
    if (costPerMeterPerMM <= thresholds.average) return 8;
    return 3;
};

export const getHeadLossScore = (headLoss: number, pipeType: string, length: number): number => {
    const headLossPer100m = length > 0 ? (headLoss / length) * 100 : 0;

    const thresholds = {
        branch: { excellent: 4.0, good: 8.0, average: 15.0 },
        secondary: { excellent: 3.5, good: 7.0, average: 12.0 },
        main: { excellent: 3.0, good: 6.0, average: 10.0 },
    }[pipeType] || { excellent: 4.0, good: 8.0, average: 15.0 };

    if (headLossPer100m <= thresholds.excellent) return 15;
    if (headLossPer100m <= thresholds.good) return 12;
    if (headLossPer100m <= thresholds.average) return 8;
    return 3;
};

export const calculateZoneFlowRate = (
    sprinklerCount: number,
    waterPerSprinklerLPM: number = 6.0, 
    irrigationTimeMinutes: number = 30
): {
    flowLPM: number;
    totalWaterPerIrrigation: number; 
} => {
    const flowLPM = sprinklerCount * waterPerSprinklerLPM;

    const totalWaterPerIrrigation = flowLPM * (irrigationTimeMinutes / 60);

    return {
        flowLPM: flowLPM,
        totalWaterPerIrrigation: totalWaterPerIrrigation, 
    };
};

export const calculateFieldCropZoneFlowRate = (
    sprinklerCount: number,
    waterPerSprinklerLPM: number = 6.0,
    irrigationTimeMinutes: number = 30
): {
    flowLPM: number;
    totalWaterPerIrrigation: number; 
} => {
    const flowLPM = sprinklerCount * waterPerSprinklerLPM;

    const totalWaterPerIrrigation = flowLPM * (irrigationTimeMinutes / 60);

    return {
        flowLPM: flowLPM,
        totalWaterPerIrrigation: totalWaterPerIrrigation, 
    };
};

export const formatWaterFlow = (waterFlow: any) => {
    if (Array.isArray(waterFlow)) return `${waterFlow[0]}-${waterFlow[1]}`;
    if (typeof waterFlow === 'string' && waterFlow.includes('-')) return waterFlow;
    return waterFlow ? waterFlow.toString() : '0';
};

export const formatRadius = (radius: any) => {
    if (Array.isArray(radius)) return `${radius[0]}-${radius[1]}`;
    if (typeof radius === 'string' && radius.includes('-')) return radius;
    return radius ? radius.toString() : '0';
};

export const parseRangeValue = (value: any): [number, number] | number => {
    if (value === null || value === undefined || value === '') return 0;

    if (Array.isArray(value)) {
        if (value.length === 2 && value.every((v) => typeof v === 'number' || !isNaN(Number(v)))) {
            return [Number(value[0]), Number(value[1])];
        }
        if (value.length === 1) return Number(value[0]) || 0;
        if (value.length > 2) return [Number(value[0]), Number(value[value.length - 1])];
        return 0;
    }

    if (typeof value === 'string') {
        const separators = ['-', ',', '~', '–', '—'];

        for (const separator of separators) {
            if (value.includes(separator) && !value.startsWith('-')) {
                const parts = value
                    .split(separator)
                    .map((v) => {
                        const cleaned = v.trim().replace(/[^\d.]/g, '');
                        return parseFloat(cleaned);
                    })
                    .filter((v) => !isNaN(v));

                if (parts.length >= 2) return [parts[0], parts[parts.length - 1]];
                if (parts.length === 1) return parts[0];
            }
        }

        const cleaned = value.trim().replace(/[^\d.]/g, '');
        const numValue = parseFloat(cleaned);
        return isNaN(numValue) ? 0 : numValue;
    }

    if (typeof value === 'number') return isNaN(value) ? 0 : value;

    const numValue = parseFloat(String(value));
    return isNaN(numValue) ? 0 : numValue;
};

export const formatNumber = (
    value: number | string | null | undefined,
    decimals: number = 3
): number => {
    const numValue = Number(value);
    if (isNaN(numValue)) {
        return 0;
    }
    return Math.round(numValue * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

export const evaluatePipeOverall = (
    pipe: any,
    flow_lpm: number,
    length_m: number,
    sectionType: string,
    pipeAgeYears: number,
    allowedTypes: string[] = []
) => {
    if (flow_lpm <= 0 || length_m <= 0) {
        return {
            ...pipe,
            score: 0,
            velocity: 0,
            headLoss: 0,
            optimalSize: 50,
            acceptableSize: 32,
            isRecommended: false,
            isGoodChoice: false,
            isUsable: false,
            isTypeAllowed: true,
            velocityRating: 'poor',
            headLossData: { major: 0, minor: 0, total: 0, velocity: 0, C: 140, K: 0 },
        };
    }

    const headLossData = calculateImprovedHeadLoss(
        flow_lpm,
        pipe.sizeMM,
        length_m,
        pipe.pipeType,
        sectionType,
        pipeAgeYears
    );

    let score = 0;
    const velocity = headLossData.velocity;
    const optimalSizes = calculateOptimalPipeSize(flow_lpm);

    score += getVelocityScore(velocity);

    score += getSizeScore(pipe.sizeMM, optimalSizes.optimal, flow_lpm) * 0.71;

    score += getHeadLossScore(headLossData.total, sectionType, length_m) * 1.33;

    score += getCostEfficiencyScore(pipe, sectionType) * 0.33;

    const isVelocityOK = velocity >= 0.3 && velocity <= 3.5;
    const isPressureRatingOK = pipe.pn >= 6;
    const isTypeAllowed = allowedTypes.length === 0 || allowedTypes.includes(pipe.pipeType);

    const totalScore = formatNumber(score, 1);

    const isRecommended =
        totalScore >= 70 &&
        isVelocityOK &&
        isPressureRatingOK &&
        velocity >= 0.8 &&
        velocity <= 2.0 &&
        (headLossData.total / length_m) * 100 <= 8.0;

    const isGoodChoice =
        totalScore >= 55 &&
        isVelocityOK &&
        isPressureRatingOK &&
        velocity >= 0.6 &&
        velocity <= 2.5 &&
        (headLossData.total / length_m) * 100 <= 12.0;

    const isUsable = totalScore >= 30 && isVelocityOK && isPressureRatingOK;

    return {
        ...pipe,
        score: totalScore,
        velocity: formatNumber(velocity, 3),
        headLoss: formatNumber(headLossData.total, 3),
        optimalSize: formatNumber(optimalSizes.optimal, 1),
        acceptableSize: formatNumber(optimalSizes.acceptable, 1),
        isRecommended,
        isGoodChoice,
        isUsable,
        isTypeAllowed,
        velocityRating:
            velocity >= 0.8 && velocity <= 2.0
                ? 'excellent'
                : velocity >= 0.6 && velocity <= 2.5
                  ? 'good'
                  : velocity >= 0.5 && velocity <= 3.0
                    ? 'fair'
                    : 'poor',
        headLossData,
    };
};

export const evaluateSprinklerOverall = (sprinkler: any, targetFlow: number) => {
    const flowRange = parseRangeValue(sprinkler.waterVolumeLitersPerMinute);
    const radiusRange = parseRangeValue(sprinkler.radiusMeters);
    const pressureRange = parseRangeValue(sprinkler.pressureBar);

    let minFlow, maxFlow, minRadius, maxRadius, minPressure, maxPressure;

    if (Array.isArray(flowRange)) {
        [minFlow, maxFlow] = flowRange;
    } else {
        minFlow = maxFlow = flowRange;
    }

    if (Array.isArray(radiusRange)) {
        [minRadius, maxRadius] = radiusRange;
    } else {
        minRadius = maxRadius = radiusRange;
    }

    if (Array.isArray(pressureRange)) {
        [minPressure, maxPressure] = pressureRange;
    } else {
        minPressure = maxPressure = pressureRange;
    }

    const avgFlow = (minFlow + maxFlow) / 2;
    const avgRadius = (minRadius + maxRadius) / 2;

    return {
        ...sprinkler,
        score: 0,
        flowMatch: targetFlow >= minFlow && targetFlow <= maxFlow,
        flowCloseMatch: targetFlow >= minFlow * 0.8 && targetFlow <= maxFlow * 1.2,
        isRecommended: false,
        isGoodChoice: false,
        isUsable: true,
        targetFlow: formatNumber(targetFlow, 3),
        minFlow: formatNumber(minFlow, 3),
        maxFlow: formatNumber(maxFlow, 3),
        avgFlow: formatNumber(avgFlow, 3),
        avgRadius: formatNumber(avgRadius, 3),
        pricePerFlow: formatNumber(sprinkler.price / avgFlow, 3),
    };
};

export const evaluatePumpOverall = (pump: any, requiredFlow: number, requiredHead: number) => {
    const maxFlow =
        pump.max_flow_rate_lpm || (Array.isArray(pump.flow_rate_lpm) ? pump.flow_rate_lpm[1] : 0);
    const maxHead = pump.max_head_m || (Array.isArray(pump.head_m) ? pump.head_m[1] : 0);

    let score = 0;

    if (maxFlow >= requiredFlow) {
        const flowRatio = maxFlow / requiredFlow;
        if (flowRatio >= 1.1 && flowRatio <= 1.4) score += 45;
        else if (flowRatio >= 1.05 && flowRatio <= 1.8) score += 40;
        else if (flowRatio >= 1.0 && flowRatio <= 2.2) score += 30;
        else score += 20;
    } else {
        score += 5;
    }

    if (maxHead >= requiredHead) {
        const headRatio = maxHead / requiredHead;
        if (headRatio >= 1.1 && headRatio <= 1.4) score += 45;
        else if (headRatio >= 1.05 && headRatio <= 1.8) score += 40;
        else if (headRatio >= 1.0 && headRatio <= 2.2) score += 30;
        else score += 20;
    } else {
        score += 5;
    }

    const flowPerBaht = maxFlow / (pump.price || 1);
    if (flowPerBaht > 0.5) score += 10;
    else if (flowPerBaht > 0.3) score += 8;
    else if (flowPerBaht > 0.2) score += 6;
    else if (flowPerBaht > 0.1) score += 4;
    else score += 2;

    const totalScore = formatNumber(score, 1);

    return {
        ...pump,
        score: totalScore,
        maxFlow: formatNumber(maxFlow, 3),
        maxHead: formatNumber(maxHead, 3),
        powerHP: formatNumber(pump.powerHP || 0, 1),
        flowRatio: formatNumber(maxFlow / Math.max(requiredFlow, 1), 3),
        headRatio: formatNumber(maxHead / Math.max(requiredHead, 1), 3),
        flowPerBaht: formatNumber(flowPerBaht, 4),
        estimatedHP: formatNumber((requiredFlow * requiredHead) / 3500, 3),
        isFlowAdequate: maxFlow >= requiredFlow,
        isHeadAdequate: maxHead >= requiredHead,
        isRecommended: maxFlow >= requiredFlow && maxHead >= requiredHead,
        isGoodChoice: maxFlow >= requiredFlow && maxHead >= requiredHead && totalScore < 80,
        isUsable: (maxFlow >= requiredFlow || maxHead >= requiredHead) && !(maxFlow >= requiredFlow && maxHead >= requiredHead),
    };
};

export const sortForDropdown = (allItems: any[], recommendedItems: any[]) => {
    const highly_recommended = allItems
        .filter((item) => recommendedItems.includes(item) && item.score >= 80)
        .sort((a, b) => b.score - a.score);

    const recommended = allItems
        .filter((item) => recommendedItems.includes(item) && item.score >= 65 && item.score < 80)
        .sort((a, b) => b.score - a.score);

    const good_choice = allItems
        .filter((item) => !recommendedItems.includes(item) && item.score >= 50)
        .sort((a, b) => b.score - a.score);

    const usable = allItems
        .filter((item) => !recommendedItems.includes(item) && item.score >= 30 && item.score < 50)
        .sort((a, b) => b.score - a.score);

    const others = allItems
        .filter((item) => !recommendedItems.includes(item) && item.score < 30)
        .sort((a, b) => a.price - b.price);

    return [...highly_recommended, ...recommended, ...good_choice, ...usable, ...others];
};

export const selectBestEquipmentByPrice = (
    equipmentList: any[],
    preferHighPrice: boolean = false
): any => {
    if (!equipmentList || equipmentList.length === 0) return null;

    const recommended = equipmentList.filter((item) => item.isRecommended);
    const goodChoice = equipmentList.filter((item) => item.isGoodChoice && !item.isRecommended);
    const usable = equipmentList.filter(
        (item) => item.isUsable && !item.isGoodChoice && !item.isRecommended
    );

    const targetGroup =
        recommended.length > 0
            ? recommended
            : goodChoice.length > 0
              ? goodChoice
              : usable.length > 0
                ? usable
                : equipmentList;

    return targetGroup.sort((a, b) => a.price - b.price)[0];
};

export const detectSignificantInputChanges = (
    oldInput: any,
    newInput: any,
    threshold: number = 0.15
): boolean => {
    if (!oldInput || !newInput) return true;

    const significantFields = [
        'totalTrees',
        'waterPerTreeLiters',
        'numberOfZones',
        'farmSizeRai',
        'irrigationTimeMinutes',
    ];

    return significantFields.some((field) => {
        const oldValue = oldInput[field] || 0;
        const newValue = newInput[field] || 0;

        if (oldValue === 0 && newValue === 0) return false;
        if (oldValue === 0 || newValue === 0) return true;

        const changeRatio = Math.abs(newValue - oldValue) / oldValue;
        return changeRatio > threshold;
    });
};

export const validateEquipmentData = (
    equipment: any,
    categoryType: 'sprinkler' | 'pump' | 'pipe'
): boolean => {
    if (
        !equipment ||
        !equipment.id ||
        !equipment.name ||
        equipment.price === null ||
        equipment.price === undefined
    ) {
        return false;
    }

    switch (categoryType) {
        case 'sprinkler':
            return !!(
                equipment.waterVolumeLitersPerMinute &&
                equipment.radiusMeters &&
                equipment.pressureBar
            );
        case 'pump':
            return !!(equipment.powerHP && equipment.flow_rate_lpm && equipment.head_m);
        case 'pipe':
            return !!(equipment.pipeType && equipment.sizeMM && equipment.lengthM);
        default:
            return false;
    }
};

export const isRecommended = (item: any, recommendedList: any[]) => {
    return recommendedList.includes(item);
};

export const flattenEquipmentAttributes = (equipment: any): any => {
    const flattened = { ...equipment };

    if (equipment.attributes && typeof equipment.attributes === 'object') {
        Object.keys(equipment.attributes).forEach((key) => {
            if (!flattened[key]) {
                flattened[key] = equipment.attributes[key];
            }
        });
    }

    if (Array.isArray(equipment.attributes)) {
        equipment.attributes.forEach((attr: any) => {
            if (attr.attribute_name && attr.value !== undefined) {
                if (!flattened[attr.attribute_name]) {
                    flattened[attr.attribute_name] = attr.value;
                }
            }
        });
    }

    return flattened;
};

export const normalizeEquipmentData = (
    equipment: any,
    categoryType: 'sprinkler' | 'pump' | 'pipe'
): any => {
    const flattened = flattenEquipmentAttributes(equipment);

    const normalized = {
        ...flattened,
        productCode: flattened.product_code || flattened.productCode,
        product_code: flattened.product_code || flattened.productCode,
        price: Number(flattened.price || 0),
        is_active: Boolean(flattened.is_active),
    };

    switch (categoryType) {
        case 'sprinkler':
            if (normalized.waterVolumeLitersPerMinute) {
                normalized.waterVolumeLitersPerMinute = parseRangeValue(
                    normalized.waterVolumeLitersPerMinute
                );
            }
            if (normalized.radiusMeters) {
                normalized.radiusMeters = parseRangeValue(normalized.radiusMeters);
            }
            if (normalized.pressureBar) {
                normalized.pressureBar = parseRangeValue(normalized.pressureBar);
            }
            break;

        case 'pump':
            {
                const numericFields = [
                    'powerHP',
                    'powerKW',
                    'phase',
                    'inlet_size_inch',
                    'outlet_size_inch',
                    'max_head_m',
                    'max_flow_rate_lpm',
                    'suction_depth_m',
                    'weight_kg',
                ];
                numericFields.forEach((field) => {
                    if (normalized[field] !== undefined) {
                        normalized[field] = Number(normalized[field]) || 0;
                    }
                });

                const rangeFields = ['flow_rate_lpm', 'head_m'];
                rangeFields.forEach((field) => {
                    if (normalized[field] !== undefined) {
                        normalized[field] = parseRangeValue(normalized[field]);
                    }
                });
            }
            break;

        case 'pipe':
            if (normalized.pn !== undefined) {
                normalized.pn = Number(normalized.pn) || 0;
            }
            if (normalized.sizeMM !== undefined) {
                normalized.sizeMM = Number(normalized.sizeMM) || 0;
            }
            if (normalized.lengthM !== undefined) {
                normalized.lengthM = Number(normalized.lengthM) || 0;
            }
            break;
    }

    return normalized;
};

export const convertAreaUnits = {
    sqmToRai: (sqm: number): number => formatNumber(sqm / 1600, 3),
    raiToSqm: (rai: number): number => formatNumber(rai * 1600, 1),
    formatArea: (sqm: number): string => {
        const rai = sqm / 1600;
        if (rai >= 1) {
            return `${formatNumber(rai, 2)} ไร่`;
        }
        return `${formatNumber(sqm, 0)} ตร.ม.`;
    },
};

export const calculatePlantingDensity = (
    areaSqm: number,
    rowSpacingM: number,
    plantSpacingM: number
): number => {
    if (!areaSqm || !rowSpacingM || !plantSpacingM) return 0;
    const plantsPerSqm = (1 / rowSpacingM) * (1 / plantSpacingM);
    return Math.floor(areaSqm * plantsPerSqm);
};

export const calculateWaterRequirementPerArea = (
    plantCount: number,
    waterPerPlantLiters: number
): number => {
    return formatNumber(plantCount * waterPerPlantLiters, 1);
};

export const calculateProductionEstimate = (
    areaSqm: number,
    yieldPerRai: number,
    pricePerKg: number
): { yield: number; income: number } => {
    const areaRai = areaSqm / 1600;
    const totalYield = Math.round(areaRai * yieldPerRai);
    const totalIncome = Math.round(totalYield * pricePerKg);
    return { yield: totalYield, income: totalIncome };
};

export const validateFieldCropInput = (input: any): boolean => {
    return !!(
        input &&
        input.area > 0 &&
        input.totalPlantingPoints > 0 &&
        input.waterRequirement >= 0
    );
};

export const validateGreenhouseInput = (input: any): boolean => {
    return !!(input && input.area > 0 && input.totalPlants > 0 && input.waterRequirement >= 0);
};
