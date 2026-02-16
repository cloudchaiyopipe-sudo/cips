/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CalculationResults, IrrigationInput, SprinklerSetGroup, SprinklerSetItem } from '../types/interfaces';
import { Zone } from '../../utils/horticultureUtils';
import { formatWaterFlow } from '../utils/calculations';
import { useLanguage } from '@/contexts/LanguageContext';
import { loadSprinklerConfig, formatFlowRate, formatPressure } from '../../utils/sprinklerUtils';
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
    gardenData?: any;
    greenhouseData?: any;
    fieldCropData?: any;
    input?: IrrigationInput;
    onInputChange?: (input: IrrigationInput) => void;
}

// Utility function to convert video link to embed format
const convertVideoLinkToEmbed = (url: string | null | undefined): string | null => {
    if (!url || !url.trim()) {
        return null;
    }

    const trimmedUrl = url.trim();

    // YouTube: https://youtu.be/VIDEO_ID or https://www.youtube.com/watch?v=VIDEO_ID
    const youtubeShortRegex = /(?:youtu\.be\/)([a-zA-Z0-9_-]+)/;
    const youtubeWatchRegex = /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/;
    
    const youtubeShortMatch = trimmedUrl.match(youtubeShortRegex);
    const youtubeWatchMatch = trimmedUrl.match(youtubeWatchRegex);
    
    if (youtubeShortMatch) {
        return `https://www.youtube.com/embed/${youtubeShortMatch[1]}`;
    }
    
    if (youtubeWatchMatch) {
        return `https://www.youtube.com/embed/${youtubeWatchMatch[1]}`;
    }

    // Google Drive: https://drive.google.com/file/d/FILE_ID/view...
    const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const driveMatch = trimmedUrl.match(driveRegex);
    
    if (driveMatch) {
        return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }

    // If already an embed URL, return as is
    if (trimmedUrl.includes('/embed/') || trimmedUrl.includes('/preview')) {
        return trimmedUrl;
    }

    return null;
};

const SprinklerSelector: React.FC<SprinklerSelectorProps> = ({
    selectedSprinkler,
    onSprinklerChange,
    results,
    activeZone,
    allZoneSprinklers,
    projectMode = 'horticulture',
    gardenStats,
    gardenData,
    greenhouseData,
    fieldCropData,
    input,
    onInputChange,
}) => {
    const [showImageModal, setShowImageModal] = useState(false);
    const [modalImage, setModalImage] = useState({ src: '', alt: '' });
    const { t } = useLanguage();

    // State for sprinkler equipment set
    const [sprinklerGroups, setSprinklerGroups] = useState<SprinklerSetGroup[]>([]);
    const [selectedSprinklerItems, setSelectedSprinklerItems] = useState<SprinklerSetItem[]>([]);
    const [loadingSprinklerGroups, setLoadingSprinklerGroups] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [equipments, setEquipments] = useState<any[]>([]);
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
    const [loadingEquipments, setLoadingEquipments] = useState(false);
    const [applyEquipmentToAllZones, setApplyEquipmentToAllZones] = useState(false);

    const inputRef = useRef(input);
    const onInputChangeRef = useRef(onInputChange);

    useEffect(() => {
        inputRef.current = input;
        onInputChangeRef.current = onInputChange;
    }, [input, onInputChange]);

    // Load sprinkler equipment set from input when zone changes
    useEffect(() => {
        if (input?.sprinklerEquipmentSet?.selectedItems) {
            setSelectedSprinklerItems(input.sprinklerEquipmentSet.selectedItems);
        } else {
            setSelectedSprinklerItems([]);
        }
    }, [input?.sprinklerEquipmentSet, activeZone?.id]);


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
                totalSprinklers: totalPlantingPoints,
                irrigationTypes: irrigationByType,
            };
        }

        return null;
    }, [fieldCropData]);

    // ฟังก์ชันหาจำนวนหัวฉีดของโซนนี้
    const getZoneSprinklerCount = useCallback(() => {
        if (activeZone && input) {
            // ใช้ input.totalTrees สำหรับโซนนี้
            let zoneSprinklerCount = input.totalTrees || 0;
            
            if (projectMode === 'horticulture' && zoneSprinklerCount > 0) {
                const config = loadSprinklerConfig();
                const sprinklersPerTree = config?.sprinklersPerTree || 1;
                zoneSprinklerCount = zoneSprinklerCount * sprinklersPerTree;
            }
            return zoneSprinklerCount;
        } else if ((projectMode as string) === 'garden' && gardenStats && activeZone) {
            const zone = gardenStats.zones.find((z: any) => z.zoneId === activeZone.id);
            if (zone) {
                return zone.sprinklerCount || 0;
            }
        } else if (projectMode === 'field-crop' && fieldCropData && activeZone) {
            const zone = fieldCropData.zones?.info?.find((z: any) => z.id === activeZone.id);
            if (zone) {
                const zoneSummary = fieldCropData.zoneSummaries?.[activeZone.id];
                if (zoneSummary?.totalIrrigationPoints && zoneSummary.totalIrrigationPoints > 0) {
                    return zoneSummary.totalIrrigationPoints;
                } else if (zoneSummary?.sprinklerCount && zoneSummary.sprinklerCount > 0) {
                    return zoneSummary.sprinklerCount;
                } else {
                    return zone.sprinklerCount || 0;
                }
            }
        } else if (projectMode === 'greenhouse' && greenhouseData && activeZone) {
            const plot = greenhouseData.summary?.plotStats?.find((p: any) => p.plotId === activeZone.id);
            if (plot) {
                return plot.equipmentCount?.sprinklers || plot.production?.totalPlants || 0;
            }
        }
        
        // Fallback: ใช้ results.totalSprinklers
        let totalSprinklers = results.totalSprinklers || 0;
        if (projectMode === 'horticulture' && totalSprinklers > 0) {
            const config = loadSprinklerConfig();
            const sprinklersPerTree = config?.sprinklersPerTree || 1;
            totalSprinklers = totalSprinklers * sprinklersPerTree;
        }
        return totalSprinklers;
    }, [activeZone, input, projectMode, gardenStats, fieldCropData, greenhouseData, results.totalSprinklers]);

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
                // ⚠️ สำหรับ garden mode: ใช้ range กว้างๆ จาก gardenData.sprinklers ทั้งหมด
                // เพื่อให้ครอบคลุมทุกชื่อที่ใช้จริงใน Planner
                if (gardenData && activeZone) {
                    const zoneSprinklers = gardenData.sprinklers?.filter(
                        (s: any) => s.zoneId === activeZone.id
                    ) || [];

                    if (zoneSprinklers.length > 0) {
                        // หา min/max จาก sprinklers ที่วางไว้จริง
                        const flowRates = zoneSprinklers.map((s: any) => s.type.flowRate);
                        const pressures = zoneSprinklers.map((s: any) => s.type.pressure);
                        
                        const minFlow = Math.min(...flowRates);
                        const maxFlow = Math.max(...flowRates);
                        const minPressure = Math.min(...pressures);
                        const maxPressure = Math.max(...pressures);
                        
                        // ใช้ค่ากลาง + เพิ่ม margin ±60% เพื่อให้ครอบคลุม
                        const avgFlow = (minFlow + maxFlow) / 2;
                        const avgPressure = (minPressure + maxPressure) / 2;
                        
                        sprinklerConfig = {
                            flowRatePerMinute: avgFlow,
                            pressureBar: avgPressure,
                            // เก็บ min/max ไว้ใช้ใน filter
                            minFlow,
                            maxFlow,
                            minPressure,
                            maxPressure,
                        };
                    } else {
                        sprinklerConfig = {
                            flowRatePerMinute: 6.0,
                            pressureBar: 2.5,
                        };
                    }
                } else {
                    sprinklerConfig = {
                        flowRatePerMinute: 6.0,
                        pressureBar: 2.5,
                    };
                }
            } else if (projectMode === 'greenhouse') {
                try {
                    const storedData = localStorage.getItem('greenhousePlanningData');
                    if (storedData) {
                        const summaryData = JSON.parse(storedData);

                        const flowRate = summaryData?.sprinklerFlowRate || 10.0;
                        const pressureBar = summaryData?.sprinklerPressure || 2.0;

                        sprinklerConfig = {
                            flowRatePerMinute: flowRate,
                            pressureBar: pressureBar,
                        };
                    } else {
                        sprinklerConfig = {
                            flowRatePerMinute: 10.0,
                            pressureBar: 2.0,
                        };
                    }
                } catch (error) {
                    sprinklerConfig = {
                        flowRatePerMinute: 10.0,
                        pressureBar: 2.0,
                    };
                }
            }

            if (sprinklerConfig) {
                const { flowRatePerMinute, pressureBar } = sprinklerConfig;

                const compatibleSprinklers = analyzedSprinklers.filter((sprinkler: any) => {
                    const flowMatch = isValueInRange(
                        sprinkler.waterVolumeLitersPerMinute,
                        flowRatePerMinute
                    );

                    const pressureMatch = isValueInRange(sprinkler.pressureBar, pressureBar);

                    return flowMatch && pressureMatch;
                });

                if (compatibleSprinklers.length > 0) {
                    const bestSprinkler = compatibleSprinklers.sort((a: any, b: any) => {
                        return a.price - b.price;
                    })[0];

                    const globalDefaultSprinklerStr = localStorage.getItem(
                        `${projectMode}_defaultSprinkler`
                    );

                    // ✅ Only auto-select if selectedSprinkler is truly null/undefined (not just falsy)
                    // This prevents auto-selecting when loading from database where selectedSprinkler already has a value
                    if (!selectedSprinkler || (typeof selectedSprinkler === 'object' && Object.keys(selectedSprinkler).length === 0)) {
                        let defaultSprinkler = bestSprinkler;
                        
                        // Try to find the saved default sprinkler from SprinklerConfigModal
                        if (globalDefaultSprinklerStr) {
                            try {
                                const savedDefaultSprinkler = JSON.parse(globalDefaultSprinklerStr);
                                
                                // Find sprinkler by id or productCode in compatibleSprinklers
                                const foundSprinkler = compatibleSprinklers.find((s: any) => 
                                    s.id === savedDefaultSprinkler.id || 
                                    s.productCode === savedDefaultSprinkler.productCode ||
                                    (savedDefaultSprinkler.productCode && s.productCode === savedDefaultSprinkler.productCode)
                                );
                                
                                if (foundSprinkler) {
                                    defaultSprinkler = foundSprinkler;
                                } else {
                                    // If not found in compatible, try to find in all analyzedSprinklers
                                    const foundInAll = analyzedSprinklers.find((s: any) => 
                                        s.id === savedDefaultSprinkler.id || 
                                        s.productCode === savedDefaultSprinkler.productCode ||
                                        (savedDefaultSprinkler.productCode && s.productCode === savedDefaultSprinkler.productCode)
                                    );
                                    
                                    if (foundInAll) {
                                        defaultSprinkler = foundInAll;
                                    }
                                }
                            } catch (error) {
                                console.error('Error parsing default sprinkler:', error);
                            }
                        }
                        
                        // Save the selected default if not already saved
                        if (!globalDefaultSprinklerStr) {
                            localStorage.setItem(
                                `${projectMode}_defaultSprinkler`,
                                JSON.stringify(defaultSprinkler)
                            );
                        }
                        
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
            // ⚠️ สำหรับ garden mode: ใช้ range กว้างๆ จาก gardenData.sprinklers ทั้งหมด
            if (gardenData && activeZone) {
                const zoneSprinklers = gardenData.sprinklers?.filter(
                    (s: any) => s.zoneId === activeZone.id
                ) || [];

                if (zoneSprinklers.length > 0) {
                    const flowRates = zoneSprinklers.map((s: any) => s.type.flowRate);
                    const pressures = zoneSprinklers.map((s: any) => s.type.pressure);
                    
                    const minFlow = Math.min(...flowRates);
                    const maxFlow = Math.max(...flowRates);
                    const minPressure = Math.min(...pressures);
                    const maxPressure = Math.max(...pressures);
                    
                    const avgFlow = (minFlow + maxFlow) / 2;
                    const avgPressure = (minPressure + maxPressure) / 2;
                    
                    sprinklerConfig = {
                        flowRatePerMinute: avgFlow,
                        pressureBar: avgPressure,
                        minFlow,
                        maxFlow,
                        minPressure,
                        maxPressure,
                    };
                } else {
                    sprinklerConfig = {
                        flowRatePerMinute: 6.0,
                        pressureBar: 2.5,
                    };
                }
            } else {
                sprinklerConfig = {
                    flowRatePerMinute: 6.0,
                    pressureBar: 2.5,
                };
            }
        } else if (projectMode === 'field-crop') {
            if (fieldCropData && fieldCropData.irrigationSettings) {
                sprinklerConfig = {
                    flowRatePerMinute: fieldCropData.irrigationSettings.sprinkler_system?.flow ?? 0,
                    pressureBar: fieldCropData.irrigationSettings.sprinkler_system?.pressure ?? 0,
                };
            } else {
                sprinklerConfig = {
                    flowRatePerMinute: 0,
                    pressureBar: 0,
                };
            }
        } else if (projectMode === 'greenhouse') {
            try {
                const storedData = localStorage.getItem('greenhousePlanningData');
                if (storedData) {
                    const summaryData = JSON.parse(storedData);

                    const flowRate = summaryData?.sprinklerFlowRate || 10.0;
                    const pressureBar = summaryData?.sprinklerPressure || 2.0;

                    sprinklerConfig = {
                        flowRatePerMinute: flowRate,
                        pressureBar: pressureBar,
                    };
                } else {
                    sprinklerConfig = {
                        flowRatePerMinute: 10.0,
                        pressureBar: 2.0,
                    };
                }
            } catch (error) {
                sprinklerConfig = {
                    flowRatePerMinute: 10.0,
                    pressureBar: 2.0,
                };
            }
        }

        if (!sprinklerConfig) {
            return analyzedSprinklers.sort((a, b) => a.price - b.price);
        }

        const { flowRatePerMinute, pressureBar } = sprinklerConfig;

        // ⚠️ สำหรับ garden mode: ถ้ามี min/max จาก gardenData ให้ใช้ range นั้น
        const hasMinMax = sprinklerConfig.minFlow !== undefined;
        
        const compatibleSprinklers = analyzedSprinklers.filter((sprinkler: any) => {
            const sprinklerFlow = getAverageValue(sprinkler.waterVolumeLitersPerMinute);
            const sprinklerPressure = getAverageValue(sprinkler.pressureBar);
            
            if (projectMode === 'garden' && hasMinMax) {
                // ใช้ range จาก gardenData sprinklers + margin 30%
                const flowMin = sprinklerConfig.minFlow * 0.7;
                const flowMax = sprinklerConfig.maxFlow * 1.3;
                const pressureMin = sprinklerConfig.minPressure * 0.7;
                const pressureMax = sprinklerConfig.maxPressure * 1.3;
                
                const flowMatch = sprinklerFlow >= flowMin && sprinklerFlow <= flowMax;
                const pressureMatch = sprinklerPressure >= pressureMin && sprinklerPressure <= pressureMax;
                return flowMatch && pressureMatch;
            } else if (projectMode === 'field-crop') {
                // ใช้ tolerance ±50% สำหรับ field-crop mode
                const flowMatch = Math.abs(sprinklerFlow - flowRatePerMinute) <= flowRatePerMinute * 0.5;
                const pressureMatch = Math.abs(sprinklerPressure - pressureBar) <= pressureBar * 0.5;
                return flowMatch && pressureMatch;
            } else {
                // ใช้ isValueInRange แบบเดิมสำหรับ mode อื่นๆ
                const flowMatch = isValueInRange(
                    sprinkler.waterVolumeLitersPerMinute,
                    flowRatePerMinute
                );
                const pressureMatch = isValueInRange(sprinkler.pressureBar, pressureBar);
                return flowMatch && pressureMatch;
            }
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

    // Functions for sprinkler equipment set
    useEffect(() => {
        const fetchSprinklerGroups = async () => {
            setLoadingSprinklerGroups(true);
            try {
                const response = await fetch('/api/equipment-sets/by-name/SprinklerSET');
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        const sprinklerSet = data[0];
                        if (sprinklerSet && sprinklerSet.groups) {
                            setSprinklerGroups(sprinklerSet.groups);
                        } else {
                            setSprinklerGroups([]);
                        }
                    } else {
                        setSprinklerGroups([]);
                    }
                } else {
                    setSprinklerGroups([]);
                }
            } catch (error) {
                setSprinklerGroups([]);
            } finally {
                setLoadingSprinklerGroups(false);
            }
        };
        fetchSprinklerGroups();
    }, []);

    useEffect(() => {
        if (inputRef.current && inputRef.current.sprinklerEquipmentSet) {
            setSelectedSprinklerItems(inputRef.current.sprinklerEquipmentSet.selectedItems || []);
        } else {
            setSelectedSprinklerItems([]);
        }
    }, [activeZone?.id, input?.sprinklerEquipmentSet?.selectedGroupId]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetch('/api/equipment-categories');
                if (response.ok) {
                    const data = await response.json();
                    setCategories(Array.isArray(data) ? data : []);
                } else {
                    setCategories([]);
                }
            } catch (error) {
                setCategories([]);
            }
        };
        fetchCategories();
    }, []);

    const fetchEquipmentsByCategory = async (categoryId: number) => {
        setLoadingEquipments(true);
        try {
            const response = await fetch(`/api/equipments/by-category-id/${categoryId}`);
            if (response.ok) {
                const data = await response.json();
                setEquipments(Array.isArray(data) ? data : []);
            } else {
                setEquipments([]);
            }
        } catch (error) {
            setEquipments([]);
        } finally {
            setLoadingEquipments(false);
        }
    };

    // Function to apply equipment set to all zones
    const applyEquipmentSetToAllZones = useCallback((groupId: number | string | null, items: SprinklerSetItem[]) => {
        try {
            // Get all zones from project data
            let zoneIds: string[] = [];

            if (projectMode === 'horticulture') {
                const horticultureData = localStorage.getItem('horticultureSystemData');
                if (horticultureData) {
                    const data = JSON.parse(horticultureData);
                    zoneIds = data.zones?.map((z: any) => z.id) || [];
                }
            } else if (projectMode === 'garden' && gardenStats) {
                zoneIds = gardenStats.zones.map((z: any) => z.zoneId);
            } else if (projectMode === 'field-crop' && fieldCropData) {
                zoneIds = fieldCropData.zones?.info?.map((z: any) => z.id) || [];
            } else if (projectMode === 'greenhouse' && greenhouseData) {
                zoneIds = greenhouseData.summary?.plotStats?.map((p: any) => p.plotId) || [];
            }

            // Update sprinklerEquipmentSets in localStorage
            const equipmentSetsKey = `${projectMode}_sprinklerEquipmentSets`;
            let sprinklerEquipmentSets: { [zoneId: string]: any } = {};
            
            try {
                const storedSets = localStorage.getItem(equipmentSetsKey);
                if (storedSets) {
                    sprinklerEquipmentSets = JSON.parse(storedSets);
                }
            } catch (e) {
                console.error('Error parsing sprinklerEquipmentSets:', e);
            }

            // Apply equipment set to all zones
            zoneIds.forEach((zoneId) => {
                sprinklerEquipmentSets[zoneId] = {
                    selectedGroupId: groupId,
                    selectedItems: items,
                };
            });

            // Save back to localStorage
            localStorage.setItem(equipmentSetsKey, JSON.stringify(sprinklerEquipmentSets));

            // Dispatch custom event to notify other components
            window.dispatchEvent(new CustomEvent('sprinklerEquipmentSetsUpdated', {
                detail: { sprinklerEquipmentSets }
            }));

            console.log(`Applied equipment set to ${zoneIds.length} zones`);
        } catch (error) {
            console.error('Error applying equipment set to all zones:', error);
        }
    }, [projectMode, gardenStats, fieldCropData, greenhouseData]);

    const handleSprinklerGroupChange = useCallback(
        (groupId: string) => {
            if (!inputRef.current || !onInputChangeRef.current) return;

            const selectedGroupId = groupId
                ? isNaN(parseInt(groupId))
                    ? groupId
                    : parseInt(groupId)
                : null;

            if (selectedGroupId) {
                const selectedGroup = sprinklerGroups.find((group) => group.id == selectedGroupId);
                if (selectedGroup && selectedGroup.items && selectedGroup.items.length > 0) {
                    setSelectedSprinklerItems(selectedGroup.items);

                    onInputChangeRef.current({
                        ...inputRef.current,
                        sprinklerEquipmentSet: {
                            selectedGroupId,
                            selectedItems: selectedGroup.items,
                        },
                    });

                    // Apply to all zones if checkbox is checked
                    if (applyEquipmentToAllZones) {
                        applyEquipmentSetToAllZones(selectedGroupId, selectedGroup.items);
                    }
                }
            } else {
                setSelectedSprinklerItems([]);
                onInputChangeRef.current({
                    ...inputRef.current,
                    sprinklerEquipmentSet: {
                        selectedGroupId: null,
                        selectedItems: [],
                    },
                });

                // Clear all zones if checkbox is checked
                if (applyEquipmentToAllZones) {
                    applyEquipmentSetToAllZones(null, []);
                } else {
                    // ลบข้อมูลของโซนปัจจุบันออกจาก localStorage
                    try {
                        const equipmentSetsKey = `${projectMode}_sprinklerEquipmentSets`;
                        const storedSets = localStorage.getItem(equipmentSetsKey);
                        if (storedSets) {
                            const sets = JSON.parse(storedSets);
                            // ลบโซนปัจจุบันออก
                            if (activeZone?.id) {
                                delete sets[activeZone.id];
                            }
                            // บันทึกกลับ
                            localStorage.setItem(equipmentSetsKey, JSON.stringify(sets));
                            // Dispatch event เพื่อ update components อื่น
                            window.dispatchEvent(new CustomEvent('sprinklerEquipmentSetsUpdated', {
                                detail: { sprinklerEquipmentSets: sets }
                            }));
                        }
                    } catch (error) {
                        console.error('Error clearing sprinkler equipment set:', error);
                    }
                }
            }
        },
        [sprinklerGroups, applyEquipmentToAllZones, applyEquipmentSetToAllZones, activeZone?.id, projectMode]
    );

    const isPipeEquipment = (item: SprinklerSetItem): boolean => {
        const categoryName = item.equipment.category?.name?.toLowerCase();
        return categoryName === 'pipe' || categoryName?.includes('pipe') || false;
    };

    const updateSprinklerItem = (itemIndex: number, field: keyof SprinklerSetItem, value: any) => {
        if (!inputRef.current || !onInputChangeRef.current) return;

        const updatedItems = [...selectedSprinklerItems];
        updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            [field]: value,
            ...(field === 'quantity' && {
                total_price: value * updatedItems[itemIndex].unit_price,
            }),
        };

        setSelectedSprinklerItems(updatedItems);
        onInputChangeRef.current({
            ...inputRef.current,
            sprinklerEquipmentSet: {
                selectedGroupId: inputRef.current.sprinklerEquipmentSet?.selectedGroupId || null,
                selectedItems: updatedItems,
            },
        });
    };

    // สำหรับ garden mode: group sprinklers by type from gardenData with equipment details
    const gardenSprinklersByType = useMemo(() => {
        if (projectMode !== 'garden' || !gardenData || !activeZone) {
            return [];
        }

        const zoneSprinklers = gardenData.sprinklers?.filter(
            (s: any) => s.zoneId === activeZone.id
        ) || [];

        if (zoneSprinklers.length === 0) {
            return [];
        }

        // Group by EXACT equipment name (ชื่อสปริงเกอร์) เพื่อแยกแต่ละรุ่น
        const typeGroups = new Map<string, {
            name: string;
            count: number;
            radius: number;
            pressure: number;
            flowRate: number;
            color: string;
            equipment: any; // เพิ่ม equipment data
        }>();

        zoneSprinklers.forEach((s: any) => {
            const name = s.type.nameTH || s.type.nameEN || 'Sprinkler';
            const key = name;
            
            const existing = typeGroups.get(key);
            
            if (existing) {
                existing.count += 1;
            } else {
                // หา matching equipment จาก analyzedSprinklers
                const matchingEquipment = analyzedSprinklers.find((eq: any) => {
                    const eqName = eq.name || '';
                    const avgFlow = Array.isArray(eq.waterVolumeLitersPerMinute)
                        ? (eq.waterVolumeLitersPerMinute[0] + eq.waterVolumeLitersPerMinute[1]) / 2
                        : eq.waterVolumeLitersPerMinute || 0;
                    const avgPressure = Array.isArray(eq.pressureBar)
                        ? (eq.pressureBar[0] + eq.pressureBar[1]) / 2
                        : eq.pressureBar || 0;
                    
                    return eqName === name || 
                           (Math.abs(avgFlow - s.type.flowRate) < 0.5 &&
                            Math.abs(avgPressure - s.type.pressure) < 0.5);
                });

                typeGroups.set(key, {
                    name: name,
                    count: 1,
                    radius: s.type.radius,
                    pressure: s.type.pressure,
                    flowRate: s.type.flowRate,
                    color: s.type.color || '#33CCFF',
                    equipment: matchingEquipment || null,
                });
            }
        });

        return Array.from(typeGroups.values()).sort((a, b) => b.count - a.count);
    }, [projectMode, gardenData, activeZone, analyzedSprinklers]);

    const addSprinklerItem = () => {
        setSelectedCategory(null);
        setSelectedEquipment(null);
        setEquipments([]);
        setShowAddItemModal(true);
    };

    const handleCategoryChange = (categoryId: number) => {
        setSelectedCategory(categoryId);
        setSelectedEquipment(null);
        if (categoryId) {
            fetchEquipmentsByCategory(categoryId);
        } else {
            setEquipments([]);
        }
    };

    const handleAddItemConfirm = () => {
        if (!selectedCategory || !selectedEquipment || !inputRef.current || !onInputChangeRef.current) {
            return;
        }

        const selectedEquipmentData = equipments.find((eq) => eq.id === selectedEquipment);
        if (!selectedEquipmentData) {
            return;
        }

        const selectedCategoryData = categories.find((cat) => cat.id === selectedCategory);
        const isPipe =
            selectedCategoryData?.name?.toLowerCase() === 'pipe' ||
            selectedCategoryData?.name?.toLowerCase().includes('pipe');

        const newItem: SprinklerSetItem = {
            id: Date.now(),
            group_id:
                typeof inputRef.current.sprinklerEquipmentSet?.selectedGroupId === 'string'
                    ? parseInt(inputRef.current.sprinklerEquipmentSet.selectedGroupId)
                    : inputRef.current.sprinklerEquipmentSet?.selectedGroupId || 0,
            equipment_id: selectedEquipmentData.id,
            equipment: {
                id: selectedEquipmentData.id,
                name: selectedEquipmentData.name || selectedEquipmentData.product_code || '',
                product_code: selectedEquipmentData.product_code || '',
                price: selectedEquipmentData.price || 0,
                image: selectedEquipmentData.image,
                brand: selectedEquipmentData.brand,
                category: {
                    id: selectedCategory,
                    name: selectedCategoryData?.name || '',
                    display_name: selectedCategoryData?.display_name || '',
                },
            },
            quantity: isPipe ? 1.0 : 1,
            unit_price: selectedEquipmentData.price || 0,
            total_price: selectedEquipmentData.price || 0,
            sort_order: selectedSprinklerItems.length,
        };

        const updatedItems = [...selectedSprinklerItems, newItem];
        setSelectedSprinklerItems(updatedItems);
        onInputChangeRef.current({
            ...inputRef.current,
            sprinklerEquipmentSet: {
                selectedGroupId: inputRef.current.sprinklerEquipmentSet?.selectedGroupId || null,
                selectedItems: updatedItems,
            },
        });

        setShowAddItemModal(false);
    };

    const removeSprinklerItem = (itemIndex: number) => {
        if (!inputRef.current || !onInputChangeRef.current) return;

        const updatedItems = selectedSprinklerItems.filter((_, index) => index !== itemIndex);
        setSelectedSprinklerItems(updatedItems);
        onInputChangeRef.current({
            ...inputRef.current,
            sprinklerEquipmentSet: {
                selectedGroupId: inputRef.current.sprinklerEquipmentSet?.selectedGroupId || null,
                selectedItems: updatedItems,
            },
        });
    };

    return (
        <div className="rounded-lg bg-gray-700 p-6">
            <h3 className="mb-4 text-2xl font-bold text-green-400">
                {t('เลือก')}
                {projectMode === 'garden' ? t('หัวฉีด') : t('สปริงเกอร์')}
                {activeZone && (
                    <span className="ml-2 text-lg text-red-500 font-bold underline">
                        - สำหรับ {activeZone.name.split(' (')[0]}
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
                                };
                            } else {
                                sprinklerConfig = {
                                    flowRatePerMinute: 6.0,
                                    pressureBar: 2.5,
                                };
                            }
                        } else {
                            sprinklerConfig = {
                                flowRatePerMinute: 6.0,
                                pressureBar: 2.5,
                            };
                        }
                    } else if (projectMode === 'greenhouse') {
                        try {
                            const storedData = localStorage.getItem('greenhousePlanningData');
                            if (storedData) {
                                const summaryData = JSON.parse(storedData);

                                const flowRate = summaryData?.sprinklerFlowRate || 10.0;
                                const pressureBar = summaryData?.sprinklerPressure || 2.0;

                                sprinklerConfig = {
                                    flowRatePerMinute: flowRate,
                                    pressureBar: pressureBar,
                                };
                            } else {
                                sprinklerConfig = {
                                    flowRatePerMinute: 10.0,
                                    pressureBar: 2.0,
                                };
                            }
                        } catch (error) {
                            sprinklerConfig = {
                                flowRatePerMinute: 10.0,
                                pressureBar: 2.0,
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
                            };
                        } else {
                            sprinklerConfig = {
                                flowRatePerMinute: 0,
                                pressureBar: 0,
                            };
                        }
                    }
                    return sprinklerConfig ? (
                        <>
                            {/* ซ่อนข้อมูล "สปริงเกอร์ที่ต้องการ" สำหรับ garden mode */}
                            {projectMode !== 'garden' && (
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
                                    </div>
                                </div>
                            )}
                            
                            {/* แสดงหัวฉีดที่เลือกไว้จาก Planner สำหรับ garden mode - แสดงรูปและสเปคครบถ้วน */}
                            {projectMode === 'garden' && gardenSprinklersByType.length > 0 && (
                                <div className="rounded border border-purple-700/50 bg-gradient-to-r from-purple-900/30 to-pink-900/30 p-4">
                                    <h4 className="mb-4 flex items-center gap-2 text-xl font-bold text-purple-300">
                                        💧 {t('หัวฉีดที่เลือกไว้จาก Planner')}
                                    </h4>
                                    <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                                        {gardenSprinklersByType.map((type, index) => (
                                            <div
                                                key={index}
                                                className="rounded-lg border border-purple-600/50 bg-gray-800/70 p-4 shadow-lg"
                                            >
                                                {/* Header with color dot and name */}
                                                <div className="mb-3 flex items-center gap-3">
                                                    <div
                                                        className="h-6 w-6 shrink-0 rounded-full border-2 border-white/50 shadow-lg"
                                                        style={{ backgroundColor: type.color }}
                                                    />
                                                    <div className="flex-1">
                                                        <div className="text-lg font-bold text-white">
                                                            {type.name}
                                                        </div>
                                                        {type.equipment?.product_code && (
                                                            <div className="text-xs text-gray-400">
                                                                รหัส: {type.equipment.product_code}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="rounded-full bg-orange-600 px-4 py-2 text-center">
                                                        <div className="text-2xl font-bold text-white">
                                                            {type.count}
                                                        </div>
                                                        <div className="text-xs text-orange-200">{t('หัว')}</div>
                                                    </div>
                                                </div>

                                                {/* Image */}
                                                {type.equipment?.image && (
                                                    <div className="mb-3">
                                                        <img
                                                            src={type.equipment.image}
                                                            alt={type.name}
                                                            className="h-32 w-full rounded-lg border border-purple-500/30 object-contain bg-gray-900/50 p-2"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                )}

                                                {/* Specs */}
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div className="rounded bg-gray-900/50 p-2">
                                                        <div className="text-xs text-gray-400">{t('รัศมี')}</div>
                                                        <div className="font-semibold text-cyan-300">
                                                            {type.radius.toFixed(1)} {t('ม.')}
                                                        </div>
                                                    </div>
                                                    <div className="rounded bg-gray-900/50 p-2">
                                                        <div className="text-xs text-gray-400">{t('แรงดัน')}</div>
                                                        <div className="font-semibold text-green-300">
                                                            {type.pressure.toFixed(1)} {t('บาร์')}
                                                        </div>
                                                    </div>
                                                    <div className="rounded bg-gray-900/50 p-2 col-span-2">
                                                        <div className="text-xs text-gray-400">{t('อัตราการไหล')}</div>
                                                        <div className="font-semibold text-blue-300">
                                                            {type.flowRate.toFixed(1)} {t('ลิตร/นาที')}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Brand & Price */}
                                                {type.equipment && (
                                                    <div className="mt-3 space-y-1 border-t border-purple-600/30 pt-3 text-sm">
                                                        {type.equipment.brand && (
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-400">{t('ยี่ห้อ')}:</span>
                                                                <span className="text-white">{type.equipment.brand}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-400">{t('ราคา/หัว')}:</span>
                                                            <span className="font-semibold text-yellow-400">
                                                                {type.equipment.price?.toLocaleString() || 0} {t('บาท')}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between border-t border-gray-700 pt-1">
                                                            <span className="text-gray-300">{t('ราคารวม')}:</span>
                                                            <span className="text-lg font-bold text-green-400">
                                                                {((type.equipment.price || 0) * type.count).toLocaleString()} {t('บาท')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 rounded-lg bg-blue-900/40 p-3 text-sm text-blue-200">
                                        <div className="mb-1 font-semibold text-blue-300">💡 {t('หมายเหตุ')}:</div>
                                        <div>• {t('รายการนี้แสดงหัวฉีดที่วางไว้ใน Planner จริงๆ')}</div>
                                        <div>• {t('ระบบจะใช้ข้อมูลนี้ในการคำนวณราคาและสรุปต้นทุน')}</div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null;
                })()}

            {/* ซ่อน dropdown สำหรับ garden mode */}
            {projectMode !== 'garden' && (
                <SearchableDropdown
                value={(() => {
                    // Try productCode first, then product_code, then id
                    if (selectedSprinkler) {
                        return selectedSprinkler.productCode || selectedSprinkler.product_code || selectedSprinkler.id || '';
                    }
                    return '';
                })()}
                onChange={(value) => {
                    // Find by productCode, product_code, or id
                    const selected = analyzedSprinklers.find(
                        (s) => s.id === value || s.productCode === value || (s as any).product_code === value
                    );

                    if (
                        selected &&
                        (projectMode === 'horticulture' ||
                            (projectMode as string) === 'garden' ||
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
                    // ✅ Ensure selected sprinkler is always in options
                    const selectedInOptions = selectedSprinkler && sortedSprinklers.find(
                        (s) => s.id === selectedSprinkler.id || 
                               s.productCode === selectedSprinkler.productCode ||
                               (s as any).product_code === selectedSprinkler.productCode ||
                               s.productCode === selectedSprinkler.product_code ||
                               (s as any).product_code === selectedSprinkler.product_code
                    );
                    const selectedNotInOptions = selectedSprinkler && !selectedInOptions;
                    
                    // ✅ If selected sprinkler is not in filtered options, add it from analyzedSprinklers
                    const selectedFromAnalyzed = selectedNotInOptions 
                        ? analyzedSprinklers.find(
                            (s) => s.id === selectedSprinkler.id || 
                                   s.productCode === selectedSprinkler.productCode ||
                                   (s as any).product_code === selectedSprinkler.productCode ||
                                   s.productCode === selectedSprinkler.product_code ||
                                   (s as any).product_code === selectedSprinkler.product_code
                          )
                        : null;
                    
                    const options = [
                        {
                            value: '',
                            label: `-- ${t('เลือก')} ${(projectMode as string) === 'garden' ? t('หัวฉีด') : t('สปริงเกอร์')}${activeZone ? ` ${t('สำหรับ')} ${activeZone.name.split(' (')[0]}` : ''} --`,
                        },
                        // ✅ Add selected sprinkler first if it's not in filtered list
                        ...(selectedFromAnalyzed ? [{
                            value: selectedFromAnalyzed.productCode || (selectedFromAnalyzed as any).product_code || selectedFromAnalyzed.id,
                            label: `${selectedFromAnalyzed.productCode || (selectedFromAnalyzed as any).product_code || selectedFromAnalyzed.id || ''} - ${selectedFromAnalyzed.name} - ${selectedFromAnalyzed.price} ${t('บาท')} | ${selectedFromAnalyzed.brand || selectedFromAnalyzed.brand_name || '-'}`,
                            searchableText: `${selectedFromAnalyzed.productCode || (selectedFromAnalyzed as any).product_code || selectedFromAnalyzed.id || ''} ${selectedFromAnalyzed.name || ''} ${selectedFromAnalyzed.brand || selectedFromAnalyzed.brand_name || ''} ${formatRangeValue(selectedFromAnalyzed.radiusMeters || '')} รัศมี`,
                            image: selectedFromAnalyzed.image,
                            productCode: selectedFromAnalyzed.productCode || (selectedFromAnalyzed as any).product_code || selectedFromAnalyzed.id,
                            name: selectedFromAnalyzed.name,
                            brand: selectedFromAnalyzed.brand || selectedFromAnalyzed.brand_name,
                            price: selectedFromAnalyzed.price,
                            unit: t('บาท'),
                        }] : []),
                        ...sortedSprinklers.map((sprinkler) => {
                            // ✅ Normalize productCode - use productCode, product_code, or id
                            const productCode = sprinkler.productCode || (sprinkler as any).product_code || sprinkler.id;
                            const option = {
                                value: productCode,
                                label: `${productCode || ''} - ${sprinkler.name} - ${sprinkler.price} ${t('บาท')} | ${sprinkler.brand || sprinkler.brand_name || '-'}`,
                                searchableText: `${productCode || ''} ${sprinkler.name || ''} ${sprinkler.brand || sprinkler.brand_name || ''} ${formatRangeValue(sprinkler.radiusMeters || '')} รัศมี`,
                                image: sprinkler.image,
                                productCode: productCode,
                                name: sprinkler.name,
                                brand: sprinkler.brand || sprinkler.brand_name,
                                price: sprinkler.price,
                                unit: t('บาท'),
                            };
                            
                            
                            return option;
                        }),
                    ];
                    return options;
                })()}
                placeholder={`-- ${t('เลือก')} ${(projectMode as string) === 'garden' ? t('หัวฉีด') : t('สปริงเกอร์')}${activeZone ? ` ${t('สำหรับ')} ${activeZone.name.split(' (')[0]}` : ''} --`}
                searchPlaceholder={
                    t('พิมพ์เพื่อค้นหา') +
                    ((projectMode as string) === 'garden' ? t('หัวฉีด') : t('สปริงเกอร์')) +
                    ' (ชื่อ, รหัสสินค้า, แบรนด์, รัศมี)...'
                }
                className="mb-4 w-full"
            />
            )}

            {/* ซ่อนข้อมูลสปริงเกอร์ที่เลือกสำหรับ garden mode */}
            {(projectMode as string) !== 'garden' && selectedSprinkler && selectedAnalyzed && (
                <div className="rounded-lg bg-gray-600 p-4 shadow-lg">
                    {/* Header */}
                    <div className="mb-4 border-b border-gray-500 pb-3">
                        <h4 className="text-xl font-bold text-white">
                            {selectedSprinkler.name}
                        </h4>
                    </div>
                    {/* Debug: Uncomment to check video_link */}
                    {/* {console.log('selectedSprinkler video_link:', selectedSprinkler.video_link || selectedSprinkler.videoLink)} */}

                    {/* Main Content - Shopee Style Layout */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {/* Left Side - Large Image & Video */}
                        <div className="space-y-3">
                            {/* Main Image */}
                            <div className="relative flex items-center justify-center rounded-lg bg-white p-3 shadow-md min-h-[300px] min-w-0" style={{ minHeight: 300, maxHeight: 350 }}>
                                {selectedSprinkler.image ? (
                                    <img
                                        src={selectedSprinkler.image}
                                        alt={selectedSprinkler.name}
                                        className="h-auto max-h-[350px] w-full cursor-pointer rounded-lg object-contain transition-transform hover:scale-105"
                                        style={{ maxHeight: 350, minHeight: 300 }}
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
                                    <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-gray-200 text-gray-500">
                                        <div className="text-center">
                                            <svg
                                                className="mx-auto h-16 w-16 text-gray-400"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                />
                                            </svg>
                                            <p className="mt-2 text-xs">{t('ไม่มีรูป')}</p>
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() =>
                                        openImageModal(
                                            selectedSprinkler.image,
                                            selectedSprinkler.name
                                        )
                                    }
                                    className="absolute bottom-3 right-3 rounded-full bg-blue-600 px-3 py-1.5 text-xs text-white shadow-lg transition-colors hover:bg-blue-700"
                                    title={t('ดูรูปขนาดใหญ่')}
                                >
                                    🔍 {t('ขยาย')}
                                </button>
                            </div>

                            {/* Video Section */}
                            {(() => {
                                const videoLink = selectedSprinkler?.video_link || selectedSprinkler?.videoLink;
                                const embedUrl = videoLink ? convertVideoLinkToEmbed(videoLink) : null;
                                
                                if (embedUrl) {
                                    return (
                                        <div
                                            className="rounded-lg bg-gray-700 p-3 shadow-md mt-3 flex flex-col"
                                            style={{ minHeight: 350, maxHeight: 350, height: 350 }}
                                        >
                                            <h5 className="mb-2 text-sm font-semibold text-white">
                                                🎥 {t('วิดีโอสินค้า')}
                                            </h5>
                                            <div
                                                className="relative w-full flex-1 overflow-hidden rounded-lg bg-black flex items-center justify-center"
                                                style={{ minHeight: 300, maxHeight: 300, height: 300 }}
                                            >
                                                <iframe
                                                    src={embedUrl}
                                                    className="absolute inset-0 w-full h-full"
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                    }}
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                    title={selectedSprinkler?.name || 'Video'}
                                                />
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        {/* Right Side - Product Details */}
                        <div className="space-y-4">
                            {/* Price Section */}
                            <div className="rounded-lg bg-gradient-to-r from-green-900/50 to-emerald-900/50 p-4">
                            <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">{t('ราคาต่อหัว')}</span>
                                    <span className="text-base font-bold text-gray-50">
                                        ฿{selectedSprinkler.price?.toLocaleString()}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-300">{t('จำนวนที่ต้องใช้:')}</span>
                                        <span className="text-base font-semibold text-white">
                                            {(() => {
                                                // หาจำนวนหัวฉีดของโซนนี้
                                                let zoneSprinklerCount = 0;
                                                
                                                if (activeZone && input) {
                                                    // ใช้ input.totalTrees สำหรับโซนนี้
                                                    zoneSprinklerCount = input.totalTrees || 0;
                                                    
                                                    if (projectMode === 'horticulture' && zoneSprinklerCount > 0) {
                                                        const config = loadSprinklerConfig();
                                                        const sprinklersPerTree = config?.sprinklersPerTree || 1;
                                                        zoneSprinklerCount = zoneSprinklerCount * sprinklersPerTree;
                                                    }
                                                } else if ((projectMode as string) === 'garden' && gardenStats && activeZone) {
                                                    const zone = gardenStats.zones.find((z: any) => z.zoneId === activeZone.id);
                                                    if (zone) {
                                                        zoneSprinklerCount = zone.sprinklerCount || 0;
                                                    }
                                                } else if (projectMode === 'field-crop' && fieldCropData && activeZone) {
                                                    const zone = fieldCropData.zones?.info?.find((z: any) => z.id === activeZone.id);
                                                    if (zone) {
                                                        const zoneSummary = fieldCropData.zoneSummaries?.[activeZone.id];
                                                        if (zoneSummary?.totalIrrigationPoints && zoneSummary.totalIrrigationPoints > 0) {
                                                            zoneSprinklerCount = zoneSummary.totalIrrigationPoints;
                                                        } else if (zoneSummary?.sprinklerCount && zoneSummary.sprinklerCount > 0) {
                                                            zoneSprinklerCount = zoneSummary.sprinklerCount;
                                                        } else {
                                                            zoneSprinklerCount = zone.sprinklerCount || 0;
                                                        }
                                                    }
                                                } else if (projectMode === 'greenhouse' && greenhouseData && activeZone) {
                                                    const plot = greenhouseData.summary?.plotStats?.find((p: any) => p.plotId === activeZone.id);
                                                    if (plot) {
                                                        zoneSprinklerCount = plot.equipmentCount?.sprinklers || plot.production?.totalPlants || 0;
                                                    }
                                                } else {
                                                    // Fallback: ใช้ results.totalSprinklers
                                                    zoneSprinklerCount = results.totalSprinklers || 0;
                                                    if (projectMode === 'horticulture' && zoneSprinklerCount > 0) {
                                                        const config = loadSprinklerConfig();
                                                        const sprinklersPerTree = config?.sprinklersPerTree || 1;
                                                        zoneSprinklerCount = zoneSprinklerCount * sprinklersPerTree;
                                                    }
                                                }
                                                
                                                return zoneSprinklerCount.toLocaleString();
                                            })()}{' '}
                                            {t('หัว')}
                                            {activeZone && (
                                                <span className="ml-1 text-xs text-gray-400">
                                                    ({t('โซนนี้')})
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-gray-600 pt-2">
                                        <span className="text-base font-semibold text-gray-300">
                                            {t('ราคารวม:')}
                                        </span>
                                        <span className="text-xl font-bold text-green-300">
                                            ฿
                                            {(() => {
                                                // หาจำนวนหัวฉีดของโซนนี้
                                                let zoneSprinklerCount = 0;
                                                
                                                if (activeZone && input) {
                                                    // ใช้ input.totalTrees สำหรับโซนนี้
                                                    zoneSprinklerCount = input.totalTrees || 0;
                                                    
                                                    if (projectMode === 'horticulture' && zoneSprinklerCount > 0) {
                                                        const config = loadSprinklerConfig();
                                                        const sprinklersPerTree = config?.sprinklersPerTree || 1;
                                                        zoneSprinklerCount = zoneSprinklerCount * sprinklersPerTree;
                                                    }
                                                } else if ((projectMode as string) === 'garden' && gardenStats && activeZone) {
                                                    const zone = gardenStats.zones.find((z: any) => z.zoneId === activeZone.id);
                                                    if (zone) {
                                                        zoneSprinklerCount = zone.sprinklerCount || 0;
                                                    }
                                                } else if (projectMode === 'field-crop' && fieldCropData && activeZone) {
                                                    const zone = fieldCropData.zones?.info?.find((z: any) => z.id === activeZone.id);
                                                    if (zone) {
                                                        const zoneSummary = fieldCropData.zoneSummaries?.[activeZone.id];
                                                        if (zoneSummary?.totalIrrigationPoints && zoneSummary.totalIrrigationPoints > 0) {
                                                            zoneSprinklerCount = zoneSummary.totalIrrigationPoints;
                                                        } else if (zoneSummary?.sprinklerCount && zoneSummary.sprinklerCount > 0) {
                                                            zoneSprinklerCount = zoneSummary.sprinklerCount;
                                                        } else {
                                                            zoneSprinklerCount = zone.sprinklerCount || 0;
                                                        }
                                                    }
                                                } else if (projectMode === 'greenhouse' && greenhouseData && activeZone) {
                                                    const plot = greenhouseData.summary?.plotStats?.find((p: any) => p.plotId === activeZone.id);
                                                    if (plot) {
                                                        zoneSprinklerCount = plot.equipmentCount?.sprinklers || plot.production?.totalPlants || 0;
                                                    }
                                                } else {
                                                    // Fallback: ใช้ results.totalSprinklers
                                                    zoneSprinklerCount = results.totalSprinklers || 0;
                                                    if (projectMode === 'horticulture' && zoneSprinklerCount > 0) {
                                                        const config = loadSprinklerConfig();
                                                        const sprinklersPerTree = config?.sprinklersPerTree || 1;
                                                        zoneSprinklerCount = zoneSprinklerCount * sprinklersPerTree;
                                                    }
                                                }
                                                
                                                return (
                                                    selectedSprinkler.price * zoneSprinklerCount
                                                ).toLocaleString();
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Product Info */}
                            <div className="rounded-lg bg-gray-700 p-4">
                                <h5 className="mb-3 text-base font-semibold text-white">
                                    {t('ข้อมูลสินค้า')}
                                </h5>
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('รหัสสินค้า:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {selectedSprinkler.productCode ||
                                                selectedSprinkler.product_code}
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('แบรนด์:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {selectedSprinkler.brand ||
                                                selectedSprinkler.brand_name ||
                                                '-'}
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('อัตราการไหล:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {formatRangeValue(
                                                selectedSprinkler.waterVolumeLitersPerMinute
                                            )}{' '}
                                            {t('LPM')}
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between border-b border-gray-600 pb-1.5 text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('รัศมี:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {formatRangeValue(selectedSprinkler.radiusMeters)}{' '}
                                            {t('เมตร')}
                                        </span>
                                    </div>
                                    <div className="flex items-start justify-between text-sm">
                                        <span className="font-medium text-gray-400">
                                            {t('แรงดัน:')}
                                        </span>
                                        <span className="text-right text-white">
                                            {formatRangeValue(selectedSprinkler.pressureBar)}{' '}
                                            {t('บาร์')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            {selectedSprinkler.description && (
                                <div className="rounded-lg bg-gray-700 p-4">
                                    <h5 className="mb-2 text-base font-semibold text-white">
                                        {t('รายละเอียดสินค้า')}
                                    </h5>
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                        {selectedSprinkler.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ท่อเสริมต่อหัวสปริงเกอร์ */}
            {input && onInputChange && (
                <div className="mt-6 rounded-lg bg-blue-600 p-3">
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-white">
                            🔧 {t('ท่อเสริมต่อหัวสปริงเกอร์')}
                        </h4>
                        {/* Checkbox to apply to all zones */}
                        <label className="flex items-center gap-2 cursor-pointer bg-white/10 hover:bg-white/20 rounded px-3 py-1.5 transition-colors">
                            <input
                                type="checkbox"
                                checked={applyEquipmentToAllZones}
                                onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    setApplyEquipmentToAllZones(isChecked);
                                    
                                    // If checkbox is checked and there's already selected equipment, apply to all zones immediately
                                    if (isChecked && input?.sprinklerEquipmentSet?.selectedGroupId) {
                                        applyEquipmentSetToAllZones(
                                            input.sprinklerEquipmentSet.selectedGroupId,
                                            input.sprinklerEquipmentSet.selectedItems || []
                                        );
                                    }
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-white font-medium whitespace-nowrap">
                                {t('ใช้กับทุกโซน')}
                            </span>
                        </label>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-white">
                                {t('เลือกชุดอุปกรณ์')}
                            </label>
                            {loadingSprinklerGroups ? (
                                <div className="flex w-full items-center justify-center rounded border border-gray-500 bg-white p-2 text-gray-500">
                                    {t('กำลังโหลด...')}
                                </div>
                            ) : (
                                <SearchableDropdown
                                    value={input.sprinklerEquipmentSet?.selectedGroupId || ''}
                                    onChange={(value) => {
                                        handleSprinklerGroupChange(String(value));
                                    }}
                                    options={[
                                        {
                                            value: '',
                                            label: `-- ${t('เลือกชุดอุปกรณ์')} --`,
                                        },
                                        ...sprinklerGroups.map((group, index) => {
                                            const groupName = group.name || `${t('กลุ่มที่')} ${index + 1}`;
                                            return {
                                                value: group.id,
                                                label: `${groupName} - ${group.total_price?.toLocaleString()} ${t('บาท')}`,
                                                searchableText: `${groupName} ${t('กลุ่มที่')} ${index + 1} ${group.total_price || 0}`,
                                                image: group.image,
                                                name: groupName,
                                                price: group.total_price,
                                                unit: t('บาท'),
                                            };
                                        }),
                                    ]}
                                    placeholder={`-- ${t('เลือกชุดอุปกรณ์')} --`}
                                    searchPlaceholder={t('พิมพ์เพื่อค้นหาชื่อชุดอุปกรณ์...')}
                                    className="w-full"
                                />
                            )}
                        </div>

                        {selectedSprinklerItems.length > 0 && (
                            <div className="mt-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <h5 className="text-sm font-medium text-green-100">
                                            {t('รายการอุปกรณ์ในชุด')} (
                                            {selectedSprinklerItems.length} {t('รายการ')})
                                        </h5>
                                        {(() => {
                                            const zoneSprinklerCount = getZoneSprinklerCount();
                                            
                                            const totalGroupPrice = selectedSprinklerItems.reduce((sum, item) => {
                                                const quantityPerHead = item.quantity || 0;
                                                const totalQuantity = quantityPerHead * zoneSprinklerCount;
                                                const itemTotalPrice = totalQuantity * (item.unit_price || 0);
                                                return sum + itemTotalPrice;
                                            }, 0);
                                            
                                            return (
                                                <span className="text-sm font-bold text-yellow-300">
                                                    | {t('ราคารวม')}: ฿{totalGroupPrice.toLocaleString()} {t('บาท')}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addSprinklerItem}
                                        className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                                    >
                                        + {t('เพิ่มรายการ')}
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-12 p-2 rounded-lg bg-gray-700">
                                    {/* Column 1: Group Image (5/12) */}
                                    <div className="md:col-span-4 flex items-center justify-center">
                                        {(() => {
                                            const selectedGroup = sprinklerGroups.find(
                                                (g) => g.id == input.sprinklerEquipmentSet?.selectedGroupId
                                            );
                                            return selectedGroup?.image ? (
                                                <div className="flex justify-center w-full">
                                                    {(() => {
                                                        const groupIndex = sprinklerGroups.findIndex((g) => g.id == selectedGroup.id);
                                                        const groupName = selectedGroup.name || `${t('กลุ่มที่')} ${groupIndex + 1}`;
                                                        return (
                                                            <img
                                                                src={selectedGroup.image}
                                                                alt={groupName}
                                                                className="h-auto w-full max-w-xs cursor-pointer rounded-lg border border-gray-500 object-contain transition-opacity hover:border-blue-400 hover:opacity-80"
                                                                onClick={() =>
                                                                    openImageModal(
                                                                        selectedGroup.image!,
                                                                        groupName
                                                                    )
                                                                }
                                                                title={t('คลิกเพื่อดูรูปขนาดใหญ่')}
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                }}
                                                            />
                                                        );
                                                    })()}
                                                </div>
                                            ) : (
                                                <div className="flex h-64 w-full max-w-xs items-center justify-center rounded-lg border border-gray-500 bg-gray-500">
                                                    <span className="text-center text-sm text-gray-300">
                                                        {t('ไม่มีรูปกลุ่ม')}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Column 2: Equipment List (7/12) */}
                                    <div className="md:col-span-8 max-h-80 overflow-y-auto">
                                        <div className="space-y-2">
                                            {selectedSprinklerItems.map((item, index) => (
                                                <div
                                                    key={`${item.id}-${index}`}
                                                    className="rounded border border-gray-600 bg-gray-600 px-2 py-1 flex items-center gap-2"
                                                    style={{ minHeight: 56 }} // shrink row height
                                                >
                                                    {/* Equipment Image */}
                                                    <div className="flex-shrink-0 flex items-center justify-center">
                                                        {item.equipment.image ? (
                                                            <img
                                                                src={item.equipment.image}
                                                                alt={
                                                                    item.equipment.name ||
                                                                    item.equipment.product_code
                                                                }
                                                                className="h-10 w-10 cursor-pointer rounded border border-gray-500 object-cover transition-opacity hover:border-blue-400 hover:opacity-80"
                                                                onClick={() =>
                                                                    openImageModal(
                                                                        item.equipment.image!,
                                                                        item.equipment.name ||
                                                                            item.equipment.product_code ||
                                                                            'อุปกรณ์'
                                                                    )
                                                                }
                                                                title={t('คลิกเพื่อดูรูปขนาดใหญ่')}
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="flex h-10 w-10 items-center justify-center rounded border border-gray-500 bg-gray-500">
                                                                <span className="text-center text-[10px] text-gray-300">
                                                                    {t('ไม่มีรูป')}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Equipment Details on 1 line, shrink font, plus quantity & price & remove button */}
                                                    <div className="flex-1 flex flex-wrap items-center gap-2 min-w-0 justify-between">
                                                        {/* Main Info */}
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-medium text-xs text-white truncate">
                                                                {item.equipment.name || item.equipment.product_code}
                                                            </span>
                                                            {item.equipment.brand && (
                                                                <span className="text-[10px] text-gray-400 truncate max-w-[7rem]">
                                                                    {t('ยี่ห้อ')}: {item.equipment.brand}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {/* Right aligned controls: Quantity, Price, Remove */}
                                                        <div className="flex items-center gap-2 ml-auto">
                                                            {/* Quantity Input */}
                                                            <label className="text-[12px] text-gray-300 ml-2 whitespace-nowrap">
                                                                {isPipeEquipment(item)
                                                                    ? t('ความยาว (เมตร)')
                                                                    : t('จำนวน')}
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min={isPipeEquipment(item) ? '0.1' : '1'}
                                                                step={isPipeEquipment(item) ? '0.1' : '1'}
                                                                value={(() => {
                                                                    const quantityPerHead = item.quantity || 0;
                                                                    const zoneSprinklerCount = getZoneSprinklerCount();
                                                                    const totalQuantity = quantityPerHead * zoneSprinklerCount;
                                                                    return isPipeEquipment(item) 
                                                                        ? totalQuantity.toFixed(1)
                                                                        : Math.round(totalQuantity);
                                                                })()}
                                                                onChange={(e) => {
                                                                    const inputValue = isPipeEquipment(item)
                                                                        ? parseFloat(e.target.value) || 0.1
                                                                        : parseInt(e.target.value) || 1;
                                                                    
                                                                    const zoneSprinklerCount = getZoneSprinklerCount();
                                                                    
                                                                    // Divide by zone sprinkler count to get quantity per head
                                                                    const quantityPerHead = inputValue / zoneSprinklerCount;
                                                                    
                                                                    updateSprinklerItem(
                                                                        index,
                                                                        'quantity',
                                                                        quantityPerHead
                                                                    );
                                                                }}
                                                                className="w-20 h-7 rounded border border-gray-500 bg-gray-700 px-1 py-0 text-xs text-white focus:border-blue-400 text-right"
                                                            />

                                                            {/* Price */}
                                                            <span className="text-xs font-semibold text-green-400 whitespace-nowrap">
                                                                ฿
                                                                {(() => {
                                                                    const quantityPerHead = item.quantity || 0;
                                                                    const zoneSprinklerCount = getZoneSprinklerCount();
                                                                    const totalQuantity = quantityPerHead * zoneSprinklerCount;
                                                                    const totalPrice = totalQuantity * (item.unit_price || 0);
                                                                    
                                                                    return totalPrice.toLocaleString();
                                                                })()}
                                                            </span>

                                                            {/* Remove button */}
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSprinklerItem(index)}
                                                                className="ml-2 rounded bg-red-600 px-2 py-0.5 text-[10px] text-white hover:bg-red-700"
                                                                style={{ lineHeight: "1.1" }}
                                                            >
                                                                {t('ลบ')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showAddItemModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md rounded-lg bg-gray-800 p-6 shadow-xl">
                        <h3 className="mb-4 text-lg font-semibold text-white">
                            {t('เพิ่มรายการใหม่')}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-300">
                                    {t('เลือกหมวดหมู่')}
                                </label>
                                <select
                                    value={selectedCategory || ''}
                                    onChange={(e) =>
                                        handleCategoryChange(parseInt(e.target.value) || 0)
                                    }
                                    className="w-full rounded border border-gray-500 bg-gray-700 p-2 text-white focus:border-blue-400"
                                >
                                    <option value="">{t('-- เลือกหมวดหมู่ --')}</option>
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.display_name || category.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-300">
                                    {t('เลือกสินค้า')}
                                </label>
                                {!selectedCategory || loadingEquipments ? (
                                    <div className="w-full rounded border border-gray-500 bg-gray-700 p-2 text-gray-400">
                                        {loadingEquipments
                                            ? t('กำลังโหลด...')
                                            : t('-- เลือกหมวดหมู่ก่อน --')}
                                    </div>
                                ) : (
                                    (() => {
                                        const mappedOptions = equipments.map((eq) => {
                                            let label = eq.name || eq.product_code;
                                            if (eq.name && eq.product_code) {
                                                label = `${eq.name} (${eq.product_code})`;
                                            }

                                            const attributes: string[] = [];
                                            if (eq.brand) attributes.push(`ยี่ห้อ: ${eq.brand}`);
                                            if (eq.waterVolumeLitersPerMinute)
                                                attributes.push(
                                                    `ปริมาณน้ำ: ${eq.waterVolumeLitersPerMinute} ลิตร/นาที`
                                                );
                                            if (eq.radiusMeters)
                                                attributes.push(`รัศมี: ${eq.radiusMeters} เมตร`);
                                            if (eq.pressureBar)
                                                attributes.push(`แรงดัน: ${eq.pressureBar} บาร์`);
                                            if (eq.powerHP)
                                                attributes.push(`กำลัง: ${eq.powerHP} แรงม้า`);
                                            if (eq.powerKW)
                                                attributes.push(`กำลัง: ${eq.powerKW} กิโลวัตต์`);
                                            if (eq.inlet_size_inch)
                                                attributes.push(
                                                    `ขนาดทางเข้า: ${eq.inlet_size_inch} นิ้ว`
                                                );
                                            if (eq.outlet_size_inch)
                                                attributes.push(
                                                    `ขนาดทางออก: ${eq.outlet_size_inch} นิ้ว`
                                                );
                                            if (eq.pipeType)
                                                attributes.push(`ประเภทท่อ: ${eq.pipeType}`);
                                            if (eq.pn) attributes.push(`PN: ${eq.pn}`);
                                            if (eq.sizeMM)
                                                attributes.push(`ขนาด: ${eq.sizeMM} มม.`);
                                            if (eq.sizeInch)
                                                attributes.push(`ขนาด: ${eq.sizeInch} นิ้ว`);
                                            if (eq.lengthM)
                                                attributes.push(`ความยาว: ${eq.lengthM} เมตร`);

                                            if (attributes.length > 0) {
                                                label += ` - ${attributes.join(', ')}`;
                                            }

                                            return {
                                                value: eq.id,
                                                label: label,
                                                productCode: eq.product_code,
                                                price: eq.price,
                                                image: eq.image,
                                                brand: eq.brand,
                                                name: eq.name,
                                                description: eq.description,
                                                searchableText: `${eq.name || ''} ${eq.product_code || ''} ${eq.brand || ''} ${attributes.join(' ')}`,
                                            };
                                        });

                                        if (mappedOptions.length === 0) {
                                            return (
                                                <div className="w-full rounded border border-gray-500 bg-gray-700 p-2 text-sm text-gray-400">
                                                    {t('ไม่พบอุปกรณ์ในหมวดหมู่นี้')}
                                                </div>
                                            );
                                        }

                                        return (
                                            <SearchableDropdown
                                                options={mappedOptions}
                                                value={selectedEquipment || ''}
                                                onChange={(value) =>
                                                    setSelectedEquipment(
                                                        parseInt(String(value)) || null
                                                    )
                                                }
                                                placeholder={t('พิมพ์เพื่อค้นหาสินค้า...')}
                                                searchPlaceholder={t(
                                                    'พิมพ์เพื่อค้นหาจากชื่อ, รหัสสินค้า, ยี่ห้อ, หรือคุณสมบัติ...'
                                                )}
                                                className="text-sm"
                                            />
                                        );
                                    })()
                                )}
                            </div>

                            {selectedEquipment && (
                                <div className="rounded border border-gray-600 bg-gray-700 p-3">
                                    {(() => {
                                        const equipment = equipments.find(
                                            (eq) => eq.id === selectedEquipment
                                        );
                                        return equipment ? (
                                            <div>
                                                <h4 className="text-sm font-medium text-green-300">
                                                    {t('ตัวอย่างสินค้าที่เลือก')}
                                                </h4>
                                                <p className="text-sm text-white">
                                                    {equipment.name || equipment.product_code}
                                                </p>
                                                {equipment.brand && (
                                                    <p className="text-xs text-gray-400">
                                                        {t('ยี่ห้อ')}: {equipment.brand}
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-400">
                                                    {t('ราคา')}: ฿
                                                    {equipment.price?.toLocaleString()}
                                                </p>
                                            </div>
                                        ) : null;
                                    })()}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setShowAddItemModal(false)}
                                className="rounded bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700"
                            >
                                {t('ยกเลิก')}
                            </button>
                            <button
                                type="button"
                                onClick={handleAddItemConfirm}
                                disabled={!selectedCategory || !selectedEquipment}
                                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-500"
                            >
                                {t('เพิ่มรายการ')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showImageModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                    onClick={closeImageModal}
                >
                    <div
                        className="relative flex h-full w-full items-center justify-center p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={closeImageModal}
                            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                            title={t('ปิด')}
                        >
                            ✕
                        </button>
                        <img
                            src={modalImage.src}
                            alt={modalImage.alt}
                            className="max-h-full max-w-full rounded-lg shadow-2xl object-contain"
                            style={{
                                maxHeight: '90vh',
                                maxWidth: '90vw',
                                width: 'auto',
                                height: 'auto',
                            }}
                        />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                            <p className="inline-block rounded bg-black bg-opacity-50 px-3 py-2 text-sm text-white">
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
