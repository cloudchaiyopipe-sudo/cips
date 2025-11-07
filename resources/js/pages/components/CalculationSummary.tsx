/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CalculationResults, IrrigationInput } from '../types/interfaces';
import { Zone } from '../../utils/horticultureUtils';
import { useLanguage } from '../../contexts/LanguageContext';
import { getEnhancedFieldCropData, FieldCropData } from '../../utils/fieldCropData';

interface ZoneOperationGroup {
    id: string;
    zones: string[];
    order: number;
    label: string;
}

interface CalculationSummaryProps {
    results: CalculationResults;
    input: IrrigationInput;
    selectedSprinkler: any;
    selectedPump?: any;
    selectedBranchPipe?: any;
    selectedSecondaryPipe?: any;
    selectedMainPipe?: any;
    activeZone?: Zone;
    selectedZones?: string[];
    allZoneSprinklers: { [zoneId: string]: any };
    projectMode?: 'horticulture' | 'garden' | 'field-crop' | 'greenhouse';
    showPump?: boolean;
    simultaneousZonesCount?: number;
    zoneOperationGroups?: ZoneOperationGroup[];
    getZoneName?: (zoneId: string) => string;
    fieldCropData?: any;
    greenhouseData?: any;
    gardenStats?: any;
    maxPumpHeadForProjectMode?: number;
    onPumpHeadCalculated?: (pumpHead: number) => void;
}

const CalculationSummary: React.FC<CalculationSummaryProps> = ({
    results,
    input,
    selectedSprinkler,
    activeZone,
    selectedZones = [],
    allZoneSprinklers,
    projectMode = 'horticulture',
    showPump = true,
    simultaneousZonesCount = 1,
    zoneOperationGroups = [],
    getZoneName = (id) => id,
    fieldCropData,
    greenhouseData,
    gardenStats,
    maxPumpHeadForProjectMode,
    onPumpHeadCalculated,
}) => {
    const { t } = useLanguage();
    const actualPump = results.autoSelectedPump;
    const actualBranchPipe = results.autoSelectedBranchPipe;
    const actualSecondaryPipe = results.autoSelectedSecondaryPipe;
    const actualMainPipe = results.autoSelectedMainPipe;
    const actualEmitterPipe = results.autoSelectedEmitterPipe;

    useEffect(() => {}, [
        projectMode,
        results.totalWaterRequiredLPM,
        results.totalSprinklers,
        input.waterPerTreeLiters,
        input.totalTrees,
        input,
    ]);

    const getActualPipeHeadLoss = useCallback(() => {
        try {
            if (projectMode === 'greenhouse') {
                const greenhousePipeCalculationsStr = localStorage.getItem(
                    'greenhouse_pipe_calculations'
                );
                if (greenhousePipeCalculationsStr) {
                    const pipeCalculations = JSON.parse(greenhousePipeCalculationsStr);

                    const branchHeadLoss = pipeCalculations.branch?.headLoss || 0;
                    const mainHeadLoss = pipeCalculations.main?.headLoss || 0;

                    const secondaryHeadLoss = 0;
                    const emitterHeadLoss = 0;

                    const totalHeadLoss = branchHeadLoss + mainHeadLoss;

                    return {
                        branch: branchHeadLoss,
                        secondary: secondaryHeadLoss,
                        main: mainHeadLoss,
                        emitter: emitterHeadLoss,
                        total: totalHeadLoss,
                    };
                }
            }

            if (projectMode === 'field-crop') {
                const fieldCropPipeCalculationsStr = localStorage.getItem(
                    'field_crop_pipe_calculations'
                );
                if (fieldCropPipeCalculationsStr) {
                    const pipeCalculations = JSON.parse(fieldCropPipeCalculationsStr);

                    const branchHeadLoss = pipeCalculations.branch?.headLoss || 0;
                    const secondaryHeadLoss = pipeCalculations.secondary?.headLoss || 0;
                    const mainHeadLoss = pipeCalculations.main?.headLoss || 0;
                    const emitterHeadLoss = pipeCalculations.emitter?.headLoss || 0;

                    const totalHeadLoss =
                        branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;

                    return {
                        branch: branchHeadLoss,
                        secondary: secondaryHeadLoss,
                        main: mainHeadLoss,
                        emitter: emitterHeadLoss,
                        total: totalHeadLoss,
                    };
                }
            }

            const gardenPipeCalculationsStr = localStorage.getItem('garden_pipe_calculations');
            if (gardenPipeCalculationsStr) {
                const pipeCalculations = JSON.parse(gardenPipeCalculationsStr);

                const branchHeadLoss = pipeCalculations.branch?.headLoss || 0;
                const secondaryHeadLoss = pipeCalculations.secondary?.headLoss || 0;
                const mainHeadLoss = pipeCalculations.main?.headLoss || 0;
                const emitterHeadLoss = pipeCalculations.emitter?.headLoss || 0;

                const totalHeadLoss =
                    branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;

                return {
                    branch: branchHeadLoss,
                    secondary: secondaryHeadLoss,
                    main: mainHeadLoss,
                    emitter: emitterHeadLoss,
                    total: totalHeadLoss,
                };
            }
        } catch (error) {
            console.error('Error loading pipe calculations from localStorage:', error);
        }

        try {
            const horticulturePipeCalculationsStr = localStorage.getItem(
                'horticulture_pipe_calculations'
            );
            if (horticulturePipeCalculationsStr) {
                const horticulturePipeCalculations = JSON.parse(horticulturePipeCalculationsStr);

                const branchHeadLoss = horticulturePipeCalculations.branch?.headLoss || 0;
                const secondaryHeadLoss = horticulturePipeCalculations.secondary?.headLoss || 0;
                const mainHeadLoss = horticulturePipeCalculations.main?.headLoss || 0;
                const emitterHeadLoss = horticulturePipeCalculations.emitter?.headLoss || 0;

                const totalHeadLoss =
                    branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;

                return {
                    branch: branchHeadLoss,
                    secondary: secondaryHeadLoss,
                    main: mainHeadLoss,
                    emitter: emitterHeadLoss,
                    total: totalHeadLoss,
                };
            }
        } catch (error) {
            console.error('Error loading horticulture pipe calculations from localStorage:', error);
        }

        const branchHeadLoss = actualBranchPipe?.headLoss || 0;
        const secondaryHeadLoss = actualSecondaryPipe?.headLoss || 0;
        const mainHeadLoss = actualMainPipe?.headLoss || 0;
        const emitterHeadLoss = actualEmitterPipe?.headLoss || 0;

        const totalHeadLoss = branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;

        return {
            branch: branchHeadLoss,
            secondary: secondaryHeadLoss,
            main: mainHeadLoss,
            emitter: emitterHeadLoss,
            total: totalHeadLoss,
        };
    }, [actualBranchPipe, actualSecondaryPipe, actualMainPipe, actualEmitterPipe, projectMode]);

    const [actualHeadLoss, setActualHeadLoss] = useState(() => getActualPipeHeadLoss());
    const actualHeadLossRef = useRef(actualHeadLoss);

    useEffect(() => {
        actualHeadLossRef.current = actualHeadLoss;
    }, [actualHeadLoss]);

    useEffect(() => {
        const handleStorageChange = () => {
            setActualHeadLoss(getActualPipeHeadLoss());
        };

        window.addEventListener('storage', handleStorageChange);

        const interval = setInterval(() => {
            const newHeadLoss = getActualPipeHeadLoss();
            const currentHeadLossString = JSON.stringify(actualHeadLossRef.current);
            const newHeadLossString = JSON.stringify(newHeadLoss);

            if (currentHeadLossString !== newHeadLossString) {
                setActualHeadLoss(newHeadLoss);
            }
        }, 2000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [getActualPipeHeadLoss, projectMode]);

    useEffect(() => {
        if (projectMode === 'greenhouse' || projectMode === 'field-crop') {
            const newHeadLoss = getActualPipeHeadLoss();
            setActualHeadLoss(newHeadLoss);
        }
    }, [projectMode, getActualPipeHeadLoss]);

    const getEquipmentName = () => {
        switch (projectMode) {
            case 'garden':
                return t('หัวฉีด');
            case 'field-crop':
                return t('สปริงเกอร์');
            case 'greenhouse':
                return t('สปริงเกอร์');
            default:
                return t('สปริงเกอร์');
        }
    };

    const getSprinklerPressureInfo = () => {
        if (!selectedSprinkler) {
            return {
                pressure: input.pressureHeadM,
                source: 'ค่าเริ่มต้น',
            };
        }

        let minPressure, maxPressure;
        const pressureData = selectedSprinkler.pressureBar;

        if (Array.isArray(pressureData)) {
            minPressure = pressureData[0];
            maxPressure = pressureData[1];
        } else if (typeof pressureData === 'string' && pressureData.includes('-')) {
            const parts = pressureData.split('-');
            minPressure = parseFloat(parts[0]);
            maxPressure = parseFloat(parts[1]);
        } else {
            minPressure = maxPressure = parseFloat(String(pressureData));
        }

        const avgPressureBar = (minPressure + maxPressure) / 2;
        const pressureM = avgPressureBar * 10.2;

        const sprinklerName = getEquipmentName();

        return {
            pressure: pressureM,
            source: `จาก${sprinklerName} (${(avgPressureBar || 0).toFixed(1)} bar)`,
            pressureBar: avgPressureBar,
        };
    };

    const pressureInfo = getSprinklerPressureInfo();

    const calculateSprinklerHeadLoss = () => {
        let sprinklerPressureBar = 2.5; // default fallback

        if (projectMode === 'horticulture') {
            // ลองหาจาก localStorage ก่อน (เหมือนกับ PipeSystemSummary.tsx)
            try {
                const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
                if (horticultureSystemDataStr) {
                    const horticultureSystemData = JSON.parse(horticultureSystemDataStr);
                    if (horticultureSystemData?.sprinklerConfig?.pressureBar) {
                        sprinklerPressureBar = horticultureSystemData.sprinklerConfig.pressureBar;
                    }
                }
            } catch (error) {
                console.error('Error parsing horticulture system data:', error);
            }

            if (
                sprinklerPressureBar === 2.5 &&
                selectedSprinkler &&
                selectedSprinkler.pressureBar
            ) {
                if (Array.isArray(selectedSprinkler.pressureBar)) {
                    sprinklerPressureBar =
                        (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) / 2;
                } else if (
                    typeof selectedSprinkler.pressureBar === 'string' &&
                    selectedSprinkler.pressureBar.includes('-')
                ) {
                    const parts = selectedSprinkler.pressureBar.split('-');
                    sprinklerPressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                } else {
                    sprinklerPressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                }
            }
        } else if (projectMode === 'garden') {
            if (gardenStats && activeZone) {
                const currentZone = gardenStats.zones.find((z: any) => z.zoneId === activeZone.id);
                if (currentZone) {
                    sprinklerPressureBar = currentZone.sprinklerPressure || 2.5;
                } else {
                    if (selectedSprinkler && selectedSprinkler.pressureBar) {
                        if (Array.isArray(selectedSprinkler.pressureBar)) {
                            sprinklerPressureBar =
                                (selectedSprinkler.pressureBar[0] +
                                    selectedSprinkler.pressureBar[1]) /
                                2;
                        } else if (
                            typeof selectedSprinkler.pressureBar === 'string' &&
                            selectedSprinkler.pressureBar.includes('-')
                        ) {
                            const parts = selectedSprinkler.pressureBar.split('-');
                            sprinklerPressureBar =
                                (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                        } else {
                            sprinklerPressureBar = parseFloat(
                                String(selectedSprinkler.pressureBar)
                            );
                        }
                    }
                }
            } else {
                if (selectedSprinkler && selectedSprinkler.pressureBar) {
                    if (Array.isArray(selectedSprinkler.pressureBar)) {
                        sprinklerPressureBar =
                            (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) /
                            2;
                    } else if (
                        typeof selectedSprinkler.pressureBar === 'string' &&
                        selectedSprinkler.pressureBar.includes('-')
                    ) {
                        const parts = selectedSprinkler.pressureBar.split('-');
                        sprinklerPressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                    } else {
                        sprinklerPressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                    }
                }
            }
        } else if (projectMode === 'greenhouse') {
            try {
                const greenhouseSummaryDataStr = localStorage.getItem('greenhouseSummaryData');
                if (greenhouseSummaryDataStr) {
                    const greenhouseSummaryData = JSON.parse(greenhouseSummaryDataStr);
                    if (greenhouseSummaryData?.sprinklerPressure) {
                        sprinklerPressureBar = greenhouseSummaryData.sprinklerPressure;
                    }
                }
            } catch (error) {
                console.error('Error parsing greenhouse summary data:', error);
            }

            if (
                sprinklerPressureBar === 2.5 &&
                selectedSprinkler &&
                selectedSprinkler.pressureBar
            ) {
                if (Array.isArray(selectedSprinkler.pressureBar)) {
                    sprinklerPressureBar =
                        (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) / 2;
                } else if (
                    typeof selectedSprinkler.pressureBar === 'string' &&
                    selectedSprinkler.pressureBar.includes('-')
                ) {
                    const parts = selectedSprinkler.pressureBar.split('-');
                    sprinklerPressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                } else {
                    sprinklerPressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                }
            }
        } else {
            if (selectedSprinkler && selectedSprinkler.pressureBar) {
                if (Array.isArray(selectedSprinkler.pressureBar)) {
                    sprinklerPressureBar =
                        (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) / 2;
                } else if (
                    typeof selectedSprinkler.pressureBar === 'string' &&
                    selectedSprinkler.pressureBar.includes('-')
                ) {
                    const parts = selectedSprinkler.pressureBar.split('-');
                    sprinklerPressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                } else {
                    sprinklerPressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                }
            }
        }

        return sprinklerPressureBar * 10;
    };

    const sprinklerHeadLoss = calculateSprinklerHeadLoss();

    const calculatePumpHead = () => {
        if (projectMode === 'greenhouse') {
            const greenhouseTotalHeadLoss =
                (actualHeadLoss.main || 0) + (actualHeadLoss.branch || 0);
            return greenhouseTotalHeadLoss + sprinklerHeadLoss;
        } else if (projectMode === 'field-crop') {
            // สำหรับ field-crop mode ให้ใช้ค่าเดียวกันกับ PipeSystemSummary.tsx
            let fieldCropSprinklerHeadLoss = 0;

            if (fieldCropData && fieldCropData.irrigationSettings?.sprinkler_system?.pressure) {
                fieldCropSprinklerHeadLoss =
                    fieldCropData.irrigationSettings.sprinkler_system.pressure * 10;
            } else if (selectedSprinkler && selectedSprinkler.pressureBar) {
                let pressureBar = 2.5; // default fallback
                if (Array.isArray(selectedSprinkler.pressureBar)) {
                    pressureBar =
                        (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) / 2;
                } else if (
                    typeof selectedSprinkler.pressureBar === 'string' &&
                    selectedSprinkler.pressureBar.includes('-')
                ) {
                    const parts = selectedSprinkler.pressureBar.split('-');
                    pressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                } else {
                    pressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                }
                fieldCropSprinklerHeadLoss = pressureBar * 10;
            } else {
                fieldCropSprinklerHeadLoss = 2.5 * 10;
            }

            let fieldCropPipeHeadLoss = 0;
            try {
                const fieldCropPipeCalculationsStr = localStorage.getItem(
                    'field_crop_pipe_calculations'
                );
                if (fieldCropPipeCalculationsStr) {
                    const fieldCropPipeCalculations = JSON.parse(fieldCropPipeCalculationsStr);
                    const branchHeadLoss = fieldCropPipeCalculations.branch?.headLoss || 0;
                    const secondaryHeadLoss = fieldCropPipeCalculations.secondary?.headLoss || 0;
                    const mainHeadLoss = fieldCropPipeCalculations.main?.headLoss || 0;
                    const emitterHeadLoss = fieldCropPipeCalculations.emitter?.headLoss || 0;
                    fieldCropPipeHeadLoss =
                        branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;
                }
            } catch (error) {
                console.error('Error parsing field-crop pipe calculations:', error);
            }

            if (fieldCropPipeHeadLoss === 0) {
                fieldCropPipeHeadLoss = actualHeadLoss.total;
            }

            const totalPumpHead = fieldCropPipeHeadLoss + fieldCropSprinklerHeadLoss;
            return totalPumpHead;
        } else if (projectMode === 'horticulture') {
            let horticultureSprinklerHeadLoss = 2.5 * 10; // default fallback

            try {
                const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
                if (horticultureSystemDataStr) {
                    const horticultureSystemData = JSON.parse(horticultureSystemDataStr);
                    if (horticultureSystemData?.sprinklerConfig?.pressureBar) {
                        horticultureSprinklerHeadLoss =
                            horticultureSystemData.sprinklerConfig.pressureBar * 10;
                    }
                }
            } catch (error) {
                console.error('Error parsing horticulture system data:', error);
            }

            if (
                horticultureSprinklerHeadLoss === 2.5 * 10 &&
                selectedSprinkler &&
                selectedSprinkler.pressureBar
            ) {
                let pressureBar = 2.5; // default fallback
                if (Array.isArray(selectedSprinkler.pressureBar)) {
                    pressureBar =
                        (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) / 2;
                } else if (
                    typeof selectedSprinkler.pressureBar === 'string' &&
                    selectedSprinkler.pressureBar.includes('-')
                ) {
                    const parts = selectedSprinkler.pressureBar.split('-');
                    pressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                } else {
                    pressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                }
                horticultureSprinklerHeadLoss = pressureBar * 10;
            }

            let horticulturePipeHeadLoss = 0;
            try {
                const horticulturePipeCalculationsStr = localStorage.getItem(
                    'horticulture_pipe_calculations'
                );
                if (horticulturePipeCalculationsStr) {
                    const horticulturePipeCalculations = JSON.parse(
                        horticulturePipeCalculationsStr
                    );
                    const branchHeadLoss = horticulturePipeCalculations.branch?.headLoss || 0;
                    const secondaryHeadLoss = horticulturePipeCalculations.secondary?.headLoss || 0;
                    const mainHeadLoss = horticulturePipeCalculations.main?.headLoss || 0;
                    const emitterHeadLoss = horticulturePipeCalculations.emitter?.headLoss || 0;
                    horticulturePipeHeadLoss =
                        branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;
                }
            } catch (error) {
                console.error('Error parsing horticulture pipe calculations:', error);
            }

            if (horticulturePipeHeadLoss === 0) {
                horticulturePipeHeadLoss = actualHeadLoss.total;
            }

            // เพิ่ม static head (ความสูงจากปั๊มไปจุดสูงสุด) จาก localStorage
            let staticHeadM = input.staticHeadM || 0;
            try {
                const stored = localStorage.getItem('horticulture_elevation_diff_m');
                if (stored !== null) {
                    const value = parseFloat(stored);
                    if (isFinite(value)) {
                        staticHeadM = value;
                    }
                }
            } catch (error) {
                console.warn('Error reading elevation difference from localStorage:', error);
            }

            const totalPumpHead =
                horticulturePipeHeadLoss + horticultureSprinklerHeadLoss + staticHeadM;

            return totalPumpHead;
        }
        return actualHeadLoss.total + sprinklerHeadLoss;
    };

    const actualPumpHead = calculatePumpHead();

    useEffect(() => {
        if (onPumpHeadCalculated && actualPumpHead > 0) {
            const pumpHeadWithSafety = actualPumpHead + actualPumpHead * 0.1;
            onPumpHeadCalculated(pumpHeadWithSafety);
        }
    }, [actualPumpHead, onPumpHeadCalculated, projectMode, activeZone, selectedZones]);

    const getMaxPumpHeadForProjectMode = () => {
        if (maxPumpHeadForProjectMode !== undefined && maxPumpHeadForProjectMode > 0) {
            return maxPumpHeadForProjectMode;
        }

        if (projectMode === 'greenhouse') {
            const greenhouseTotalHeadLoss =
                (actualHeadLoss.main || 0) + (actualHeadLoss.branch || 0);
            return greenhouseTotalHeadLoss + sprinklerHeadLoss;
        } else if (projectMode === 'field-crop') {
            let fieldCropSprinklerHeadLoss = 0;

            if (fieldCropData && fieldCropData.irrigationSettings?.sprinkler_system?.pressure) {
                fieldCropSprinklerHeadLoss =
                    fieldCropData.irrigationSettings.sprinkler_system.pressure * 10;
            } else if (selectedSprinkler && selectedSprinkler.pressureBar) {
                let pressureBar = 2.5; // default fallback
                if (Array.isArray(selectedSprinkler.pressureBar)) {
                    pressureBar =
                        (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) / 2;
                } else if (
                    typeof selectedSprinkler.pressureBar === 'string' &&
                    selectedSprinkler.pressureBar.includes('-')
                ) {
                    const parts = selectedSprinkler.pressureBar.split('-');
                    pressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                } else {
                    pressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                }
                fieldCropSprinklerHeadLoss = pressureBar * 10;
            } else {
                fieldCropSprinklerHeadLoss = 2.5 * 10;
            }

            let fieldCropPipeHeadLoss = 0;
            try {
                const fieldCropPipeCalculationsStr = localStorage.getItem(
                    'field_crop_pipe_calculations'
                );
                if (fieldCropPipeCalculationsStr) {
                    const fieldCropPipeCalculations = JSON.parse(fieldCropPipeCalculationsStr);
                    const branchHeadLoss = fieldCropPipeCalculations.branch?.headLoss || 0;
                    const secondaryHeadLoss = fieldCropPipeCalculations.secondary?.headLoss || 0;
                    const mainHeadLoss = fieldCropPipeCalculations.main?.headLoss || 0;
                    const emitterHeadLoss = fieldCropPipeCalculations.emitter?.headLoss || 0;
                    fieldCropPipeHeadLoss =
                        branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;
                }
            } catch (error) {
                console.error('Error parsing field-crop pipe calculations:', error);
            }

            if (fieldCropPipeHeadLoss === 0) {
                fieldCropPipeHeadLoss = actualHeadLoss.total;
            }

            return fieldCropPipeHeadLoss + fieldCropSprinklerHeadLoss;
        } else if (projectMode === 'horticulture') {
            let horticultureSprinklerHeadLoss = 2.5 * 10; // default fallback

            try {
                const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
                if (horticultureSystemDataStr) {
                    const horticultureSystemData = JSON.parse(horticultureSystemDataStr);
                    if (horticultureSystemData?.sprinklerConfig?.pressureBar) {
                        horticultureSprinklerHeadLoss =
                            horticultureSystemData.sprinklerConfig.pressureBar * 10;
                    }
                }
            } catch (error) {
                console.error('Error parsing horticulture system data:', error);
            }

            if (
                horticultureSprinklerHeadLoss === 2.5 * 10 &&
                selectedSprinkler &&
                selectedSprinkler.pressureBar
            ) {
                let pressureBar = 2.5; // default fallback
                if (Array.isArray(selectedSprinkler.pressureBar)) {
                    pressureBar =
                        (selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) / 2;
                } else if (
                    typeof selectedSprinkler.pressureBar === 'string' &&
                    selectedSprinkler.pressureBar.includes('-')
                ) {
                    const parts = selectedSprinkler.pressureBar.split('-');
                    pressureBar = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                } else {
                    pressureBar = parseFloat(String(selectedSprinkler.pressureBar));
                }
                horticultureSprinklerHeadLoss = pressureBar * 10;
            }

            let horticulturePipeHeadLoss = 0;
            try {
                const horticulturePipeCalculationsStr = localStorage.getItem(
                    'horticulture_pipe_calculations'
                );
                if (horticulturePipeCalculationsStr) {
                    const horticulturePipeCalculations = JSON.parse(
                        horticulturePipeCalculationsStr
                    );
                    const branchHeadLoss = horticulturePipeCalculations.branch?.headLoss || 0;
                    const secondaryHeadLoss = horticulturePipeCalculations.secondary?.headLoss || 0;
                    const mainHeadLoss = horticulturePipeCalculations.main?.headLoss || 0;
                    const emitterHeadLoss = horticulturePipeCalculations.emitter?.headLoss || 0;
                    horticulturePipeHeadLoss =
                        branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;
                }
            } catch (error) {
                console.error('Error parsing horticulture pipe calculations:', error);
            }

            if (horticulturePipeHeadLoss === 0) {
                horticulturePipeHeadLoss = actualHeadLoss.total;
            }

            // เพิ่ม static head (ความสูงจากปั๊มไปจุดสูงสุด) จาก localStorage
            let staticHeadM = input.staticHeadM || 0;
            try {
                const stored = localStorage.getItem('horticulture_elevation_diff_m');
                if (stored !== null) {
                    const value = parseFloat(stored);
                    if (isFinite(value)) {
                        staticHeadM = value;
                    }
                }
            } catch (error) {
                console.warn('Error reading elevation difference from localStorage:', error);
            }

            return horticulturePipeHeadLoss + horticultureSprinklerHeadLoss + staticHeadM;
        } else if (projectMode === 'garden') {
            let gardenSprinklerHeadLoss = 2.5 * 10; // default fallback

            if (gardenStats && activeZone) {
                const currentZone = gardenStats.zones.find((z: any) => z.zoneId === activeZone.id);
                if (currentZone) {
                    gardenSprinklerHeadLoss = (currentZone.sprinklerPressure || 2.5) * 10;
                } else {
                    if (selectedSprinkler && selectedSprinkler.pressureBar) {
                        if (Array.isArray(selectedSprinkler.pressureBar)) {
                            gardenSprinklerHeadLoss =
                                ((selectedSprinkler.pressureBar[0] +
                                    selectedSprinkler.pressureBar[1]) /
                                    2) *
                                10;
                        } else if (
                            typeof selectedSprinkler.pressureBar === 'string' &&
                            selectedSprinkler.pressureBar.includes('-')
                        ) {
                            const parts = selectedSprinkler.pressureBar.split('-');
                            gardenSprinklerHeadLoss =
                                ((parseFloat(parts[0]) + parseFloat(parts[1])) / 2) * 10;
                        } else {
                            gardenSprinklerHeadLoss =
                                parseFloat(String(selectedSprinkler.pressureBar)) * 10;
                        }
                    }
                }
            } else {
                if (selectedSprinkler && selectedSprinkler.pressureBar) {
                    if (Array.isArray(selectedSprinkler.pressureBar)) {
                        gardenSprinklerHeadLoss =
                            ((selectedSprinkler.pressureBar[0] + selectedSprinkler.pressureBar[1]) /
                                2) *
                            10;
                    } else if (
                        typeof selectedSprinkler.pressureBar === 'string' &&
                        selectedSprinkler.pressureBar.includes('-')
                    ) {
                        const parts = selectedSprinkler.pressureBar.split('-');
                        gardenSprinklerHeadLoss =
                            ((parseFloat(parts[0]) + parseFloat(parts[1])) / 2) * 10;
                    } else {
                        gardenSprinklerHeadLoss =
                            parseFloat(String(selectedSprinkler.pressureBar)) * 10;
                    }
                }
            }

            let gardenPipeHeadLoss = 0;
            try {
                const gardenPipeCalculationsStr = localStorage.getItem('garden_pipe_calculations');
                if (gardenPipeCalculationsStr) {
                    const gardenPipeCalculations = JSON.parse(gardenPipeCalculationsStr);
                    const branchHeadLoss = gardenPipeCalculations.branch?.headLoss || 0;
                    const secondaryHeadLoss = gardenPipeCalculations.secondary?.headLoss || 0;
                    const mainHeadLoss = gardenPipeCalculations.main?.headLoss || 0;
                    const emitterHeadLoss = gardenPipeCalculations.emitter?.headLoss || 0;
                    gardenPipeHeadLoss =
                        branchHeadLoss + secondaryHeadLoss + mainHeadLoss + emitterHeadLoss;
                }
            } catch (error) {
                console.error('Error parsing garden pipe calculations:', error);
            }

            if (gardenPipeHeadLoss === 0) {
                gardenPipeHeadLoss = actualHeadLoss.total;
            }

            return gardenPipeHeadLoss + gardenSprinklerHeadLoss;
        }

        return actualHeadLoss.total + sprinklerHeadLoss;
    };

    const isMultiZone =
        selectedZones.length > 1 || (results.allZoneResults && results.allZoneResults.length > 1);

    const getItemName = () => {
        switch (projectMode) {
            case 'garden':
                return t('หัวฉีด');
            case 'field-crop':
                return t('จุดปลูก');
            case 'greenhouse':
            default:
                return t('ต้นไม้');
        }
    };

    const getAreaUnit = () => {
        return t('ไร่');
    };

    const formatArea = (area: number) => {
        const safeArea = area || 0;
        return `${safeArea.toFixed(1)} ไร่`;
    };

    const getProjectIcon = () => {
        switch (projectMode) {
            case 'garden':
                return '🏡';
            case 'field-crop':
                return '🌾';
            case 'greenhouse':
                return '🏠';
            default:
                return '🌿';
        }
    };

    const getWaterSourceLabel = () => {
        switch (projectMode) {
            case 'garden':
                return t('แหล่งน้ำ');
            case 'field-crop':
                return t('ปั๊ม');
            case 'greenhouse':
                return t('แหล่งน้ำ');
            default:
                return t('ปั๊ม');
        }
    };

    const getCurrentZoneData = () => {
        if (projectMode === 'field-crop' && fieldCropData && activeZone) {
            const zone = fieldCropData.zones.info.find((z: any) => z.id === activeZone.id);
            if (zone) {
                return {
                    name: zone.name,
                    area: zone.area,
                    itemCount: zone.totalPlantingPoints,
                    waterNeed: zone.totalWaterRequirementPerDay || 0,
                    cropType: zone.cropType,
                    estimatedYield: 0,
                    estimatedIncome: 0,
                };
            }
        }

        if (projectMode === 'greenhouse' && greenhouseData && activeZone) {
            const plot = greenhouseData.summary.plotStats.find(
                (p: any) => p.plotId === activeZone.id
            );
            if (plot) {
                return {
                    name: plot.plotName,
                    area: plot.area,
                    itemCount: plot.equipmentCount.sprinklers || plot.production.totalPlants,
                    waterNeed: plot.production.waterRequirementPerIrrigation || 0,
                    cropType: plot.cropType,
                    estimatedYield: plot.production.estimatedYield || 0,
                    estimatedIncome: plot.production.estimatedIncome || 0,
                };
            }
        }

        return activeZone
            ? {
                  name: activeZone.name,
                  area: activeZone.area,
                  itemCount: activeZone.plantCount,
                  waterNeed: activeZone.totalWaterNeed || 0,
                  cropType: activeZone.plantData?.name,
                  estimatedYield: 0,
                  estimatedIncome: 0,
              }
            : null;
    };

    const currentZoneData = getCurrentZoneData();

    const getSystemPerformance = () => {
        const performance = {
            velocityStatus: 'good' as 'good' | 'warning' | 'critical',
            headLossStatus: 'good' as 'good' | 'warning' | 'critical',
            pumpStatus: 'good' as 'good' | 'warning' | 'critical',
            overallStatus: 'good' as 'good' | 'warning' | 'critical',
        };

        const velocities = [
            results.velocity.branch,
            results.velocity.secondary,
            results.velocity.main,
            results.velocity.emitter,
        ].filter((v) => v && v > 0);

        const hasHighVelocity = velocities.some((v) => v && v > 2.5);
        const hasLowVelocity = velocities.some((v) => v && v < 0.6);
        const hasOptimalVelocity = velocities.some((v) => v && v >= 0.8 && v <= 2.0);

        if (hasHighVelocity) performance.velocityStatus = 'critical';
        else if (hasLowVelocity && !hasOptimalVelocity) performance.velocityStatus = 'warning';

        const headLossRatio = results.headLossValidation?.ratio || 0;
        const actualHeadLossRatio =
            actualHeadLoss.total > 0
                ? (actualHeadLoss.total / (input.staticHeadM + pressureInfo.pressure)) * 100
                : 0;
        if (actualHeadLossRatio > 25) performance.headLossStatus = 'critical';
        else if (actualHeadLossRatio > 20) performance.headLossStatus = 'warning';

        if (showPump && actualPump) {
            if (!actualPump.isFlowAdequate || !actualPump.isHeadAdequate) {
                performance.pumpStatus = 'critical';
            } else if (actualPump.flowRatio > 2.5 || actualPump.headRatio > 2.5) {
                performance.pumpStatus = 'warning';
            }
        }

        const statuses = [performance.velocityStatus, performance.headLossStatus];
        if (showPump) statuses.push(performance.pumpStatus);

        if (statuses.includes('critical')) performance.overallStatus = 'critical';
        else if (statuses.includes('warning')) performance.overallStatus = 'warning';

        return performance;
    };

    const systemPerformance = getSystemPerformance();

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'good':
                return 'text-green-400';
            case 'warning':
                return 'text-yellow-400';
            case 'critical':
                return 'text-red-400';
            default:
                return 'text-gray-400';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'good':
                return '✅';
            case 'warning':
                return '⚠️';
            case 'critical':
                return '❌';
            default:
                return '❓';
        }
    };

    const getOperationModeLabel = (mode: string) => {
        switch (mode) {
            case 'sequential':
                return t('เปิดทีละโซน');
            case 'simultaneous':
                return t('เปิดพร้อมกันทุกโซน');
            case 'custom':
                return t('เปิดแบบกำหนดเอง');
            default:
                return t('โซนเดียว');
        }
    };

    const getProjectSummaryData = () => {
        if (projectMode === 'field-crop') {
            const fcData = fieldCropData || getEnhancedFieldCropData();
            if (fcData) {
                return {
                    totalArea: fcData.area?.sizeInRai || 0,
                    totalZones: fcData.zones?.count || 0,
                    totalItems: fcData.summary?.totalPlantingPoints || 0,
                    totalWaterNeed: fcData.summary?.totalWaterRequirementPerDay || 0,
                    totalEstimatedYield: fcData.summary?.totalEstimatedYield || 0,
                    totalEstimatedIncome: fcData.summary?.totalEstimatedIncome || 0,
                    irrigationEfficiency: fcData.summary?.irrigationEfficiency || 0,
                    totalIrrigationPoints: fcData.irrigation?.totalCount || 0,
                    irrigationByType: fcData.irrigation?.byType || {},
                };
            }
        }

        if (projectMode === 'greenhouse' && greenhouseData) {
            const totalPlotArea = greenhouseData.summary?.totalPlotArea || 0;
            const totalAreaInRai = totalPlotArea / 1600;

            const plotStats = greenhouseData.summary?.plotStats || [];
            const totalPlants = plotStats.reduce(
                (sum: number, plot: any) => sum + (plot.production?.totalPlants || 0),
                0
            );

            let totalDailyWaterNeed = 0;
            if (greenhouseData.summary?.waterManagement?.dailyRequirement?.optimal) {
                totalDailyWaterNeed =
                    greenhouseData.summary.waterManagement.dailyRequirement.optimal;
            } else {
                totalDailyWaterNeed = plotStats.reduce((sum: number, plot: any) => {
                    const waterCalc = plot.production?.waterCalculation;
                    return sum + (waterCalc?.dailyWaterNeed?.optimal || 0);
                }, 0);
            }

            const totalEstimatedYield = plotStats.reduce(
                (sum: number, plot: any) => sum + (plot.production?.estimatedYield || 0),
                0
            );
            const totalEstimatedIncome = plotStats.reduce(
                (sum: number, plot: any) => sum + (plot.production?.estimatedIncome || 0),
                0
            );

            return {
                totalArea: totalAreaInRai,
                totalZones: plotStats.length,
                totalItems: totalPlants,
                totalWaterNeed: totalDailyWaterNeed,
                totalEstimatedYield: totalEstimatedYield,
                totalEstimatedIncome: totalEstimatedIncome,
                totalGreenhouseArea: greenhouseData.summary?.totalGreenhouseArea || 0,
                totalEffectivePlantingArea: greenhouseData.summary?.totalEffectivePlantingArea || 0,
                irrigationMethod: greenhouseData.projectInfo?.irrigationMethod || 'mini-sprinkler',
            };
        }

        return null;
    };

    const projectSummaryData = getProjectSummaryData();

    return (
        <div className="space-y-6">
            <div className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 p-4">
                <h2 className="mb-2 text-lg font-bold text-white">
                    🎯 {t('ข้อมูลสำคัญ')}
                    {isMultiZone && currentZoneData && (
                        <span className="ml-2 text-sm font-normal">
                            ({t('โซนปัจจุบัน:')} {currentZoneData.name.split(' (')[0]})
                        </span>
                    )}
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
                    <div className="text-center">
                        <p className="text-blue-200">{t('ความต้องการน้ำ')}</p>
                        <p className="text-xl font-bold">
                            {(() => {
                                if (projectMode === 'garden') {
                                    return input.waterPerTreeLiters.toFixed(1);
                                } else if (projectMode === 'greenhouse') {
                                    return input.waterPerTreeLiters.toLocaleString(undefined, {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 2,
                                    });
                                } else if (projectMode === 'field-crop') {
                                    return input.waterPerTreeLiters.toFixed(1);
                                } else {
                                    return input.waterPerTreeLiters.toFixed(1);
                                }
                            })()}{' '}
                            {t('LPM')}
                        </p>
                        {currentZoneData && (
                            <p className="text-xs text-blue-100">
                                ({currentZoneData.name.split(' (')[0]})
                            </p>
                        )}
                    </div>
                    <div className="text-center">
                        <p className="text-green-200">{t('Head Loss ท่อ')}</p>
                        <p
                            className={`text-xl font-bold ${getStatusColor(systemPerformance.headLossStatus)}`}
                        >
                            {(() => {
                                if (projectMode === 'greenhouse') {
                                    const greenhouseTotalHeadLoss =
                                        (actualHeadLoss.main || 0) + (actualHeadLoss.branch || 0);
                                    return greenhouseTotalHeadLoss.toFixed(1);
                                } else if (projectMode === 'field-crop') {
                                    const totalHeadLoss =
                                        (actualHeadLoss.main || 0) +
                                        (actualHeadLoss.secondary || 0) +
                                        (actualHeadLoss.branch || 0) +
                                        (actualHeadLoss.emitter || 0);
                                    return totalHeadLoss.toFixed(1);
                                } else if (projectMode === 'horticulture') {
                                    try {
                                        const horticulturePipeCalculationsStr =
                                            localStorage.getItem('horticulture_pipe_calculations');
                                        if (horticulturePipeCalculationsStr) {
                                            const horticulturePipeCalculations = JSON.parse(
                                                horticulturePipeCalculationsStr
                                            );
                                            const branchHeadLoss =
                                                horticulturePipeCalculations.branch?.headLoss || 0;
                                            const secondaryHeadLoss =
                                                horticulturePipeCalculations.secondary?.headLoss ||
                                                0;
                                            const mainHeadLoss =
                                                horticulturePipeCalculations.main?.headLoss || 0;
                                            const emitterHeadLoss =
                                                horticulturePipeCalculations.emitter?.headLoss || 0;
                                            const totalHeadLoss =
                                                branchHeadLoss +
                                                secondaryHeadLoss +
                                                mainHeadLoss +
                                                emitterHeadLoss;
                                            return totalHeadLoss.toFixed(1);
                                        }
                                    } catch (error) {
                                        console.error(
                                            'Error parsing horticulture pipe calculations:',
                                            error
                                        );
                                    }
                                    return actualHeadLoss.total.toFixed(1);
                                }
                                return actualHeadLoss.total.toFixed(1);
                            })()}{' '}
                            m
                        </p>
                        <p className="text-xs text-green-100">
                            {projectMode === 'greenhouse'
                                ? t('ท่อเมนหลัก + ท่อย่อย')
                                : systemPerformance.headLossStatus === 'good'
                                  ? t('เหมาะสม')
                                  : systemPerformance.headLossStatus === 'warning'
                                    ? t('ค่อนข้างสูง')
                                    : t('สูงเกินไป')}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-yellow-200">{t('Head Loss หัวฉีด')}</p>
                        <p className="text-xl font-bold text-yellow-400">
                            {(() => {
                                if (projectMode === 'field-crop' && fieldCropData) {
                                    let pressureBar = 2.5; // default fallback - ใช้ค่าเริ่มต้นที่เหมาะสม

                                    if (
                                        (fieldCropData as any)?.irrigationSettings?.sprinkler_system
                                            ?.pressure
                                    ) {
                                        pressureBar = (fieldCropData as any).irrigationSettings
                                            .sprinkler_system.pressure;
                                    } else if (selectedSprinkler && selectedSprinkler.pressureBar) {
                                        if (Array.isArray(selectedSprinkler.pressureBar)) {
                                            pressureBar =
                                                (selectedSprinkler.pressureBar[0] +
                                                    selectedSprinkler.pressureBar[1]) /
                                                2;
                                        } else if (
                                            typeof selectedSprinkler.pressureBar === 'string' &&
                                            selectedSprinkler.pressureBar.includes('-')
                                        ) {
                                            const parts = selectedSprinkler.pressureBar.split('-');
                                            pressureBar =
                                                (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                                        } else {
                                            pressureBar = parseFloat(
                                                String(selectedSprinkler.pressureBar)
                                            );
                                        }
                                    }

                                    return (pressureBar * 10).toFixed(1);
                                } else if (projectMode === 'horticulture') {
                                    let pressureBar = 2.5; // default fallback

                                    try {
                                        const horticultureSystemDataStr =
                                            localStorage.getItem('horticultureSystemData');
                                        if (horticultureSystemDataStr) {
                                            const horticultureSystemData =
                                                JSON.parse(horticultureSystemDataStr);
                                            if (
                                                horticultureSystemData?.sprinklerConfig?.pressureBar
                                            ) {
                                                pressureBar =
                                                    horticultureSystemData.sprinklerConfig
                                                        .pressureBar;
                                            }
                                        }
                                    } catch (error) {
                                        console.error(
                                            'Error parsing horticulture system data:',
                                            error
                                        );
                                    }

                                    if (
                                        pressureBar === 2.5 &&
                                        selectedSprinkler &&
                                        selectedSprinkler.pressureBar
                                    ) {
                                        if (Array.isArray(selectedSprinkler.pressureBar)) {
                                            pressureBar =
                                                (selectedSprinkler.pressureBar[0] +
                                                    selectedSprinkler.pressureBar[1]) /
                                                2;
                                        } else if (
                                            typeof selectedSprinkler.pressureBar === 'string' &&
                                            selectedSprinkler.pressureBar.includes('-')
                                        ) {
                                            const parts = selectedSprinkler.pressureBar.split('-');
                                            pressureBar =
                                                (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                                        } else {
                                            pressureBar = parseFloat(
                                                String(selectedSprinkler.pressureBar)
                                            );
                                        }
                                    }

                                    return (pressureBar * 10).toFixed(1);
                                }
                                return sprinklerHeadLoss.toFixed(1);
                            })()}{' '}
                            m
                        </p>
                        <p className="text-xs text-yellow-100">{t('จากสูตร: แรงดัน(บาร์) × 10')}</p>
                    </div>
                    {showPump && (
                        <div className="text-center">
                            <p className="text-purple-50">{t('Pump Head')}</p>
                            <p className="text-xl font-bold text-orange-300">
                                {(() => {
                                    return (actualPumpHead + actualPumpHead * 0.1).toFixed(1);
                                })()}{' '}
                                m
                            </p>
                            <p className="text-xs text-purple-100">
                                (+ 10% + ความสูงจากปั๊มไปจุดสูงสุด)
                            </p>
                        </div>
                    )}
                    <div className="text-center">
                        <p className="text-pink-200">
                            {t('จำนวน')}
                            {getEquipmentName()}
                        </p>
                        <p className="text-xl font-bold text-green-300">
                            {results.totalSprinklers} {t('หัว')}
                        </p>
                        {currentZoneData && (
                            <p className="text-xs text-pink-100">
                                ({t('ในโซน')} {currentZoneData.name.split(' (')[0]})
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalculationSummary;
