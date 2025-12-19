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

    const inputRef = useRef(input);
    const onInputChangeRef = useRef(onInputChange);

    useEffect(() => {
        inputRef.current = input;
        onInputChangeRef.current = onInputChange;
    }, [input, onInputChange]);

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

                    if (!selectedSprinkler) {
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
            if (gardenStats && activeZone) {
                const currentZone = gardenStats.zones.find((z: any) => z.zoneId === activeZone.id);
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

        const compatibleSprinklers = analyzedSprinklers.filter((sprinkler: any) => {
            const flowMatch = isValueInRange(
                sprinkler.waterVolumeLitersPerMinute,
                flowRatePerMinute
            );

            const pressureMatch = isValueInRange(sprinkler.pressureBar, pressureBar);

            return flowMatch && pressureMatch;
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
            }
        },
        [sprinklerGroups]
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
                    ) : null;
                })()}

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
                            searchableText: `${sprinkler.productCode || ''} ${sprinkler.name || ''} ${sprinkler.brand || sprinkler.brand_name || ''} ${formatRangeValue(sprinkler.radiusMeters || '')} รัศมี`,
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
                    ' (ชื่อ, รหัสสินค้า, แบรนด์, รัศมี)...'
                }
                className="mb-4 w-full"
            />

            {selectedSprinkler && selectedAnalyzed && (
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
                                                if (projectMode === 'horticulture') {
                                                    const config = loadSprinklerConfig();
                                                    const sprinklersPerTree =
                                                        config?.sprinklersPerTree || 1;
                                                    return (
                                                        results.totalSprinklers * sprinklersPerTree
                                                    ).toLocaleString();
                                                }
                                                return results.totalSprinklers.toLocaleString();
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
                                                if (projectMode === 'horticulture') {
                                                    const config = loadSprinklerConfig();
                                                    const sprinklersPerTree =
                                                        config?.sprinklersPerTree || 1;
                                                    return (
                                                        selectedSprinkler.price *
                                                        results.totalSprinklers *
                                                        sprinklersPerTree
                                                    ).toLocaleString();
                                                }
                                                return (
                                                    selectedSprinkler.price *
                                                    results.totalSprinklers
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
                    <h4 className="mb-3 text-lg font-semibold text-white">
                        🔧 {t('ท่อเสริมต่อหัวสปริงเกอร์')}
                    </h4>
                    <div className="space-y-3">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-white">
                                {t('เลือกกลุ่มอุปกรณ์')}
                            </label>
                            <select
                                value={input.sprinklerEquipmentSet?.selectedGroupId || ''}
                                onChange={(e) => handleSprinklerGroupChange(e.target.value)}
                                className="w-full rounded border border-gray-500 bg-white p-2 text-black focus:border-blue-400"
                                disabled={loadingSprinklerGroups}
                            >
                                <option value="">
                                    {loadingSprinklerGroups
                                        ? t('กำลังโหลด...')
                                        : `-- ${t('เลือกกลุ่มอุปกรณ์')} --`}
                                </option>
                                {sprinklerGroups.map((group, index) => (
                                    <option key={group.id} value={group.id}>
                                        {t('กลุ่มที่')} {index + 1} -{' '}
                                        {group.total_price?.toLocaleString()} {t('บาท')}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedSprinklerItems.length > 0 && (
                            <div className="mt-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h5 className="text-sm font-medium text-green-300">
                                        {t('รายการอุปกรณ์ในกลุ่ม')} (
                                        {selectedSprinklerItems.length} {t('รายการ')})
                                    </h5>
                                    <button
                                        type="button"
                                        onClick={addSprinklerItem}
                                        className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                                    >
                                        + {t('เพิ่มรายการ')}
                                    </button>
                                </div>
                                <div className="max-h-48 space-y-2 overflow-y-auto">
                                    {selectedSprinklerItems.map((item, index) => (
                                        <div
                                            key={`${item.id}-${index}`}
                                            className="rounded border border-gray-600 bg-gray-600 p-3"
                                        >
                                            <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                                                <div className="col-span-2 flex items-center justify-center">
                                                    {item.equipment.image ? (
                                                        <img
                                                            src={item.equipment.image}
                                                            alt={
                                                                item.equipment.name ||
                                                                item.equipment.product_code
                                                            }
                                                            className="h-16 w-16 rounded-md border border-gray-500 object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-16 w-16 items-center justify-center rounded-md border border-gray-500 bg-gray-500">
                                                            <span className="text-center text-xs text-gray-300">
                                                                {t('ไม่มีรูป')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="col-span-5">
                                                    <label className="mb-1 block text-xs text-gray-300">
                                                        {t('ชื่อสินค้า')}
                                                    </label>
                                                    <p className="text-sm text-white">
                                                        {item.equipment.name ||
                                                            item.equipment.product_code}
                                                    </p>
                                                    {item.equipment.brand && (
                                                        <p className="text-xs text-gray-400">
                                                            {item.equipment.brand}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="mb-1 block text-xs text-gray-300">
                                                        {isPipeEquipment(item)
                                                            ? t('ความยาว (เมตร)')
                                                            : t('จำนวน')}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={
                                                            isPipeEquipment(item) ? '0.1' : '1'
                                                        }
                                                        step={
                                                            isPipeEquipment(item) ? '0.1' : '1'
                                                        }
                                                        value={item.quantity}
                                                        onChange={(e) =>
                                                            updateSprinklerItem(
                                                                index,
                                                                'quantity',
                                                                isPipeEquipment(item)
                                                                    ? parseFloat(
                                                                          e.target.value
                                                                      ) || 0.1
                                                                    : parseInt(
                                                                          e.target.value
                                                                      ) || 1
                                                            )
                                                        }
                                                        className="w-full rounded border border-gray-500 bg-gray-700 p-1 text-sm text-white focus:border-blue-400"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="mb-1 block text-xs text-gray-300">
                                                        {t('ราคารวม')}
                                                    </label>
                                                    <p className="text-sm text-green-400">
                                                        ฿
                                                        {(
                                                            (item.quantity || 0) *
                                                            (item.unit_price || 0)
                                                        ).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="col-span-1 flex items-center">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeSprinklerItem(index)
                                                        }
                                                        className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                                                    >
                                                        {t('ลบ')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
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
