// Pipe Selection Utilities
export interface PipeRecommendation {
    sizeMM: number;
    sizeInch: string;
    reason: string;
}

export interface PipeRecommendations {
    main: PipeRecommendation;
    subMain: PipeRecommendation;
    lateral: PipeRecommendation;
}

export const calculatePipeSize = (flowRate: number, length: number, pipeType: string): PipeRecommendation => {
    // Simplified pipe sizing calculation based on flow rate and length
    let recommendedSize = 0;
    let reason = '';

    if (pipeType === 'main') {
        // Main pipe: based on total flow rate
        if (flowRate >= 200) {
            recommendedSize = 100;
            reason = 'High Flow Rate (≥200 LPM)';
        } else if (flowRate >= 100) {
            recommendedSize = 80;
            reason = 'Medium Flow Rate (100-200 LPM)';
        } else if (flowRate >= 50) {
            recommendedSize = 63;
            reason = 'Medium Flow Rate (50-100 LPM)';
        } else {
            recommendedSize = 50;
            reason = 'Low Flow Rate (<50 LPM)';
        }
    } else if (pipeType === 'subMain') {
        // Sub main pipe: based on zone flow rate
        if (flowRate >= 50) {
            recommendedSize = 63;
            reason = 'High Flow Rate (≥50 LPM)';
        } else if (flowRate >= 25) {
            recommendedSize = 50;
            reason = 'Medium Flow Rate (25-50 LPM)';
        } else {
            recommendedSize = 40;
            reason = 'Low Flow Rate (<25 LPM)';
        }
    } else if (pipeType === 'lateral') {
        // Lateral pipe: based on sprinkler flow rate
        if (flowRate >= 10) {
            recommendedSize = 32;
            reason = 'High Flow Rate (≥10 LPM)';
        } else if (flowRate >= 5) {
            recommendedSize = 25;
            reason = 'Medium Flow Rate (5-10 LPM)';
        } else {
            recommendedSize = 20;
            reason = 'Low Flow Rate (<5 LPM)';
        }
    }

    // Convert mm to inch
    const sizeInch = (recommendedSize / 25.4).toFixed(1);
    return {
        sizeMM: recommendedSize,
        sizeInch: `${sizeInch}"`,
        reason: reason
    };
};

export const calculatePipeRecommendations = (
    totalFlowRate: number,
    avgZoneFlowRate: number,
    avgSprinklerFlowRate: number
): PipeRecommendations => {
    return {
        main: calculatePipeSize(totalFlowRate, 0, 'main'),
        subMain: calculatePipeSize(avgZoneFlowRate, 0, 'subMain'),
        lateral: calculatePipeSize(avgSprinklerFlowRate, 0, 'lateral')
    };
};
