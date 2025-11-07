/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    calculateNewHeadLoss,
    SprinklerPressureInfo,
    PipeCalculationResult,
} from '../../utils/horticulturePipeCalculations';

interface PipeSystemSummaryProps {
    horticultureSystemData?: any;
    gardenSystemData?: any;
    greenhouseSystemData?: any;
    fieldCropData?: any;
    greenhouseData?: any;
    activeZoneId?: string;
    selectedPipes?: {
        branch?: any;
        secondary?: any;
        main?: any;
        emitter?: any;
    };
    sprinklerPressure?: SprinklerPressureInfo;
    projectMode?: 'horticulture' | 'garden' | 'field-crop' | 'greenhouse';
}

const PipeSystemSummary: React.FC<PipeSystemSummaryProps> = ({
    horticultureSystemData,
    gardenSystemData,
    greenhouseSystemData,
    fieldCropData,
    greenhouseData,
    activeZoneId,
    selectedPipes,
    sprinklerPressure,
    projectMode = 'horticulture',
}) => {
    const { t } = useLanguage();

    if (
        projectMode !== 'horticulture' &&
        projectMode !== 'garden' &&
        projectMode !== 'field-crop' &&
        projectMode !== 'greenhouse'
    ) {
        return null;
    }

    const systemData =
        projectMode === 'garden'
            ? gardenSystemData
            : projectMode === 'greenhouse'
                ? greenhouseData
                : projectMode === 'field-crop'
                    ? fieldCropData
                    : horticultureSystemData;
    if (!sprinklerPressure || !systemData || !activeZoneId) {
        return null;
    }

    const getStoredCalculations = useCallback(() => {
        try {
            const storageKey =
                projectMode === 'garden'
                    ? 'garden_pipe_calculations'
                    : projectMode === 'greenhouse'
                        ? 'greenhouse_pipe_calculations'
                        : projectMode === 'field-crop'
                            ? 'field_crop_pipe_calculations'
                            : 'horticulture_pipe_calculations';

            const storedCalcStr = localStorage.getItem(storageKey);
            return storedCalcStr ? JSON.parse(storedCalcStr) : {};
        } catch (error) {
            return {};
        }
    }, [projectMode]);

    const calculateData = useCallback(() => {
        const storedCalculations = getStoredCalculations();

        const filteredCalculations =
            projectMode === 'greenhouse'
                ? {
                    branch: storedCalculations.branch || {},
                    main: storedCalculations.main || {},
                    secondary: {},
                    emitter: {},
                }
                : storedCalculations;

        if (
            projectMode === 'greenhouse' &&
            (storedCalculations.secondary || storedCalculations.emitter)
        ) {
            const cleanedData = {
                branch: storedCalculations.branch || {},
                main: storedCalculations.main || {},
            };
            localStorage.setItem('greenhouse_pipe_calculations', JSON.stringify(cleanedData));
        }

        if (!selectedPipes) {
            return null;
        }

        if (projectMode === 'greenhouse' && Object.keys(filteredCalculations).length === 0) {
            const defaultCalculations = {
                branch: { headLoss: 0, pipeLength: 0, flowRate: 0 },
                main: { headLoss: 0, pipeLength: 0, flowRate: 0 },
            };
            localStorage.setItem('greenhouse_pipe_calculations', JSON.stringify(defaultCalculations));
            return {
                branchCalc: defaultCalculations.branch,
                subMainCalc: null,
                mainCalc: defaultCalculations.main,
                emitterCalc: null,
                branchSubMainCombined: 0,
                totalHeadLoss: 0,
                head20Percent: sprinklerPressure.head20PercentM,
            };
        }

        if (Object.keys(filteredCalculations).length === 0) {
            return null;
        }

        const branchCalc = filteredCalculations.branch
            ? {
                headLoss: filteredCalculations.branch.headLoss || 0,
                pipeLength: filteredCalculations.branch.pipeLength || 0,
                flowRate: filteredCalculations.branch.flowRate || 0,
            }
            : null;

        const subMainCalc = filteredCalculations.secondary
            ? {
                headLoss: filteredCalculations.secondary.headLoss || 0,
                pipeLength: filteredCalculations.secondary.pipeLength || 0,
                flowRate: filteredCalculations.secondary.flowRate || 0,
            }
            : null;

        const mainCalc = filteredCalculations.main
            ? {
                headLoss: filteredCalculations.main.headLoss || 0,
                pipeLength: filteredCalculations.main.pipeLength || 0,
                flowRate: filteredCalculations.main.flowRate || 0,
            }
            : null;

        const emitterCalc = filteredCalculations.emitter
            ? {
                headLoss: filteredCalculations.emitter.headLoss || 0,
                pipeLength: filteredCalculations.emitter.pipeLength || 0,
                flowRate: filteredCalculations.emitter.flowRate || 0,
            }
            : null;

        const branchSubMainCombined =
            projectMode === 'greenhouse'
                ? branchCalc?.headLoss || 0
                : (branchCalc?.headLoss || 0) + (subMainCalc?.headLoss || 0);

        const totalHeadLoss =
            projectMode === 'greenhouse'
                ? (mainCalc?.headLoss || 0) + (branchCalc?.headLoss || 0)
                : (mainCalc?.headLoss || 0) +
                (subMainCalc?.headLoss || 0) +
                (branchCalc?.headLoss || 0) +
                (emitterCalc?.headLoss || 0);

        const head20Percent = sprinklerPressure.head20PercentM;

        return {
            branchCalc,
            subMainCalc,
            mainCalc,
            emitterCalc,
            branchSubMainCombined,
            totalHeadLoss,
            head20Percent,
        };
    }, [selectedPipes, sprinklerPressure, projectMode, getStoredCalculations]);

    const [calculationData, setCalculationData] = useState(() => calculateData());
    const calculationDataRef = useRef(calculationData);

    useEffect(() => {
        calculationDataRef.current = calculationData;
    }, [calculationData]);

    useEffect(() => {
        const handleStorageChange = () => {
            setCalculationData(calculateData());
        };

        window.addEventListener('storage', handleStorageChange);

        const interval = setInterval(() => {
            const newData = calculateData();
            const currentDataString = JSON.stringify(calculationDataRef.current);
            const newDataString = JSON.stringify(newData);

            if (currentDataString !== newDataString) {
                setCalculationData(newData);
            }
        }, 2000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, [calculateData, projectMode]);

    useEffect(() => {
        if (projectMode === 'greenhouse' || projectMode === 'field-crop') {
            const newData = calculateData();
            setCalculationData(newData);
        }
    }, [projectMode, calculateData]);

    if (!calculationData) {
        return null;
    }

    const {
        branchCalc,
        subMainCalc,
        mainCalc,
        emitterCalc,
        branchSubMainCombined,
        totalHeadLoss,
        head20Percent,
    } = calculationData;

    return (
        <div className="mt-6 rounded bg-blue-900 p-4">
            <h4 className="mb-3 text-lg font-bold text-blue-300">🔧 สรุปการคำนวณระบบท่อทั้งหมด</h4>

            <div className="space-y-3 text-sm">


                {/* สรุปการคำนวณทั้งหมด */}
                <div className="rounded bg-green-800 p-3">
                    <h5 className="mb-2 font-medium text-green-200">
                        🔧 สรุปการคำนวณระบบท่อทั้งหมด
                    </h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="flex items-center justify-around space-x-6 rounded bg-blue-800 px-2 py-1">
                                <h5 className="mb-0 whitespace-nowrap text-[12px] font-medium text-blue-50">
                                    💧 ข้อมูลหัวฉีด ={' '}
                                </h5>
                                <div className="flex items-center space-x-2">
                                    <span className="text-[12px] text-blue-300">แรงดัน</span>
                                    <span className="text-[12px] font-bold text-white">
                                        {parseFloat(
                                            (sprinklerPressure?.pressureBar || 0).toFixed(2)
                                        ).toString()}
                                    </span>
                                    <span className="text-[12px] text-blue-300">บาร์</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="text-[12px] text-blue-300">Head</span>
                                    <span className="text-[12px] font-bold text-white">
                                        {parseFloat((sprinklerPressure?.headM || 0).toFixed(2)).toString()}
                                    </span>
                                    <span className="text-[12px] text-blue-300">ม.</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="text-[12px] text-blue-300">20% Head</span>
                                    <span className="text-[12px] font-bold text-yellow-300">
                                        {parseFloat((head20Percent || 0).toFixed(2)).toString()}
                                    </span>
                                    <span className="text-[12px] text-blue-300">ม.</span>
                                </div>
                            </div>
                            <div className="space-y-1 mt-2">
                                <div className="flex justify-between">
                                    <span className="text-green-200">Head Loss ท่อเมนหลัก:</span>
                                    <span className="font-bold text-white">
                                        {mainCalc && mainCalc.headLoss > 0
                                            ? `${mainCalc.headLoss.toFixed(3)} ม.`
                                            : '0.000 ม.'}
                                    </span>
                                </div>
                                {projectMode !== 'greenhouse' && (
                                    <div className="flex justify-between">
                                        <span className="text-green-200">Head Loss ท่อเมนรอง:</span>
                                        <span className="font-bold text-white">
                                            {subMainCalc && subMainCalc.headLoss > 0
                                                ? `${subMainCalc.headLoss.toFixed(3)} ม.`
                                                : '0.000 ม.'}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-green-200">Head Loss ท่อย่อย:</span>
                                    <span className="font-bold text-white">
                                        {branchCalc && branchCalc.headLoss > 0
                                            ? `${branchCalc.headLoss.toFixed(3)} ม.`
                                            : '0.000 ม.'}
                                    </span>
                                </div>
                                {emitterCalc && projectMode !== 'greenhouse' && (
                                    <div className="flex justify-between">
                                        <span className="text-green-200">Head Loss ท่อย่อยแยก:</span>
                                        <span className="font-bold text-white">
                                            {emitterCalc.headLoss > 0
                                                ? `${emitterCalc.headLoss.toFixed(3)} ม.`
                                                : '0.000 ม.'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="border-l border-green-700 pl-4">
                            <div className="text-center">
                                <div className="rounded bg-blue-800 p-3">
                                    <h5 className="mb-2 font-medium text-blue-200">📊 สรุปผล</h5>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-blue-300">
                                                ขีดจำกัด 20% Head หัวฉีด:
                                            </span>
                                            <span className="font-bold text-yellow-300">
                                                {(head20Percent || 0).toFixed(3)} ม.
                                            </span>
                                        </div>

                                        {projectMode === 'greenhouse' && (
                                            <div className="flex justify-between">
                                                <span className="text-blue-300">
                                                    Head Loss รวมทั้งระบบ:
                                                </span>
                                                <span
                                                    className={`font-bold ${totalHeadLoss > head20Percent ? 'text-red-400' : 'text-green-400'}`}
                                                >
                                                    {totalHeadLoss.toFixed(3)} ม.
                                                </span>
                                            </div>
                                        )}

                                        {projectMode === 'greenhouse' && (
                                            <div className="mt-2 text-xs text-gray-400">
                                                Debug: Branch=
                                                {branchCalc?.headLoss?.toFixed(3) || '0'} + Main=
                                                {mainCalc?.headLoss?.toFixed(3) || '0'} ={' '}
                                                {totalHeadLoss.toFixed(3)}
                                            </div>
                                        )}

                                        {projectMode === 'greenhouse' &&
                                            totalHeadLoss > head20Percent && (
                                                <div className="rounded border border-red-700 bg-red-900 p-2">
                                                    <span className="text-xs text-red-300">
                                                        ⚠️ <strong>คำเตือน:</strong> Head Loss
                                                        รวมทั้งระบบ ({totalHeadLoss.toFixed(3)} ม.)
                                                        เกินขีดจำกัด 20% Head หัวฉีด (
                                                        {head20Percent.toFixed(3)} ม.) อยู่{' '}
                                                        {(totalHeadLoss - head20Percent).toFixed(3)}{' '}
                                                        ม.
                                                    </span>
                                                </div>
                                            )}

                                        {projectMode !== 'greenhouse' &&
                                            mainCalc &&
                                            mainCalc.headLoss > head20Percent && (
                                                <div className="rounded border border-red-700 bg-red-900 p-2">
                                                    <span className="text-xs text-red-300">
                                                        ⚠️ <strong>คำเตือน:</strong> ท่อเมนหลักมี
                                                        Head Loss เกินขีดจำกัด{' '}
                                                        {(
                                                            mainCalc.headLoss - (head20Percent || 0)
                                                        ).toFixed(3)}{' '}
                                                        ม.
                                                    </span>
                                                </div>
                                            )}

                                        {projectMode !== 'greenhouse' &&
                                            branchCalc &&
                                            branchSubMainCombined > head20Percent && (
                                                <div className="rounded border border-red-700 bg-red-900 p-2">
                                                    <span className="text-xs text-red-300">
                                                        ⚠️ <strong>คำเตือน:</strong> ท่อย่อย +
                                                        ท่อเมนรอง มี Head Loss เกินขีดจำกัด{' '}
                                                        {(
                                                            branchSubMainCombined - head20Percent
                                                        ).toFixed(3)}{' '}
                                                        ม.
                                                    </span>
                                                </div>
                                            )}

                                        {projectMode === 'greenhouse' &&
                                            totalHeadLoss <= head20Percent && (
                                                <div className="rounded border border-green-700 bg-green-900 p-2">
                                                    <span className="text-xs text-green-300">
                                                        ✅ <strong>ปกติ:</strong> Head Loss
                                                        รวมทั้งระบบ ({totalHeadLoss.toFixed(3)} ม.)
                                                        อยู่ในขีดจำกัดที่ยอมรับได้
                                                    </span>
                                                </div>
                                            )}

                                        {projectMode !== 'greenhouse' &&
                                            (!mainCalc || mainCalc.headLoss <= head20Percent) &&
                                            (!branchCalc ||
                                                branchSubMainCombined <= head20Percent) && (
                                                <div className="rounded border border-green-700 bg-green-900 p-2">
                                                    <span className="text-xs text-green-300">
                                                        ✅ <strong>ปกติ:</strong> ค่า Head Loss
                                                        ทั้งหมดอยู่ในขีดจำกัดที่ยอมรับได้
                                                    </span>
                                                </div>
                                            )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PipeSystemSummary;
