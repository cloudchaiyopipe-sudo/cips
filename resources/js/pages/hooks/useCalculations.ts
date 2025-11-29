/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState, useEffect } from 'react';
import { IrrigationInput, CalculationResults } from '../types/interfaces';
import {
    calculatePipeRolls,
    calculateImprovedHeadLoss,
    checkVelocity,
    evaluatePipeOverall,
    evaluatePumpOverall,
    formatNumber,
    parseRangeValue,
    calculatePumpRequirement,
    validateHeadLossRatio,
    calculateSafetyFactor,
} from '../utils/calculations';
import {
    getEnhancedFieldCropData,
    calculateEnhancedFieldStats,
    FieldCropData,
} from '../../utils/fieldCropData';

export interface ZoneCalculationData {
    zoneId: string;
    input: IrrigationInput;
    sprinkler?: any;
    projectMode?: 'horticulture' | 'garden' | 'field-crop' | 'greenhouse';
}

interface ZoneOperationGroup {
    id: string;
    zones: string[];
    order: number;
    label: string;
}

interface ZoneResults {
    zoneId: string;
    zoneName: string;
    totalFlowLPM: number;
    headLoss: {
        branch: number;
        secondary: number;
        main: number;
        total: number;
    };
    staticHead: number;
    pressureHead: number;
    totalHead: number;
    autoSelectedPipes: {
        branch?: any;
        secondary?: any;
        main?: any;
    };
    sprinklerCount: number;
}

interface ProjectSummary {
    totalFlowLPM: number;
    maxHeadM: number;
    criticalZone: string;
    operationMode: string;
    selectedGroupFlowLPM: number;
    selectedGroupHeadM: number;
    criticalGroup?: ZoneOperationGroup;
}

const calculateSprinklerPressure = (
    sprinkler: any,
    defaultPressure: number,
    projectMode?: string
): number => {
    if (!sprinkler) return defaultPressure;

    try {
        let minPressure, maxPressure;
        const pressureData = sprinkler.pressureBar || sprinkler.pressure_bar;

        if (Array.isArray(pressureData)) {
            [minPressure, maxPressure] = pressureData;
        } else if (typeof pressureData === 'string' && pressureData.includes('-')) {
            const parts = pressureData.split('-');
            minPressure = parseFloat(parts[0]);
            maxPressure = parseFloat(parts[1]);
        } else {
            minPressure = maxPressure = parseFloat(String(pressureData));
        }

        if (isNaN(minPressure) || isNaN(maxPressure)) {
            return defaultPressure;
        }

        let workingPressureFactor = 0.7;
        if (projectMode === 'garden') {
            workingPressureFactor = 0.6;
        } else if (projectMode === 'field-crop') {
            workingPressureFactor = 0.8;
        } else if (projectMode === 'greenhouse') {
            workingPressureFactor = 0.65;
        }

        const avgPressureBar = (minPressure + maxPressure) / 2;
        const workingPressureBar = avgPressureBar * workingPressureFactor;
        return workingPressureBar * 10.197;
    } catch (error) {
        return defaultPressure;
    }
};

const calculateSprinklerBasedFlow = (
    sprinkler: any,
    input: IrrigationInput,
    projectMode?: string
) => {
    let totalWaterPerMinute: number;
    let totalSprinklers: number;
    let flowPerSprinkler: number;

    if (projectMode === 'field-crop') {
        totalSprinklers = input.totalTrees;
        flowPerSprinkler = input.waterPerTreeLiters;
        totalWaterPerMinute = totalSprinklers * flowPerSprinkler;

        if (totalSprinklers === 1) {
            console.error('Error calculating pressure from sprinkler: totalSprinklers is 1');
        }

        if (totalWaterPerMinute === 0 || isNaN(totalWaterPerMinute)) {
            try {
                const fieldCropSystemDataStr = localStorage.getItem('fieldCropSystemData');
                if (fieldCropSystemDataStr) {
                    const fieldCropSystemData = JSON.parse(fieldCropSystemDataStr);
                    if (fieldCropSystemData?.sprinklerConfig?.totalFlowRatePerMinute) {
                        totalWaterPerMinute =
                            fieldCropSystemData.sprinklerConfig.totalFlowRatePerMinute;
                    }
                }
            } catch (error) {
                console.error('Error parsing fieldCropSystemData:', error);
            }
        }
    } else if (projectMode === 'greenhouse') {
        totalSprinklers = input.totalTrees;
        flowPerSprinkler = input.waterPerTreeLiters / (input.irrigationTimeMinutes || 30);
        totalWaterPerMinute = totalSprinklers * flowPerSprinkler;
    } else if (projectMode === 'garden') {
        totalSprinklers = input.totalTrees;
        flowPerSprinkler = input.waterPerTreeLiters / (input.irrigationTimeMinutes || 30);
        totalWaterPerMinute = totalSprinklers * flowPerSprinkler;
    } else {
        totalSprinklers = Math.ceil(input.totalTrees * (input.sprinklersPerTree || 1));
        totalWaterPerMinute = input.waterPerTreeLiters;
        flowPerSprinkler = totalSprinklers > 0 ? totalWaterPerMinute / totalSprinklers : 0;
    }

    return {
        totalFlowLPM: totalWaterPerMinute,
        sprinklerFlowLPM: formatNumber(flowPerSprinkler, 2),
        sprinklersUsed: totalSprinklers,
    };
};

const calculateFlowRequirements = (
    input: IrrigationInput,
    selectedSprinkler: any,
    projectMode?: string
) => {
    const sprinklerFlow = calculateSprinklerBasedFlow(selectedSprinkler, input, projectMode);

    let totalSprinklers: number;
    let flowPerSprinklerLPM: number;

    if (projectMode === 'field-crop' || projectMode === 'greenhouse' || projectMode === 'garden') {
        totalSprinklers = sprinklerFlow.sprinklersUsed || input.totalTrees;
        flowPerSprinklerLPM =
            sprinklerFlow.sprinklerFlowLPM ||
            (totalSprinklers > 0 ? sprinklerFlow.totalFlowLPM / totalSprinklers : 0);
    } else {
        totalSprinklers =
            sprinklerFlow.sprinklersUsed ||
            Math.ceil(input.totalTrees * (input.sprinklersPerTree || 1));
        flowPerSprinklerLPM =
            sprinklerFlow.sprinklerFlowLPM || sprinklerFlow.totalFlowLPM / totalSprinklers;
    }

    let maxSprinklersPerBranch: number;
    if (projectMode === 'field-crop') {
        maxSprinklersPerBranch = Math.min(
            input.sprinklersPerLongestBranch || input.sprinklersPerBranch || 1,
            25
        );
    } else if (projectMode === 'greenhouse') {
        maxSprinklersPerBranch = Math.min(
            input.sprinklersPerLongestBranch || input.sprinklersPerBranch,
            15
        );
    } else if (projectMode === 'garden') {
        maxSprinklersPerBranch = Math.min(
            input.sprinklersPerLongestBranch || input.sprinklersPerBranch,
            12
        );
    } else {
        maxSprinklersPerBranch = Math.min(
            input.sprinklersPerLongestBranch || input.sprinklersPerBranch,
            20
        );
    }

    const branchFlowLPM = flowPerSprinklerLPM * maxSprinklersPerBranch;

    let maxBranchesPerSecondary: number;
    if (projectMode === 'field-crop') {
        maxBranchesPerSecondary = Math.min(
            input.branchesPerLongestSecondary || input.branchesPerSecondary || 1,
            12
        );
    } else if (projectMode === 'greenhouse') {
        maxBranchesPerSecondary = Math.min(
            input.branchesPerLongestSecondary || input.branchesPerSecondary,
            8
        );
    } else {
        maxBranchesPerSecondary = Math.min(
            input.branchesPerLongestSecondary || input.branchesPerSecondary,
            10
        );
    }

    const secondaryFlowLPM =
        input.longestSecondaryPipeM > 0 && projectMode !== 'greenhouse'
            ? branchFlowLPM * maxBranchesPerSecondary
            : 0;

    const mainFlowLPM =
        input.longestMainPipeM > 0
            ? projectMode === 'greenhouse'
                ? sprinklerFlow.totalFlowLPM
                : Math.min(sprinklerFlow.totalFlowLPM, secondaryFlowLPM * 2)
            : 0;

    const emitterFlowLPM =
        input.longestEmitterPipeM && input.longestEmitterPipeM > 0
            ? Math.max(flowPerSprinklerLPM * 0.5, flowPerSprinklerLPM)
            : 0;

    return {
        totalFlowLPM: sprinklerFlow.totalFlowLPM,
        totalSprinklers,
        sprinklersPerZone: formatNumber(totalSprinklers / input.numberOfZones, 1),
        flowPerSprinklerLPM: formatNumber(flowPerSprinklerLPM, 2),
        branchFlowLPM: formatNumber(branchFlowLPM, 1),
        secondaryFlowLPM: formatNumber(secondaryFlowLPM, 1),
        mainFlowLPM: formatNumber(mainFlowLPM, 1),
        emitterFlowLPM: formatNumber(emitterFlowLPM, 1),
    };
};

const calculateZoneResults = (
    allZoneData: ZoneCalculationData[],
    pipeData: any[]
): ZoneResults[] => {
    return allZoneData.map((zoneData) => {
        const { zoneId, input, sprinkler, projectMode } = zoneData;

        const flowData = calculateFlowRequirements(input, sprinkler, projectMode);

        const analyzedBranchPipes = pipeData
            .map((pipe) =>
                evaluatePipeOverall(
                    pipe,
                    flowData.branchFlowLPM,
                    input.longestBranchPipeM,
                    'branch',
                    input.pipeAgeYears || 0,
                    []
                )
            )
            .sort((a, b) => {
                if (a.isRecommended !== b.isRecommended) return b.isRecommended ? 1 : -1;
                if (a.isGoodChoice !== b.isGoodChoice) return b.isGoodChoice ? 1 : -1;
                return a.price - b.price;
            });

        const autoSelectedBranchPipe = autoSelectBestPipe(
            analyzedBranchPipes,
            'branch',
            flowData.branchFlowLPM,
            projectMode
        );

        const hasValidSecondaryPipe =
            input.longestSecondaryPipeM > 0 && input.totalSecondaryPipeM > 0;
        let autoSelectedSecondaryPipe: any = null;
        if (hasValidSecondaryPipe) {
            const analyzedSecondaryPipes = pipeData
                .map((pipe) =>
                    evaluatePipeOverall(
                        pipe,
                        flowData.secondaryFlowLPM,
                        input.longestSecondaryPipeM,
                        'secondary',
                        input.pipeAgeYears || 0,
                        []
                    )
                )
                .sort((a, b) => {
                    if (a.isRecommended !== b.isRecommended) return b.isRecommended ? 1 : -1;
                    if (a.isGoodChoice !== b.isGoodChoice) return b.isGoodChoice ? 1 : -1;
                    return a.price - b.price;
                });

            autoSelectedSecondaryPipe = autoSelectBestPipe(
                analyzedSecondaryPipes,
                'secondary',
                flowData.secondaryFlowLPM,
                projectMode
            );
        }

        const hasValidMainPipe = input.longestMainPipeM > 0 && input.totalMainPipeM > 0;
        let autoSelectedMainPipe: any = null;
        if (hasValidMainPipe) {
            const analyzedMainPipes = pipeData
                .map((pipe) =>
                    evaluatePipeOverall(
                        pipe,
                        flowData.mainFlowLPM,
                        input.longestMainPipeM,
                        'main',
                        input.pipeAgeYears || 0,
                        []
                    )
                )
                .sort((a, b) => {
                    if (a.isRecommended !== b.isRecommended) return b.isRecommended ? 1 : -1;
                    if (a.isGoodChoice !== b.isGoodChoice) return b.isGoodChoice ? 1 : -1;
                    return a.price - b.price;
                });

            autoSelectedMainPipe = autoSelectBestPipe(
                analyzedMainPipes,
                'main',
                flowData.mainFlowLPM,
                projectMode
            );
        }

        const branchLoss = autoSelectedBranchPipe
            ? calculateImprovedHeadLoss(
                  flowData.branchFlowLPM,
                  autoSelectedBranchPipe.sizeMM,
                  input.longestBranchPipeM,
                  autoSelectedBranchPipe.pipeType,
                  'branch',
                  input.pipeAgeYears || 0
              )
            : { major: 0, minor: 0, total: 0, velocity: 0, C: 135, K: 0 };

        const secondaryLoss =
            autoSelectedSecondaryPipe && hasValidSecondaryPipe
                ? calculateImprovedHeadLoss(
                      flowData.secondaryFlowLPM,
                      autoSelectedSecondaryPipe.sizeMM,
                      input.longestSecondaryPipeM,
                      autoSelectedSecondaryPipe.pipeType,
                      'secondary',
                      input.pipeAgeYears || 0
                  )
                : { major: 0, minor: 0, total: 0, velocity: 0, C: 140, K: 0 };

        const mainLoss =
            autoSelectedMainPipe && hasValidMainPipe
                ? calculateImprovedHeadLoss(
                      flowData.mainFlowLPM,
                      autoSelectedMainPipe.sizeMM,
                      input.longestMainPipeM,
                      autoSelectedMainPipe.pipeType,
                      'main',
                      input.pipeAgeYears || 0
                  )
                : { major: 0, minor: 0, total: 0, velocity: 0, C: 145, K: 0 };

        const hasValidEmitterPipe =
            input.longestEmitterPipeM &&
            input.longestEmitterPipeM > 0 &&
            input.totalEmitterPipeM &&
            input.totalEmitterPipeM > 0;
        let autoSelectedEmitterPipe: any = null;
        if (hasValidEmitterPipe) {
            const analyzedEmitterPipes = pipeData
                .map((pipe) =>
                    evaluatePipeOverall(
                        pipe,
                        flowData.emitterFlowLPM,
                        input.longestEmitterPipeM || 0,
                        'emitter',
                        input.pipeAgeYears || 0,
                        []
                    )
                )
                .sort((a, b) => {
                    if (a.isRecommended !== b.isRecommended) return b.isRecommended ? 1 : -1;
                    if (a.isGoodChoice !== b.isGoodChoice) return b.isGoodChoice ? 1 : -1;
                    return a.price - b.price;
                });

            autoSelectedEmitterPipe = autoSelectBestPipe(
                analyzedEmitterPipes,
                'emitter',
                flowData.emitterFlowLPM,
                projectMode
            );
        }

        const emitterLoss =
            autoSelectedEmitterPipe && hasValidEmitterPipe
                ? calculateImprovedHeadLoss(
                      flowData.emitterFlowLPM,
                      autoSelectedEmitterPipe.sizeMM,
                      input.longestEmitterPipeM || 0,
                      autoSelectedEmitterPipe.pipeType,
                      'emitter',
                      input.pipeAgeYears || 0
                  )
                : { major: 0, minor: 0, total: 0, velocity: 0, C: 135, K: 0 };

        const totalHeadLoss =
            branchLoss.total + secondaryLoss.total + mainLoss.total + emitterLoss.total;
        const pressureHead = calculateSprinklerPressure(
            sprinkler,
            input.pressureHeadM,
            projectMode
        );
        const totalHead = input.staticHeadM + totalHeadLoss + pressureHead;

        return {
            zoneId,
            zoneName: zoneId,
            totalFlowLPM: flowData.totalFlowLPM,
            headLoss: {
                branch: branchLoss.total,
                secondary: secondaryLoss.total,
                main: mainLoss.total,
                emitter: emitterLoss.total,
                total: totalHeadLoss,
            },
            staticHead: input.staticHeadM,
            pressureHead: pressureHead,
            totalHead: totalHead,
            autoSelectedPipes: {
                branch: autoSelectedBranchPipe,
                secondary: autoSelectedSecondaryPipe,
                main: autoSelectedMainPipe,
                emitter: autoSelectedEmitterPipe,
            },
            sprinklerCount: flowData.totalSprinklers,
        };
    });
};

const calculateProjectSummary = (
    allZoneResults: ZoneResults[],
    zoneOperationGroups: ZoneOperationGroup[]
): ProjectSummary => {
    if (!allZoneResults || allZoneResults.length === 0) {
        return {
            totalFlowLPM: 0,
            maxHeadM: 0,
            criticalZone: '',
            operationMode: 'single',
            selectedGroupFlowLPM: 0,
            selectedGroupHeadM: 0,
        };
    }

    const maxHeadZone = allZoneResults.reduce((max, current) =>
        current.totalHead > max.totalHead ? current : max
    );

    let operationMode = 'sequential';
    let selectedGroupFlowLPM = maxHeadZone.totalFlowLPM;
    let selectedGroupHeadM = maxHeadZone.totalHead;
    let criticalGroup: ZoneOperationGroup | undefined;

    if (zoneOperationGroups && zoneOperationGroups.length > 0) {
        const groupRequirements = zoneOperationGroups.map((group) => {
            const zonesInGroup = allZoneResults.filter((zr) => group.zones.includes(zr.zoneId));
            const totalFlow = zonesInGroup.reduce((sum, zone) => sum + zone.totalFlowLPM, 0);
            const maxHead =
                zonesInGroup.length > 0
                    ? Math.max(...zonesInGroup.map((zone) => zone.totalHead))
                    : 0;

            return {
                group,
                totalFlow,
                maxHead,
                zones: zonesInGroup,
            };
        });

        const criticalGroupReq = groupRequirements.reduce((max, current) =>
            current.maxHead > max.maxHead ? current : max
        );

        selectedGroupFlowLPM = criticalGroupReq.totalFlow;
        selectedGroupHeadM = criticalGroupReq.maxHead;
        criticalGroup = criticalGroupReq.group;

        if (
            zoneOperationGroups.length === 1 &&
            zoneOperationGroups[0].zones.length === allZoneResults.length
        ) {
            operationMode = 'simultaneous';
        } else if (zoneOperationGroups.length > 1) {
            operationMode = 'custom';
        }
    }

    const totalFlowLPM = allZoneResults.reduce((sum, zone) => sum + zone.totalFlowLPM, 0);

    return {
        totalFlowLPM,
        maxHeadM: maxHeadZone.totalHead,
        criticalZone: maxHeadZone.zoneId,
        operationMode,
        selectedGroupFlowLPM,
        selectedGroupHeadM,
        criticalGroup,
    };
};

const calculateSystemComplexity = (input: IrrigationInput, projectMode?: string): string => {
    let complexityScore = 0;

    if (input.numberOfZones > 6) complexityScore += 4;
    else if (input.numberOfZones > 3) complexityScore += 3;
    else if (input.numberOfZones > 1) complexityScore += 2;

    if (input.longestMainPipeM > 0 && input.longestSecondaryPipeM > 0) complexityScore += 4;
    else if (input.longestSecondaryPipeM > 0) complexityScore += 3;
    else if (input.longestMainPipeM > 0) complexityScore += 2;

    if (projectMode === 'field-crop') {
        if (input.farmSizeRai > 50 || input.totalTrees > 2000) complexityScore += 4;
        else if (input.farmSizeRai > 20 || input.totalTrees > 1000) complexityScore += 3;
        else if (input.farmSizeRai > 10 || input.totalTrees > 500) complexityScore += 2;
    } else if (projectMode === 'greenhouse') {
        if (input.farmSizeRai > 5000 || input.totalTrees > 2000) complexityScore += 3;
        else if (input.farmSizeRai > 2000 || input.totalTrees > 1000) complexityScore += 2;
        else if (input.farmSizeRai > 1000 || input.totalTrees > 500) complexityScore += 1;
    } else if (projectMode === 'garden') {
        if (input.farmSizeRai > 800 || input.totalTrees > 200) complexityScore += 2;
        else if (input.farmSizeRai > 400 || input.totalTrees > 100) complexityScore += 1;
    } else {
        if (input.farmSizeRai > 30 || input.totalTrees > 3000) complexityScore += 3;
        else if (input.farmSizeRai > 15 || input.totalTrees > 1500) complexityScore += 2;
        else if (input.farmSizeRai > 5 || input.totalTrees > 500) complexityScore += 1;
    }

    const totalPipeLength =
        input.totalBranchPipeM + input.totalSecondaryPipeM + input.totalMainPipeM;

    let pipeLengthThresholds = [5000, 2000, 800];
    if (projectMode === 'field-crop') {
        pipeLengthThresholds = [8000, 3000, 1200];
    } else if (projectMode === 'greenhouse') {
        pipeLengthThresholds = [2000, 800, 300];
    } else if (projectMode === 'garden') {
        pipeLengthThresholds = [1000, 400, 150];
    }

    if (totalPipeLength > pipeLengthThresholds[0]) complexityScore += 3;
    else if (totalPipeLength > pipeLengthThresholds[1]) complexityScore += 2;
    else if (totalPipeLength > pipeLengthThresholds[2]) complexityScore += 1;

    if (input.simultaneousZones === input.numberOfZones && input.numberOfZones > 3) {
        complexityScore += 2;
    }

    if (complexityScore >= 8) return 'complex';
    if (complexityScore >= 4) return 'medium';
    return 'simple';
};

const autoSelectBestPipe = (
    analyzedPipes: any[],
    pipeType: string,
    flowLPM: number,
    projectMode?: string
): any => {
    if (!analyzedPipes || analyzedPipes.length === 0) return null;

    let velocityMin = 0.3;
    let velocityMax = 3.5;
    let minPressure = 6;

    if (projectMode === 'field-crop') {
        velocityMin = 0.4;
        velocityMax = 4.0;
        minPressure = 8;
    } else if (projectMode === 'greenhouse') {
        velocityMin = 0.2;
        velocityMax = 3.0;
        minPressure = 6;
    } else if (projectMode === 'garden') {
        velocityMin = 0.3;
        velocityMax = 3.5;
        minPressure = 6;
    }

    const suitablePipes = analyzedPipes.filter((pipe) => {
        const isVelocityOK = pipe.velocity >= velocityMin && pipe.velocity <= velocityMax;
        const isPressureOK = pipe.pn >= minPressure;
        const isHeadLossOK = (pipe.headLoss / pipe.lengthM) * 100 <= 20;
        return isVelocityOK && isPressureOK && isHeadLossOK;
    });

    if (suitablePipes.length === 0) {
        return analyzedPipes.sort((a, b) => {
            if (a.isRecommended !== b.isRecommended) return b.isRecommended ? 1 : -1;
            if (a.isGoodChoice !== b.isGoodChoice) return b.isGoodChoice ? 1 : -1;
            return a.price - b.price;
        })[0];
    }

    return suitablePipes.sort((a, b) => {
        if (a.isRecommended !== b.isRecommended) return b.isRecommended ? 1 : -1;
        if (a.isGoodChoice !== b.isGoodChoice) return b.isGoodChoice ? 1 : -1;

        const aHeadLossPer100m = (a.headLoss / Math.max(a.lengthM || 50, 1)) * 100;
        const bHeadLossPer100m = (b.headLoss / Math.max(b.lengthM || 50, 1)) * 100;
        if (Math.abs(aHeadLossPer100m - bHeadLossPer100m) > 3) {
            return aHeadLossPer100m - bHeadLossPer100m;
        }

        let optimalVelocity = 1.4;
        if (projectMode === 'field-crop') {
            optimalVelocity = 1.6;
        } else if (projectMode === 'greenhouse') {
            optimalVelocity = 1.2;
        }

        const aVelScore = Math.abs(optimalVelocity - a.velocity);
        const bVelScore = Math.abs(optimalVelocity - b.velocity);
        if (Math.abs(aVelScore - bVelScore) > 0.2) return aVelScore - bVelScore;

        return a.price - b.price;
    })[0];
};

const autoSelectBestPump = (
    analyzedPumps: any[],
    requiredFlowLPM: number,
    requiredHeadM: number,
    projectMode?: string
): any => {
    if (!analyzedPumps || analyzedPumps.length === 0) return null;

    const fullyAdequatePumps = analyzedPumps.filter(
        (pump) => pump.isFlowAdequate && pump.isHeadAdequate
    );

    if (fullyAdequatePumps.length > 0) {
        return fullyAdequatePumps.sort((a, b) => {
            const aFlowEfficiency = a.maxFlow / requiredFlowLPM;
            const aHeadEfficiency = a.maxHead / requiredHeadM;
            const aEfficiency = Math.abs(aFlowEfficiency - 1.0) + Math.abs(aHeadEfficiency - 1.0);

            const bFlowEfficiency = b.maxFlow / requiredFlowLPM;
            const bHeadEfficiency = b.maxHead / requiredHeadM;
            const bEfficiency = Math.abs(bFlowEfficiency - 1.0) + Math.abs(bHeadEfficiency - 1.0);

            if (Math.abs(aEfficiency - bEfficiency) > 0.1) {
                return aEfficiency - bEfficiency;
            }
            return a.price - b.price;
        })[0];
    }

    const partiallyAdequatePumps = analyzedPumps.filter(
        (pump) => pump.isFlowAdequate || pump.isHeadAdequate
    );

    if (partiallyAdequatePumps.length > 0) {
        return partiallyAdequatePumps.sort((a, b) => {
            const aScore = (a.isFlowAdequate ? 2 : 0) + (a.isHeadAdequate ? 1 : 0);
            const bScore = (b.isFlowAdequate ? 2 : 0) + (b.isHeadAdequate ? 1 : 0);

            if (aScore !== bScore) {
                return bScore - aScore; // คะแนนสูงสุดก่อน
            }

            const aDeficit =
                Math.max(0, requiredFlowLPM - a.maxFlow) + Math.max(0, requiredHeadM - a.maxHead);
            const bDeficit =
                Math.max(0, requiredFlowLPM - b.maxFlow) + Math.max(0, requiredHeadM - b.maxHead);

            if (Math.abs(aDeficit - bDeficit) > 0.1) {
                return aDeficit - bDeficit;
            }

            return a.price - b.price;
        })[0];
    }

    return analyzedPumps.sort((a, b) => {
        const aDeficit =
            Math.max(0, requiredFlowLPM - a.maxFlow) + Math.max(0, requiredHeadM - a.maxHead);
        const bDeficit =
            Math.max(0, requiredFlowLPM - b.maxFlow) + Math.max(0, requiredHeadM - b.maxHead);
        return aDeficit - bDeficit;
    })[0];
};

const getFieldCropCalculationData = (): {
    fieldCropData: FieldCropData | null;
    convertedInput: IrrigationInput | null;
} => {
    try {
        const fieldCropData = getEnhancedFieldCropData();
        if (!fieldCropData) {
            return { fieldCropData: null, convertedInput: null };
        }

        const convertedInput: IrrigationInput = {
            farmSizeRai: fieldCropData.area.sizeInRai,
            totalTrees: fieldCropData.summary.totalPlantingPoints,
            waterPerTreeLiters:
                fieldCropData.summary.totalWaterRequirementPerDay /
                fieldCropData.summary.totalPlantingPoints /
                60,
            numberOfZones: fieldCropData.zones.count,
            sprinklersPerTree: 1,
            longestBranchPipeM: fieldCropData.pipes.stats.lateral.longestLength,
            totalBranchPipeM: fieldCropData.pipes.stats.lateral.totalLength,
            longestSecondaryPipeM: fieldCropData.pipes.stats.submain.longestLength,
            totalSecondaryPipeM: fieldCropData.pipes.stats.submain.totalLength,
            longestMainPipeM: fieldCropData.pipes.stats.main.longestLength,
            totalMainPipeM: fieldCropData.pipes.stats.main.totalLength,
            irrigationTimeMinutes: 30,
            staticHeadM: 5,
            pressureHeadM: 20,
            pipeAgeYears: 0,
            sprinklersPerBranch: Math.min(
                25,
                Math.ceil(
                    fieldCropData.summary.totalPlantingPoints / fieldCropData.zones.count / 10
                )
            ),
            branchesPerSecondary: Math.min(12, Math.ceil(fieldCropData.zones.count / 2)),
            simultaneousZones: 1,
            sprinklersPerLongestBranch: Math.min(
                25,
                Math.ceil(
                    fieldCropData.summary.totalPlantingPoints / fieldCropData.zones.count / 10
                )
            ),
            branchesPerLongestSecondary: Math.min(12, Math.ceil(fieldCropData.zones.count / 2)),
            secondariesPerLongestMain: Math.min(8, Math.ceil(fieldCropData.zones.count / 3)),
        };

        return { fieldCropData, convertedInput };
    } catch (error) {
        return { fieldCropData: null, convertedInput: null };
    }
};

export const useCalculations = (
    input: IrrigationInput,
    selectedSprinkler?: any,
    allZoneData?: ZoneCalculationData[],
    zoneOperationGroups?: ZoneOperationGroup[]
): CalculationResults | null => {
    const [sprinklerData, setSprinklerData] = useState<any[]>([]);
    const [pumpData, setPumpData] = useState<any[]>([]);
    const [pipeData, setPipeData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEquipmentData = async (categoryName: string) => {
        try {
            const endpoints = [
                `/api/equipments/by-category/${categoryName}`,
                `/api/equipments/category/${categoryName}`,
                `/api/equipments?category=${categoryName}`,
                `/api/equipments/by-category-name/${categoryName}`,
            ];

            let data: any[] = [];

            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint);
                    if (response.ok) {
                        const result = await response.json();
                        data = Array.isArray(result) ? result : [];
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (data.length === 0) {
                const response = await fetch('/api/equipments');
                if (response.ok) {
                    const allEquipments = await response.json();
                    data = Array.isArray(allEquipments)
                        ? allEquipments.filter((item) => {
                              const categoryMatch =
                                  item.category?.name === categoryName ||
                                  item.category?.display_name
                                      ?.toLowerCase()
                                      .includes(categoryName.toLowerCase());
                              return categoryMatch;
                          })
                        : [];
                }
            }

            return data;
        } catch (error) {
            return [];
        }
    };

    const transformEquipmentData = (
        equipment: any[],
        categoryType: 'sprinkler' | 'pump' | 'pipe'
    ) => {
        return equipment
            .map((item) => {
                try {
                    const transformed: any = {
                        id: item.id,
                        productCode: item.product_code || item.productCode,
                        product_code: item.product_code || item.productCode,
                        name: item.name,
                        brand: item.brand,
                        image: item.image,
                        price: Number(item.price || 0),
                        is_active: Boolean(item.is_active),
                        description: item.description,
                    };

                    const allAttributes = {};
                    Object.keys(item).forEach((key) => {
                        if (
                            ![
                                'id',
                                'category_id',
                                'product_code',
                                'productCode',
                                'name',
                                'brand',
                                'image',
                                'price',
                                'description',
                                'is_active',
                                'created_at',
                                'updated_at',
                                'category',
                                'attributes',
                                'formatted_attributes',
                                'attributes_raw',
                                'pumpAccessories',
                                'pumpAccessory',
                            ].includes(key)
                        ) {
                            (allAttributes as any)[key] = item[key];
                        }
                    });

                    if (item.attributes && typeof item.attributes === 'object') {
                        Object.assign(allAttributes, item.attributes);
                    }

                    if (item.attributes_raw && typeof item.attributes_raw === 'object') {
                        Object.assign(allAttributes, item.attributes_raw);
                    }

                    if (Array.isArray(item.formatted_attributes)) {
                        item.formatted_attributes.forEach((attr: any) => {
                            if (attr.attribute_name && attr.value !== undefined) {
                                (allAttributes as any)[attr.attribute_name] = attr.value;
                            }
                        });
                    }

                    Object.assign(transformed, allAttributes);

                    switch (categoryType) {
                        case 'sprinkler':
                            if (transformed.waterVolumeLitersPerMinute !== undefined) {
                                transformed.waterVolumeLitersPerMinute = parseRangeValue(
                                    transformed.waterVolumeLitersPerMinute
                                );
                            }
                            if (transformed.radiusMeters !== undefined) {
                                transformed.radiusMeters = parseRangeValue(
                                    transformed.radiusMeters
                                );
                            }
                            if (transformed.pressureBar !== undefined) {
                                transformed.pressureBar = parseRangeValue(transformed.pressureBar);
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
                                    if (transformed[field] !== undefined) {
                                        transformed[field] = Number(transformed[field]) || 0;
                                    }
                                });

                                const rangeFields = ['flow_rate_lpm', 'head_m'];
                                rangeFields.forEach((field) => {
                                    if (transformed[field] !== undefined) {
                                        transformed[field] = parseRangeValue(transformed[field]);
                                    }
                                });
                            }

                            if (item.pumpAccessories || item.pump_accessories) {
                                transformed.pumpAccessories =
                                    item.pumpAccessories || item.pump_accessories || [];
                            }
                            break;

                        case 'pipe':
                            if (transformed.pn !== undefined) {
                                transformed.pn = Number(transformed.pn) || 0;
                            }
                            if (transformed.sizeMM !== undefined) {
                                transformed.sizeMM = Number(transformed.sizeMM) || 0;
                            }
                            if (transformed.lengthM !== undefined) {
                                transformed.lengthM = Number(transformed.lengthM) || 0;
                            }
                            break;
                    }

                    return transformed;
                } catch (error) {
                    return null;
                }
            })
            .filter((item) => item && item.is_active !== false);
    };

    useEffect(() => {
        const loadEquipmentData = async () => {
            setLoading(true);
            setError(null);

            try {
                const [sprinklers, pumps, pipes] = await Promise.all([
                    fetchEquipmentData('sprinkler'),
                    fetchEquipmentData('pump'),
                    fetchEquipmentData('pipe'),
                ]);

                const transformedSprinklers = transformEquipmentData(sprinklers, 'sprinkler');
                const transformedPumps = transformEquipmentData(pumps, 'pump');
                const transformedPipes = transformEquipmentData(pipes, 'pipe');

                setSprinklerData(transformedSprinklers);
                setPumpData(transformedPumps);
                setPipeData(transformedPipes);

                if (
                    transformedSprinklers.length === 0 &&
                    transformedPumps.length === 0 &&
                    transformedPipes.length === 0
                ) {
                    setError('ไม่พบข้อมูลอุปกรณ์ที่เปิดใช้งานในระบบ');
                }
            } catch (error) {
                setError(
                    `ไม่สามารถโหลดข้อมูลอุปกรณ์ได้: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
                setSprinklerData([]);
                setPumpData([]);
                setPipeData([]);
            } finally {
                setLoading(false);
            }
        };

        loadEquipmentData();
    }, []);

    return useMemo(() => {
        if (loading || error) return null;

        if (!sprinklerData.length || !pumpData.length || !pipeData.length) {
            return null;
        }
        if (!input) return null;

        const projectMode =
            allZoneData && allZoneData.length > 0 ? allZoneData[0].projectMode : undefined;

        let workingInput = input;
        let fieldCropData: FieldCropData | null = null;

        if (projectMode === 'field-crop') {
            const { fieldCropData: fcData, convertedInput } = getFieldCropCalculationData();
            if (fcData && convertedInput) {
                fieldCropData = fcData;
                workingInput = convertedInput;
            }
        }

        const sanitizedInput = {
            ...workingInput,
            sprinklersPerLongestBranch: Math.min(
                Math.max(workingInput.sprinklersPerLongestBranch || 4, 1),
                projectMode === 'field-crop' ? 25 : projectMode === 'greenhouse' ? 15 : 20
            ),
            branchesPerLongestSecondary: Math.min(
                Math.max(workingInput.branchesPerLongestSecondary || 1, 1),
                projectMode === 'field-crop' ? 12 : projectMode === 'greenhouse' ? 8 : 10
            ),
            totalTrees: Math.max(workingInput.totalTrees, 1),
            waterPerTreeLiters: Math.max(workingInput.waterPerTreeLiters, 0.1),
            irrigationTimeMinutes: Math.max(workingInput.irrigationTimeMinutes, 5),
        };

        const flowData = calculateFlowRequirements(sanitizedInput, selectedSprinkler, projectMode);
        const systemComplexity = calculateSystemComplexity(sanitizedInput, projectMode);

        const hasValidSecondaryPipe =
            sanitizedInput.longestSecondaryPipeM > 0 && sanitizedInput.totalSecondaryPipeM > 0;
        const hasValidMainPipe =
            sanitizedInput.longestMainPipeM > 0 && sanitizedInput.totalMainPipeM > 0;

        let allZoneResults: ZoneResults[] = [];
        let projectSummary: ProjectSummary | undefined = undefined;

        if (allZoneData && allZoneData.length > 1) {
            allZoneResults = calculateZoneResults(allZoneData, pipeData);
            projectSummary = calculateProjectSummary(allZoneResults, zoneOperationGroups || []);
        }

        const analyzedSprinklers = sprinklerData
            .map((sprinkler) => {
                const enhancedSprinkler = { ...sprinkler };

                if (projectMode === 'field-crop' && fieldCropData) {
                    const targetFlow = sanitizedInput.waterPerTreeLiters;
                    const minFlow = targetFlow * 0.8;
                    const maxFlow = targetFlow * 1.2;

                    const sprinklerFlow =
                        sprinkler.waterVolumeLitersPerMinute || sprinkler.flow || 0;
                    enhancedSprinkler.flowMatch =
                        sprinklerFlow >= minFlow && sprinklerFlow <= maxFlow;
                    enhancedSprinkler.flowCloseMatch =
                        Math.abs(sprinklerFlow - targetFlow) <= targetFlow * 0.3;
                    enhancedSprinkler.targetFlow = targetFlow;
                    enhancedSprinkler.minFlow = minFlow;
                    enhancedSprinkler.maxFlow = maxFlow;

                    enhancedSprinkler.pricePerFlow =
                        sprinklerFlow > 0 ? (sprinkler.price || 0) / sprinklerFlow : 0;

                    enhancedSprinkler.isRecommended =
                        enhancedSprinkler.flowMatch && (sprinkler.price || 0) < 1000;
                    enhancedSprinkler.isGoodChoice =
                        enhancedSprinkler.flowCloseMatch && (sprinkler.price || 0) < 2000;
                    enhancedSprinkler.isUsable = sprinklerFlow >= minFlow * 0.5;
                }

                return enhancedSprinkler;
            })
            .sort((a, b) => {
                if (a.isRecommended !== b.isRecommended) return b.isRecommended ? 1 : -1;
                if (a.isGoodChoice !== b.isGoodChoice) return b.isGoodChoice ? 1 : -1;
                return a.price - b.price;
            });

        const analyzedBranchPipes = pipeData
            .map((pipe) =>
                evaluatePipeOverall(
                    pipe,
                    flowData.branchFlowLPM,
                    sanitizedInput.longestBranchPipeM,
                    'branch',
                    sanitizedInput.pipeAgeYears || 0,
                    []
                )
            )
            .sort((a, b) => {
                if (a.isRecommended !== b.isRecommended) return b.isRecommended ? 1 : -1;
                if (a.isGoodChoice !== b.isGoodChoice) return b.isGoodChoice ? 1 : -1;
                return a.price - b.price;
            });

        const autoSelectedBranchPipe = autoSelectBestPipe(
            analyzedBranchPipes,
            'branch',
            flowData.branchFlowLPM,
            projectMode
        );

        const analyzedSecondaryPipes = hasValidSecondaryPipe
            ? pipeData
                  .map((pipe) =>
                      evaluatePipeOverall(
                          pipe,
                          flowData.secondaryFlowLPM,
                          sanitizedInput.longestSecondaryPipeM,
                          'secondary',
                          sanitizedInput.pipeAgeYears || 0,
                          []
                      )
                  )
                  .sort((a, b) => {
                      if (a.isRecommended !== b.isRecommended) return b.isRecommended ? 1 : -1;
                      if (a.isGoodChoice !== b.isGoodChoice) return b.isGoodChoice ? 1 : -1;
                      return a.price - b.price;
                  })
            : [];

        const autoSelectedSecondaryPipe = hasValidSecondaryPipe
            ? autoSelectBestPipe(
                  analyzedSecondaryPipes,
                  'secondary',
                  flowData.secondaryFlowLPM,
                  projectMode
              )
            : null;

        const analyzedMainPipes = hasValidMainPipe
            ? pipeData
                  .map((pipe) =>
                      evaluatePipeOverall(
                          pipe,
                          flowData.mainFlowLPM,
                          sanitizedInput.longestMainPipeM,
                          'main',
                          sanitizedInput.pipeAgeYears || 0,
                          []
                      )
                  )
                  .sort((a, b) => {
                      if (a.isRecommended !== b.isRecommended) return b.isRecommended ? 1 : -1;
                      if (a.isGoodChoice !== b.isGoodChoice) return b.isGoodChoice ? 1 : -1;
                      return a.price - b.price;
                  })
            : [];

        const autoSelectedMainPipe = hasValidMainPipe
            ? autoSelectBestPipe(analyzedMainPipes, 'main', flowData.mainFlowLPM, projectMode)
            : null;

        const hasValidEmitterPipe =
            sanitizedInput.longestEmitterPipeM &&
            sanitizedInput.longestEmitterPipeM > 0 &&
            sanitizedInput.totalEmitterPipeM &&
            sanitizedInput.totalEmitterPipeM > 0;

        const analyzedEmitterPipes = hasValidEmitterPipe
            ? pipeData
                  .map((pipe) =>
                      evaluatePipeOverall(
                          pipe,
                          flowData.emitterFlowLPM,
                          sanitizedInput.longestEmitterPipeM || 0,
                          'emitter',
                          sanitizedInput.pipeAgeYears || 0,
                          []
                      )
                  )
                  .sort((a, b) => {
                      if (a.isRecommended !== b.isRecommended) return b.isRecommended ? 1 : -1;
                      if (a.isGoodChoice !== b.isGoodChoice) return b.isGoodChoice ? 1 : -1;
                      return a.price - b.price;
                  })
            : [];

        const autoSelectedEmitterPipe = hasValidEmitterPipe
            ? autoSelectBestPipe(
                  analyzedEmitterPipes,
                  'emitter',
                  flowData.emitterFlowLPM,
                  projectMode
              )
            : null;

        const branchLoss = autoSelectedBranchPipe
            ? calculateImprovedHeadLoss(
                  flowData.branchFlowLPM,
                  autoSelectedBranchPipe.sizeMM,
                  sanitizedInput.longestBranchPipeM,
                  autoSelectedBranchPipe.pipeType,
                  'branch',
                  sanitizedInput.pipeAgeYears || 0
              )
            : { major: 0, minor: 0, total: 0, velocity: 0, C: 135, K: 0 };

        const secondaryLoss =
            autoSelectedSecondaryPipe && hasValidSecondaryPipe
                ? calculateImprovedHeadLoss(
                      flowData.secondaryFlowLPM,
                      autoSelectedSecondaryPipe.sizeMM,
                      sanitizedInput.longestSecondaryPipeM,
                      autoSelectedSecondaryPipe.pipeType,
                      'secondary',
                      sanitizedInput.pipeAgeYears || 0
                  )
                : { major: 0, minor: 0, total: 0, velocity: 0, C: 140, K: 0 };

        const mainLoss =
            autoSelectedMainPipe && hasValidMainPipe
                ? calculateImprovedHeadLoss(
                      flowData.mainFlowLPM,
                      autoSelectedMainPipe.sizeMM,
                      sanitizedInput.longestMainPipeM,
                      autoSelectedMainPipe.pipeType,
                      'main',
                      sanitizedInput.pipeAgeYears || 0
                  )
                : { major: 0, minor: 0, total: 0, velocity: 0, C: 145, K: 0 };

        const emitterLoss =
            autoSelectedEmitterPipe && hasValidEmitterPipe
                ? calculateImprovedHeadLoss(
                      flowData.emitterFlowLPM,
                      autoSelectedEmitterPipe.sizeMM,
                      sanitizedInput.longestEmitterPipeM || 0,
                      autoSelectedEmitterPipe.pipeType,
                      'emitter',
                      sanitizedInput.pipeAgeYears || 0
                  )
                : { major: 0, minor: 0, total: 0, velocity: 0, C: 135, K: 0 };

        let totalHeadLoss =
            branchLoss.total + secondaryLoss.total + mainLoss.total + emitterLoss.total;
        const connectionLoss = totalHeadLoss * 0.03;
        totalHeadLoss += connectionLoss;

        const totalMajorLoss =
            branchLoss.major + secondaryLoss.major + mainLoss.major + emitterLoss.major;
        const totalMinorLoss =
            branchLoss.minor +
            secondaryLoss.minor +
            mainLoss.minor +
            emitterLoss.minor +
            connectionLoss;

        const pressureFromSprinkler = calculateSprinklerPressure(
            selectedSprinkler,
            sanitizedInput.pressureHeadM,
            projectMode
        );

        let basePumpHead = sanitizedInput.staticHeadM + totalHeadLoss + pressureFromSprinkler;
        let requiredPumpFlow = flowData.totalFlowLPM;

        if (projectSummary) {
            basePumpHead = projectSummary.selectedGroupHeadM;
            requiredPumpFlow = projectSummary.selectedGroupFlowLPM;
        }

        const safetyFactor = calculateSafetyFactor(systemComplexity, sanitizedInput.numberOfZones);
        const pumpHeadRequired = basePumpHead * safetyFactor;

        const headLossValidation = validateHeadLossRatio(totalHeadLoss, basePumpHead);

        const analyzedPumps = pumpData
            .map((pump) => {
                const enhancedPump = evaluatePumpOverall(pump, requiredPumpFlow, pumpHeadRequired);

                if (projectMode === 'field-crop' && fieldCropData) {
                    const pumpFlow = pump.flow_rate_lpm || pump.maxFlow || 0;
                    const pumpHead = pump.head_m || pump.maxHead || 0;

                    enhancedPump.flowRatio = pumpFlow > 0 ? pumpFlow / requiredPumpFlow : 0;
                    enhancedPump.headRatio = pumpHead > 0 ? pumpHead / pumpHeadRequired : 0;

                    enhancedPump.isFlowAdequate = pumpFlow >= requiredPumpFlow * 0.9;
                    enhancedPump.isHeadAdequate = pumpHead >= pumpHeadRequired * 0.9;

                    const flowEfficiency = enhancedPump.isFlowAdequate
                        ? 1
                        : pumpFlow / requiredPumpFlow;
                    const headEfficiency = enhancedPump.isHeadAdequate
                        ? 1
                        : pumpHead / pumpHeadRequired;
                    enhancedPump.efficiencyScore = (flowEfficiency + headEfficiency) / 2;

                    enhancedPump.isRecommended =
                        enhancedPump.isFlowAdequate &&
                        enhancedPump.isHeadAdequate &&
                        (pump.price || 0) < 50000;
                    enhancedPump.isGoodChoice =
                        enhancedPump.efficiencyScore > 0.8 && (pump.price || 0) < 100000;
                    enhancedPump.isUsable = enhancedPump.efficiencyScore > 0.6;
                }

                return enhancedPump;
            })
            .sort((a, b) => {
                const aAdequate = a.isFlowAdequate && a.isHeadAdequate;
                const bAdequate = b.isFlowAdequate && b.isHeadAdequate;
                if (aAdequate !== bAdequate) return bAdequate ? 1 : -1;
                if (a.isRecommended !== b.isRecommended) return b.isRecommended ? 1 : -1;
                if (a.isGoodChoice !== b.isGoodChoice) return b.isGoodChoice ? 1 : -1;
                return a.price - b.price;
            });

        const autoSelectedPump = autoSelectBestPump(
            analyzedPumps,
            requiredPumpFlow,
            pumpHeadRequired,
            projectMode
        );

        const branchRolls =
            autoSelectedBranchPipe && sanitizedInput.totalBranchPipeM > 0
                ? calculatePipeRolls(
                      sanitizedInput.totalBranchPipeM,
                      autoSelectedBranchPipe.lengthM
                  )
                : 0;
        const secondaryRolls =
            autoSelectedSecondaryPipe && hasValidSecondaryPipe
                ? calculatePipeRolls(
                      sanitizedInput.totalSecondaryPipeM,
                      autoSelectedSecondaryPipe.lengthM
                  )
                : 0;
        const mainRolls =
            autoSelectedMainPipe && hasValidMainPipe
                ? calculatePipeRolls(sanitizedInput.totalMainPipeM, autoSelectedMainPipe.lengthM)
                : 0;
        const emitterRolls =
            autoSelectedEmitterPipe && hasValidEmitterPipe
                ? calculatePipeRolls(
                      sanitizedInput.totalEmitterPipeM || 0,
                      autoSelectedEmitterPipe.lengthM
                  )
                : 0;

        const velocityWarnings: string[] = [];
        if (branchLoss.velocity > 0) {
            const warning = checkVelocity(branchLoss.velocity, 'ท่อย่อย');
            if (!warning.includes('🟢')) velocityWarnings.push(warning);
        }
        if (hasValidSecondaryPipe && secondaryLoss.velocity > 0) {
            const warning = checkVelocity(secondaryLoss.velocity, 'ท่อรอง');
            if (!warning.includes('🟢')) velocityWarnings.push(warning);
        }
        if (hasValidMainPipe && mainLoss.velocity > 0) {
            const warning = checkVelocity(mainLoss.velocity, 'ท่อหลัก');
            if (!warning.includes('🟢')) velocityWarnings.push(warning);
        }
        if (hasValidEmitterPipe && emitterLoss.velocity > 0) {
            const warning = checkVelocity(emitterLoss.velocity, 'ท่อย่อยแยก');
            if (!warning.includes('🟢')) velocityWarnings.push(warning);
        }

        return {
            totalWaterRequiredLPM: flowData.totalFlowLPM,
            waterPerZoneLPM: formatNumber(flowData.totalFlowLPM / sanitizedInput.numberOfZones, 1),
            totalSprinklers: flowData.totalSprinklers,
            sprinklersPerZone: flowData.sprinklersPerZone,
            waterPerSprinklerLPM: flowData.flowPerSprinklerLPM,

            recommendedSprinklers: [],
            recommendedBranchPipe: analyzedBranchPipes.filter((p) => p.isRecommended),
            recommendedSecondaryPipe: analyzedSecondaryPipes.filter((p) => p.isRecommended),
            recommendedMainPipe: analyzedMainPipes.filter((p) => p.isRecommended),
            recommendedEmitterPipe: analyzedEmitterPipes.filter((p) => p.isRecommended),
            recommendedPump: analyzedPumps.filter((p) => p.isRecommended),

            analyzedBranchPipes,
            analyzedSecondaryPipes,
            analyzedMainPipes,
            analyzedEmitterPipes,
            analyzedSprinklers,
            analyzedPumps,

            autoSelectedBranchPipe,
            autoSelectedSecondaryPipe,
            autoSelectedMainPipe,
            autoSelectedEmitterPipe,
            autoSelectedPump,

            branchPipeRolls: branchRolls,
            secondaryPipeRolls: secondaryRolls,
            mainPipeRolls: mainRolls,
            emitterPipeRolls: emitterRolls,

            headLoss: {
                branch: {
                    major: formatNumber(branchLoss.major, 3),
                    minor: formatNumber(branchLoss.minor, 3),
                    total: formatNumber(branchLoss.total, 3),
                },
                secondary: {
                    major: formatNumber(secondaryLoss.major, 3),
                    minor: formatNumber(secondaryLoss.minor, 3),
                    total: formatNumber(secondaryLoss.total, 3),
                },
                main: {
                    major: formatNumber(mainLoss.major, 3),
                    minor: formatNumber(mainLoss.minor, 3),
                    total: formatNumber(mainLoss.total, 3),
                },
                emitter: {
                    major: formatNumber(emitterLoss.major, 3),
                    minor: formatNumber(emitterLoss.minor, 3),
                    total: formatNumber(emitterLoss.total, 3),
                },
                totalMajor: formatNumber(totalMajorLoss, 3),
                totalMinor: formatNumber(totalMinorLoss, 3),
                total: formatNumber(totalHeadLoss, 3),
            },

            velocity: {
                branch: formatNumber(branchLoss.velocity, 3),
                secondary: formatNumber(secondaryLoss.velocity, 3),
                main: formatNumber(mainLoss.velocity, 3),
                emitter: formatNumber(emitterLoss.velocity, 3),
            },

            flows: {
                branch: flowData.branchFlowLPM,
                secondary: flowData.secondaryFlowLPM,
                main: flowData.mainFlowLPM,
                emitter: flowData.emitterFlowLPM,
            },

            coefficients: {
                branch: formatNumber(branchLoss.C, 0),
                secondary: formatNumber(secondaryLoss.C, 0),
                main: formatNumber(mainLoss.C, 0),
                emitter: formatNumber(emitterLoss.C, 0),
            },

            pumpHeadRequired: formatNumber(pumpHeadRequired, 3),
            pressureFromSprinkler: formatNumber(pressureFromSprinkler, 3),
            safetyFactor: safetyFactor,
            adjustedFlow: requiredPumpFlow,
            velocityWarnings,
            hasValidSecondaryPipe,
            hasValidMainPipe,
            hasValidEmitterPipe: Boolean(hasValidEmitterPipe),

            headLossValidation,

            allZoneResults,
            projectSummary,

            // คำนวณค่า maxPumpHeadForProjectMode สำหรับแต่ละ projectMode
            // ใช้ค่าสูงสุดจากทุกโซน + 10% safety factor (เหมือนกับอัตราการไหล)
            maxPumpHeadForProjectMode: (() => {
                if (allZoneResults && allZoneResults.length > 0) {
                    // หาค่า Pump Head ที่สูงที่สุดจากทุกโซน
                    let maxHead = 0;

                    allZoneResults.forEach((zoneResult) => {
                        // ใช้ค่า totalHead จาก zoneResult (รวม pipe head loss + sprinkler head loss + static head)
                        const totalHead = zoneResult.totalHead || 0;
                        maxHead = Math.max(maxHead, totalHead);
                    });

                    // เพิ่ม 10% safety factor
                    if (maxHead > 0) {
                        return maxHead + maxHead * 0.1;
                    }

                    // Fallback: ใช้ pumpHeadRequired + 10%
                    return pumpHeadRequired + pumpHeadRequired * 0.1;
                }

                // สำหรับ projectMode อื่นๆ ใช้ค่า default + 10%
                return pumpHeadRequired + pumpHeadRequired * 0.1;
            })(),

            calculationMetadata: {
                totalWaterRequiredLPM: flowData.totalFlowLPM,
                waterPerZoneLPM: formatNumber(
                    flowData.totalFlowLPM / sanitizedInput.numberOfZones,
                    1
                ),
            },
        };
    }, [
        input,
        selectedSprinkler,
        sprinklerData,
        pumpData,
        pipeData,
        loading,
        error,
        allZoneData,
        zoneOperationGroups,
    ]);
};
