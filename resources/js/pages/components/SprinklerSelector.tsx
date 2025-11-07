/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalculationResults } from '../types/interfaces';
import { Zone } from '../../utils/horticultureUtils';
import { formatWaterFlow } from '../utils/calculations';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    loadSprinklerConfig,
    formatFlowRate,
    formatPressure,
    formatRadius,
} from '../../utils/sprinklerUtils';
import SearchableDropdown from './SearchableDropdown';
import { getEnhancedFieldCropData, FieldCropData } from '../../utils/fieldCropData';

interface SprinklerSelectorProps {
    selectedSprinkler: any;
    onSprinklerChange: (sprinkler: any) => void;
    results: CalculationResults;
    activeZone?: Zone;
    allZoneSprinklers: { [zoneId: string]: any };
    projectMode?: 'horticulture' | 'garden' | 'field-crop' | 'greenhouse';
    gardenStats?: any;
    greenhouseData?: any;
    fieldCropData?: any;
}

const SprinklerSelector: React.FC<SprinklerSelectorProps> = ({
    selectedSprinkler,
    onSprinklerChange,
    results,
    activeZone,
    allZoneSprinklers,
    projectMode = 'horticulture',
    gardenStats,
    greenhouseData,
    fieldCropData,
}) => {
    const [showImageModal, setShowImageModal] = useState(false);
    const [modalImage, setModalImage] = useState({ src: '', alt: '' });
    const { t } = useLanguage();

    const analyzedSprinklers = useMemo(
        () => results.analyzedSprinklers || [],
        [results.analyzedSprinklers]
    );

    const getFieldCropSprinklerRequirements = useCallback(() => {
        try {
            const systemDataStr = localStorage.getItem('fieldCropSystemData');
            if (systemDataStr) {
                const systemData = JSON.parse(systemDataStr);
                if (systemData?.sprinklerConfig) {
                    return {
                        targetFlowPerSprinkler: systemData.sprinklerConfig.flowRatePerPlant,
                        targetPressure: systemData.sprinklerConfig.pressureBar,
                        targetRadius: systemData.sprinklerConfig.radiusMeters,
                        totalSprinklers: systemData.totalPlants || 0,
                        irrigationTypes: {},
                    };
                }
            }
        } catch (error) {
            console.error('Error parsing field crop system data:', error);
        }

        const fcData = fieldCropData || getEnhancedFieldCropData();
        if (fcData) {
            const totalWaterRequirement = fcData.summary?.totalWaterRequirementPerDay || 0;
            const totalPlantingPoints = fcData.summary?.totalPlantingPoints || 1;
            const irrigationTimeMinutes = 30;

            const targetFlowPerSprinkler =
                totalWaterRequirement / totalPlantingPoints / irrigationTimeMinutes;

            const irrigationByType = fcData.irrigation?.byType || {};
            let targetPressure = 2.5;

            if (irrigationByType.dripTape > 0) {
                targetPressure = 1.0;
            } else if (irrigationByType.pivot > 0) {
                targetPressure = 3.0;
            } else if (irrigationByType.waterJetTape > 0) {
                targetPressure = 1.5;
            }

            return {
                targetFlowPerSprinkler,
                targetPressure,
                targetRadius: 8.0,
                totalSprinklers: totalPlantingPoints,
                irrigationTypes: irrigationByType,
            };
        }

        return null;
    }, [fieldCropData]);

    const getAverageValue = (value: any): number => {
        if (Array.isArray(value)) {
            return (value[0] + value[1]) / 2;
        }
        return parseFloat(String(value)) || 0;
    };

    const getMinValue = (value: any): number => {
        if (Array.isArray(value)) {
            return Math.min(value[0], value[1]);
        }
        return parseFloat(String(value)) || 0;
    };

    const getMaxValue = (value: any): number => {
        if (Array.isArray(value)) {
            return Math.max(value[0], value[1]);
        }
        return parseFloat(String(value)) || 0;
    };

    const isValueInRange = (value: any, target: number): boolean => {
        if (Array.isArray(value)) {
            return target >= value[0] && target <= value[1];
        }
        return Math.abs(value - target) < 0.01;
    };

    useEffect(() => {
        if (
            (projectMode === 'horticulture' ||
                projectMode === 'garden' ||
                projectMode === 'greenhouse') &&
            analyzedSprinklers.length > 0
        ) {
            let sprinklerConfig: any = null;

            if (projectMode === 'horticulture') {
                sprinklerConfig = loadSprinklerConfig();
            } else if (projectMode === 'garden') {
                if (gardenStats && activeZone) {
                    const currentZone = gardenStats.zones.find(
                        (z: any) => z.zoneId === activeZone.id
                    );
                    if (currentZone) {
                        sprinklerConfig = {
                            flowRatePerMinute: currentZone.sprinklerFlowRate || 6.0,
                            pressureBar: currentZone.sprinklerPressure || 2.5,
                            radiusMeters: currentZone.sprinklerRadius || 8.0,
                        };
                    } else {
                        sprinklerConfig = {
                            flowRatePerMinute: 6.0,
                            pressureBar: 2.5,
                            radiusMeters: 8.0,
                        };
                    }
                } else {
                    sprinklerConfig = {
                        flowRatePerMinute: 6.0,
                        pressureBar: 2.5,
                        radiusMeters: 8.0,
                    };
                }
            } else if (projectMode === 'greenhouse') {
                try {
                    const storedData = localStorage.getItem('greenhousePlanningData');
                    if (storedData) {
                        const summaryData = JSON.parse(storedData);

                        const flowRate = summaryData?.sprinklerFlowRate || 10.0;
                        const pressureBar = summaryData?.sprinklerPressure || 2.0;
                        const radiusMeters = summaryData?.sprinklerRadius || 1.5;

                        sprinklerConfig = {
                            flowRatePerMinute: flowRate,
                            pressureBar: pressureBar,
                            radiusMeters: radiusMeters,
                        };
                    } else {
                        sprinklerConfig = {
                            flowRatePerMinute: 10.0,
                            pressureBar: 2.0,
                            radiusMeters: 1.5,
                        };
                    }
                } catch (error) {
                    sprinklerConfig = {
                        flowRatePerMinute: 10.0,
                        pressureBar: 2.0,
                        radiusMeters: 1.5,
                    };
                }
            }

            if (sprinklerConfig) {
                const { flowRatePerMinute, pressureBar, radiusMeters } = sprinklerConfig;

                const compatibleSprinklers = analyzedSprinklers.filter((sprinkler: any) => {
                    const flowMatch = isValueInRange(
                        sprinkler.waterVolumeLitersPerMinute,
                        flowRatePerMinute
                    );

                    const pressureMatch = isValueInRange(sprinkler.pressureBar, pressureBar);

                    const radiusMatch = isValueInRange(sprinkler.radiusMeters, radiusMeters);

                    return flowMatch && pressureMatch && radiusMatch;
                });

                if (compatibleSprinklers.length > 0) {
                    const bestSprinkler = compatibleSprinklers.sort((a: any, b: any) => {
                        return a.price - b.price;
                    })[0];

                    const globalDefaultSprinkler = localStorage.getItem(
                        `${projectMode}_defaultSprinkler`
                    );

                    if (!globalDefaultSprinkler) {
                        localStorage.setItem(
                            `${projectMode}_defaultSprinkler`,
                            JSON.stringify(bestSprinkler)
                        );
                    }

                    if (!selectedSprinkler) {
                        const defaultSprinkler = globalDefaultSprinkler
                            ? JSON.parse(globalDefaultSprinkler)
                            : bestSprinkler;
                        onSprinklerChange(defaultSprinkler);
                    }
                }
            }
        }
    }, [
        projectMode,
        selectedSprinkler,
        analyzedSprinklers,
        onSprinklerChange,
        gardenStats,
        activeZone,
        greenhouseData,
    ]);

    const openImageModal = (src: string, alt: string) => {
        setModalImage({ src, alt });
        setShowImageModal(true);
    };

    const closeImageModal = () => {
        setShowImageModal(false);
        setModalImage({ src: '', alt: '' });
    };

    const getFilteredSprinklers = () => {
        if (
            projectMode !== 'horticulture' &&
            projectMode !== 'garden' &&
            projectMode !== 'greenhouse' &&
            projectMode !== 'field-crop'
        ) {
            return analyzedSprinklers.sort((a, b) => a.price - b.price);
        }

        let sprinklerConfig: any = null;

        if (projectMode === 'horticulture') {
            sprinklerConfig = loadSprinklerConfig();
        } else if (projectMode === 'garden') {
            if (gardenStats && activeZone) {
                const currentZone = gardenStats.zones.find((z: any) => z.zoneId === activeZone.id);
                if (currentZone) {
                    sprinklerConfig = {
                        flowRatePerMinute: currentZone.sprinklerFlowRate || 6.0,
                        pressureBar: currentZone.sprinklerPressure || 2.5,
                        radiusMeters: currentZone.sprinklerRadius || 8.0,
                    };
                } else {
                    sprinklerConfig = {
                        flowRatePerMinute: 6.0,
                        pressureBar: 2.5,
                        radiusMeters: 8.0,
                    };
                }
            } else {
                sprinklerConfig = {
                    flowRatePerMinute: 6.0,
                    pressureBar: 2.5,
                    radiusMeters: 8.0,
                };
            }
        } else if (projectMode === 'field-crop') {
            if (fieldCropData && fieldCropData.irrigationSettings) {
                sprinklerConfig = {
                    flowRatePerMinute: fieldCropData.irrigationSettings.sprinkler_system?.flow ?? 0,
                    pressureBar: fieldCropData.irrigationSettings.sprinkler_system?.pressure ?? 0,
                    radiusMeters:
                        fieldCropData.irrigationSettings.sprinkler_system?.coverageRadius ?? 0,
                };
            } else {
                sprinklerConfig = {
                    flowRatePerMinute: 0,
                    pressureBar: 0,
                    radiusMeters: 0,
                };
            }
        } else if (projectMode === 'greenhouse') {
            try {
                const storedData = localStorage.getItem('greenhousePlanningData');
                if (storedData) {
                    const summaryData = JSON.parse(storedData);

                    const flowRate = summaryData?.sprinklerFlowRate || 10.0;
                    const pressureBar = summaryData?.sprinklerPressure || 2.0;
                    const radiusMeters = summaryData?.sprinklerRadius || 1.5;

                    sprinklerConfig = {
                        flowRatePerMinute: flowRate,
                        pressureBar: pressureBar,
                        radiusMeters: radiusMeters,
                    };
                } else {
                    sprinklerConfig = {
                        flowRatePerMinute: 10.0,
                        pressureBar: 2.0,
                        radiusMeters: 1.5,
                    };
                }
            } catch (error) {
                sprinklerConfig = {
                    flowRatePerMinute: 10.0,
                    pressureBar: 2.0,
                    radiusMeters: 1.5,
                };
            }
        }

        if (!sprinklerConfig) {
            return analyzedSprinklers.sort((a, b) => a.price - b.price);
        }

        const { flowRatePerMinute, pressureBar, radiusMeters } = sprinklerConfig;

        const compatibleSprinklers = analyzedSprinklers.filter((sprinkler: any) => {
            const flowMatch = isValueInRange(
                sprinkler.waterVolumeLitersPerMinute,
                flowRatePerMinute
            );

            const pressureMatch = isValueInRange(sprinkler.pressureBar, pressureBar);

            const radiusMatch = isValueInRange(sprinkler.radiusMeters, radiusMeters);

            return flowMatch && pressureMatch && radiusMatch;
        });

        return compatibleSprinklers.sort((a: any, b: any) => {
            return a.price - b.price;
        });
    };

    const sortedSprinklers = getFilteredSprinklers();
    const selectedAnalyzed = selectedSprinkler
        ? analyzedSprinklers.find((s) => s.id === selectedSprinkler.id)
        : null;

    useEffect(() => {
        if (projectMode === 'field-crop' && !selectedSprinkler && analyzedSprinklers.length > 0) {
            if (sortedSprinklers.length > 0) {
                const bestSprinkler = sortedSprinklers[0];
                onSprinklerChange(bestSprinkler);
            }
        }
    }, [projectMode, selectedSprinkler, analyzedSprinklers, sortedSprinklers, onSprinklerChange]);

    const formatRangeValue = (value: any) => {
        if (Array.isArray(value)) return `${value[0]}-${value[1]}`;
        return String(value);
    };

    const getUniqueSprinklers = () => {
        const sprinklerMap = new Map();
        Object.values(allZoneSprinklers).forEach((sprinkler) => {
            if (sprinkler) sprinklerMap.set(sprinkler.id, sprinkler);
        });
        return Array.from(sprinklerMap.values());
    };

    const getZonesUsingSprinkler = (sprinklerId: number) => {
        const zones: string[] = [];
        Object.entries(allZoneSprinklers).forEach(([zoneId, sprinkler]) => {
            if (sprinkler && sprinkler.id === sprinklerId) {
                zones.push(zoneId);
            }
        });
        return zones;
    };

    const uniqueSprinklers = getUniqueSprinklers();

    const getLabel = (key: string) => {
        if (projectMode === 'garden') {
            switch (key) {
                case 'sprinkler':
                    return 'หัวฉีด';
                case 'perHead':
                    return 'ต่อหัวฉีด';
                case 'totalRequired':
                    return 'จำนวนที่ต้องใช้';
                default:
                    return key;
            }
        }
        return key;
    };

    return (
        <div className="rounded-lg bg-gray-700 p-6">
            <h3 className="mb-4 text-2xl font-bold text-green-400">
                {t('เลือก')}
                {projectMode === 'garden' ? t('หัวฉีด') : t('สปริงเกอร์')}
                {activeZone && (
                    <span className="ml-2 text-sm font-normal text-gray-400">
                        - {activeZone.name.split(' (')[0]}
                    </span>
                )}
            </h3>

            {(projectMode === 'horticulture' ||
                projectMode === 'garden' ||
                projectMode === 'greenhouse' ||
                projectMode === 'field-crop') &&
                (() => {
                    let sprinklerConfig: any = null;

                    if (projectMode === 'horticulture') {
                        sprinklerConfig = loadSprinklerConfig();
                    } else if (projectMode === 'garden') {
                        if (gardenStats && activeZone) {
                            const currentZone = gardenStats.zones.find(
                                (z: any) => z.zoneId === activeZone.id
                            );
                            if (currentZone) {
                                sprinklerConfig = {
                                    flowRatePerMinute: currentZone.sprinklerFlowRate || 6.0,
                                    pressureBar: currentZone.sprinklerPressure || 2.5,
                                    radiusMeters: currentZone.sprinklerRadius || 8.0,
                                };
                            } else {
                                sprinklerConfig = {
                                    flowRatePerMinute: 6.0,
                                    pressureBar: 2.5,
                                    radiusMeters: 8.0,
                                };
                            }
                        } else {
                            sprinklerConfig = {
                                flowRatePerMinute: 6.0,
                                pressureBar: 2.5,
                                radiusMeters: 8.0,
                            };
                        }
                    } else if (projectMode === 'greenhouse') {
                        try {
                            const storedData = localStorage.getItem('greenhousePlanningData');
                            if (storedData) {
                                const summaryData = JSON.parse(storedData);

                                const flowRate = summaryData?.sprinklerFlowRate || 10.0;
                                const pressureBar = summaryData?.sprinklerPressure || 2.0;
                                const radiusMeters = summaryData?.sprinklerRadius || 1.5;

                                sprinklerConfig = {
                                    flowRatePerMinute: flowRate,
                                    pressureBar: pressureBar,
                                    radiusMeters: radiusMeters,
                                };
                            } else {
                                sprinklerConfig = {
                                    flowRatePerMinute: 10.0,
                                    pressureBar: 2.0,
                                    radiusMeters: 1.5,
                                };
                            }
                        } catch (error) {
                            sprinklerConfig = {
                                flowRatePerMinute: 10.0,
                                pressureBar: 2.0,
                                radiusMeters: 1.5,
                            };
                        }
                    } else if (projectMode === 'field-crop') {
                        if (fieldCropData && fieldCropData.irrigationSettings) {
                            sprinklerConfig = {
                                flowRatePerMinute:
                                    fieldCropData.irrigationSettings.sprinkler_system?.flow ?? 0,
                                pressureBar:
                                    fieldCropData.irrigationSettings.sprinkler_system?.pressure ??
                                    0,
                                radiusMeters:
                                    fieldCropData.irrigationSettings.sprinkler_system
                                        ?.coverageRadius ?? 0,
                            };
                        } else {
                            sprinklerConfig = {
                                flowRatePerMinute: 0,
                                pressureBar: 0,
                                radiusMeters: 0,
                            };
                        }
                    }
                    return sprinklerConfig ? (
                        <div className="mb-4 rounded border border-blue-700/50 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 p-4">
                            <div className="flex flex-row flex-wrap items-center gap-6">
                                <h4 className="m-0 flex items-center p-0 text-lg font-semibold text-cyan-300">
                                    🚿 {t('สปริงเกอร์ที่ต้องการ')} =
                                </h4>
                                <div className="flex flex-row items-center gap-2">
                                    <span className="text-lg text-gray-50">Q หัวฉีด:</span>
                                    <span className="text-lg font-bold text-cyan-400">
                                        {sprinklerConfig.flowRatePerMinute} {t('ลิตร/นาที')}
                                    </span>
                                </div>
                                <div className="flex flex-row items-center gap-2">
                                    <span className="text-lg text-gray-50">แรงดัน:</span>
                                    <span className="text-lg font-bold text-orange-400">
                                        {formatPressure(sprinklerConfig.pressureBar)}
                                    </span>
                                </div>
                                <div className="flex flex-row items-center gap-2">
                                    <span className="text-lg text-gray-50">รัศมีหัวฉีด:</span>
                                    <span className="text-lg font-bold text-purple-400">
                                        {formatRadius(sprinklerConfig.radiusMeters)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : null;
                })()}

            {/* <div className="mb-4 rounded bg-gray-600 p-3">
                <h4 className="mb-2 text-sm font-medium text-green-300">
                    💧 {t('ความต้องการ')} {activeZone ? ` (${activeZone.name})` : ''}:
                </h4>
                <div className="text-xs text-gray-300">
                    <p>
                        {t('อัตราการไหล')} {projectMode === 'garden' ? t('ต่อหัวฉีด') : t('ต่อหัว')}:{' '}
                        <span className="font-bold text-blue-300">
                            {results.waterPerSprinklerLPM.toFixed(1)} {t('LPM')}
                        </span>
                    </p>
                    <p>
                        {t('จำนวนที่ต้องใช้')}:{' '}
                        <span className="font-bold text-yellow-300">
                            {results.totalSprinklers} {t('หัว')}
                        </span>
                        {activeZone && <span className="ml-1 text-gray-400">({t('ในโซนนี้')})</span>}
                    </p>
                </div>
            </div> */}

            <SearchableDropdown
                value={selectedSprinkler?.productCode || selectedSprinkler?.id || ''}
                onChange={(value) => {
                    const selected = analyzedSprinklers.find(
                        (s) => s.id === value || s.productCode === value
                    );

                    if (
                        selected &&
                        (projectMode === 'horticulture' ||
                            projectMode === 'garden' ||
                            projectMode === 'greenhouse')
                    ) {
                        localStorage.setItem(
                            `${projectMode}_defaultSprinkler`,
                            JSON.stringify(selected)
                        );
                    }

                    onSprinklerChange(selected);
                }}
                options={(() => {
                    const options = [
                        {
                            value: '',
                            label: `-- ${t('เลือก')} ${projectMode === 'garden' ? t('หัวฉีด') : t('สปริงเกอร์')}${activeZone ? ` ${t('สำหรับ')} ${activeZone.name.split(' (')[0]}` : ''} --`,
                        },
                        ...sortedSprinklers.map((sprinkler) => ({
                            value: sprinkler.productCode || sprinkler.id,
                            label: `${sprinkler.productCode || ''} - ${sprinkler.name} - ${sprinkler.price} ${t('บาท')} | ${sprinkler.brand || sprinkler.brand_name || '-'}`,
                            searchableText: `${sprinkler.productCode || ''} ${sprinkler.name || ''} ${sprinkler.brand || sprinkler.brand_name || ''}`,
                            image: sprinkler.image,
                            productCode: sprinkler.productCode || (sprinkler as any).product_code,
                            name: sprinkler.name,
                            brand: sprinkler.brand || sprinkler.brand_name,
                            price: sprinkler.price,
                            unit: t('บาท'),
                        })),
                    ];
                    return options;
                })()}
                placeholder={`-- ${t('เลือก')} ${projectMode === 'garden' ? t('หัวฉีด') : t('สปริงเกอร์')}${activeZone ? ` ${t('สำหรับ')} ${activeZone.name.split(' (')[0]}` : ''} --`}
                searchPlaceholder={
                    t('พิมพ์เพื่อค้นหา') +
                    (projectMode === 'garden' ? t('หัวฉีด') : t('สปริงเกอร์')) +
                    ' (ชื่อ, รหัสสินค้า, แบรนด์)...'
                }
                className="mb-4 w-full"
            />

            {selectedSprinkler && selectedAnalyzed && (
                <div className="rounded bg-gray-600 p-3">
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-medium text-white">
                            <strong>{selectedSprinkler.name}</strong>
                            {activeZone && (
                                <span className="ml-2 text-sm font-normal text-gray-400">
                                    ({t('สำหรับ')} {activeZone.name.split(' (')[0]})
                                </span>
                            )}
                        </h4>
                    </div>

                    <div className="grid grid-cols-10 items-center justify-between gap-3 text-sm">
                        <div className="col-span-2 flex items-center justify-center">
                            {selectedSprinkler.image ? (
                                <img
                                    src={selectedSprinkler.image}
                                    alt={selectedSprinkler.name}
                                    className="h-auto w-[85px] cursor-pointer rounded border border-gray-500 transition-opacity hover:border-blue-400 hover:opacity-80"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                    onClick={() =>
                                        openImageModal(
                                            selectedSprinkler.image,
                                            selectedSprinkler.name
                                        )
                                    }
                                    title={t('คลิกเพื่อดูรูปขนาดใหญ่')}
                                />
                            ) : (
                                <div className="flex h-[60px] w-[85px] items-center justify-center rounded bg-gray-500 text-xs text-gray-300">
                                    {t('ไม่มีรูป')}
                                </div>
                            )}
                        </div>

                        <div className="col-span-4">
                            <p>
                                <strong>{t('รหัสสินค้า:')}</strong>{' '}
                                {selectedSprinkler.productCode || selectedSprinkler.product_code}
                            </p>
                            <p>
                                <strong>{t('อัตราการไหล:')}</strong>{' '}
                                {formatRangeValue(selectedSprinkler.waterVolumeLitersPerMinute)}{' '}
                                {t('LPM')}
                            </p>
                            <p>
                                <strong>{t('รัศมี:')}</strong>{' '}
                                {formatRangeValue(selectedSprinkler.radiusMeters)} {t('เมตร')}
                            </p>
                            <p>
                                <strong>{t('แรงดัน:')}</strong>{' '}
                                {formatRangeValue(selectedSprinkler.pressureBar)} {t('บาร์')}
                            </p>
                        </div>

                        <div className="col-span-4">
                            <p>
                                <strong>{t('แบรนด์:')}</strong>{' '}
                                {selectedSprinkler.brand || selectedSprinkler.brand_name || '-'}
                            </p>
                            <p>
                                <strong>{t('ราคาต่อหัว:')}</strong>{' '}
                                {selectedSprinkler.price?.toLocaleString()} {t('บาท')}
                            </p>
                            <p>
                                <strong>{t('จำนวนที่ต้องใช้:')}</strong> {results.totalSprinklers}{' '}
                                {t('หัว')}
                                {activeZone && (
                                    <span className="ml-1 text-xs text-gray-400">
                                        ({t('โซนนี้')})
                                    </span>
                                )}
                            </p>
                            <p>
                                <strong>{t('ราคารวม:')}</strong>{' '}
                                <span className="text-green-300">
                                    {(
                                        selectedSprinkler.price * results.totalSprinklers
                                    ).toLocaleString()}
                                </span>{' '}
                                {t('บาท')}
                            </p>
                        </div>
                    </div>

                    {selectedSprinkler.description && (
                        <div className="mt-3 rounded bg-gray-800 p-2">
                            <p className="text-xs text-gray-300">
                                <strong>{t('รายละเอียด:')}</strong> {selectedSprinkler.description}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {showImageModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                    onClick={closeImageModal}
                >
                    <div
                        className="relative max-h-[90vh] max-w-[90vw] p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={closeImageModal}
                            className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                            title={t('ปิด')}
                        >
                            ✕
                        </button>
                        <img
                            src={modalImage.src}
                            alt={modalImage.alt}
                            className="max-h-full max-w-full rounded-lg shadow-2xl"
                        />
                        <div className="mt-2 text-center">
                            <p className="inline-block rounded bg-black bg-opacity-50 px-2 py-1 text-sm text-white">
                                {modalImage.alt}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SprinklerSelector;
