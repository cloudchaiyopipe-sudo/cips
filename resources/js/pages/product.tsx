/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { IrrigationInput, QuotationData, QuotationDataCustomer } from './types/interfaces';
import { useCalculations, ZoneCalculationData } from './hooks/useCalculations';
import { calculatePipeRolls, formatNumber } from './utils/calculations';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useLanguage } from '../contexts/LanguageContext';

interface HorticultureProject {
    projectName: string;
    customerName?: string;
    totalArea: number;
    mainArea?: any[];
    pump?: any;
    zones: Zone[];
    mainPipes?: MainPipe[];
    subMainPipes?: SubMainPipe[];
    lateralPipes?: any[];
    plants: any[];
    useZones: boolean;
    irrigationZones?: any[];
    selectedPlantType?: any;
    exclusionAreas?: any[];
    createdAt?: string;
    updatedAt?: string;
}

interface Zone {
    id: string;
    name: string;
    plantCount: number;
    area: number;
    plantData?: any;
}

interface MainPipe {
    id: string;
    toZone: string;
    length?: number;
}

interface SubMainPipe {
    id: string;
    zoneId: string;
    length?: number;
    branchPipes?: any[];
}

import { loadGardenData, clearGardenDataCache, bakeSprinklerColorsIntoGardenData, GardenPlannerData, GardenZone } from '../utils/homeGardenData';
import { calculateGardenStatistics, GardenStatistics } from '../utils/gardenStatistics';

import {
    getEnhancedFieldCropData,
    migrateToEnhancedFieldCropData,
    FieldCropData,
    calculateEnhancedFieldStats,
} from '../utils/fieldCropData';

import {
    getGreenhouseData,
    migrateLegacyGreenhouseData,
    GreenhousePlanningData,
    EnhancedPlotStats,
    PIXELS_PER_METER,
    GreenhouseSummaryData,
    convertSummaryDataToRawData,
    convertEnhancedDataToSummaryData,
    EnhancedGreenhousePlanningData,
    calculateAllGreenhouseStats,
} from '../utils/greenHouseData';

import { getCropByValue } from './utils/cropData';
import { selectBestPipeByHeadLoss } from '../utils/horticulturePipeCalculations';
import { refreshCsrfToken, getCsrfToken } from '../bootstrap';

import InputForm from './components/InputForm';
import CalculationSummary from './components/CalculationSummary';
import SprinklerSelector from './components/SprinklerSelector';
import PumpSelector from './components/PumpSelector';
import PipeSelector from './components/PipeSelector';
import GardenConnectorEquipmentsSelector from './components/GardenConnectorEquipmentsSelector';
import PipeSystemSummary from './components/PipeSystemSummary';
import ConnectionEquipmentsSelector from './components/ConnectionEquipmentsSelector';
import CostSummary from './components/CostSummary';
import QuotationModal from './components/QuotationModal';
import QuotationDocument from './components/QuotationDocument';
import SmartOnboardingTour from '../components/horticulture/SmartOnboardingTour';
import {
    getProductTourSteps,
    shouldShowProductTour,
    markProductTourCompleted,
    markProductTourSkipped,
    markProductTourDontShowAgain,
    PRODUCT_TOUR_STORAGE_KEY,
} from '../utils/productTourUtils';
import type { TourStep } from '../utils/onboardingTourUtils';

import { router } from '@inertiajs/react';
import { loadSprinklerConfig, calculateTotalFlowRate } from '../utils/sprinklerUtils';
import { getZoneColor } from '../utils/horticultureUtils';

type ProjectMode = 'horticulture' | 'garden' | 'field-crop' | 'greenhouse';

interface ZoneOperationGroup {
    id: string;
    zones: string[];
    order: number;
    label: string;
}

const loadGreenhouseSummaryData = (): GreenhouseSummaryData | null => {
    try {
        const storedData = localStorage.getItem('greenhouseSummaryData');
        if (storedData) {
            const data = JSON.parse(storedData);
            return data;
        }
        return null;
    } catch (error) {
        return null;
    }
};

const getStoredProjectImage = (projectMode: ProjectMode): string | null => {
    const imageKeys = ['projectMapImage', `${projectMode}PlanImage`, 'mapCaptureImage'];

    if (projectMode === 'field-crop') {
        imageKeys.push('fieldCropPlanImage');
    } else if (projectMode === 'garden') {
        imageKeys.push('gardenPlanImage', 'homeGardenPlanImage');
    } else if (projectMode === 'greenhouse') {
        imageKeys.push('greenhousePlanImage');
    } else if (projectMode === 'horticulture') {
        imageKeys.push('horticulturePlanImage');
    }

    for (const key of imageKeys) {
        const image = localStorage.getItem(key);
        if (image && image.startsWith('data:image/')) {
            try {
                const metadata = localStorage.getItem('projectMapMetadata');
                if (metadata) {
                    const parsedMetadata = JSON.parse(metadata);
                }
            } catch (error) {
                console.error('Error parsing project map metadata:', error);
            }

            return image;
        }
    }

    return null;
};

const validateImageData = (imageData: string): boolean => {
    if (!imageData || !imageData.startsWith('data:image/')) {
        return false;
    }

    if (imageData.length < 1000) {
        return false;
    }

    return true;
};

const cleanupOldImages = (): void => {
    const imageKeys = [
        'projectMapImage',
        'fieldCropPlanImage',
        'gardenPlanImage',
        'homeGardenPlanImage',
        'greenhousePlanImage',
        'horticulturePlanImage',
        'mapCaptureImage',
    ];

    let cleanedCount = 0;
    imageKeys.forEach((key) => {
        const image = localStorage.getItem(key);
        if (image && image.startsWith('blob:')) {
            URL.revokeObjectURL(image);
            localStorage.removeItem(key);
            cleanedCount++;
        }
    });
};

export default function Product() {
    const [projectMode, setProjectMode] = useState<ProjectMode>('horticulture');
    const [gardenData, setGardenData] = useState<GardenPlannerData | null>(null);
    const [gardenStats, setGardenStats] = useState<GardenStatistics | null>(null);

    const [fieldCropData, setFieldCropData] = useState<FieldCropData | null>(null);

    const [greenhouseData, setGreenhouseData] = useState<GreenhousePlanningData | null>(null);
    const [greenhouseSummaryData, setGreenhouseSummaryData] =
        useState<GreenhouseSummaryData | null>(null);

    const [projectData, setProjectData] = useState<HorticultureProject | null>(null);
    const [projectStats, setProjectStats] = useState<any>(null);
    const [activeZoneId, setActiveZoneId] = useState<string>('');
    const [zoneInputs, setZoneInputs] = useState<{ [zoneId: string]: IrrigationInput }>({});
    const [zoneSprinklers, setZoneSprinklers] = useState<{ [zoneId: string]: any }>({});
    const [horticultureSystemData, setHorticultureSystemData] = useState<any>(null);
    const [connectionStats, setConnectionStats] = useState<any[]>([]);
    const [gardenSystemData, setGardenSystemData] = useState<any>(null);

    const [zoneOperationMode, setZoneOperationMode] = useState<
        'sequential' | 'simultaneous' | 'custom'
    >('sequential');
    const [zoneOperationGroups, setZoneOperationGroups] = useState<ZoneOperationGroup[]>([]);

    const { t } = useLanguage();

    const [selectedPipes, setSelectedPipes] = useState<{
        [zoneId: string]: {
            branch?: any;
            secondary?: any;
            main?: any;
            emitter?: any;
        };
    }>({});
    // ✅ Store pipe material type (PE/PVC) for each zone and pipe type
    const [selectedPipeMaterials, setSelectedPipeMaterials] = useState<{
        [zoneId: string]: {
            branch?: 'PE' | 'PVC';
            secondary?: 'PE' | 'PVC';
            main?: 'PE' | 'PVC';
            emitter?: 'PE' | 'PVC';
        };
    }>({});
    const [selectedPump, setSelectedPump] = useState<any>(null);
    const [showPumpOption, setShowPumpOption] = useState(true);

    const [sprinklerEquipmentSets, setSprinklerEquipmentSets] = useState<{ [zoneId: string]: any }>(
        {}
    );
    const [connectionEquipments, setConnectionEquipments] = useState<{ [zoneId: string]: any[] }>(
        {}
    );

    // ✅ Track if initial data load has completed
    const initialDataLoadRef = useRef(false);

    // Tab system state
    const [activeTab, setActiveTab] = useState<number>(1); // 1 = InputForm, 2 = SprinklerSelector, 3 = PipeSelector, 4 = PumpSelector, 5 = CostSummary
    const [visitedTabs, setVisitedTabs] = useState<Set<number>>(new Set([1])); // Track which tabs have been visited

    // เมื่อ showPumpOption เปลี่ยนเป็น false และ activeTab เป็น 4 ให้เปลี่ยนไป Tab 5
    useEffect(() => {
        if (!showPumpOption && activeTab === 4) {
            setActiveTab(5);
            setVisitedTabs((prev) => new Set([...prev, 5]));
        }
    }, [showPumpOption, activeTab]);

    const [projectImage, setProjectImage] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState<boolean>(false);
    const [imageLoadError, setImageLoadError] = useState<string | null>(null);
    const [showImageModal, setShowImageModal] = useState(false);

    // Onboarding Tour state
    const [showOnboardingTour, setShowOnboardingTour] = useState(false);
    const [tourSteps, setTourSteps] = useState<TourStep[]>([]);

    // เมื่อ showPumpOption เปลี่ยนเป็น false และ activeTab เป็น 4 ให้เปลี่ยนไป Tab 5
    useEffect(() => {
        if (!showPumpOption && activeTab === 4) {
            setActiveTab(5);
            setVisitedTabs((prev) => new Set([...prev, 5]));
        }
    }, [showPumpOption, activeTab]);

    // Clear connection equipment selections on initial mount (only if not loading from database)
    useEffect(() => {
        const currentFieldId = localStorage.getItem('currentFieldId');
        const isLoadingFromDatabase = currentFieldId && !currentFieldId.startsWith('mock-');
        
        // Only reset if not loading from database (new project)
        if (!isLoadingFromDatabase) {
            localStorage.removeItem('connectionPointEquipmentSelections');
            // Reset connection equipment selections for new project
        } else {
            // Keep connection equipment selections when loading from database
        }
    }, []); // Run only once on mount

    // Load sprinklerEquipmentSets from localStorage on mount and listen for updates
    useEffect(() => {
        const loadSprinklerEquipmentSets = () => {
            try {
                const equipmentSetsKey = `${projectMode}_sprinklerEquipmentSets`;
                const storedSets = localStorage.getItem(equipmentSetsKey);
                if (storedSets) {
                    const sets = JSON.parse(storedSets);
                    setSprinklerEquipmentSets(sets);
                    
                    // Also update zoneInputs to include sprinklerEquipmentSet
                    setZoneInputs((prev) => {
                        const updated = { ...prev };
                        Object.keys(sets).forEach((zoneId) => {
                            if (updated[zoneId]) {
                                updated[zoneId] = {
                                    ...updated[zoneId],
                                    sprinklerEquipmentSet: sets[zoneId],
                                };
                            }
                        });
                        return updated;
                    });
                }
            } catch (error) {
                console.error('Error loading sprinkler equipment sets:', error);
            }
        };

        // Load on mount
        loadSprinklerEquipmentSets();

        // Listen for custom event
        const handleUpdate = (event: any) => {
            if (event.detail?.sprinklerEquipmentSets) {
                setSprinklerEquipmentSets(event.detail.sprinklerEquipmentSets);
                
                // Also update zoneInputs
                setZoneInputs((prev) => {
                    const updated = { ...prev };
                    Object.keys(event.detail.sprinklerEquipmentSets).forEach((zoneId) => {
                        if (updated[zoneId]) {
                            updated[zoneId] = {
                                ...updated[zoneId],
                                sprinklerEquipmentSet: event.detail.sprinklerEquipmentSets[zoneId],
                            };
                        }
                    });
                    return updated;
                });
            }
        };

        window.addEventListener('sprinklerEquipmentSetsUpdated', handleUpdate);

        return () => {
            window.removeEventListener('sprinklerEquipmentSetsUpdated', handleUpdate);
        };
    }, [projectMode]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageLoading(true);
            setImageLoadError(null);

            const reader = new FileReader();
            reader.onload = (event) => {
                const imageData = event.target?.result as string;
                if (validateImageData(imageData)) {
                    setProjectImage(imageData);

                    const saveKeys = [
                        'projectMapImage',
                        `${projectMode}PlanImage`,
                        'userUploadedImage',
                    ];

                    saveKeys.forEach((key) => {
                        try {
                            localStorage.setItem(key, imageData);
                        } catch (error) {
                            console.error('Error saving project image:', error);
                        }
                    });
                } else {
                    setImageLoadError('Invalid image format');
                }
                setImageLoading(false);
            };

            reader.onerror = () => {
                setImageLoadError('Failed to read image file');
                setImageLoading(false);
            };

            reader.readAsDataURL(file);
        }
    };

    const handleImageDelete = () => {
        if (projectImage && projectImage.startsWith('blob:')) {
            URL.revokeObjectURL(projectImage);
        }

        const keysToRemove = [
            'projectMapImage',
            `${projectMode}PlanImage`,
            'userUploadedImage',
            'mapCaptureImage',
        ];

        keysToRemove.forEach((key) => {
            localStorage.removeItem(key);
        });

        setProjectImage(null);
        setImageLoadError(null);
    };

    useEffect(() => {
        return () => {
            if (projectImage && projectImage.startsWith('blob:')) {
                URL.revokeObjectURL(projectImage);
            }
            cleanupOldImages();
        };
    }, [projectImage]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode') as ProjectMode;
        if (mode) {
            setProjectMode(mode);
        }
    }, []);

    useEffect(() => {
        if (!projectMode) return;

        setImageLoading(true);
        setImageLoadError(null);
        cleanupOldImages();
        const image = getStoredProjectImage(projectMode);

        if (image && validateImageData(image)) {
            setProjectImage(image);
        } else {
            setProjectImage(null);
            const modeNames = {
                'field-crop': 'Field Crop Summary',
                garden: 'Garden Planner',
                greenhouse: 'Greenhouse Planner',
                horticulture: 'Horticulture Planner',
            };

            setImageLoadError(
                `No map image found. Please capture one from ${modeNames[projectMode]} page.`
            );
        }

        setImageLoading(false);
    }, [projectMode]);

    // เมื่อมาจาก Results หรือโหลด horticultureSystemData จาก localStorage → อัปเดตรูปแผนผังจาก localStorage (รูปที่ Results บันทึก)
    useEffect(() => {
        if (projectMode !== 'horticulture') return;
        const fromResults =
            typeof sessionStorage !== 'undefined' &&
            sessionStorage.getItem('fromHorticultureResults') === 'true';
        if (!fromResults && !horticultureSystemData) return;
        const image = getStoredProjectImage('horticulture');
        if (image && validateImageData(image)) {
            setProjectImage(image);
            setImageLoadError(null);
        }
    }, [projectMode, horticultureSystemData]);

    useEffect(() => {
        if (projectImage && projectMode) {
            const isValid = validateImageData(projectImage);
            if (!isValid) {
                setProjectImage(null);
                const validImage = getStoredProjectImage(projectMode);
                if (validImage && validateImageData(validImage)) {
                    setProjectImage(validImage);
                    setImageLoadError(null);
                } else {
                    setImageLoadError('Invalid or corrupted image data');
                }
            }
        }
    }, [projectImage, projectMode]);

    useEffect(() => {
        if (projectMode === 'greenhouse') {
            const summaryData = loadGreenhouseSummaryData();
            if (summaryData) {
                setGreenhouseSummaryData(summaryData);
                const rawData = convertSummaryDataToRawData(summaryData);
                const enhancedData = calculateAllGreenhouseStats(rawData);
                setGreenhouseData(enhancedData);
            } else {
                const data = getGreenhouseData();
                if (data) {
                    setGreenhouseData(data);
                    const summaryFormat = convertEnhancedDataToSummaryData(data);
                    setGreenhouseSummaryData(summaryFormat);
                }
            }
        }
    }, [projectMode]);

    // Initialize tour on mount
    useEffect(() => {
        setTourSteps(getProductTourSteps(t));
        
        // เช็คว่ามาจากหน้า HorticultureResultsPage หรือไม่ (ไม่ลบ flag ที่นี่ — ใช้ใน apply auto-selected effect)
        const fromResults = sessionStorage.getItem('fromHorticultureResults') === 'true';
        
        // ถ้ามาจากหน้า results ให้แสดง tour ทุกครั้ง
        // ถ้าไม่ใช่ ให้เช็คว่าเคยเลือก "อย่าแสดงอีก" หรือไม่
        if (fromResults) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                setShowOnboardingTour(true);
            });
        } else if (shouldShowProductTour()) {
            // Auto-start tour immediately when page loads if not marked as "don't show again"
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                setShowOnboardingTour(true);
            });
        }
    }, [t]);

    const handleTourComplete = () => {
        markProductTourCompleted();
        setShowOnboardingTour(false);
    };

    const handleTourSkip = () => {
        markProductTourSkipped();
        setShowOnboardingTour(false);
    };

    const handleTourDontShowAgain = () => {
        markProductTourDontShowAgain();
        setShowOnboardingTour(false);
    };

    const getZoneName = (zoneId: string): string => {
        if (projectMode === 'garden' && gardenStats) {
            const zone = gardenStats.zones.find((z) => z.zoneId === zoneId);
            return zone?.zoneName || zoneId;
        }
        if (projectMode === 'field-crop' && fieldCropData) {
            const zone = fieldCropData.zones.info.find((z) => z.id === zoneId);
            return zone?.name || zoneId;
        }
        if (projectMode === 'greenhouse' && greenhouseData) {
            const plot = greenhouseData.summary.plotStats.find((p) => p.plotId === zoneId);
            return plot?.plotName || zoneId;
        }

        const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
        if (horticultureSystemDataStr) {
            try {
                const horticultureSystemData = JSON.parse(horticultureSystemDataStr);
                if (horticultureSystemData && horticultureSystemData.zones) {
                    const zone = horticultureSystemData.zones.find((z: any) => z.id === zoneId);
                    if (zone?.name) {
                        return zone.name;
                    }
                }
            } catch (error) {
                console.error('Error parsing horticultureSystemData:', error);
            }
        }

        const zone = projectData?.zones.find((z) => z.id === zoneId);
        return zone?.name || zoneId;
    };

    const createGreenhouseZoneInput = (
        plot: EnhancedPlotStats,
        greenhouseData: GreenhousePlanningData,
        totalZones: number
    ): IrrigationInput => {
        const areaInSqm = plot.area;
        const areaInRai = areaInSqm / 1600;
        const crop = getCropByValue(plot.cropType || '');
        const totalSprinklers = plot.equipmentCount.sprinklers || plot.production.totalPlants;

        const waterPerSprinkler =
            plot.production.waterRequirementPerIrrigation / Math.max(totalSprinklers, 1);

        const longestBranch = plot.pipeStats.drip.longest || plot.pipeStats.sub.longest || 30;
        const totalBranchLength =
            plot.pipeStats.drip.totalLength || plot.pipeStats.sub.totalLength || 100;
        const longestMain = plot.pipeStats.main.longest || 0;
        const totalMainLength = plot.pipeStats.main.totalLength || 0;

        return {
            farmSizeRai: formatNumber(areaInRai, 3),
            totalTrees: totalSprinklers,
            waterPerTreeLiters: formatNumber(waterPerSprinkler, 3),
            numberOfZones: totalZones,
            sprinklersPerTree: 1,
            irrigationTimeMinutes: 30,
            staticHeadM: 0,
            pressureHeadM: 20,
            pipeAgeYears: 0,

            sprinklersPerBranch: Math.max(1, Math.ceil(totalSprinklers / 5)),
            branchesPerSecondary: 1,
            simultaneousZones: 1,

            sprinklersPerLongestBranch: Math.max(1, Math.ceil(totalSprinklers / 5)),
            branchesPerLongestSecondary: 1,
            secondariesPerLongestMain: 1,

            longestBranchPipeM: formatNumber(longestBranch, 3),
            totalBranchPipeM: formatNumber(totalBranchLength, 3),
            longestSecondaryPipeM: 0, // greenhouse mode ไม่มีท่อเมนรอง
            totalSecondaryPipeM: 0, // greenhouse mode ไม่มีท่อเมนรอง
            longestMainPipeM: formatNumber(longestMain, 3),
            totalMainPipeM: formatNumber(totalMainLength, 3),
        };
    };

    const createSingleGreenhouseInput = (
        greenhouseData: GreenhousePlanningData
    ): IrrigationInput => {
        const areaInSqm = greenhouseData.summary.totalPlotArea;
        const areaInRai = areaInSqm / 1600;
        const totalSprinklers =
            greenhouseData.summary.overallEquipmentCount.sprinklers ||
            greenhouseData.summary.overallProduction.totalPlants;

        const waterPerSprinkler =
            greenhouseData.summary.overallProduction.waterRequirementPerIrrigation /
            Math.max(totalSprinklers, 1);

        return {
            farmSizeRai: formatNumber(areaInRai, 3),
            totalTrees: totalSprinklers,
            waterPerTreeLiters: formatNumber(waterPerSprinkler, 3),
            numberOfZones: 1,
            sprinklersPerTree: 1,
            irrigationTimeMinutes: 30,
            staticHeadM: 0,
            pressureHeadM: 20,
            pipeAgeYears: 0,

            sprinklersPerBranch: Math.max(1, Math.ceil(totalSprinklers / 5)),
            branchesPerSecondary: 1,
            simultaneousZones: 1,

            sprinklersPerLongestBranch: Math.max(1, Math.ceil(totalSprinklers / 5)),
            branchesPerLongestSecondary: 1,
            secondariesPerLongestMain: 1,

            longestBranchPipeM: formatNumber(
                greenhouseData.summary.overallPipeStats.drip.longest ||
                    greenhouseData.summary.overallPipeStats.sub.longest ||
                    30,
                3
            ),
            totalBranchPipeM: formatNumber(
                greenhouseData.summary.overallPipeStats.drip.totalLength ||
                    greenhouseData.summary.overallPipeStats.sub.totalLength ||
                    100,
                3
            ),
            longestSecondaryPipeM: 0, // greenhouse mode ไม่มีท่อเมนรอง
            totalSecondaryPipeM: 0, // greenhouse mode ไม่มีท่อเมนรอง
            longestMainPipeM: formatNumber(
                greenhouseData.summary.overallPipeStats.main.longest || 0,
                3
            ),
            totalMainPipeM: formatNumber(
                greenhouseData.summary.overallPipeStats.main.totalLength || 0,
                3
            ),
        };
    };

    const createFieldCropZoneInput = (
        zone: FieldCropData['zones']['info'][0],
        fieldData: FieldCropData,
        totalZones: number
    ): IrrigationInput => {
        const areaInRai = zone.area / 1600;
        const assignedCropValue = fieldData.crops.zoneAssignments[String(zone.id)] ?? fieldData.crops.zoneAssignments[zone.id];
        const crop = assignedCropValue ? getCropByValue(assignedCropValue) : null;

        const totalSprinklers =
            zone.sprinklerCount || Math.max(1, Math.ceil(zone.totalPlantingPoints / 10));

        const waterPerSprinklerLPM = 2.5;

        const zonePipeStats = zone.pipeStats;
        const longestBranch = zonePipeStats.lateral.longestLength || 30;
        const totalBranchLength = zonePipeStats.lateral.totalLength || 100;
        const longestSubmain = zonePipeStats.submain.longestLength || 0;
        const totalSubmainLength = zonePipeStats.submain.totalLength || 0;
        const longestMain = zonePipeStats.main.longestLength || 0;
        const totalMainLength = zonePipeStats.main.totalLength || 0;

        return {
            farmSizeRai: formatNumber(areaInRai || 0, 3),
            totalTrees: totalSprinklers || 0,
            waterPerTreeLiters: formatNumber(waterPerSprinklerLPM || 2.5, 3),
            numberOfZones: totalZones || 1,
            sprinklersPerTree: 1,
            irrigationTimeMinutes: 30,
            staticHeadM: 0,
            pressureHeadM: 20,
            pipeAgeYears: 0,

            sprinklersPerBranch: Math.max(1, Math.ceil((totalSprinklers || 0) / 5)),
            branchesPerSecondary: 1,
            simultaneousZones: 1,

            sprinklersPerLongestBranch: Math.max(1, Math.ceil((totalSprinklers || 0) / 5)),
            branchesPerLongestSecondary: 1,
            secondariesPerLongestMain: 1,

            longestBranchPipeM: formatNumber(longestBranch || 30, 3),
            totalBranchPipeM: formatNumber(totalBranchLength || 100, 3),
            longestSecondaryPipeM: formatNumber(longestSubmain || 0, 3),
            totalSecondaryPipeM: formatNumber(totalSubmainLength || 0, 3),
            longestMainPipeM: formatNumber(longestMain || 0, 3),
            totalMainPipeM: formatNumber(totalMainLength || 0, 3),
        };
    };

    const createFieldCropZoneInputFromSystemData = (
        zone: any,
        totalZones: number
    ): IrrigationInput => {
        const areaInRai = zone.area / 1600;
        const totalSprinklers = zone.sprinklerCount || zone.plantCount || 0;
        const waterPerSprinklerLPM = zone.waterPerTree || 2.0;

        return {
            farmSizeRai: formatNumber(areaInRai || 0, 3),
            totalTrees: totalSprinklers || 0,
            waterPerTreeLiters: formatNumber(waterPerSprinklerLPM || 2.0, 3),
            numberOfZones: totalZones || 1,
            sprinklersPerTree: 1,
            irrigationTimeMinutes: 30,
            staticHeadM: 0,
            pressureHeadM: 20,
            pipeAgeYears: 0,

            sprinklersPerBranch: Math.max(1, Math.ceil((totalSprinklers || 0) / 5)),
            branchesPerSecondary: 1,
            simultaneousZones: 1,

            sprinklersPerLongestBranch: Math.max(1, Math.ceil((totalSprinklers || 0) / 5)),
            branchesPerLongestSecondary: 1,
            secondariesPerLongestMain: 1,

            longestBranchPipeM: formatNumber(zone.pipes?.branchPipes?.longest || 30, 3),
            totalBranchPipeM: formatNumber(zone.pipes?.branchPipes?.totalLength || 100, 3),
            longestSecondaryPipeM: formatNumber(zone.pipes?.subMainPipes?.longest || 0, 3),
            totalSecondaryPipeM: formatNumber(zone.pipes?.subMainPipes?.totalLength || 0, 3),
            longestMainPipeM: formatNumber(zone.pipes?.mainPipes?.longest || 0, 3),
            totalMainPipeM: formatNumber(zone.pipes?.mainPipes?.totalLength || 0, 3),
        };
    };

    const createSingleFieldCropInput = (fieldData: FieldCropData): IrrigationInput => {
        const areaInRai = fieldData.area.size / 1600;

        const totalSprinklers =
            fieldData.irrigation.totalCount ||
            fieldData.summary.totalPlantingPoints ||
            Math.max(1, Math.ceil(fieldData.summary.totalPlantingPoints / 10));

        const waterPerSprinklerLPM = 2.5;

        return {
            farmSizeRai: formatNumber(areaInRai || 0, 3),
            totalTrees: totalSprinklers || 0,
            waterPerTreeLiters: formatNumber(waterPerSprinklerLPM || 2.5, 3),
            numberOfZones: 1,
            sprinklersPerTree: 1,
            irrigationTimeMinutes: 30,
            staticHeadM: 0,
            pressureHeadM: 20,
            pipeAgeYears: 0,

            sprinklersPerBranch: Math.max(1, Math.ceil((totalSprinklers || 0) / 5)),
            branchesPerSecondary: 1,
            simultaneousZones: 1,

            sprinklersPerLongestBranch: Math.max(1, Math.ceil((totalSprinklers || 0) / 5)),
            branchesPerLongestSecondary: 1,
            secondariesPerLongestMain: 1,

            longestBranchPipeM: formatNumber(
                fieldData.pipes?.stats?.lateral?.longestLength || 30,
                3
            ),
            totalBranchPipeM: formatNumber(fieldData.pipes?.stats?.lateral?.totalLength || 100, 3),
            longestSecondaryPipeM: formatNumber(
                fieldData.pipes?.stats?.submain?.longestLength || 0,
                3
            ),
            totalSecondaryPipeM: formatNumber(fieldData.pipes?.stats?.submain?.totalLength || 0, 3),
            longestMainPipeM: formatNumber(fieldData.pipes?.stats?.main?.longestLength || 0, 3),
            totalMainPipeM: formatNumber(fieldData.pipes?.stats?.main?.totalLength || 0, 3),
        };
    };

    const createZoneCalculationData = (): ZoneCalculationData[] => {
        const zoneCalcData: ZoneCalculationData[] = [];
        let allZoneIds: string[] = [];

        if (projectMode === 'garden' && gardenStats) {
            allZoneIds = gardenStats.zones.map((z) => z.zoneId);
        } else if (projectMode === 'field-crop' && fieldCropData) {
            allZoneIds = fieldCropData.zones.info.map((z) => String(z.id));
        } else if (projectMode === 'greenhouse' && greenhouseData) {
            allZoneIds = greenhouseData.summary.plotStats.map((p) => p.plotId);
        } else if (projectData) {
            allZoneIds = projectData.zones.map((z) => z.id);
        }

        allZoneIds.forEach((zoneId) => {
            const zoneInput = zoneInputs[zoneId];
            const zoneSprinkler = zoneSprinklers[zoneId];

            if (zoneInput && zoneSprinkler) {
                let simultaneousZonesForCalc = 1;
                if (zoneOperationMode === 'simultaneous') {
                    simultaneousZonesForCalc = allZoneIds.length;
                } else if (zoneOperationMode === 'custom') {
                    const group = zoneOperationGroups.find((g) => g.zones.includes(zoneId));
                    simultaneousZonesForCalc = group ? group.zones.length : 1;
                }

                const adjustedInput = {
                    ...zoneInput,
                    simultaneousZones: simultaneousZonesForCalc,
                    numberOfZones: allZoneIds.length,
                };

                zoneCalcData.push({
                    zoneId,
                    input: adjustedInput,
                    sprinkler: zoneSprinkler,
                    projectMode,
                });
            }
        });

        return zoneCalcData;
    };

    const createGardenZoneInput = (
        zone: any,
        gardenStats: GardenStatistics,
        totalZones: number
    ): IrrigationInput => {
        const zoneStats = gardenStats.zones.find((z) => z.zoneId === zone.zoneId);

        if (!zoneStats) {
            throw new Error(`Zone statistics not found for zone ${zone.zoneId}`);
        }

        const areaInRai = zoneStats.area / 1600;

        const sprinklerCount =
            zoneStats.sprinklerCount > 0
                ? zoneStats.sprinklerCount
                : Math.max(5, Math.ceil(areaInRai * 12));

        const totalWaterRequirement = zoneStats.sprinklerFlowRate * zoneStats.sprinklerCount;
        const waterPerSprinkler =
            sprinklerCount > 0
                ? totalWaterRequirement / sprinklerCount
                : zoneStats.sprinklerFlowRate;

        return {
            farmSizeRai: formatNumber(areaInRai || 0, 3),
            totalTrees: sprinklerCount || 0,
            waterPerTreeLiters: formatNumber(waterPerSprinkler || 2.5, 3),
            numberOfZones: totalZones || 1,
            sprinklersPerTree: 1,
            irrigationTimeMinutes: 30,
            staticHeadM: 0,
            pressureHeadM: 20,
            pipeAgeYears: 0,

            sprinklersPerBranch: Math.max(1, Math.ceil((sprinklerCount || 0) / 5)),
            branchesPerSecondary: 1,
            simultaneousZones: 1,

            sprinklersPerLongestBranch: Math.max(1, Math.ceil((sprinklerCount || 0) / 5)),
            branchesPerLongestSecondary: 1,
            secondariesPerLongestMain: 1,

            longestBranchPipeM: formatNumber(zoneStats?.longestPipeFromSource || 20, 3),
            totalBranchPipeM: formatNumber(zoneStats?.totalPipeLength || 100, 3),
            longestSecondaryPipeM: 0,
            totalSecondaryPipeM: 0,
            longestMainPipeM: 0,
            totalMainPipeM: 0,
        };
    };

    const createSingleGardenInput = (stats: GardenStatistics): IrrigationInput => {
        const summary = stats.summary;

        const areaInRai = summary.totalArea / 1600;

        const totalSprinklers =
            summary.totalSprinklers > 0
                ? summary.totalSprinklers
                : Math.max(5, Math.ceil(areaInRai * 12));

        return {
            farmSizeRai: formatNumber(areaInRai || 0, 3),
            totalTrees: totalSprinklers || 0,
            waterPerTreeLiters: formatNumber(50, 3),
            numberOfZones: 1,
            sprinklersPerTree: 1,
            irrigationTimeMinutes: 30,
            staticHeadM: 0,
            pressureHeadM: 20,
            pipeAgeYears: 0,

            sprinklersPerBranch: Math.max(1, Math.ceil((totalSprinklers || 0) / 5)),
            branchesPerSecondary: 1,
            simultaneousZones: 1,

            sprinklersPerLongestBranch: Math.max(1, Math.ceil((totalSprinklers || 0) / 5)),
            branchesPerLongestSecondary: 1,
            secondariesPerLongestMain: 1,

            longestBranchPipeM: formatNumber(summary?.longestPipeFromSource || 20, 3),
            totalBranchPipeM: formatNumber(summary?.totalPipeLength || 100, 3),
            longestSecondaryPipeM: 0,
            totalSecondaryPipeM: 0,
            longestMainPipeM: 0,
            totalMainPipeM: 0,
        };
    };

    const createGardenSystemData = (
        gardenData: GardenPlannerData,
        gardenStats: GardenStatistics
    ) => {
        if (!gardenData || !gardenStats) return null;

        const summary = gardenStats.summary;
        const zones = gardenStats.zones;

        const sprinklerConfig = {
            flowRatePerPlant: 6.0,
            pressureBar: 2.5,
            radiusMeters: 8.0,
        };

        const systemZones =
            zones.length > 0
                ? zones.map((zone) => {
                      const sprinklerCount =
                          zone.sprinklerCount || Math.max(1, Math.ceil((zone.area / 1600) * 12));

                      return {
                          id: zone.zoneId,
                          name: zone.zoneName,
                          sprinklerCount: sprinklerCount,
                          waterNeedPerMinute: sprinklerCount * sprinklerConfig.flowRatePerPlant,
                          bestPipes: {
                              branch: {
                                  id: `branch-${zone.zoneId}`,
                                  length: zone.longestPipeFromSource || 20,
                                  count: sprinklerCount,
                                  waterFlowRate: sprinklerCount * sprinklerConfig.flowRatePerPlant,
                                  details: { type: 'branch', zoneId: zone.zoneId },
                              },
                              subMain: {
                                  id: `submain-${zone.zoneId}`,
                                  length: Math.max(zone.longestPipeFromSource * 0.7, 15),
                                  count: Math.max(1, Math.ceil(sprinklerCount / 5)),
                                  waterFlowRate: sprinklerCount * sprinklerConfig.flowRatePerPlant,
                                  details: { type: 'subMain', zoneId: zone.zoneId },
                              },
                              main: {
                                  id: `main-${zone.zoneId}`,
                                  length: Math.max(zone.longestPipeFromSource * 0.5, 10),
                                  count: 1,
                                  waterFlowRate: sprinklerCount * sprinklerConfig.flowRatePerPlant,
                                  details: { type: 'main', zoneId: zone.zoneId },
                              },
                          },
                      };
                  })
                : [
                      {
                          id: 'main-garden',
                          name: 'สวนหลัก',
                          sprinklerCount:
                              summary.totalSprinklers ||
                              Math.max(5, Math.ceil((summary.totalArea / 1600) * 12)),
                          waterNeedPerMinute:
                              (summary.totalSprinklers ||
                                  Math.max(5, Math.ceil((summary.totalArea / 1600) * 12))) *
                              sprinklerConfig.flowRatePerPlant,
                          bestPipes: {
                              branch: {
                                  id: 'branch-main-garden',
                                  length: summary.longestPipeFromSource || 20,
                                  count:
                                      summary.totalSprinklers ||
                                      Math.max(5, Math.ceil((summary.totalArea / 1600) * 12)),
                                  waterFlowRate:
                                      (summary.totalSprinklers ||
                                          Math.max(5, Math.ceil((summary.totalArea / 1600) * 12))) *
                                      sprinklerConfig.flowRatePerPlant,
                                  details: { type: 'branch', zoneId: 'main-garden' },
                              },
                              subMain: {
                                  id: 'submain-main-garden',
                                  length: Math.max((summary.longestPipeFromSource || 20) * 0.7, 15),
                                  count: Math.max(1, Math.ceil((summary.totalSprinklers || 5) / 5)),
                                  waterFlowRate:
                                      (summary.totalSprinklers ||
                                          Math.max(5, Math.ceil((summary.totalArea / 1600) * 12))) *
                                      sprinklerConfig.flowRatePerPlant,
                                  details: { type: 'subMain', zoneId: 'main-garden' },
                              },
                              main: {
                                  id: 'main-main-garden',
                                  length: Math.max((summary.longestPipeFromSource || 20) * 0.5, 10),
                                  count: 1,
                                  waterFlowRate:
                                      (summary.totalSprinklers ||
                                          Math.max(5, Math.ceil((summary.totalArea / 1600) * 12))) *
                                      sprinklerConfig.flowRatePerPlant,
                                  details: { type: 'main', zoneId: 'main-garden' },
                              },
                          },
                      },
                  ];

        return {
            sprinklerConfig,
            zones: systemZones,
            isMultipleZones: zones.length > 1,
            projectMode: 'garden',
            connectorSummary: summary.connectorSummary ?? { byWays: {}, straightCouplers: 0 },
        };
    };

    const currentInput = useMemo(() => {
        if (!activeZoneId || !zoneInputs[activeZoneId]) {
            return null;
        }

        const baseInput = zoneInputs[activeZoneId];

        let simultaneousZonesForCalc = 1;
        let allZoneIds: string[] = [];

        if (projectMode === 'garden' && gardenStats) {
            allZoneIds = gardenStats.zones.map((z) => z.zoneId);
        } else if (projectMode === 'field-crop' && fieldCropData) {
            allZoneIds = fieldCropData.zones.info.map((z) => String(z.id));
        } else if (projectMode === 'greenhouse' && greenhouseData) {
            allZoneIds = greenhouseData.summary.plotStats.map((p) => p.plotId);
        } else if (projectData) {
            allZoneIds = projectData.zones.map((z) => z.id);
        }

        if (zoneOperationMode === 'simultaneous') {
            simultaneousZonesForCalc = allZoneIds.length;
        } else if (zoneOperationMode === 'custom') {
            const group = zoneOperationGroups.find((g) => g.zones.includes(activeZoneId));
            simultaneousZonesForCalc = group ? group.zones.length : 1;
        }

        const updatedInput = {
            ...baseInput,
            simultaneousZones: simultaneousZonesForCalc,
            numberOfZones: allZoneIds.length,
        };

        return updatedInput;
    }, [
        activeZoneId,
        zoneInputs,
        zoneOperationMode,
        zoneOperationGroups,
        projectMode,
        gardenStats,
        fieldCropData,
        greenhouseData,
        projectData,
    ]);

    const handleZoneOperationModeChange = (mode: 'sequential' | 'simultaneous' | 'custom') => {
        setZoneOperationMode(mode);

        let allZoneIds: string[] = [];

        if (projectMode === 'garden' && gardenStats) {
            allZoneIds = gardenStats.zones.map((z) => z.zoneId);
        } else if (projectMode === 'field-crop' && fieldCropData) {
            allZoneIds = fieldCropData.zones.info.map((z) => String(z.id));
        } else if (projectMode === 'greenhouse' && greenhouseData) {
            allZoneIds = greenhouseData.summary.plotStats.map((p) => p.plotId);
        } else if (projectData) {
            allZoneIds = projectData.zones.map((z) => z.id);
        }

        if (mode === 'sequential') {
            const groups = allZoneIds.map((zoneId, index) => ({
                id: `group-${index}`,
                zones: [zoneId],
                order: index + 1,
                label: `${getZoneName(zoneId)}`,
            }));
            setZoneOperationGroups(groups);
        } else if (mode === 'simultaneous') {
            setZoneOperationGroups([
                {
                    id: 'group-all',
                    zones: allZoneIds,
                    order: 1,
                    label: t('เปิดทุกโซนพร้อมกัน'),
                },
            ]);
        }
    };

    const addOperationGroup = () => {
        const newGroup: ZoneOperationGroup = {
            id: `group-${Date.now()}`,
            zones: [],
            order: zoneOperationGroups.length + 1,
            label: t(`กลุ่มที่ ${zoneOperationGroups.length + 1}`),
        };
        setZoneOperationGroups([...zoneOperationGroups, newGroup]);
    };

    const updateOperationGroup = (groupId: string, zones: string[]) => {
        setZoneOperationGroups((groups) =>
            groups.map((g) => (g.id === groupId ? { ...g, zones } : g))
        );
    };

    const removeOperationGroup = (groupId: string) => {
        setZoneOperationGroups((groups) =>
            groups
                .filter((g) => g.id !== groupId)
                .map((g, index) => ({
                    ...g,
                    order: index + 1,
                    label: t(`กลุ่มที่ ${index + 1}`),
                }))
        );
    };

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        let mode = urlParams.get('mode') as ProjectMode;
        const storedType = localStorage.getItem('projectType');

        if (!mode && storedType === 'greenhouse') {
            mode = 'greenhouse';
        } else if (!mode && storedType === 'field-crop') {
            mode = 'field-crop';
        } else if (!mode && storedType === 'home-garden') {
            mode = 'garden';
        } else if (!mode && storedType === 'horticulture') {
            mode = 'horticulture';
        }

        if (mode === 'greenhouse') {
            setProjectMode('greenhouse');
            localStorage.removeItem('horticulture_defaultSprinkler');
            localStorage.removeItem('garden_defaultSprinkler');

            const summaryData = loadGreenhouseSummaryData();
            let currentData: GreenhousePlanningData | null = null;

            if (summaryData) {
                setGreenhouseSummaryData(summaryData);
                const rawData = convertSummaryDataToRawData(summaryData);
                const enhancedData = calculateAllGreenhouseStats(rawData);
                setGreenhouseData(enhancedData);
                currentData = enhancedData;
            } else {
                let data = getGreenhouseData();

                if (!data) {
                    data = migrateLegacyGreenhouseData();
                }

                if (data) {
                    setGreenhouseData(data);
                    const summaryFormat = convertEnhancedDataToSummaryData(data);
                    setGreenhouseSummaryData(summaryFormat);
                    currentData = data;
                }
            }

            if (currentData) {
                const initialZoneInputs: { [zoneId: string]: IrrigationInput } = {};
                const initialSelectedPipes: {
                    [zoneId: string]: { branch?: any; secondary?: any; main?: any };
                } = {};

                if (currentData.summary.plotStats.length > 1) {
                    currentData.summary.plotStats.forEach((plot) => {
                        initialZoneInputs[plot.plotId] = createGreenhouseZoneInput(
                            plot,
                            currentData!,
                            currentData!.summary.plotStats.length
                        );
                        initialSelectedPipes[plot.plotId] = {
                            branch: undefined,
                            secondary: undefined,
                            main: undefined,
                        };
                    });

                    setZoneInputs(initialZoneInputs);
                    setSelectedPipes(initialSelectedPipes);
                    setActiveZoneId(currentData.summary.plotStats[0].plotId);
                    handleZoneOperationModeChange('sequential');
                } else if (currentData.summary.plotStats.length === 1) {
                    const plot = currentData.summary.plotStats[0];
                    const singleInput = createGreenhouseZoneInput(plot, currentData, 1);
                    setZoneInputs({ [plot.plotId]: singleInput });
                    setSelectedPipes({
                        [plot.plotId]: { branch: undefined, secondary: undefined, main: undefined },
                    });
                    setActiveZoneId(plot.plotId);
                } else {
                    const singleInput = createSingleGreenhouseInput(currentData);
                    setZoneInputs({ 'main-area': singleInput });
                    setSelectedPipes({
                        'main-area': { branch: undefined, secondary: undefined, main: undefined },
                    });
                    setActiveZoneId('main-area');
                }
            } else {
                router.visit('/greenhouse-crop');
            }
        } else if (mode === 'field-crop') {
            setProjectMode('field-crop');
            localStorage.removeItem('horticulture_defaultSprinkler');
            localStorage.removeItem('garden_defaultSprinkler');

            let fieldData: FieldCropData | null = null;
            const fieldDataStr = localStorage.getItem('fieldCropData');
            if (fieldDataStr) {
                try {
                    fieldData = JSON.parse(fieldDataStr);
                } catch (error) {
                    console.error('Error parsing fieldCropData:', error);
                }
            }

            if (!fieldData) {
                fieldData = getEnhancedFieldCropData();
                if (!fieldData) {
                    fieldData = migrateToEnhancedFieldCropData();
                }
            }

            if (fieldData) {
                setFieldCropData(fieldData);

                const initialZoneInputs: { [zoneId: string]: IrrigationInput } = {};
                const initialSelectedPipes: {
                    [zoneId: string]: { branch?: any; secondary?: any; main?: any };
                } = {};

                const zonesInfo = fieldData.zones.info;

                if (zonesInfo.length > 1) {
                    zonesInfo.forEach((zone: any) => {
                        const zoneId = String(zone.id);
                        initialZoneInputs[zoneId] = createFieldCropZoneInput(
                            zone,
                            fieldData,
                            zonesInfo.length
                        );

                        initialSelectedPipes[zoneId] = {
                            branch: undefined,
                            secondary: undefined,
                            main: undefined,
                        };
                    });

                    setZoneInputs(initialZoneInputs);
                    setSelectedPipes(initialSelectedPipes);
                    setActiveZoneId(String(zonesInfo[0].id));
                    handleZoneOperationModeChange('sequential');
                } else if (zonesInfo.length === 1) {
                    const zone = zonesInfo[0];
                    const zoneId = String(zone.id);
                    const singleInput = createFieldCropZoneInput(zone, fieldData, 1);

                    setZoneInputs({ [zoneId]: singleInput });
                    setSelectedPipes({
                        [zoneId]: { branch: undefined, secondary: undefined, main: undefined },
                    });
                    setActiveZoneId(zoneId);
                } else {
                    const singleInput = createSingleFieldCropInput(fieldData);
                    setZoneInputs({ 'main-area': singleInput });
                    setSelectedPipes({
                        'main-area': { branch: undefined, secondary: undefined, main: undefined },
                    });
                    setActiveZoneId('main-area');
                }
            } else {
                router.visit('/field-map');
            }
        } else if (mode === 'garden') {
            setProjectMode('garden');
            localStorage.removeItem('horticulture_defaultSprinkler');
            const gardenPlannerData = loadGardenData();
            if (gardenPlannerData) {
                setGardenData(gardenPlannerData);
                const stats = calculateGardenStatistics(gardenPlannerData);
                setGardenStats(stats);

                const systemData = createGardenSystemData(gardenPlannerData, stats);
                setGardenSystemData(systemData);

                const initialZoneInputs: { [zoneId: string]: IrrigationInput } = {};
                const initialSelectedPipes: {
                    [zoneId: string]: { branch?: any; secondary?: any; main?: any; emitter?: any };
                } = {};

                if (stats.zones.length > 1) {
                    stats.zones.forEach((zone) => {
                        initialZoneInputs[zone.zoneId] = createGardenZoneInput(
                            zone,
                            stats,
                            stats.zones.length
                        );
                        initialSelectedPipes[zone.zoneId] = {
                            branch: undefined,
                            secondary: undefined,
                            main: undefined,
                            emitter: undefined,
                        };
                    });

                    setZoneInputs(initialZoneInputs);
                    setSelectedPipes(initialSelectedPipes);
                    setActiveZoneId(stats.zones[0].zoneId);
                    handleZoneOperationModeChange('sequential');
                } else {
                    // ใช้ zoneId จริงจาก stats.zones[0] แทน hardcoded 'main-area'
                    const zoneId = stats.zones[0]?.zoneId || 'main-area';
                    const singleInput = createSingleGardenInput(stats);
                    setZoneInputs({ [zoneId]: singleInput });
                    setSelectedPipes({
                        [zoneId]: {
                            branch: undefined,
                            secondary: undefined,
                            main: undefined,
                            emitter: undefined,
                        },
                    });
                    setActiveZoneId(zoneId);
                }

                // ⚠️ สำหรับ garden mode: ยังไม่ set zoneSprinklers ที่นี่
                // จะทำการ auto-select sprinkler ให้แต่ละโซน ใน useEffect ต่างหาก (หลังจาก analyzedSprinklers โหลดมา)
            }
        } else {
            setProjectMode('horticulture');
            localStorage.removeItem('garden_defaultSprinkler');
            
            // ✅ Prevent multiple loads
            if (initialDataLoadRef.current) {
                return;
            }
            initialDataLoadRef.current = true;

            // ✅ Check if loading from database (currentFieldId exists)
            const currentFieldId = localStorage.getItem('currentFieldId');
            const isLoadingFromDatabase = currentFieldId && !currentFieldId.startsWith('mock-');

            // ✅ First, try to load from localStorage (set by home.tsx)
            // Check for zoneInputs, connectionEquipments, etc. from localStorage
            const savedZoneInputsStr = localStorage.getItem('zoneInputs') || localStorage.getItem('horticultureZoneInputs');
            const savedConnectionEquipmentsStr = localStorage.getItem('connectionEquipments') || localStorage.getItem('horticultureConnectionEquipments');
            
            // ✅ If loading from database, skip loading equipment from localStorage (will load from API instead)
            // This prevents old localStorage data from overriding new database data
            let savedSelectedPipesStr: string | null = null;
            let savedSprinklerEquipmentSetsStr: string | null = null;
            let savedZoneSprinklersStr: string | null = null;
            let savedSelectedPumpStr: string | null = null;
            
            if (!isLoadingFromDatabase) {
                // Only load equipment from localStorage if NOT loading from database
                savedSelectedPipesStr = localStorage.getItem('selectedPipes') || localStorage.getItem('horticultureSelectedPipes');
                savedSprinklerEquipmentSetsStr = localStorage.getItem('sprinklerEquipmentSets') || localStorage.getItem('horticultureSprinklerEquipmentSets');
                savedZoneSprinklersStr = localStorage.getItem('zoneSprinklers') || localStorage.getItem('horticultureZoneSprinklers');
                savedSelectedPumpStr = localStorage.getItem('selectedPump') || localStorage.getItem('horticultureSelectedPump');
            } else {
                // Skip localStorage load - will load from API instead
            }

            // Load saved data from localStorage if available
            if (savedZoneInputsStr) {
                try {
                    const parsed = JSON.parse(savedZoneInputsStr);
                    if (parsed && Object.keys(parsed).length > 0) {
                        setZoneInputs(parsed);
                        localStorage.setItem('horticultureZoneInputs', JSON.stringify(parsed));
                    }
                } catch (e) {
                    console.error('Error loading zoneInputs from localStorage:', e);
                }
            }

            if (savedConnectionEquipmentsStr) {
                try {
                    const parsed = JSON.parse(savedConnectionEquipmentsStr);
                    if (parsed && Object.keys(parsed).length > 0) {
                        setConnectionEquipments(parsed);
                        localStorage.setItem('horticultureConnectionEquipments', JSON.stringify(parsed));
                        // Also save to connectionPointEquipmentSelections for ConnectionEquipmentsSelector (format: zoneId-connectionType)
                        const connectionSelections: any = {};
                        Object.entries(parsed).forEach(([zoneId, equipments]: [string, any]) => {
                            if (Array.isArray(equipments)) {
                                equipments.forEach((eq: any) => {
                                    if (eq.equipment && eq.connectionType) {
                                        const key = `${zoneId}-${eq.connectionType}`;
                                        connectionSelections[key] = {
                                            equipment: eq.equipment,
                                            category: eq.category,
                                        };
                                    }
                                });
                            }
                        });
                        if (Object.keys(connectionSelections).length > 0) {
                            localStorage.setItem('connectionPointEquipmentSelections', JSON.stringify(connectionSelections));
                        }
                    }
                } catch (e) {
                    console.error('Error loading connectionEquipments from localStorage:', e);
                }
            }

            // ✅ Only load equipment from localStorage if NOT loading from database
            if (!isLoadingFromDatabase) {
                if (savedSelectedPipesStr) {
                    try {
                        const parsed = JSON.parse(savedSelectedPipesStr);
                        if (parsed && Object.keys(parsed).length > 0) {
                            setSelectedPipes(parsed);
                            localStorage.setItem('horticultureSelectedPipes', JSON.stringify(parsed));
                        }
                        
                        // ✅ Load selectedPipeMaterials from localStorage
                        try {
                            const materialsStr = localStorage.getItem('horticultureSelectedPipeMaterials');
                            if (materialsStr) {
                                const parsed = JSON.parse(materialsStr);
                                setSelectedPipeMaterials(parsed);
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    } catch (e) {
                        console.error('Error loading selectedPipes from localStorage:', e);
                    }
                }

                if (savedSprinklerEquipmentSetsStr) {
                    try {
                        const parsed = JSON.parse(savedSprinklerEquipmentSetsStr);
                        if (parsed && Object.keys(parsed).length > 0) {
                            setSprinklerEquipmentSets(parsed);
                            localStorage.setItem('horticultureSprinklerEquipmentSets', JSON.stringify(parsed));
                        }
                    } catch (e) {
                        console.error('Error loading sprinklerEquipmentSets from localStorage:', e);
                    }
                }

                if (savedZoneSprinklersStr) {
                    try {
                        const parsed = JSON.parse(savedZoneSprinklersStr);
                        if (parsed && Object.keys(parsed).length > 0) {
                            setZoneSprinklers(parsed);
                            localStorage.setItem('horticultureZoneSprinklers', JSON.stringify(parsed));
                        }
                    } catch (e) {
                        console.error('Error loading zoneSprinklers from localStorage:', e);
                    }
                }

                if (savedSelectedPumpStr) {
                    try {
                        const parsed = JSON.parse(savedSelectedPumpStr);
                        if (parsed) {
                            setSelectedPump(parsed);
                            localStorage.setItem('horticultureSelectedPump', JSON.stringify(parsed));
                        }
                    } catch (e) {
                        console.error('Error loading selectedPump from localStorage:', e);
                    }
                }
            }

            const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
            let horticultureSystemData: any = null;
            if (horticultureSystemDataStr) {
                try {
                    horticultureSystemData = JSON.parse(horticultureSystemDataStr);
                    setHorticultureSystemData(horticultureSystemData);

                    if (horticultureSystemData.connectionStats) {
                        setConnectionStats(horticultureSystemData.connectionStats);
                    }
                } catch (error) {
                    console.error('Error parsing current project data:', error);
                }
            } else {
                console.error('No horticulture system data found in localStorage');
            }

            // ✅ Try to load from horticultureProjectData (set by home.tsx)
            const horticultureProjectDataStr = localStorage.getItem('horticultureProjectData');
            let data: HorticultureProject | null = null;
            if (horticultureProjectDataStr) {
                try {
                    data = JSON.parse(horticultureProjectDataStr);
                } catch (error) {
                    console.error('Error parsing horticultureProjectData:', error);
                }
            }

            // ✅ Fallback to currentHorticultureProject if no data loaded yet
            if (!data) {
                const currentProjectDataStr = localStorage.getItem('currentHorticultureProject');
                if (currentProjectDataStr) {
                    try {
                        data = JSON.parse(currentProjectDataStr);
                    } catch (error) {
                        console.error('Error parsing current project data:', error);
                    }
                }
            }

            let stats: any = null;
            if (data) {
                stats = {
                    totalAreaInRai: data.totalArea / 1600,
                    totalPlants: data.plants?.length || 0,
                    zoneDetails:
                        data.zones?.map((zone: Zone) => ({
                            zoneId: zone.id,
                            zoneName: zone.name,
                            areaInRai: zone.area / 1600,
                            plantCount: zone.plantCount || 0,
                        })) || [],
                };
            }

            if (!data && horticultureSystemData) {
                data = {
                    projectName: 'Default Project',
                    totalArea: horticultureSystemData.zones[0]?.area || 1600,
                    zones: horticultureSystemData.zones.map((zone: any) => ({
                        id: zone.id,
                        name: zone.name,
                        plantCount: zone.plantCount,
                        area: zone.area,
                    })),
                    plants: [],
                    useZones: horticultureSystemData.isMultipleZones,
                    irrigationZones: horticultureSystemData.isMultipleZones
                        ? horticultureSystemData.zones
                        : [],
                };

                stats = {
                    totalAreaInRai: data.totalArea / 1600,
                    totalPlants: horticultureSystemData.totalPlants || 0,
                    zoneDetails: horticultureSystemData.zones.map((zone: any) => ({
                        zoneId: zone.id,
                        zoneName: zone.name,
                        areaInRai: zone.area / 1600,
                        plantCount: zone.plantCount || 0,
                    })),
                };
            }

            // ✅ Set projectData even if stats is null (stats can be loaded later)
            // ✅ If no data at all, create minimal data immediately to prevent infinite loading
            if (!data && !horticultureSystemData) {
                const minimalData: HorticultureProject = {
                    projectName: 'โครงการใหม่',
                    totalArea: 1600,
                    zones: [],
                    plants: [],
                    useZones: false,
                    irrigationZones: [],
                };
                setProjectData(minimalData);
                setProjectStats({
                    totalAreaInRai: 1,
                    totalPlants: 0,
                    zoneDetails: [],
                });
                // Create default zoneInputs for minimal data
                const defaultInput: IrrigationInput = {
                    farmSizeRai: 1,
                    totalTrees: 100,
                    waterPerTreeLiters: 50,
                    numberOfZones: 1,
                    sprinklersPerTree: 1,
                    irrigationTimeMinutes: 20,
                    staticHeadM: 0,
                    pressureHeadM: 20,
                    pipeAgeYears: 0,
                    sprinklersPerBranch: 4,
                    branchesPerSecondary: 5,
                    simultaneousZones: 1,
                    sprinklersPerLongestBranch: 4,
                    branchesPerLongestSecondary: 5,
                    secondariesPerLongestMain: 1,
                    longestBranchPipeM: 30,
                    totalBranchPipeM: 100,
                    longestSecondaryPipeM: 0,
                    totalSecondaryPipeM: 0,
                    longestMainPipeM: 0,
                    totalMainPipeM: 0,
                    longestEmitterPipeM: 0,
                    totalEmitterPipeM: 0,
                };
                setZoneInputs({ 'main-area': defaultInput });
                setSelectedPipes({
                    'main-area': {
                        branch: undefined,
                        secondary: undefined,
                        main: undefined,
                        emitter: undefined,
                    },
                });
                setActiveZoneId('main-area');
            } else if (data) {
                setProjectData(data);
                if (stats) {
                    setProjectStats(stats);
                } else {
                    // Create basic stats if data exists but stats doesn't
                    const basicStats = {
                        totalAreaInRai: data.totalArea / 1600,
                        totalPlants: data.plants?.length || 0,
                        zoneDetails: data.zones?.map((zone: Zone) => ({
                            zoneId: zone.id,
                            zoneName: zone.name,
                            areaInRai: zone.area / 1600,
                            plantCount: zone.plantCount || 0,
                        })) || [],
                    };
                    setProjectStats(basicStats);
                }

                // ✅ Check if zoneInputs are already loaded (from database/localStorage)
                const existingZoneInputsStr = localStorage.getItem('zoneInputs') || localStorage.getItem('horticultureZoneInputs');
                let hasExistingZoneInputs = false;
                try {
                    if (existingZoneInputsStr) {
                        const existingZoneInputs = JSON.parse(existingZoneInputsStr);
                        hasExistingZoneInputs = existingZoneInputs && Object.keys(existingZoneInputs).length > 0;
                    }
                } catch (e) {
                    // Ignore parse errors
                }
                const fromHorticultureResults = sessionStorage.getItem('fromHorticultureResults') === 'true';
                // เมื่อมาจาก Results ให้ใช้ความยาวท่อจาก horticultureSystemData เสมอ (ให้ตรงกับ HorticultureResultsPage)
                const shouldBuildFromHorticultureSystem =
                    horticultureSystemData?.zones?.length > 0 &&
                    (fromHorticultureResults || !hasExistingZoneInputs);

                if (shouldBuildFromHorticultureSystem) {
                    if (horticultureSystemData.zones.length > 0) {
                        const initialZoneInputs: { [zoneId: string]: IrrigationInput } = {};
                        const initialSelectedPipes: {
                            [zoneId: string]: {
                                branch?: any;
                                secondary?: any;
                                main?: any;
                                emitter?: any;
                            };
                        } = {};

                        horticultureSystemData.zones.forEach((zone: any) => {
                            initialZoneInputs[zone.id] = {
                            farmSizeRai: formatNumber((zone.area || 0) / 1600, 3),
                            totalTrees: zone.plantCount || 0,
                            waterPerTreeLiters: formatNumber(zone.waterNeedPerMinute || 50, 3),
                            numberOfZones: horticultureSystemData.zones.length || 1,
                            sprinklersPerTree: 1,
                            irrigationTimeMinutes: 20,
                            staticHeadM: 0,
                            pressureHeadM: 20,
                            pipeAgeYears: 0,
                            sprinklersPerBranch: Math.max(1, Math.ceil((zone.plantCount || 0) / 5)),
                            branchesPerSecondary: 1,
                            simultaneousZones: 1,
                            sprinklersPerLongestBranch: Math.max(
                                1,
                                Math.ceil((zone.plantCount || 0) / 5)
                            ),
                            branchesPerLongestSecondary: 1,
                            secondariesPerLongestMain: 1,
                            longestBranchPipeM: formatNumber(zone.pipes?.branchPipes?.longest ?? 30, 2),
                            totalBranchPipeM: formatNumber(zone.pipes?.branchPipes?.totalLength ?? 100, 2),
                            longestSecondaryPipeM: formatNumber(zone.pipes?.subMainPipes?.longest ?? 0, 2),
                            totalSecondaryPipeM: formatNumber(zone.pipes?.subMainPipes?.totalLength ?? 0, 2),
                            longestMainPipeM: formatNumber(zone.pipes?.mainPipes?.longest ?? 0, 2),
                            totalMainPipeM: formatNumber(zone.pipes?.mainPipes?.totalLength ?? 0, 2),
                            longestEmitterPipeM: formatNumber(zone.pipes?.emitterPipes?.longest ?? 0, 2),
                            totalEmitterPipeM: formatNumber(zone.pipes?.emitterPipes?.totalLength ?? 0, 2),
                        };

                        initialSelectedPipes[zone.id] = {
                            branch: undefined,
                            secondary: undefined,
                            main: undefined,
                            emitter: undefined,
                        };
                    });

                        setZoneInputs(initialZoneInputs);
                        setSelectedPipes(initialSelectedPipes);
                        setActiveZoneId(horticultureSystemData.zones[0].id);
                        handleZoneOperationModeChange('sequential');
                        if (fromHorticultureResults) {
                            sessionStorage.removeItem('fromHorticultureResults');
                        }
                    }
                } else if (!hasExistingZoneInputs) {
                    if (data && data.useZones && data.zones.length > 0) {
                        const initialZoneInputs: { [zoneId: string]: IrrigationInput } = {};
                        const initialSelectedPipes: {
                            [zoneId: string]: {
                                branch?: any;
                                secondary?: any;
                                main?: any;
                                emitter?: any;
                            };
                        } = {};

                        data.zones.forEach((zone) => {
                            initialZoneInputs[zone.id] = {
                            farmSizeRai: formatNumber((zone.area || 0) / 1600, 3),
                            totalTrees: zone.plantCount || 100,
                            waterPerTreeLiters: formatNumber(50, 3),
                            numberOfZones: data.zones.length || 1,
                            sprinklersPerTree: 1,
                            irrigationTimeMinutes: 20,
                            staticHeadM: 0,
                            pressureHeadM: 20,
                            pipeAgeYears: 0,
                            sprinklersPerBranch: Math.max(1, Math.ceil((zone.plantCount || 0) / 5)),
                            branchesPerSecondary: 1,
                            simultaneousZones: 1,
                            sprinklersPerLongestBranch: Math.max(
                                1,
                                Math.ceil((zone.plantCount || 0) / 5)
                            ),
                            branchesPerLongestSecondary: 1,
                            secondariesPerLongestMain: 1,
                            longestBranchPipeM: 30,
                            totalBranchPipeM: 100,
                            longestSecondaryPipeM: 0,
                            totalSecondaryPipeM: 0,
                            longestMainPipeM: 0,
                            totalMainPipeM: 0,
                            longestEmitterPipeM: 0,
                            totalEmitterPipeM: 0,
                        };

                        initialSelectedPipes[zone.id] = {
                            branch: undefined,
                            secondary: undefined,
                            main: undefined,
                            emitter: undefined,
                        };
                    });

                        setZoneInputs(initialZoneInputs);
                        setSelectedPipes(initialSelectedPipes);
                        setActiveZoneId(data.zones[0].id);

                        handleZoneOperationModeChange('sequential');
                    } else {
                        const singleInput: IrrigationInput = {
                        farmSizeRai: formatNumber(
                            (horticultureSystemData?.zones?.[0]?.area || data?.totalArea || 1600) /
                                1600,
                            3
                        ),
                        totalTrees:
                            horticultureSystemData?.zones?.[0]?.plantCount ||
                            data?.plants?.length ||
                            100,
                        waterPerTreeLiters: formatNumber(
                            horticultureSystemData?.zones?.[0]?.waterNeedPerMinute || 50,
                            3
                        ),
                        numberOfZones: 1,
                        sprinklersPerTree: 1,
                        irrigationTimeMinutes: 20,
                        staticHeadM: 0,
                        pressureHeadM: 20,
                        pipeAgeYears: 0,
                        sprinklersPerBranch: 4,
                        branchesPerSecondary: 5,
                        simultaneousZones: 1,
                        sprinklersPerLongestBranch: 4,
                        branchesPerLongestSecondary: 5,
                        secondariesPerLongestMain: 1,
                        longestBranchPipeM: formatNumber(
                            horticultureSystemData?.zones?.[0]?.pipes?.branchPipes?.longest ?? 30,
                            2
                        ),
                        totalBranchPipeM: formatNumber(
                            horticultureSystemData?.zones?.[0]?.pipes?.branchPipes?.totalLength ?? 100,
                            2
                        ),
                        longestSecondaryPipeM: formatNumber(
                            horticultureSystemData?.zones?.[0]?.pipes?.subMainPipes?.longest ?? 0,
                            2
                        ),
                        totalSecondaryPipeM: formatNumber(
                            horticultureSystemData?.zones?.[0]?.pipes?.subMainPipes?.totalLength ?? 0,
                            2
                        ),
                        longestMainPipeM: formatNumber(
                            horticultureSystemData?.zones?.[0]?.pipes?.mainPipes?.longest ?? 0,
                            2
                        ),
                        totalMainPipeM: formatNumber(
                            horticultureSystemData?.zones?.[0]?.pipes?.mainPipes?.totalLength ?? 0,
                            2
                        ),
                        longestEmitterPipeM: formatNumber(
                            horticultureSystemData?.zones?.[0]?.pipes?.emitterPipes?.longest ?? 0,
                            2
                        ),
                        totalEmitterPipeM: formatNumber(
                            horticultureSystemData?.zones?.[0]?.pipes?.emitterPipes?.totalLength ?? 0,
                            2
                        ),
                    };
                        setZoneInputs({ 'main-area': singleInput });
                        setSelectedPipes({
                            'main-area': {
                                branch: undefined,
                                secondary: undefined,
                                main: undefined,
                                emitter: undefined,
                            },
                        });
                        setActiveZoneId('main-area');
                    }
                } else {
                    // ✅ zoneInputs already loaded, just set active zone if needed
                    const zoneIds = Object.keys(zoneInputs);
                    if (zoneIds.length > 0 && !activeZoneId) {
                        setActiveZoneId(zoneIds[0]);
                        handleZoneOperationModeChange('sequential');
                    }
                }
            } else {
                // ✅ If we don't have data, create minimal projectData to allow page to render
                const defaultInput: IrrigationInput = {
                    farmSizeRai: 1,
                    totalTrees: 100,
                    waterPerTreeLiters: 50,
                    numberOfZones: 1,
                    sprinklersPerTree: 1,
                    irrigationTimeMinutes: 20,
                    staticHeadM: 0,
                    pressureHeadM: 20,
                    pipeAgeYears: 0,
                    sprinklersPerBranch: 4,
                    branchesPerSecondary: 5,
                    simultaneousZones: 1,
                    sprinklersPerLongestBranch: 4,
                    branchesPerLongestSecondary: 5,
                    secondariesPerLongestMain: 1,
                    longestBranchPipeM: 30,
                    totalBranchPipeM: 100,
                    longestSecondaryPipeM: 0,
                    totalSecondaryPipeM: 0,
                    longestMainPipeM: 0,
                    totalMainPipeM: 0,
                    longestEmitterPipeM: 0,
                    totalEmitterPipeM: 0,
                };

                setZoneInputs({ 'main-area': defaultInput });
                setSelectedPipes({
                    'main-area': {
                        branch: undefined,
                        secondary: undefined,
                        main: undefined,
                        emitter: undefined,
                    },
                });
                setActiveZoneId('main-area');
            }
            
        }
        
        // Reset ref when component unmounts (for navigation)
        return () => {
            initialDataLoadRef.current = false;
        };
    }, [projectMode]); // Run when projectMode changes

    // ✅ Auto-set activeZoneId when zoneInputs are loaded but activeZoneId is not set or invalid
    useEffect(() => {
        const zoneIds = Object.keys(zoneInputs);
        if (zoneIds.length === 0) return;
        const firstZoneId = zoneIds[0];
        const needSetActive = !activeZoneId || !zoneInputs[activeZoneId];
        if (needSetActive && firstZoneId) {
            setActiveZoneId(firstZoneId);
            if (projectMode === 'horticulture') {
                handleZoneOperationModeChange('sequential');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoneInputs, activeZoneId, projectMode]);

    // ✅ Load project stats from database if needed (separate useEffect to avoid blocking)
    // ✅ Always load equipment from API when loading from database to ensure latest saved selections
    useEffect(() => {
        const currentFieldId = localStorage.getItem('currentFieldId');
        const isLoadingFromDatabase = currentFieldId && !currentFieldId.startsWith('mock-');
        
        // ✅ Always load from API if loading from database (to ensure we have latest saved equipment)
        // This ensures that equipment selections are always loaded from database, not from localStorage
        // Even if localStorage has data, we should load from database to get the latest saved selections
        if (isLoadingFromDatabase && currentFieldId && projectMode === 'horticulture') {
            // Always load equipment data from API when loading from database
            
            // ✅ Load equipment data from API even if we have some data in localStorage
            // This ensures we always get the latest saved selections from database
            let isMounted = true;
            
            (async () => {
                try {
                    const response = await fetch(`/api/fields/${currentFieldId}`);
                    if (response.ok && isMounted) {
                        const fieldData = await response.json();
                        if (fieldData.success && fieldData.field && isMounted) {
                            // Load project_stats
                            const projectStats = fieldData.field.projectStats || fieldData.field.project_stats;
                            if (projectStats && isMounted) {
                                const databaseProjectStats = typeof projectStats === 'string' 
                                    ? JSON.parse(projectStats) 
                                    : projectStats;
                                
                                // Restore all saved data
                                if (databaseProjectStats.zoneInputs && isMounted) {
                                    setZoneInputs(databaseProjectStats.zoneInputs);
                                    localStorage.setItem('horticultureZoneInputs', JSON.stringify(databaseProjectStats.zoneInputs));
                                    // ✅ Ensure a zone is active when loading from DB (fix: zone not auto-selected on open)
                                    const loadedZoneIds = Object.keys(databaseProjectStats.zoneInputs);
                                    if (loadedZoneIds.length > 0) {
                                        setActiveZoneId(loadedZoneIds[0]);
                                    }
                                }
                                
                                if (databaseProjectStats.connectionEquipments && isMounted) {
                                    setConnectionEquipments(databaseProjectStats.connectionEquipments);
                                    localStorage.setItem('horticultureConnectionEquipments', JSON.stringify(databaseProjectStats.connectionEquipments));
                                    // Also save to connectionPointEquipmentSelections (format: zoneId-connectionType)
                                    const connectionSelections: any = {};
                                    Object.entries(databaseProjectStats.connectionEquipments).forEach(([zoneId, equipments]: [string, any]) => {
                                        if (Array.isArray(equipments)) {
                                            equipments.forEach((eq: any) => {
                                                if (eq.equipment && eq.connectionType) {
                                                    const key = `${zoneId}-${eq.connectionType}`;
                                                    connectionSelections[key] = {
                                                        equipment: eq.equipment,
                                                        category: eq.category,
                                                    };
                                                }
                                            });
                                        }
                                    });
                                    if (Object.keys(connectionSelections).length > 0) {
                                        localStorage.setItem('connectionPointEquipmentSelections', JSON.stringify(connectionSelections));
                                    }
                                }
                                
                                if (databaseProjectStats.selectedPipes && isMounted) {
                                    setSelectedPipes(databaseProjectStats.selectedPipes);
                                    localStorage.setItem('horticultureSelectedPipes', JSON.stringify(databaseProjectStats.selectedPipes));
                                }
                                
                                if (databaseProjectStats.sprinklerEquipmentSets && isMounted) {
                                    setSprinklerEquipmentSets(databaseProjectStats.sprinklerEquipmentSets);
                                    localStorage.setItem('horticultureSprinklerEquipmentSets', JSON.stringify(databaseProjectStats.sprinklerEquipmentSets));
                                }
                                
                                if (databaseProjectStats.zoneSprinklers && isMounted) {
                                    // ✅ Normalize productCode/product_code for each zone sprinkler
                                    const normalizedZoneSprinklers: any = {};
                                    Object.entries(databaseProjectStats.zoneSprinklers).forEach(([zoneId, sprinkler]: [string, any]) => {
                                        if (sprinkler) {
                                            normalizedZoneSprinklers[zoneId] = {
                                                ...sprinkler,
                                                // ✅ Ensure productCode exists (use product_code if productCode doesn't exist)
                                                productCode: sprinkler.productCode || sprinkler.product_code || sprinkler.id,
                                                product_code: sprinkler.product_code || sprinkler.productCode || sprinkler.id,
                                            };
                                        }
                                    });
                                    setZoneSprinklers(normalizedZoneSprinklers);
                                    localStorage.setItem('horticultureZoneSprinklers', JSON.stringify(normalizedZoneSprinklers));
                                }
                                
                                if (databaseProjectStats.selectedPipes && isMounted) {
                                    // ✅ Normalize selectedPipes to ensure id exists for each pipe
                                    const normalizedSelectedPipes: any = {};
                                    Object.entries(databaseProjectStats.selectedPipes).forEach(([zoneId, pipes]: [string, any]) => {
                                        if (pipes) {
                                            normalizedSelectedPipes[zoneId] = {};
                                            ['branch', 'secondary', 'main', 'emitter'].forEach((pipeType) => {
                                                if (pipes[pipeType]) {
                                                    const originalPipe = pipes[pipeType];
                                                    normalizedSelectedPipes[zoneId][pipeType] = {
                                                        ...originalPipe,
                                                        // ✅ Ensure id exists (use productCode or product_code if id doesn't exist)
                                                        id: originalPipe.id || originalPipe.productCode || originalPipe.product_code,
                                                        productCode: originalPipe.productCode || originalPipe.product_code || originalPipe.id,
                                                        product_code: originalPipe.product_code || originalPipe.productCode || originalPipe.id,
                                                    };
                                                }
                                            });
                                        }
                                    });
                                    setSelectedPipes(normalizedSelectedPipes);
                                    localStorage.setItem('horticultureSelectedPipes', JSON.stringify(normalizedSelectedPipes));
                                }
                                
                                // ✅ Load selectedPipeMaterials from database
                                if (databaseProjectStats.selectedPipeMaterials && isMounted) {
                                    setSelectedPipeMaterials(databaseProjectStats.selectedPipeMaterials);
                                    localStorage.setItem('horticultureSelectedPipeMaterials', JSON.stringify(databaseProjectStats.selectedPipeMaterials));
                                }
                                
                                if (databaseProjectStats.selectedPump && isMounted) {
                                    // ✅ Normalize selectedPump to ensure productCode exists
                                    const normalizedSelectedPump = {
                                        ...databaseProjectStats.selectedPump,
                                        // ✅ Ensure productCode exists (use product_code if productCode doesn't exist)
                                        productCode: databaseProjectStats.selectedPump.productCode || databaseProjectStats.selectedPump.product_code || databaseProjectStats.selectedPump.id,
                                        product_code: databaseProjectStats.selectedPump.product_code || databaseProjectStats.selectedPump.productCode || databaseProjectStats.selectedPump.id,
                                    };
                                    setSelectedPump(normalizedSelectedPump);
                                    localStorage.setItem('horticultureSelectedPump', JSON.stringify(normalizedSelectedPump));
                                }
                                
                                if (databaseProjectStats.results && isMounted) {
                                    localStorage.setItem('horticultureResults', JSON.stringify(databaseProjectStats.results));
                                }
                                
                                if (isMounted) {
                                    setProjectStats(databaseProjectStats);
                                }
                            }
                        }
                    }
                } catch (error) {
                    if (isMounted) {
                        console.error('❌ Error loading project from database:', error);
                    }
                }
            })();
            
            return () => {
                isMounted = false;
            };
        }
    }, [projectMode]); // Run when projectMode changes or on mount if loading from database

    // โหลด sprinkler และอุปกรณ์สำหรับทุกโซนโดยอัตโนมัติเมื่อโหลดข้อมูลครั้งแรก
    // ✅ แต่ไม่โหลดถ้ามีข้อมูลจากฐานข้อมูลแล้ว (เพื่อไม่ให้ override ข้อมูลที่บันทึกไว้)
    useEffect(() => {
        const currentFieldId = localStorage.getItem('currentFieldId');
        const isLoadingFromDatabase = currentFieldId && !currentFieldId.startsWith('mock-');
        
        // ถ้ากำลังโหลดจากฐานข้อมูล ให้ไม่โหลด default sprinkler (รอให้ข้อมูลจากฐานข้อมูลโหลดก่อน)
        if (isLoadingFromDatabase) {
            // Skip auto-load sprinkler when loading from database
            return;
        }
        
        // ตรวจสอบว่ามี zoneInputs และยังไม่มี zoneSprinklers สำหรับบางโซน
        const allZoneIds: string[] = [];
        
        if (projectMode === 'garden' && gardenStats) {
            allZoneIds.push(...gardenStats.zones.map((z) => z.zoneId));
        } else if (projectMode === 'field-crop' && fieldCropData) {
            allZoneIds.push(...fieldCropData.zones.info.map((z: any) => String(z.id)));
        } else if (projectMode === 'greenhouse' && greenhouseData) {
            allZoneIds.push(...greenhouseData.summary.plotStats.map((p) => p.plotId));
        } else if (projectMode === 'horticulture' && (projectData || horticultureSystemData)) {
            if (horticultureSystemData?.zones) {
                allZoneIds.push(...horticultureSystemData.zones.map((z: any) => String(z.id)));
            } else if (projectData?.zones) {
                allZoneIds.push(...projectData.zones.map((z) => String(z.id)));
            }
        }

        // โหลด sprinkler สำหรับทุกโซนที่ยังไม่มี
        if (allZoneIds.length > 0 && Object.keys(zoneInputs).length > 0) {
            const zonesToLoad = allZoneIds.filter((zoneId) => 
                zoneInputs[zoneId] && !zoneSprinklers[zoneId]
            );

            // ถ้ามีโซนที่ต้องโหลด
            if (zonesToLoad.length > 0) {
                // ก่อนใช้ default: ถ้ามีโซนใดโซนหนึ่งมี sprinkler อยู่แล้ว ให้ copy ไปโซนที่ยังไม่มี (ให้ครบทุกโซนโดยไม่ต้องเปิดทีละโซน)
                const firstZoneWithSprinkler = allZoneIds.find((id) => zoneSprinklers[id]);
                if (firstZoneWithSprinkler && zoneSprinklers[firstZoneWithSprinkler]) {
                    const sourceSprinkler = zoneSprinklers[firstZoneWithSprinkler];
                    const newZoneSprinklers: { [zoneId: string]: any } = {};
                    zonesToLoad.forEach((zoneId) => {
                        newZoneSprinklers[zoneId] = sourceSprinkler;
                    });
                    if (Object.keys(newZoneSprinklers).length > 0) {
                        setZoneSprinklers((prev) => ({ ...prev, ...newZoneSprinklers }));
                    }
                } else if (projectMode === 'garden' && gardenData && gardenStats && results?.analyzedSprinklers) {
                    const newZoneSprinklers: { [zoneId: string]: any } = {};
                    
                    zonesToLoad.forEach((zoneId) => {
                        const zone = gardenStats.zones.find((z) => z.zoneId === zoneId);
                        if (zone && results.analyzedSprinklers) {
                            const targetFlowRate = zone.sprinklerFlowRate || 6.0;
                            const targetPressure = zone.sprinklerPressure || 2.5;
                            
                            const compatibleSprinklers = (results?.analyzedSprinklers || []).filter((eq: any) => {
                                const eqFlow = Array.isArray(eq.waterVolumeLitersPerMinute)
                                    ? (eq.waterVolumeLitersPerMinute[0] + eq.waterVolumeLitersPerMinute[1]) / 2
                                    : eq.waterVolumeLitersPerMinute || 0;
                                const eqPressure = Array.isArray(eq.pressureBar)
                                    ? (eq.pressureBar[0] + eq.pressureBar[1]) / 2
                                    : eq.pressureBar || 0;
                                
                                const flowMatch = Math.abs(eqFlow - targetFlowRate) <= Math.max(targetFlowRate * 0.35, 2);
                                const pressureMatch = Math.abs(eqPressure - targetPressure) <= Math.max(targetPressure * 0.35, 1);
                                
                                return flowMatch && pressureMatch;
                            });
                            
                            if (compatibleSprinklers.length > 0) {
                                newZoneSprinklers[zoneId] = compatibleSprinklers.sort((a: any, b: any) => a.price - b.price)[0];
                            }
                        }
                    });
                    
                    if (Object.keys(newZoneSprinklers).length > 0) {
                        setZoneSprinklers((prev) => ({ ...prev, ...newZoneSprinklers }));
                    }
                } else {
                    // ใช้ setTimeout เพื่อให้โหลดหลังจาก render เสร็จแล้ว
                    setTimeout(() => {
                        zonesToLoad.forEach((zoneId) => {
                            // ใช้ default sprinkler จาก localStorage สำหรับ mode อื่นๆ
                            const defaultSprinklerStr = localStorage.getItem(
                                `${projectMode}_defaultSprinkler`
                            );
                            
                            if (defaultSprinklerStr) {
                                try {
                                    const defaultSprinkler = JSON.parse(defaultSprinklerStr);
                                    setZoneSprinklers((prev) => ({
                                        ...prev,
                                        [zoneId]: defaultSprinkler,
                                    }));
                                } catch (error) {
                                    console.error('Error parsing default sprinkler:', error);
                                }
                            }
                        });
                    }, 500);
                }
            }
        }
    }, [zoneInputs, projectMode, gardenStats, fieldCropData, greenhouseData, projectData, horticultureSystemData, zoneSprinklers]);

    // ให้ท่อที่เลือกครบทุกโซน: ถ้าโซนแรกที่มีท่อมี branch/secondary/main ให้ copy ไปโซนอื่นทีละ type
    // (ตรวจสอบทีละ type ไม่ใช่ "โซนที่ไม่มีเลย" เพื่อให้ secondary/main ถูก copy แม้โซนนั้นมี branch แล้ว)
    useEffect(() => {
        const currentFieldId = typeof localStorage !== 'undefined' ? localStorage.getItem('currentFieldId') : null;
        if (currentFieldId && !currentFieldId.startsWith('mock-')) return;

        const zoneIds: string[] = [];
        if (projectMode === 'field-crop' && fieldCropData?.zones?.info?.length) {
            zoneIds.push(...fieldCropData.zones.info.map((z: any) => String(z.id)));
        } else if (projectMode === 'horticulture' && (horticultureSystemData?.zones?.length || projectData?.zones?.length)) {
            const zones = horticultureSystemData?.zones || projectData?.zones || [];
            zoneIds.push(...zones.map((z: any) => String(z.id)));
        }
        if (zoneIds.length <= 1) return;

        const firstZoneWithPipes = zoneIds.find((id) => {
            const p = selectedPipes[id];
            return p && (p.branch || p.secondary || p.main);
        });
        if (!firstZoneWithPipes || !selectedPipes[firstZoneWithPipes]) return;

        const source = selectedPipes[firstZoneWithPipes];

        // ตรวจสอบว่ามีโซนอื่นที่ยังขาด pipe type ใด type หนึ่ง (ไม่ใช่แค่ "ขาดทั้งหมด")
        const otherZones = zoneIds.filter((id) => id !== firstZoneWithPipes);
        const needsCopy = otherZones.some((id) => {
            const p = selectedPipes[id] || {};
            return (!p.branch && source.branch) ||
                   (!p.secondary && source.secondary) ||
                   (!p.main && source.main) ||
                   (!p.emitter && source.emitter);
        });
        if (!needsCopy) return;

        setSelectedPipes((prev) => {
            let changed = false;
            const next = { ...prev };
            otherZones.forEach((zoneId) => {
                const cur = next[zoneId] || {};
                if (!cur.branch && source.branch) { next[zoneId] = { ...next[zoneId], branch: source.branch }; changed = true; }
                if (!cur.secondary && source.secondary) { next[zoneId] = { ...next[zoneId], secondary: source.secondary }; changed = true; }
                if (!cur.main && source.main) { next[zoneId] = { ...next[zoneId], main: source.main }; changed = true; }
                if (!cur.emitter && source.emitter) { next[zoneId] = { ...next[zoneId], emitter: source.emitter }; changed = true; }
            });
            return changed ? next : prev;
        });
    }, [projectMode, fieldCropData, horticultureSystemData, projectData, selectedPipes]);

    // เมื่อ showPumpOption เปลี่ยนเป็น false และ activeTab เป็น 4 ให้เปลี่ยนไป Tab 5
    useEffect(() => {
        if (!showPumpOption && activeTab === 4) {
            setActiveTab(5);
            setVisitedTabs((prev) => new Set([...prev, 5]));
        }
    }, [showPumpOption, activeTab]);

    const currentSprinkler = zoneSprinklers[activeZoneId] || null;
    

    const handleSprinklerChange = (sprinkler: any) => {
        if (activeZoneId && sprinkler) {
            // ✅ Normalize sprinkler to ensure productCode and product_code are always present
            const normalizedSprinkler = {
                ...sprinkler,
                productCode: sprinkler.productCode || sprinkler.product_code || sprinkler.id,
                product_code: sprinkler.product_code || sprinkler.productCode || sprinkler.id,
            };
            
            setZoneSprinklers((prev) => ({
                ...prev,
                [activeZoneId]: normalizedSprinkler,
            }));
        }
    };

    const handlePipeChange = useCallback(
        (pipeType: 'branch' | 'secondary' | 'main' | 'emitter', pipe: any) => {
            if (activeZoneId && pipe) {
                // ✅ Normalize pipe to ensure productCode and product_code are always present
                const normalizedPipe = {
                    ...pipe,
                    productCode: pipe.productCode || pipe.product_code || pipe.id,
                    product_code: pipe.product_code || pipe.productCode || pipe.id,
                };
                
                setSelectedPipes((prev) => ({
                    ...prev,
                    [activeZoneId]: {
                        ...prev[activeZoneId],
                        [pipeType]: normalizedPipe,
                    },
                }));
            }
        },
        [activeZoneId]
    );

    // สำหรับ field-crop: ตั้งค่าท่อให้โซนที่ระบุ (ใช้เมื่อ render PipeSelector แบบ hidden)
    const handlePipeChangeForZone = useCallback(
        (pipeType: 'branch' | 'secondary' | 'main' | 'emitter', pipe: any, zoneId: string) => {
            if (zoneId && pipe) {
                const normalizedPipe = {
                    ...pipe,
                    productCode: pipe.productCode || pipe.product_code || pipe.id,
                    product_code: pipe.product_code || pipe.productCode || pipe.id,
                };
                setSelectedPipes((prev) => ({
                    ...prev,
                    [zoneId]: {
                        ...prev[zoneId],
                        [pipeType]: normalizedPipe,
                    },
                }));
            }
        },
        []
    );

    // ✅ Handle pipe material type change (PE/PVC)
    const handlePipeMaterialChange = useCallback(
        (pipeType: 'branch' | 'secondary' | 'main' | 'emitter', material: 'PE' | 'PVC') => {
            if (activeZoneId) {
                setSelectedPipeMaterials((prev) => ({
                    ...prev,
                    [activeZoneId]: {
                        ...prev[activeZoneId],
                        [pipeType]: material,
                    },
                }));
            }
        },
        [activeZoneId]
    );

    const handleBranchPipeChange = useCallback(
        (pipe: any) => {
            handlePipeChange('branch', pipe);
        },
        [handlePipeChange]
    );

    const handleBranchPipeMaterialChange = useCallback(
        (material: 'PE' | 'PVC') => {
            handlePipeMaterialChange('branch', material);
        },
        [handlePipeMaterialChange]
    );

    const handleSecondaryPipeChange = useCallback(
        (pipe: any) => {
            handlePipeChange('secondary', pipe);
        },
        [handlePipeChange]
    );

    const handleSecondaryPipeMaterialChange = useCallback(
        (material: 'PE' | 'PVC') => {
            handlePipeMaterialChange('secondary', material);
        },
        [handlePipeMaterialChange]
    );

    const handleMainPipeChange = useCallback(
        (pipe: any) => {
            handlePipeChange('main', pipe);
        },
        [handlePipeChange]
    );

    const handleMainPipeMaterialChange = useCallback(
        (material: 'PE' | 'PVC') => {
            handlePipeMaterialChange('main', material);
        },
        [handlePipeMaterialChange]
    );

    const handleEmitterPipeChange = useCallback(
        (pipe: any) => {
            handlePipeChange('emitter', pipe);
        },
        [handlePipeChange]
    );

    const handleEmitterPipeMaterialChange = useCallback(
        (material: 'PE' | 'PVC') => {
            handlePipeMaterialChange('emitter', material);
        },
        [handlePipeMaterialChange]
    );

    const handlePumpChange = (pump: any) => {
        if (pump) {
            // ✅ Normalize pump to ensure productCode and product_code are always present
            const normalizedPump = {
                ...pump,
                productCode: pump.productCode || pump.product_code || pump.id,
                product_code: pump.product_code || pump.productCode || pump.id,
            };
            setSelectedPump(normalizedPump);
        } else {
            setSelectedPump(null);
        }
    };

    const allZoneData = useMemo(() => {
        return createZoneCalculationData();
    }, [zoneInputs, zoneSprinklers, zoneOperationMode, zoneOperationGroups]);

    const results = useCalculations(
        currentInput as IrrigationInput,
        currentSprinkler,
        allZoneData,
        zoneOperationGroups
    );


    const hasValidMainPipeData = results?.hasValidMainPipe ?? false;
    const hasValidSubmainPipeData = results?.hasValidSecondaryPipe ?? false;

    const shouldShowSecondaryPipe =
        projectMode === 'garden' || projectMode === 'greenhouse' ? false : hasValidSubmainPipeData;
    const shouldShowMainPipe = projectMode === 'garden' ? false : hasValidMainPipeData;

    // ✅ การคำนวณครั้งแรก: ตั้งท่อและปั๊มที่ดีที่สุดจาก results ลง state (results ใช้เกณฑ์ 20% head แล้ว)
    const hasAppliedAutoSelectedRef = useRef(false);
    useEffect(() => {
        // horticulture, garden: ตั้งค่าท่อจาก results.autoSelected* ให้ครบทุกโซน
        // field-crop: ไม่ใช้ results.autoSelected* (คำนวณจาก aggregate) เพราะ PipeSelector เลือกท่อต่อโซน (flow/length ต่างกัน) → ใช้ "copy from first zone" แทน
        if ((projectMode !== 'horticulture' && projectMode !== 'garden') || !results) return;
        const currentFieldId = localStorage.getItem('currentFieldId');
        const isLoadingFromDatabase = currentFieldId && !currentFieldId.startsWith('mock-');
        if (isLoadingFromDatabase) return;

        const hasAutoPipes =
            results.autoSelectedBranchPipe ||
            results.autoSelectedSecondaryPipe ||
            results.autoSelectedMainPipe ||
            results.autoSelectedEmitterPipe;
        const hasAutoPump = results.autoSelectedPump;
        if (!hasAutoPipes && !hasAutoPump) return;

        const zoneIds = Object.keys(zoneInputs);
        if (zoneIds.length === 0) return;

        // เมื่อมาจาก HorticultureResults หรือ Garden: pipeData โหลดแบบ async → PipeSelector อาจเลือกท่อไปก่อน
        // ให้ overwrite ทุก zone ด้วย results.autoSelected* เมื่อ results พร้อม (ไม่เช็ค needPipes)
        const fromHorticultureResults =
            typeof sessionStorage !== 'undefined' &&
            sessionStorage.getItem('fromHorticultureResults') === 'true';
        // Garden: ใช้ผลอัตโนมัติเสมอครั้งแรก (เหมือนกดปุ่มเลือกอัตโนมัติ) เพื่อไม่ให้เลือกท่อผิด
        const fromGardenOrHorticulture = fromHorticultureResults || projectMode === 'garden';

        const needPipes = zoneIds.some(
            (zoneId) =>
                !selectedPipes[zoneId]?.branch &&
                !selectedPipes[zoneId]?.secondary &&
                !selectedPipes[zoneId]?.main &&
                !selectedPipes[zoneId]?.emitter
        );
        const needPump = !selectedPump;
        const shouldApplyPipes = fromGardenOrHorticulture ? hasAutoPipes : needPipes && hasAutoPipes;
        const shouldApplyPump = fromGardenOrHorticulture ? hasAutoPump : needPump && hasAutoPump;
        if (!shouldApplyPipes && !shouldApplyPump) return;
        if (hasAppliedAutoSelectedRef.current) return;

        hasAppliedAutoSelectedRef.current = true;
        if (fromHorticultureResults && typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('fromHorticultureResults');
        }

        const normalizePipe = (p: any) =>
            p
                ? {
                      ...p,
                      productCode: p.productCode || p.product_code || p.id,
                      product_code: p.product_code || p.productCode || p.id,
                  }
                : undefined;

        if (shouldApplyPipes && hasAutoPipes && results) {
            const analyzedBranch = results.analyzedBranchPipes ?? [];
            const head20Garden =
                (typeof gardenSystemData?.sprinklerConfig?.pressureBar === 'number'
                    ? gardenSystemData.sprinklerConfig.pressureBar
                    : 2.5) *
                10.197 *
                0.2;

            // โหมด garden: ใช้ logic เดียวกับปุ่ม "กลับไปใช้การเลือกอัตโนมัติ" = selectBestPipeByHeadLoss ต่อ zone
            const getBranchForZone = (zoneId: string): any => {
                if (projectMode !== 'garden' || !gardenSystemData?.zones || analyzedBranch.length === 0) {
                    const pvcBranch = analyzedBranch.filter(
                        (p: any) =>
                            (p.pipeType && String(p.pipeType).toUpperCase() === 'PVC') ||
                            (p.type && String(p.type).toUpperCase() === 'PVC')
                    );
                    const sorted = (pvcBranch.length > 0 ? pvcBranch : analyzedBranch)
                        .slice()
                        .sort((a: any, b: any) => {
                            const aHL = Number(a.headLoss);
                            const bHL = Number(b.headLoss);
                            if (!Number.isFinite(aHL)) return 1;
                            if (!Number.isFinite(bHL)) return -1;
                            return aHL - bHL;
                        });
                    return sorted[0] ?? results.autoSelectedBranchPipe;
                }
                const zone = gardenSystemData.zones.find((z: any) => z.id === zoneId);
                const bestPipeInfo = zone?.bestPipes?.branch;
                if (!bestPipeInfo) {
                    const sorted = analyzedBranch
                        .filter(
                            (p: any) =>
                                (p.pipeType && String(p.pipeType).toUpperCase() === 'PVC') ||
                                (p.type && String(p.type).toUpperCase() === 'PVC')
                        )
                        .slice()
                        .sort((a: any, b: any) => Number(a.headLoss) - Number(b.headLoss));
                    return sorted[0] ?? results.autoSelectedBranchPipe;
                }
                const chosen = selectBestPipeByHeadLoss(
                    analyzedBranch,
                    'branch',
                    bestPipeInfo,
                    'PVC',
                    {},
                    head20Garden
                );
                return chosen ?? results.autoSelectedBranchPipe;
            };

            setSelectedPipes((prev) => {
                const next = { ...prev };
                zoneIds.forEach((zoneId) => {
                    const cur = prev[zoneId] || {};
                    if (fromGardenOrHorticulture || !(cur.branch || cur.secondary || cur.main || cur.emitter)) {
                        const branchToApply =
                            projectMode === 'garden' ? getBranchForZone(zoneId) : results.autoSelectedBranchPipe;
                        next[zoneId] = {
                            branch: normalizePipe(branchToApply) ?? cur.branch,
                            secondary: normalizePipe(results.autoSelectedSecondaryPipe) ?? cur.secondary,
                            main: normalizePipe(results.autoSelectedMainPipe) ?? cur.main,
                            emitter: normalizePipe(results.autoSelectedEmitterPipe) ?? cur.emitter,
                        };
                    }
                });
                return next;
            });
        }

        // โหมด garden: ไม่เซ็ตปั๊มที่นี่ — ให้ PumpSelector เลือกปั๊มเอง (ใช้ gardenReq + maxPumpHeadWithSafety ที่อัปเดตแล้ว) เพื่อให้ได้ตัวที่เหมาะสม
        if (shouldApplyPump && hasAutoPump && projectMode !== 'garden') {
            const pump = results.autoSelectedPump as any;
            if (pump) {
                setSelectedPump({
                    ...pump,
                    productCode: pump.productCode || pump.product_code || pump.id,
                    product_code: pump.product_code || pump.productCode || pump.id,
                });
            }
        }
    }, [
        projectMode,
        results,
        zoneInputs,
        selectedPipes,
        selectedPump,
        gardenSystemData,
    ]);

    // field-crop: คำนวณท่อที่ถูกต้องต่อโซนตั้งแต่โหลดหน้า ใช้ algorithm เดียวกับ PipeSelector (selectBestPipeByHeadLoss ต่อโซน)
    // - ทำงานครั้งเดียวเมื่อ fieldCropData พร้อม (ไม่ขึ้นกับ selectedPipes เพื่อไม่ให้รัน loop ซ้ำ)
    // - เขียนทับทุกโซน (ไม่ skip โซนที่มีท่อแล้ว) เพื่อไม่ให้ถูกรบกวนจาก copy effect
    const hasAppliedFieldCropPipesRef = useRef(false);
    useEffect(() => {
        if (projectMode !== 'field-crop' || !fieldCropData?.zones?.info?.length) return;
        const currentFieldId = typeof localStorage !== 'undefined' ? localStorage.getItem('currentFieldId') : null;
        if (currentFieldId && !currentFieldId.startsWith('mock-')) return;
        if (hasAppliedFieldCropPipesRef.current) return;
        hasAppliedFieldCropPipesRef.current = true;

        const fetchAndSelectPipes = async () => {
            try {
                let allPipes: any[] = [];
                const endpoints = ['/api/equipments/by-category/pipe', '/api/equipments/category/pipe', '/api/equipments?category=pipe'];
                for (const endpoint of endpoints) {
                    try {
                        const res = await fetch(endpoint);
                        if (res.ok) { allPipes = await res.json(); break; }
                    } catch { continue; }
                }
                if (!allPipes.length) return;

                const getPipes = (material: 'PE' | 'PVC', minPN: number) =>
                    allPipes.filter((p: any) => {
                        const t = (p.pipeType || p.type || '').toLowerCase();
                        return t === material.toLowerCase() && typeof p.pn === 'number' && p.pn >= minPN;
                    });

                const fcData = fieldCropData;
                const irrigationByType = fcData.irrigation?.byType || {};
                let pressureBar = 2.5;
                if (irrigationByType.dripTape > 0) pressureBar = 1.0;
                else if (irrigationByType.pivot > 0) pressureBar = 3.0;
                else if (irrigationByType.waterJetTape > 0) pressureBar = 1.5;
                const head20Percent = pressureBar * 10 * 0.2;

                const perSprinklerLmin = (fcData as any)?.irrigationSettings?.sprinkler_system?.flow ?? 30;
                const totalProjectSprinklers =
                    (fcData.summary as any)?.totalSprinklerCount ??
                    fcData.zones?.info?.reduce((s: number, z: any) => s + (z.sprinklerCount ?? 0), 0) ?? 1;

                const getZoneFlow = (zone: any, key: 'lateral' | 'submain' | 'main') => {
                    const camel = key === 'lateral' ? 'lateralFlowLMin' : key === 'submain' ? 'submainFlowLMin' : 'mainFlowLMin';
                    const snake = key === 'lateral' ? 'lateral_flow_l_min' : key === 'submain' ? 'submain_flow_l_min' : 'main_flow_l_min';
                    const v = (zone as any)[camel] ?? (zone as any)[snake];
                    return typeof v === 'number' && v > 0 ? v : undefined;
                };
                const getLongest = (zone: any, type: 'lateral' | 'submain' | 'main') => {
                    const zoneStats = (zone?.pipeStats as any)?.[type] ?? (fcData.pipes?.stats as any)?.[type];
                    if (!zoneStats) return type === 'lateral' ? 50 : type === 'submain' ? 100 : 200;
                    const len = zoneStats.longestLength ?? zoneStats.longest ?? (type === 'lateral' ? 50 : type === 'submain' ? 100 : 200);
                    return Number(len) || (type === 'lateral' ? 50 : type === 'submain' ? 100 : 200);
                };

                const normPipe = (p: any) => p ? {
                    ...p,
                    productCode: p.productCode || p.product_code || p.id,
                    product_code: p.product_code || p.productCode || p.id,
                } : undefined;

                const newPipes: { [zoneId: string]: { branch?: any; secondary?: any; main?: any } } = {};

                for (const zone of fcData.zones.info) {
                    const zoneId = String(zone.id);
                    const zoneAny = zone as any;
                    const branchOutlets = zoneAny.lateralOutlets ?? zoneAny.sprinklersOnLongestLateral ?? (zone.sprinklerCount ?? 1);
                    const secondaryOutlets = zoneAny.submainOutlets ?? zoneAny.connectedLaterals ?? 1;

                    const branchInfo = {
                        id: 'branch-pipe-field-crop', length: getLongest(zone, 'lateral'),
                        count: Math.max(Math.round(branchOutlets), 1),
                        sprinklerCount: Math.max(Math.round(branchOutlets), 1),
                        waterFlowRate: getZoneFlow(zone, 'lateral') ?? Math.max(1, perSprinklerLmin * Math.max(Math.round(branchOutlets), 1)),
                        details: { type: 'branch' },
                    };
                    const secondaryInfo = {
                        id: 'secondary-pipe-field-crop', length: getLongest(zone, 'submain'),
                        count: Math.max(Math.round(secondaryOutlets), 1),
                        waterFlowRate: getZoneFlow(zone, 'submain') ?? Math.max(1, perSprinklerLmin * Math.max(Math.round(branchOutlets), 1) * Math.max(Math.round(secondaryOutlets), 1)),
                        details: { type: 'secondary' },
                    };
                    const mainInfo = {
                        id: 'main-pipe-field-crop', length: getLongest(zone, 'main'),
                        count: 1,
                        waterFlowRate: getZoneFlow(zone, 'main') ?? Math.max(1, perSprinklerLmin * Math.max(totalProjectSprinklers, 1)),
                        details: { type: 'main' },
                    };

                    const branchBest =
                        selectBestPipeByHeadLoss(getPipes('PVC', pressureBar), 'branch', branchInfo, 'PVC', {}, head20Percent, { preferSmallestValidPipe: true }) ||
                        selectBestPipeByHeadLoss(getPipes('PE', pressureBar), 'branch', branchInfo, 'PE', {}, head20Percent, { preferSmallestValidPipe: true });

                    const branchSizes = branchBest ? { branch: branchBest.sizeMM } : {};

                    const secondaryBest =
                        selectBestPipeByHeadLoss(getPipes('PE', pressureBar), 'secondary', secondaryInfo, 'PE', branchSizes, head20Percent, { preferSmallestValidPipe: true }) ||
                        selectBestPipeByHeadLoss(getPipes('PVC', pressureBar), 'secondary', secondaryInfo, 'PVC', branchSizes, head20Percent, { preferSmallestValidPipe: true });

                    const secondarySizes = { ...branchSizes, secondary: secondaryBest?.sizeMM ?? 0 };

                    const mainBest =
                        selectBestPipeByHeadLoss(getPipes('PE', pressureBar), 'main', mainInfo, 'PE', secondarySizes, head20Percent, { preferSmallestValidPipe: true }) ||
                        selectBestPipeByHeadLoss(getPipes('PVC', pressureBar), 'main', mainInfo, 'PVC', secondarySizes, head20Percent, { preferSmallestValidPipe: true });

                    newPipes[zoneId] = {
                        branch: normPipe(branchBest),
                        secondary: normPipe(secondaryBest),
                        main: normPipe(mainBest),
                    };
                }

                if (!Object.keys(newPipes).length) return;

                // เขียนทับทุกโซนด้วยท่อที่คำนวณถูกต้องต่อโซน (ไม่ข้ามโซนที่มีท่อแล้ว เพราะท่อที่ copy มาอาจผิด)
                setSelectedPipes((prev) => {
                    const next = { ...prev };
                    Object.entries(newPipes).forEach(([zoneId, pipes]) => {
                        // ข้ามถ้า user เคยเลือกท่อเองในโซนนี้แล้ว (มีท่อครบทั้ง 3 ประเภท)
                        const cur = next[zoneId] || {};
                        const userSelectedAll = cur.branch && cur.secondary && cur.main;
                        if (!userSelectedAll) {
                            next[zoneId] = { ...cur, ...pipes };
                        }
                    });
                    return next;
                });
            } catch (err) {
                console.warn('[FieldCrop] auto-select pipes error', err);
            }
        };

        fetchAndSelectPipes();
    // ไม่ใส่ selectedPipes ใน deps เพื่อให้ effect รันครั้งเดียวตอน fieldCropData พร้อม
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectMode, fieldCropData]);

    // field-crop: ตั้งค่า sprinkler ให้ครบทุกโซนจาก results.analyzedSprinklers เมื่อยังไม่มี (ไม่ต้องเปิด tab สปริงเกอร์ทีละโซน)
    const hasAppliedFieldCropSprinklerRef = useRef(false);
    useEffect(() => {
        if (projectMode !== 'field-crop' || !results?.analyzedSprinklers?.length || !fieldCropData?.zones?.info?.length)
            return;
        const zoneIds = fieldCropData.zones.info.map((z: any) => String(z.id));
        if (zoneIds.length <= 1) return;

        const zonesWithoutSprinkler = zoneIds.filter((id) => !zoneSprinklers[id]);
        if (zonesWithoutSprinkler.length === 0) return;
        if (hasAppliedFieldCropSprinklerRef.current) return;

        const sorted = [...(results.analyzedSprinklers || [])].sort(
            (a: any, b: any) => (a.price ?? 0) - (b.price ?? 0)
        );
        const defaultSprinkler = sorted[0];
        if (!defaultSprinkler) return;

        hasAppliedFieldCropSprinklerRef.current = true;
        const newZoneSprinklers: { [zoneId: string]: any } = {};
        zonesWithoutSprinkler.forEach((zoneId) => {
            newZoneSprinklers[zoneId] = defaultSprinkler;
        });
        setZoneSprinklers((prev) => ({ ...prev, ...newZoneSprinklers }));
    }, [projectMode, results, fieldCropData, zoneSprinklers]);

    const [showQuotationModal, setShowQuotationModal] = useState(false);
    const [showQuotation, setShowQuotation] = useState(false);
    const [quotationData, setQuotationData] = useState<QuotationData>({
        yourReference: '',
        quotationDate: new Date().toLocaleString('th-TH'),
        salesperson: '',
        paymentTerms: '0',
    });
    const [quotationDataCustomer, setQuotationDataCustomer] = useState<QuotationDataCustomer>({
        name: '',
        projectName: '',
        address: '',
        phone: '',
    });

    // State สำหรับ SaveProjectModal
    const [showSaveProjectModal, setShowSaveProjectModal] = useState(false);
    const [saveProjectName, setSaveProjectName] = useState('');
    const [saveAsNewProject, setSaveAsNewProject] = useState(false);

    const [currentZonePumpHead, setCurrentZonePumpHead] = useState<number>(0);

    // เก็บค่า Pump Head ของทุกโซน (zoneId -> pumpHead)
    const zonePumpHeadsRef = useRef<Map<string, number>>(new Map());

    // เก็บค่าสูงสุดของ maxPumpHeadForProjectMode (ไม่เปลี่ยนตามโซน)
    const [maxPumpHeadForAllZones, setMaxPumpHeadForAllZones] = useState<number>(0);

    // เก็บ activeZoneId ล่าสุดเพื่อใช้ใน handlePumpHeadCalculated
    const activeZoneIdRef = useRef<string>(activeZoneId);

    // อัพเดต activeZoneIdRef เมื่อ activeZoneId เปลี่ยน
    useEffect(() => {
        activeZoneIdRef.current = activeZoneId;
    }, [activeZoneId]);

    // ฟังก์ชันคำนวณค่าสูงสุดจากทุกโซนที่ยังมีอยู่
    const calculateMaxPumpHeadFromAllZones = useCallback(() => {
        const zonePumpHeads = zonePumpHeadsRef.current;
        if (zonePumpHeads.size === 0) {
            return 0;
        }
        const maxHead = Math.max(...Array.from(zonePumpHeads.values()));
        return maxHead;
    }, []);

    // คำนวณค่าที่ส่งไปยัง PumpSelector (ใช้ค่าสูงสุดจากทุกโซน)
    // ใช้ maxPumpHeadForAllZones เป็นหลัก (ค่าสูงสุดที่เก็บไว้แล้ว - ไม่เปลี่ยนตามโซน)
    const finalMaxPumpHeadForProjectMode = useMemo(() => {
        // ใช้ maxPumpHeadForAllZones เป็นหลัก (ค่าสูงสุดที่เก็บไว้แล้ว)
        // ถ้ายังไม่มีค่าให้ใช้ results?.maxPumpHeadForProjectMode (fallback)
        const finalValue =
            maxPumpHeadForAllZones > 0
                ? maxPumpHeadForAllZones
                : (results?.maxPumpHeadForProjectMode ?? 0);
        return finalValue;
    }, [
        maxPumpHeadForAllZones, // ใช้ค่าสูงสุดที่เก็บไว้ (ไม่เปลี่ยนตามโซน)
        // ใช้ results?.maxPumpHeadForProjectMode เป็น fallback (จะเปลี่ยนเฉพาะเมื่อค่าจริงๆ เปลี่ยน)
        results?.maxPumpHeadForProjectMode ?? 0,
    ]);

    const handlePumpHeadCalculated = (pumpHead: number) => {
        setCurrentZonePumpHead(pumpHead);

        // ใช้ activeZoneIdRef.current เพื่อให้ได้ค่าล่าสุด
        const currentZoneId = activeZoneIdRef.current;

        // เก็บค่า Pump Head ของโซนปัจจุบันไว้ใน Map
        zonePumpHeadsRef.current.set(currentZoneId, pumpHead);

        // คำนวณค่าสูงสุดจากทุกโซนที่ยังมีอยู่
        const maxHead = calculateMaxPumpHeadFromAllZones();

        // อัพเดตค่าสูงสุด (จะอัพเดตเสมอ ไม่ว่าจะเพิ่มขึ้นหรือลดลง)
        setMaxPumpHeadForAllZones((prevValue) => {
            if (maxHead !== prevValue) {
                return maxHead;
            }
            return prevValue;
        });
    };

    // ลบค่า Pump Head ของโซนที่ถูกลบออกจาก Map
    useEffect(() => {
        const zonesData = getZonesData();
        const currentZoneIds = new Set(zonesData?.map((z: any) => z.id) || []);
        const storedZoneIds = Array.from(zonePumpHeadsRef.current.keys());

        // หาโซนที่ถูกลบออก (มีใน Map แต่ไม่มีใน zones ปัจจุบัน)
        const removedZoneIds = storedZoneIds.filter((zoneId) => !currentZoneIds.has(zoneId));

        if (removedZoneIds.length > 0) {
            // ลบค่า Pump Head ของโซนที่ถูกลบออก
            removedZoneIds.forEach((zoneId) => {
                zonePumpHeadsRef.current.delete(zoneId);
            });

            // คำนวณค่าสูงสุดใหม่จากโซนที่เหลือ
            const maxHead = calculateMaxPumpHeadFromAllZones();

            // อัพเดตค่าสูงสุด
            setMaxPumpHeadForAllZones((prevValue) => {
                if (maxHead !== prevValue) {
                    return maxHead;
                }
                return prevValue;
            });
        }
    }, [results?.allZoneResults, calculateMaxPumpHeadFromAllZones]);

    const handleInputChange = (input: IrrigationInput) => {
        if (activeZoneId) {
            setZoneInputs((prev) => {
                const updated = {
                    ...prev,
                    [activeZoneId]: input,
                };

                // สำหรับ horticulture mode: ค่า staticHeadM ต้องเหมือนกันทุกโซน
                // อัพเดตทุกโซนให้ใช้ค่าเดียวกับโซนปัจจุบัน
                if (projectMode === 'horticulture' && prev[activeZoneId]) {
                    const staticHeadChanged =
                        Math.abs((prev[activeZoneId].staticHeadM || 0) - (input.staticHeadM || 0)) >
                        0.01;

                    if (staticHeadChanged) {
                        Object.keys(updated).forEach((zoneId) => {
                            if (zoneId !== activeZoneId && updated[zoneId]) {
                                updated[zoneId] = {
                                    ...updated[zoneId],
                                    staticHeadM: input.staticHeadM,
                                };
                            }
                        });
                    }
                }

                return updated;
            });

            if (input.sprinklerEquipmentSet) {
                setSprinklerEquipmentSets((prev) => ({
                    ...prev,
                    [activeZoneId]: input.sprinklerEquipmentSet,
                }));
            }
        }
    };

    const handleConnectionEquipmentsChange = useCallback(
        (equipments: any[]) => {
            if (activeZoneId) {
                setConnectionEquipments((prev) => ({
                    ...prev,
                    [activeZoneId]: equipments,
                }));
            }
        },
        [activeZoneId]
    );

    const handleQuotationModalConfirm = () => {
        setShowQuotationModal(false);
        setShowQuotation(true);
    };

    const getEffectiveEquipment = () => {
        const currentZonePipes = selectedPipes[activeZoneId] || {};

        const effective = {
            branchPipe: currentZonePipes.branch || results?.autoSelectedBranchPipe,
            secondaryPipe: currentZonePipes.secondary || results?.autoSelectedSecondaryPipe,
            mainPipe: currentZonePipes.main || results?.autoSelectedMainPipe,
            emitterPipe: currentZonePipes.emitter || results?.autoSelectedEmitterPipe,
            pump: selectedPump || results?.autoSelectedPump,
        };
        
        return effective;
    };

    const getZonesData = () => {
        if (projectMode === 'garden' && gardenStats) {
            const zones = gardenStats.zones.map((z) => ({
                id: z.zoneId,
                name: z.zoneName,
                area: z.area,
                plantCount: z.sprinklerCount,
                totalWaterNeed: z.sprinklerCount * 50,
                plantData: null,
            }));
            return zones;
        }
        if (projectMode === 'field-crop' && fieldCropData) {
            const zones = fieldCropData.zones.info.map((z) => {
                const assignedCropValue = fieldCropData.crops.zoneAssignments[String(z.id)] ?? fieldCropData.crops.zoneAssignments[z.id];
                const crop = assignedCropValue ? getCropByValue(assignedCropValue) : null;

                return {
                    id: z.id,
                    name: z.name,
                    area: z.area,
                    plantCount:
                        z.sprinklerCount || Math.max(1, Math.ceil(z.totalPlantingPoints / 10)),
                    totalWaterNeed: z.totalWaterRequirementPerDay,
                    plantData: crop
                        ? {
                              name: crop.name,
                              waterNeed: crop.waterRequirement || 50,
                              category: crop.category,
                          }
                        : null,
                };
            });
            return zones;
        }
        if (projectMode === 'greenhouse' && greenhouseData) {
            const zones = greenhouseData.summary.plotStats.map((p) => {
                const crop = getCropByValue(p.cropType || '');

                return {
                    id: p.plotId,
                    name: p.plotName,
                    area: p.area,
                    plantCount: p.production.totalPlants,
                    totalWaterNeed: p.production.waterRequirementPerIrrigation,
                    plantData: crop
                        ? {
                              name: crop.name,
                              waterNeed: crop.waterRequirement || 50,
                              category: crop.category,
                          }
                        : null,

                    effectivePlantingArea: p.effectivePlantingArea,
                    cropType: p.cropType,
                    cropIcon: p.cropIcon,
                    pipeStats: p.pipeStats,
                    equipmentCount: p.equipmentCount,
                    waterCalculation: p.production.waterCalculation,
                    plantingDensity: p.plantingDensity,
                    estimatedYield: p.production.estimatedYield,
                    estimatedIncome: p.production.estimatedIncome,
                };
            });
            return zones;
        }

        if (projectMode === 'horticulture') {
            if (horticultureSystemData?.zones && horticultureSystemData.zones.length > 0) {
                return horticultureSystemData.zones.map((zone: any) => ({
                    id: zone.id,
                    name: zone.name,
                    plantCount: zone.plantCount || 0,
                    area: zone.area || 0,
                    totalWaterNeed: zone.waterNeedPerMinute || 0,
                    plantData: null,
                }));
            }

            if (projectData?.zones && projectData.zones.length > 0) {
                return projectData.zones;
            }

            return [];
        }

        const zones = projectData?.zones || [];
        return zones;
    };

    const getZoneNameForSummary = (zoneId: string): string => {
        if (projectMode === 'garden' && gardenStats) {
            const zone = gardenStats.zones.find((z) => z.zoneId === zoneId);
            return zone?.zoneName || zoneId;
        }
        if (projectMode === 'field-crop' && fieldCropData) {
            const zone = fieldCropData.zones.info.find((z) => z.id === zoneId);
            return zone?.name || zoneId;
        }
        if (projectMode === 'greenhouse' && greenhouseData) {
            const plot = greenhouseData.summary.plotStats.find((p) => p.plotId === zoneId);
            return plot?.plotName || zoneId;
        }
        const zone = projectData?.zones.find((z) => z.id === zoneId);
        return zone?.name || zoneId;
    };

    const getActiveZone = () => {
        if (projectMode === 'garden' && gardenStats) {
            const zone = gardenStats.zones.find((z) => z.zoneId === activeZoneId);
            if (zone) {
                return {
                    id: zone.zoneId,
                    name: zone.zoneName,
                    area: zone.area,
                    plantCount: zone.sprinklerCount,
                    totalWaterNeed: zone.sprinklerCount * 50,
                    plantData: null,
                } as any;
            }
            // ⚠️ Fallback: ถ้าไม่เจอ zone ที่ตรงกับ activeZoneId ให้ใช้ zone แรก
            if (gardenStats.zones.length > 0) {
                const firstZone = gardenStats.zones[0];
                return {
                    id: firstZone.zoneId,
                    name: firstZone.zoneName,
                    area: firstZone.area,
                    plantCount: firstZone.sprinklerCount,
                    totalWaterNeed: firstZone.sprinklerCount * 50,
                    plantData: null,
                } as any;
            }
        }
        if (projectMode === 'field-crop' && fieldCropData) {
            const zone = fieldCropData.zones.info.find((z) => String(z.id) === activeZoneId);
            if (zone) {
                const assignedCropValue = fieldCropData.crops.zoneAssignments[String(zone.id)] ?? fieldCropData.crops.zoneAssignments[zone.id];
                const crop = assignedCropValue ? getCropByValue(assignedCropValue) : null;

                return {
                    id: zone.id,
                    name: zone.name,
                    area: zone.area,
                    plantCount:
                        zone.sprinklerCount ||
                        Math.max(1, Math.ceil(zone.totalPlantingPoints / 10)),
                    totalWaterNeed: zone.totalWaterRequirementPerDay,
                    plantData: crop
                        ? {
                              name: crop.name,
                              waterNeed: crop.waterRequirement || 50,
                              category: crop.category,
                          }
                        : null,
                } as any;
            }
        }
        if (projectMode === 'greenhouse' && greenhouseData) {
            const plot = greenhouseData.summary.plotStats.find((p) => p.plotId === activeZoneId);
            if (plot) {
                const crop = getCropByValue(plot.cropType || '');

                return {
                    id: plot.plotId,
                    name: plot.plotName,
                    area: plot.area,
                    plantCount: plot.production.totalPlants,
                    totalWaterNeed: plot.production.waterRequirementPerIrrigation,
                    plantData: crop
                        ? {
                              name: crop.name,
                              waterNeed: crop.waterRequirement || 50,
                              category: crop.category,
                          }
                        : null,
                    effectivePlantingArea: plot.effectivePlantingArea,
                    cropType: plot.cropType,
                    cropIcon: plot.cropIcon,
                    pipeStats: plot.pipeStats,
                    equipmentCount: plot.equipmentCount,
                    waterCalculation: plot.production.waterCalculation,
                    plantingDensity: plot.plantingDensity,
                    estimatedYield: plot.production.estimatedYield,
                    estimatedIncome: plot.production.estimatedIncome,
                } as any;
            }
        }

        if (projectMode === 'horticulture') {
            if (horticultureSystemData?.zones && horticultureSystemData.zones.length > 0) {
                const zone = horticultureSystemData.zones.find((z: any) => z.id === activeZoneId);
                if (zone) {
                    return {
                        id: zone.id,
                        name: zone.name,
                        plantCount: zone.plantCount || 0,
                        area: zone.area || 0,
                        totalWaterNeed: zone.waterNeedPerMinute || 0,
                        plantData: null,
                    } as any;
                }
            }

            if (projectData?.zones && projectData.zones.length > 0) {
                return projectData.zones.find((z) => z.id === activeZoneId);
            }

            return null;
        }

        return projectData?.zones.find((z) => z.id === activeZoneId);
    };

    // คำนวณพื้นที่โซนจาก coordinates ให้ตรงกับ HorticultureResultsPage
    const calculatePolygonAreaForZone = (coords: { lat: number; lng: number }[]): number => {
        if (!coords || coords.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < coords.length; i++) {
            const j = (i + 1) % coords.length;
            area += coords[i].lat * coords[j].lng;
            area -= coords[j].lat * coords[i].lng;
        }
        area = Math.abs(area) / 2;
        const metersPerDegree = 111320;
        return area * metersPerDegree * metersPerDegree;
    };

    const getZoneAreaData = ():
        | {
              zoneId: string;
              zoneName: string;
              areaInRai: number;
              coordinates?: { lat: number; lng: number }[];
              plantCount?: number;
              waterNeedPerMinute?: number;
          }
        | undefined => {
        if (!activeZoneId) return undefined;

        const sprinklerConfig = loadSprinklerConfig();
        const flowRatePerPlant = sprinklerConfig?.flowRatePerMinute ?? 2.5;
        const sprinklersPerTree = sprinklerConfig?.sprinklersPerTree ?? 1;

        const buildResult = (
            zoneId: string,
            zoneName: string,
            areaInRai: number,
            coordinates?: { lat: number; lng: number }[],
            plantCount?: number,
            waterNeedPerMinute?: number
        ) => ({
            zoneId,
            zoneName,
            areaInRai,
            coordinates,
            plantCount: plantCount ?? 0,
            waterNeedPerMinute: waterNeedPerMinute ?? (plantCount != null ? calculateTotalFlowRate(plantCount, flowRatePerPlant, sprinklersPerTree) : undefined),
        });

        if (horticultureSystemData && horticultureSystemData.zones) {
            const zoneFromHorticultureData = horticultureSystemData.zones.find(
                (zone: any) => zone.id === activeZoneId
            );

            if (zoneFromHorticultureData) {
                const originalZone = projectData?.zones?.find(
                    (z: any) => z.id === activeZoneId
                ) as any;
                const plantCount = originalZone?.plants?.length ?? zoneFromHorticultureData?.plantCount ?? 0;
                const waterNeedPerMinute = plantCount > 0 ? calculateTotalFlowRate(plantCount, flowRatePerPlant, sprinklersPerTree) : 0;

                if (zoneFromHorticultureData.area && zoneFromHorticultureData.area > 0) {
                    return buildResult(
                        zoneFromHorticultureData.id as string,
                        zoneFromHorticultureData.name as string,
                        zoneFromHorticultureData.area / 1600,
                        undefined,
                        plantCount,
                        waterNeedPerMinute
                    );
                }

                if (originalZone?.coordinates && originalZone.coordinates.length >= 3) {
                    const areaInSquareMeters = originalZone.area || calculatePolygonAreaForZone(originalZone.coordinates);
                    const areaInRai = areaInSquareMeters / 1600;
                    return buildResult(
                        zoneFromHorticultureData.id as string,
                        zoneFromHorticultureData.name as string,
                        areaInRai,
                        originalZone.coordinates,
                        plantCount,
                        waterNeedPerMinute
                    );
                }

                return buildResult(
                    zoneFromHorticultureData.id as string,
                    zoneFromHorticultureData.name as string,
                    0,
                    undefined,
                    plantCount,
                    waterNeedPerMinute
                );
            }
        }

        const activeZone = getActiveZone() as any;
        if (activeZone) {
            const plantCount = activeZone.plants?.length ?? activeZone.plantCount ?? 0;
            const areaInSquareMeters = activeZone.area || (activeZone.coordinates?.length >= 3 ? calculatePolygonAreaForZone(activeZone.coordinates) : 0);
            const areaInRai = areaInSquareMeters / 1600;
            const waterNeedPerMinute = plantCount > 0 ? calculateTotalFlowRate(plantCount, flowRatePerPlant, sprinklersPerTree) : 0;
            return buildResult(
                activeZone.id as string,
                (activeZone.name || `โซน ${activeZone.id}`) as string,
                areaInRai,
                activeZone.coordinates,
                plantCount,
                waterNeedPerMinute
            );
        }

        return undefined;
    };

    // ✅ For horticulture mode, allow loading even without projectStats (it can be loaded later)
    // ✅ Always ensure we have at least minimal data for horticulture mode (only if really needed)
    const fallbackInitializedRef = useRef(false);
    useEffect(() => {
        // Only create fallback data once, and only if we're in horticulture mode with no data
        // AND initial data load has completed (to avoid race condition)
        if (
            projectMode === 'horticulture' && 
            !projectData && 
            !horticultureSystemData && 
            !fallbackInitializedRef.current &&
            initialDataLoadRef.current // Wait for initial load to complete
        ) {
            // Wait a bit more to see if async data loading will complete
            const timeoutId = setTimeout(() => {
                // Double check that we still don't have data
                if (!projectData && !horticultureSystemData && !fallbackInitializedRef.current) {
                    const minimalData: HorticultureProject = {
                        projectName: 'โครงการใหม่',
                        totalArea: 1600,
                        zones: [],
                        plants: [],
                        useZones: false,
                        irrigationZones: [],
                    };
                    setProjectData(minimalData);
                    setProjectStats({
                        totalAreaInRai: 1,
                        totalPlants: 0,
                        zoneDetails: [],
                    });
                    fallbackInitializedRef.current = true;
                }
            }, 1000); // Wait 1 second for async data loading to complete
            
            return () => clearTimeout(timeoutId);
        }
        
        // Mark as initialized if we have data
        if (projectData || horticultureSystemData) {
            fallbackInitializedRef.current = true;
        }
    }, [projectMode, projectData, horticultureSystemData]);

    // ✅ Use useMemo to calculate hasEssentialData to ensure it updates when state changes
    const hasEssentialData = useMemo(() => {
        const result = Boolean(
            (projectMode === 'horticulture' && (projectData || horticultureSystemData)) ||
            (projectMode === 'garden' && gardenData && gardenStats) ||
            (projectMode === 'field-crop' && fieldCropData) ||
            (projectMode === 'greenhouse' && greenhouseData)
        );
        
        
        return result;
    }, [projectMode, projectData, horticultureSystemData, gardenData, gardenStats, fieldCropData, greenhouseData]);

    const shouldShowLoading = !hasEssentialData;
    
    if (shouldShowLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6 text-white">
                <div className="text-center">
                    <div className="mb-6 text-6xl">
                        {projectMode === 'garden'
                            ? '🏡'
                            : projectMode === 'field-crop'
                              ? '🌾'
                              : projectMode === 'greenhouse'
                                ? '🏠'
                                : '🌱'}
                    </div>
                    <h1 className="mb-4 text-2xl font-bold text-blue-400">
                        {projectMode === 'garden'
                            ? 'Chaiyo Irrigation System'
                            : projectMode === 'field-crop'
                              ? 'Chaiyo Field Crop Irrigation'
                              : projectMode === 'greenhouse'
                                ? 'Chaiyo Greenhouse Irrigation'
                                : 'Chaiyo Irrigation System'}
                    </h1>
                    <p className="mb-6 text-gray-300">{t('กำลังโหลดข้อมูล...')}</p>
                    <button
                        onClick={() =>
                            router.visit(
                                projectMode === 'garden'
                                    ? '/home-garden-planner'
                                    : projectMode === 'field-crop'
                                      ? '/field-map'
                                      : projectMode === 'greenhouse'
                                        ? '/greenhouse-crop'
                                        : '/horticulture/planner'
                            )
                        }
                        className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
                    >
                        📐 {t('ไปหน้าวางแผน')}
                    </button>
                </div>
            </div>
        );
    }

    // ✅ Only show loading screen if we don't have essential data
    if (!hasEssentialData) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6 text-white">
                <div className="text-center">
                    <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-400"></div>
                    <p className="text-gray-300">{t('กำลังโหลดข้อมูล...')}</p>
                </div>
            </div>
        );
    }
    
    // ✅ If we have essential data but no results/currentInput yet, check if zoneInputs are being loaded
    // Don't block if zoneInputs are empty but we're loading from database
    const isLoadingFromDatabase = localStorage.getItem('currentFieldId') && !localStorage.getItem('currentFieldId')?.startsWith('mock-');
    const hasZoneInputs = Object.keys(zoneInputs).length > 0;
    
    if (!results || !currentInput) {
        
        // If loading from database and zoneInputs are empty, wait a bit more
        if (isLoadingFromDatabase && !hasZoneInputs) {
            return (
                <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6 text-white">
                    <div className="text-center">
                        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-400"></div>
                        <p className="text-gray-300">{t('กำลังโหลดข้อมูล...')}</p>
                    </div>
                </div>
            );
        }
        
        // If we have zoneInputs but no currentInput, it means activeZoneId is not set yet
        // The useEffect above should set it, but we need to wait for it
        if (hasZoneInputs && !activeZoneId) {
            // Show loading while waiting for activeZoneId to be set by useEffect
            return (
                <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6 text-white">
                    <div className="text-center">
                        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-400"></div>
                        <p className="text-gray-300">{t('กำลังโหลดข้อมูล...')}</p>
                    </div>
                </div>
            );
        }
        
        // Show a brief message while calculations are running
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6 text-white">
                <div className="text-center">
                    <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-400"></div>
                    <p className="text-gray-300">{t('กำลังคำนวณข้อมูล...')}</p>
                </div>
            </div>
        );
    }

    const effectiveEquipment = getEffectiveEquipment();
    const zones = getZonesData();
    const activeZone = getActiveZone();

    const selectedPipeSizes = (() => {
        if (projectMode === 'field-crop' && fieldCropData) {
            const currentZonePipes = selectedPipes[activeZoneId] || {};
            return {
                main: currentZonePipes.main?.sizeMM || 0,
                secondary: currentZonePipes.secondary?.sizeMM || 0,
                branch: currentZonePipes.branch?.sizeMM || 0,
                emitter: currentZonePipes.emitter?.sizeMM || 0,
            };
        } else {
            // For other modes, use effectiveEquipment
            return {
                main: effectiveEquipment.mainPipe?.sizeMM || 0,
                secondary: effectiveEquipment.secondaryPipe?.sizeMM || 0,
                branch: effectiveEquipment.branchPipe?.sizeMM || 0,
                emitter: effectiveEquipment.emitterPipe?.sizeMM || 0,
            };
        }
    })();

    const extraPipeInput = zoneInputs[activeZoneId]?.extraPipePerSprinkler;
    let selectedExtraPipe: any = null;
    if (extraPipeInput && extraPipeInput.pipeId && extraPipeInput.lengthPerHead > 0) {
        let pipe: any = null;
        const pipes = selectedPipes[activeZoneId] || {};
        if (pipes.branch && pipes.branch.id === extraPipeInput.pipeId) pipe = pipes.branch;
        if (pipes.secondary && pipes.secondary.id === extraPipeInput.pipeId) pipe = pipes.secondary;
        if (pipes.main && pipes.main.id === extraPipeInput.pipeId) pipe = pipes.main;
        if (!pipe && results) {
            if (
                results.autoSelectedBranchPipe &&
                results.autoSelectedBranchPipe.id === extraPipeInput.pipeId
            )
                pipe = results.autoSelectedBranchPipe;
            if (
                results.autoSelectedSecondaryPipe &&
                results.autoSelectedSecondaryPipe.id === extraPipeInput.pipeId
            )
                pipe = results.autoSelectedSecondaryPipe;
            if (
                results.autoSelectedMainPipe &&
                results.autoSelectedMainPipe.id === extraPipeInput.pipeId
            )
                pipe = results.autoSelectedMainPipe;
        }
        if (pipe) {
            selectedExtraPipe = {
                pipe,
                lengthPerHead: extraPipeInput.lengthPerHead,
                totalLength: (results?.totalSprinklers || 0) * extraPipeInput.lengthPerHead,
            };
        }
    }

    const handleOpenQuotationModal = () => {
        if (projectData) {
            setQuotationDataCustomer((prev) => ({
                ...prev,
                projectName: projectData.projectName || prev.projectName,
                name: projectData.customerName || prev.name,
            }));
        }
        setShowQuotationModal(true);
    };

    // ฟังก์ชันบันทึกโครงการ
    const handleSaveProject = async () => {
        try {
            // ตรวจสอบว่ามีข้อมูลที่จำเป็นหรือไม่
            if (!results || !currentSprinkler) {
                alert(t('กรุณาเลือกอุปกรณ์ก่อนบันทึกโครงการ'));
                return;
            }

            // ตรวจสอบว่ากำลังแก้ไขโครงการเดิมหรือไม่ (เคยบันทึกแล้ว และไม่ใช่ mock id)
            const existingFieldId = localStorage.getItem('currentFieldId');
            const existingFieldName = localStorage.getItem('currentFieldName');
            const isEditingExisting = existingFieldId && !existingFieldId.startsWith('mock-');

            // ถ้าเคยบันทึกแล้ว (เปิดโครงการเดิมมาแก้) → เด้ง modal ให้ยืนยันชื่อ แล้วบันทึกทับ
            if (isEditingExisting) {
                setSaveProjectName(existingFieldName || projectData?.projectName || 'โครงการใหม่');
                setSaveAsNewProject(false);
                setShowSaveProjectModal(true);
                return;
            }

            // ถ้าไม่เคยบันทึก (โปรเจกต์ใหม่ หรือมาจาก Results) → เด้ง modal ให้ตั้งชื่อเสมอ ไม่ข้ามไปบันทึกเลย
            // (เดิมมีทาง "ถ้ามีชื่อโครงการแล้ว → บันทึกเลย" ทำให้ใช้ currentFieldId/ชื่อเก่าจาก localStorage แล้วบันทึกทับโครงการอื่น)
            setSaveProjectName(
                projectData?.projectName && projectData.projectName !== 'โครงการใหม่'
                    ? projectData.projectName
                    : 'โครงการใหม่'
            );
            setSaveAsNewProject(true);
            setShowSaveProjectModal(true);
        } catch (error) {
            console.error('Error in handleSaveProject:', error);
            alert(t('เกิดข้อผิดพลาดในการบันทึกโครงการ กรุณาลองใหม่อีกครั้ง'));
        }
    };

    // ฟังก์ชันจริงสำหรับบันทึกโครงการ
    const performSaveProject = async (customProjectName?: string | null, forceSaveAsNew: boolean = false) => {
        try {
            const existingFieldId = localStorage.getItem('currentFieldId');
            const isEditingExisting = existingFieldId && !existingFieldId.startsWith('mock-') && !forceSaveAsNew;
            

            // ✅ Step 1: ประกาศและโหลด enhancedProjectData ก่อนทุกอย่าง
            let enhancedProjectData: any = projectData || {};
            
            try {
                // ✅ ให้โหลดจาก API เสมอถ้ามี existingFieldId (เพื่อให้แน่ใจว่าข้อมูลถูกต้อง)
                if (existingFieldId && !existingFieldId.startsWith('mock-')) {
                    try {
                        const response = await fetch(`/api/fields/${existingFieldId}`);
                        if (response.ok) {
                            const fieldData = await response.json();
                            
                            if (fieldData.success && fieldData.field) {
                                const apiProjectData = fieldData.field.projectData || fieldData.field.project_data;
                                if (apiProjectData) {
                                    const parsedApiData = typeof apiProjectData === 'string' 
                                        ? JSON.parse(apiProjectData) 
                                        : apiProjectData;
                                    
                                    enhancedProjectData = {
                                        ...projectData,
                                        ...parsedApiData,
                                    };
                                }
                            }
                        }
                    } catch (apiError) {
                        console.error('❌ Error loading from API:', apiError);
                    }
                } else {
                    // ✅ ถ้าไม่มี existingFieldId (โปรเจคใหม่) ให้ใช้ localStorage
                    const storedProjectData = localStorage.getItem('horticultureProjectData');
                    if (storedProjectData) {
                        const parsedData = JSON.parse(storedProjectData);
                        enhancedProjectData = {
                            ...projectData,
                            ...parsedData,
                        };
                    }
                }
            } catch (error) {
                console.error('❌ Error loading project data:', error);
            }


            // ✅ Step 2: หลังจากโหลด enhancedProjectData แล้ว ค่อยสร้างตัวแปรอื่นๆ
            const defaultCoordinates = [
                { lat: 12.611267079196681, lng: 102.04609486363057 },
                { lat: 12.611253783181395, lng: 102.045455417409 },
                { lat: 12.611156776381648, lng: 102.0449031449758 },
            ];
            
            const mainAreaCoordinates =
                enhancedProjectData?.mainArea && enhancedProjectData.mainArea.length >= 3
                    ? enhancedProjectData.mainArea
                    : defaultCoordinates;
            

            // Load sprinklerConfig สำหรับ horticulture mode
            let sprinklerConfig = null;
            if (projectMode === 'horticulture') {
                sprinklerConfig = loadSprinklerConfig() || horticultureSystemData?.sprinklerConfig;
            }

            // ✅ สำหรับ Finished project: ไม่ส่ง pipes array เพราะข้อมูลถูกเก็บใน project_data แล้ว
            // Backend validation สำหรับ pipes มีความซับซ้อน และข้อมูลทั้งหมดอยู่ใน project_data อยู่แล้ว
            const pipes: any[] = [];

            // ✅ Prepare zones และ exclusion areas (หลังจาก load enhancedProjectData แล้ว)
            // Prepare irrigationZones for zones array (if horticulture mode)
            const zonesToSave = projectMode === 'horticulture' && enhancedProjectData?.irrigationZones
                ? enhancedProjectData.irrigationZones.map((zone: any) => ({
                      id: zone.id || `zone-${Math.random().toString(36).substr(2, 9)}`,
                      name: zone.name || `โซน ${zone.layoutIndex || 0}`,
                      polygon_coordinates:
                          zone.coordinates && zone.coordinates.length >= 3
                              ? zone.coordinates
                              : defaultCoordinates,
                      color: zone.color || '#22C55E',
                      pipe_direction: 'horizontal',
                  }))
                : enhancedProjectData?.zones?.map((zone) => ({
                      id: zone.id || `zone-${Math.random().toString(36).substr(2, 9)}`,
                      name: zone.name,
                      polygon_coordinates:
                          (zone as any).coordinates && (zone as any).coordinates.length >= 3
                              ? (zone as any).coordinates
                              : defaultCoordinates,
                      color: '#22C55E',
                      pipe_direction: 'horizontal',
                  })) || [];

            // Prepare exclusion areas as layers
            const exclusionAreaLayers =
                enhancedProjectData?.exclusionAreas?.map((area: any) => ({
                    type: 'exclusion',
                    coordinates: area.coordinates || [],
                    name: area.name || 'Exclusion Area',
                    exclusion_type: area.type || 'other',
                })) || [];

            // Calculate total area in rai using precise calculation from mainArea coordinates
            const calculateAreaFromCoordinates = (coordinates: any[]) => {
                if (!coordinates || coordinates.length < 3) return 0;
                
                // Shoelace formula
                let area = 0;
                for (let i = 0; i < coordinates.length; i++) {
                    const j = (i + 1) % coordinates.length;
                    area += coordinates[i].lat * coordinates[j].lng;
                    area -= coordinates[j].lat * coordinates[i].lng;
                }
                area = Math.abs(area) / 2;
                
                // Convert to square meters
                const avgLat = coordinates.reduce((sum, coord) => sum + coord.lat, 0) / coordinates.length;
                const latFactor = 111000;
                const lngFactor = 111000 * Math.cos(avgLat * Math.PI / 180);
                
                return (area * latFactor * lngFactor); // Return in square meters
            };
            
            let totalAreaInRai = 0;
            
            
            // ✅ Priority 1: คำนวณจาก mainArea coordinates (แม่นยำที่สุด)
            if (mainAreaCoordinates && mainAreaCoordinates.length >= 3) {
                const areaInSqM = calculateAreaFromCoordinates(mainAreaCoordinates);
                totalAreaInRai = areaInSqM / 1600; // Convert to ไร่
            }
            
            // ✅ Priority 2: ถ้ายังเป็น 0 ให้รวมจาก irrigationZones
            if (totalAreaInRai === 0 && projectMode === 'horticulture' && enhancedProjectData?.irrigationZones && enhancedProjectData.irrigationZones.length > 0) {
                const totalAreaInSqM = enhancedProjectData.irrigationZones.reduce(
                    (sum: number, zone: any) => sum + (zone.area || 0),
                    0
                );
                if (totalAreaInSqM > 0) {
                    totalAreaInRai = totalAreaInSqM / 1600; // Convert to ไร่
                }
            }
            
            // ✅ Priority 3: ถ้ายังเป็น 0 ให้ใช้จาก enhancedProjectData.totalArea
            if (totalAreaInRai === 0 && enhancedProjectData?.totalArea) {
                if (enhancedProjectData.totalArea > 1000) {
                    totalAreaInRai = enhancedProjectData.totalArea / 1600;
                } else {
                    totalAreaInRai = enhancedProjectData.totalArea;
                }
            }
            

            // Get plant_type_id - use default (1) if custom plant (id > 10)
            let plantTypeId = 1; // Default plant type
            if (enhancedProjectData?.selectedPlantType?.id) {
                // Only use plant_type_id if it's a standard plant (id <= 10)
                // Custom plants (id > 10) should use default plant type
                if (enhancedProjectData.selectedPlantType.id <= 10) {
                    plantTypeId = enhancedProjectData.selectedPlantType.id;
                }
            }

            const finalProjectName = customProjectName || enhancedProjectData?.projectName || 'โครงการใหม่';
            
            // ✅ คำนวณ totalCost ใหม่จากข้อมูลปัจจุบัน (ไม่ใช้ localStorage เพื่อความแม่นยำ)
            const calculateTotalCostForSave = () => {
                let totalCost = 0;
                
                // 1. คำนวณราคาสปริงเกอร์
                Object.entries(zoneSprinklers).forEach(([zoneId, sprinkler]) => {
                    if (sprinkler && zoneInputs[zoneId]) {
                        let quantity = zoneInputs[zoneId].totalTrees || 0;
                        if (projectMode === 'horticulture') {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            quantity = quantity * sprinklersPerTree;
                        }
                        totalCost += (sprinkler.price || 0) * quantity;
                    }
                });
                
                // 2. คำนวณราคาท่อ
                Object.entries(selectedPipes).forEach(([zoneId, pipes]) => {
                    const zoneInput = zoneInputs[zoneId];
                    if (!zoneInput) return;
                    
                    // Branch pipe
                    if (pipes.branch && zoneInput.totalBranchPipeM > 0) {
                        const rolls = calculatePipeRolls(zoneInput.totalBranchPipeM, pipes.branch.lengthM || 100);
                        totalCost += (pipes.branch.price || 0) * rolls;
                    }
                    
                    // Secondary pipe
                    if (pipes.secondary && zoneInput.totalSecondaryPipeM > 0) {
                        const rolls = calculatePipeRolls(zoneInput.totalSecondaryPipeM, pipes.secondary.lengthM || 100);
                        totalCost += (pipes.secondary.price || 0) * rolls;
                    }
                    
                    // Main pipe
                    if (pipes.main && zoneInput.totalMainPipeM > 0) {
                        const rolls = calculatePipeRolls(zoneInput.totalMainPipeM, pipes.main.lengthM || 100);
                        totalCost += (pipes.main.price || 0) * rolls;
                    }
                    
                    // Emitter pipe
                    if (pipes.emitter && zoneInput.totalEmitterPipeM) {
                        const emitterLength = zoneInput.totalEmitterPipeM;
                        if (emitterLength > 0) {
                            const rolls = calculatePipeRolls(emitterLength, pipes.emitter.lengthM || 100);
                            totalCost += (pipes.emitter.price || 0) * rolls;
                        }
                    }
                });
                
                // 3. คำนวณราคาปั๊ม
                if (selectedPump) {
                    totalCost += selectedPump.price || 0;
                    
                    // Pump accessories
                    if (selectedPump.pumpAccessories) {
                        // Get selectedGroupId from localStorage
                        const getStoredSelectedGroupId = (pumpId: number | undefined): number | string | null => {
                            if (!pumpId) return null;
                            try {
                                const stored = localStorage.getItem(`pump_${pumpId}_selectedGroupId`);
                                return stored ? (isNaN(Number(stored)) ? stored : Number(stored)) : null;
                            } catch {
                                return null;
                            }
                        };
                        
                        const selectedGroupId = getStoredSelectedGroupId(selectedPump.id);
                        
                        selectedPump.pumpAccessories.forEach((accessory: any) => {
                            if (accessory.group_id && accessory.group_items) {
                                if (selectedGroupId && accessory.group_id !== selectedGroupId) {
                                    return; // Skip non-selected groups
                                }
                                accessory.group_items.forEach((item: any) => {
                                    const itemPrice = Number(item.unit_price || item.total_price || item.equipment?.price || 0);
                                    const itemQuantity = Number(item.quantity || 1);
                                    if (itemPrice > 0 || !accessory.is_included) {
                                        totalCost += itemPrice * itemQuantity;
                                    }
                                });
                            } else if (!accessory.is_included || (accessory.price && accessory.price > 0)) {
                                totalCost += (accessory.price || 0) * (accessory.quantity || 1);
                            }
                        });
                    }
                }
                
                // 4. คำนวณราคา sprinkler equipment sets
                Object.entries(sprinklerEquipmentSets).forEach(([zoneId, equipmentSet]: [string, any]) => {
                    if (!equipmentSet || !equipmentSet.selectedGroupId) return;
                    
                    let totalSprinklers = 0;
                    const zoneInput = zoneInputs[zoneId];
                    if (zoneInput) {
                        totalSprinklers = zoneInput.totalTrees || 0;
                        if (projectMode === 'horticulture') {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            totalSprinklers = totalSprinklers * sprinklersPerTree;
                        }
                    }
                    
                    if (equipmentSet.selectedItems) {
                        equipmentSet.selectedItems.forEach((item: any) => {
                            if (item.equipment) {
                                const categoryName = item.equipment.category?.name?.toLowerCase();
                                const isPipe = categoryName === 'pipe' || categoryName?.includes('pipe');
                                if (!isPipe) {
                                    const quantityPerHead = item.quantity || 0;
                                    const totalQuantity = quantityPerHead * totalSprinklers;
                                    if (totalQuantity > 0) {
                                        totalCost += (item.unit_price || item.equipment?.price || 0) * totalQuantity;
                                    }
                                }
                            }
                        });
                    }
                });
                
                // 5. คำนวณราคา connection equipments
                Object.values(connectionEquipments).forEach((equipments: any[]) => {
                    if (equipments && equipments.length > 0) {
                        equipments.forEach((equipment: any) => {
                            if (equipment.equipment && equipment.count > 0) {
                                totalCost += (equipment.equipment?.price || 0) * equipment.count;
                            }
                        });
                    }
                });
                
                return totalCost;
            };
            
            // ✅ ใช้ totalCost ให้ตรงกับ CostSummary: อ่านจาก localStorage ที่ CostSummary บันทึกไว้ก่อน ถ้าไม่มีหรือเป็น 0 ค่อยคำนวณเอง
            const fromCostSummary = localStorage.getItem('calculatedTotalCost');
            const parsedStored = fromCostSummary != null ? parseFloat(fromCostSummary) : NaN;
            const totalCost =
                Number.isFinite(parsedStored) && parsedStored >= 0
                    ? parsedStored
                    : calculateTotalCostForSave();

            // ฟังก์ชันลดขนาดข้อมูลเพื่อป้องกัน MySQL packet size error
            const compressProjectData = (data: any) => {
                if (!data) return null;
                
                return {
                    ...data,
                    projectName: data.projectName,
                    customerName: data.customerName,
                    totalArea: data.totalArea,
                    selectedPlantType: data.selectedPlantType,
                    // เก็บเฉพาะข้อมูลสำคัญของ plants (ไม่เก็บทุกต้นถ้ามีเยอะ)
                    plants: data.plants ? (
                        data.plants.length > 500 
                            ? data.plants.slice(0, 500).map((p: any) => ({
                                id: p.id,
                                position: p.position,
                                zoneId: p.zoneId,
                                plantData: p.plantData ? { waterNeed: p.plantData.waterNeed } : undefined
                            }))
                            : data.plants.map((p: any) => ({
                                id: p.id,
                                position: p.position,
                                zoneId: p.zoneId,
                                plantData: p.plantData ? { waterNeed: p.plantData.waterNeed } : undefined
                            }))
                    ) : [],
                    mainArea: data.mainArea,
                    zones: data.zones,
                    irrigationZones: data.irrigationZones,
                    // ลด coordinates ของท่อ (เก็บเฉพาะจุดสำคัญ)
                    mainPipes: data.mainPipes?.map((pipe: any) => ({
                        id: pipe.id,
                        toZone: pipe.toZone,
                        coordinates: pipe.coordinates?.length > 20 
                            ? [pipe.coordinates[0], pipe.coordinates[Math.floor(pipe.coordinates.length / 2)], pipe.coordinates[pipe.coordinates.length - 1]]
                            : pipe.coordinates,
                        length: pipe.length,
                    })),
                    subMainPipes: data.subMainPipes?.map((pipe: any) => ({
                        id: pipe.id,
                        zoneId: pipe.zoneId,
                        coordinates: pipe.coordinates?.length > 20
                            ? [pipe.coordinates[0], pipe.coordinates[Math.floor(pipe.coordinates.length / 2)], pipe.coordinates[pipe.coordinates.length - 1]]
                            : pipe.coordinates,
                        length: pipe.length,
                    })),
                    lateralPipes: data.lateralPipes?.slice(0, 100).map((pipe: any) => ({ // เก็บแค่ 100 เส้นแรก
                        id: pipe.id,
                        zoneId: pipe.zoneId,
                        coordinates: [pipe.coordinates?.[0], pipe.coordinates?.[pipe.coordinates?.length - 1]], // เก็บแค่ต้น-ปลาย
                        placementMode: pipe.placementMode,
                    })),
                    exclusionAreas: data.exclusionAreas,
                    pump: data.pump ? {
                        position: data.pump.position,
                        specs: data.pump.specs,
                    } : undefined,
                    sprinklerConfig: data.sprinklerConfig,
                };
            };

            // ลดขนาด results
            const compressResults = (res: any) => {
                if (!res) return null;
                return {
                    totalSprinklers: res.totalSprinklers,
                    totalWaterRequiredLPM: res.totalWaterRequiredLPM,
                    totalBranchPipeM: res.totalBranchPipeM,
                    totalSecondaryPipeM: res.totalSecondaryPipeM,
                    totalMainPipeM: res.totalMainPipeM,
                    totalEmitterPipeM: res.totalEmitterPipeM,
                    hasValidMainPipe: res.hasValidMainPipe,
                    hasValidSecondaryPipe: res.hasValidSecondaryPipe,
                    // ✅ เพิ่มข้อมูลที่ QuotationDocument ต้องการ
                    autoSelectedBranchPipe: res.autoSelectedBranchPipe,
                    autoSelectedSecondaryPipe: res.autoSelectedSecondaryPipe,
                    autoSelectedMainPipe: res.autoSelectedMainPipe,
                    autoSelectedEmitterPipe: res.autoSelectedEmitterPipe,
                    autoSelectedPump: res.autoSelectedPump,
                    branchPipeRolls: res.branchPipeRolls,
                    secondaryPipeRolls: res.secondaryPipeRolls,
                    mainPipeRolls: res.mainPipeRolls,
                    emitterPipeRolls: res.emitterPipeRolls,
                    // ✅ เพิ่ม analyzedPipes สำหรับการค้นหา extraPipe (จำกัดแค่ข้อมูลที่จำเป็น)
                    analyzedBranchPipes: res.analyzedBranchPipes?.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        price: p.price,
                        sizeMM: p.sizeMM,
                        lengthM: p.lengthM,
                        productCode: p.productCode,
                    })),
                    analyzedSecondaryPipes: res.analyzedSecondaryPipes?.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        price: p.price,
                        sizeMM: p.sizeMM,
                        lengthM: p.lengthM,
                        productCode: p.productCode,
                    })),
                    analyzedMainPipes: res.analyzedMainPipes?.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        price: p.price,
                        sizeMM: p.sizeMM,
                        lengthM: p.lengthM,
                        productCode: p.productCode,
                    })),
                    // ไม่เก็บ allZoneResults ที่ใหญ่มาก
                };
            };

            // คำนวณค่ารวมทั้งหมดจากทุกโซน (ไม่ใช่แค่โซนเดียว)
            let actualTotalPlants = 0;
            let actualTotalWaterNeed = 0;
            
            // 1. คำนวณจำนวนพืชจริง
            if (projectMode === 'horticulture' && enhancedProjectData?.plants) {
                actualTotalPlants = enhancedProjectData.plants.length; // ✅ นับต้นไม้ทั้งหมด
            } else if (projectMode === 'garden' && gardenData?.gardenZones) {
                actualTotalPlants = gardenData.gardenZones.reduce((sum, zone: any) => sum + (zone.sprinklers?.length || 0), 0);
            } else {
                actualTotalPlants = results.totalSprinklers || 0;
            }
            
            // 2. คำนวณความต้องการน้ำรวมทั้งหมด (จากทุกโซน)
            if (projectMode === 'horticulture' && enhancedProjectData?.irrigationZones) {
                // ✅ รวมจากทุก irrigationZones
                actualTotalWaterNeed = enhancedProjectData.irrigationZones.reduce(
                    (sum: number, zone: any) => sum + (zone.totalWaterNeed || 0),
                    0
                );
            } else if (projectMode === 'horticulture' && enhancedProjectData?.plants) {
                // ✅ ถ้าไม่มี irrigationZones ให้รวมจาก plants
                actualTotalWaterNeed = enhancedProjectData.plants.reduce(
                    (sum: number, plant: any) => sum + (plant.plantData?.waterNeed || 0),
                    0
                );
            } else if (projectMode === 'garden' && gardenStats) {
                actualTotalWaterNeed = (gardenStats.zones as any[]).reduce(
                    (sum, zone: any) => sum + (zone.totalWaterNeed || 0),
                    0
                );
            } else {
                // Fallback: ใช้จาก results
                actualTotalWaterNeed = results.totalWaterRequiredLPM || 0;
            }
            
            // Backend รับ category เฉพาะ horticulture | home-garden | greenhouse | field-crop (ไม่มี 'garden')
            const categoryForApi = projectMode === 'garden' ? 'home-garden' : projectMode;

            const projectDataToSave = {
                field_name: finalProjectName,
                customer_name: enhancedProjectData?.customerName || 'ลูกค้า',
                category: categoryForApi,
                area_coordinates: mainAreaCoordinates,
                plant_type_id: plantTypeId,
                total_plants: actualTotalPlants, // ✅ รวมทุกโซน
                total_area: totalAreaInRai, // ✅ รวมทุกโซน
                total_water_need: actualTotalWaterNeed, // ✅ รวมทุกโซน
                area_type: 'irrigation',
                layers: [
                    {
                        type: 'main_area',
                        coordinates: mainAreaCoordinates,
                        is_initial_map: true,
                    },
                    ...exclusionAreaLayers,
                ],
                zones: zonesToSave,
                planting_points:
                    enhancedProjectData?.plants?.map((plant, index) => {
                        // ✅ แปลง zone_id เป็น null ถ้าไม่ใช่ตัวเลข (backend ต้องการ integer เท่านั้น)
                        let zoneId: number | null = null;
                        if (plant.zoneId) {
                            const parsed = parseInt(plant.zoneId);
                            if (!isNaN(parsed)) {
                                zoneId = parsed;
                            }
                        }
                        
                        // ✅ ทำให้ point_id unique ทุกครั้ง เพื่อป้องกัน duplicate entry error
                        // ใช้ plant.id + timestamp + random string
                        const uniquePointId = `${plant.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                        
                        
                        return {
                            lat: plant.position.lat,
                            lng: plant.position.lng,
                            point_id: uniquePointId, // ✅ ใช้ unique ID แทน plant.id เดิม
                            zone_id: zoneId, // จะเป็น integer หรือ null เท่านั้น
                        };
                    }) || [],
                pipes: pipes,
                // เก็บข้อมูลเพิ่มเติมไว้ใน JSON fields (ลดขนาดข้อมูล)
                project_data: compressProjectData({
                    ...enhancedProjectData,
                    projectName: finalProjectName,
                    mainArea: mainAreaCoordinates, // ✅ เพิ่ม mainArea ที่เตรียมไว้
                    selectedPlantType: enhancedProjectData?.selectedPlantType, // ✅ บันทึก selectedPlantType
                    totalArea: totalAreaInRai * 1600, // บันทึกพื้นที่ใน sq meters
                    irrigationZones: enhancedProjectData?.irrigationZones || [],
                    lateralPipes: enhancedProjectData?.lateralPipes || [],
                    mainPipes: enhancedProjectData?.mainPipes || [],
                    subMainPipes: enhancedProjectData?.subMainPipes || [],
                    exclusionAreas: enhancedProjectData?.exclusionAreas || [],
                    plants: enhancedProjectData?.plants || [], // ✅ บันทึก plants
                    zones: enhancedProjectData?.zones || [],
                    pump: enhancedProjectData?.pump || null,
                    sprinklerConfig: sprinklerConfig,
                    projectImage: projectImage, // ✅ บันทึก projectImage
                }),
                garden_data: gardenData ? bakeSprinklerColorsIntoGardenData(gardenData) : null,
                garden_stats: gardenStats, // ✅ บันทึก gardenStats
                greenhouse_data: greenhouseData,
                field_crop_data: fieldCropData,
                project_stats: {
                    zoneInputs: zoneInputs,
                    // ✅ Normalize zoneSprinklers to ensure productCode is always saved
                    zoneSprinklers: Object.entries(zoneSprinklers).reduce((acc, [zoneId, sprinkler]) => {
                        if (sprinkler) {
                            acc[zoneId] = {
                                ...sprinkler,
                                productCode: sprinkler.productCode || sprinkler.product_code || sprinkler.id,
                                product_code: sprinkler.product_code || sprinkler.productCode || sprinkler.id,
                            };
                        }
                        return acc;
                    }, {} as { [zoneId: string]: any }),
                    // ✅ Normalize selectedPipes to ensure productCode is always saved
                    selectedPipes: Object.entries(selectedPipes).reduce((acc, [zoneId, pipes]) => {
                        if (pipes) {
                            acc[zoneId] = {
                                branch: pipes.branch ? {
                                    ...pipes.branch,
                                    productCode: pipes.branch.productCode || pipes.branch.product_code || pipes.branch.id,
                                    product_code: pipes.branch.product_code || pipes.branch.productCode || pipes.branch.id,
                                } : undefined,
                                secondary: pipes.secondary ? {
                                    ...pipes.secondary,
                                    productCode: pipes.secondary.productCode || pipes.secondary.product_code || pipes.secondary.id,
                                    product_code: pipes.secondary.product_code || pipes.secondary.productCode || pipes.secondary.id,
                                } : undefined,
                                main: pipes.main ? {
                                    ...pipes.main,
                                    productCode: pipes.main.productCode || pipes.main.product_code || pipes.main.id,
                                    product_code: pipes.main.product_code || pipes.main.productCode || pipes.main.id,
                                } : undefined,
                                emitter: pipes.emitter ? {
                                    ...pipes.emitter,
                                    productCode: pipes.emitter.productCode || pipes.emitter.product_code || pipes.emitter.id,
                                    product_code: pipes.emitter.product_code || pipes.emitter.productCode || pipes.emitter.id,
                                } : undefined,
                            };
                        }
                        return acc;
                    }, {} as { [zoneId: string]: any }),
                    // ✅ Save pipe material types (PE/PVC) for each zone and pipe type
                    selectedPipeMaterials: selectedPipeMaterials,
                    selectedPump: selectedPump ? {
                        id: selectedPump.id,
                        name: selectedPump.name,
                        price: selectedPump.price,
                        productCode: selectedPump.productCode,
                        product_code: selectedPump.product_code,
                        brand: selectedPump.brand,
                        powerHP: selectedPump.powerHP,
                        phase: selectedPump.phase,
                        image_url: selectedPump.image_url,
                        image: selectedPump.image,
                        // ✅ บันทึก pumpAccessories ทั้งหมด (แต่ลดขนาดของแต่ละ item)
                        pumpAccessories: selectedPump.pumpAccessories?.map((acc: any) => ({
                            id: acc.id,
                            name: acc.name,
                            price: acc.price,
                            quantity: acc.quantity,
                            is_included: acc.is_included,
                            accessory_type: acc.accessory_type,
                            size: acc.size,
                            sort_order: acc.sort_order,
                            group_id: acc.group_id,
                            group: acc.group,
                            group_items: acc.group_items?.map((item: any) => ({
                                id: item.id,
                                equipment_id: item.equipment_id,
                                quantity: item.quantity,
                                unit_price: item.unit_price,
                                total_price: item.total_price,
                                name: item.name,
                                equipment: item.equipment ? {
                                    id: item.equipment.id,
                                    name: item.equipment.name,
                                    product_code: item.equipment.product_code,
                                    price: item.equipment.price,
                                    image: item.equipment.image,
                                    image_url: item.equipment.image_url,
                                } : null,
                            })),
                            image_url: acc.image_url,
                            image: acc.image,
                        })),
                    } : null,
                    sprinklerEquipmentSets: sprinklerEquipmentSets,
                    connectionEquipments: connectionEquipments,
                    results: compressResults(results), // ลดขนาด results
                    totalCost: totalCost,
                    // ✅ ค่ารวมจากทุกโซน
                    totalPlants: actualTotalPlants,
                    totalAreaInRai: totalAreaInRai,
                    totalWaterNeedPerSession: actualTotalWaterNeed,
                },
                status: 'finished',
                is_completed: true,
            };

            // Log ขนาดข้อมูลเพื่อ debug
            const dataSize = new Blob([JSON.stringify(projectDataToSave)]).size;
            
            if (dataSize > 15 * 1024 * 1024) { // ถ้าเกิน 15MB
                console.warn('⚠️ Data size is very large. This might cause MySQL packet size error.');
                alert(t('ข้อมูลโครงการมีขนาดใหญ่เกินไป กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่ม max_allowed_packet'));
                return;
            }

            // Use PUT if editing existing project, POST if creating new
            // ✅ Use /data endpoint for updating existing projects to save project_stats and project_data
            const endpoint = isEditingExisting
                ? `/api/fields/${existingFieldId}/data`
                : '/api/save-field';
            const method = isEditingExisting ? 'PUT' : 'POST';


            // ดึง CSRF token ใหม่ก่อนบันทึก เพื่อป้องกัน 419 (Page Expired)
            await refreshCsrfToken();
            const csrfToken = getCsrfToken();

            const response = await fetch(endpoint, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || '',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(projectDataToSave),
            });

            const text = await response.text();
            let responseData: any;
            try {
                responseData = text ? JSON.parse(text) : {};
            } catch {
                if (response.status === 419) {
                    alert(t('Session expired. Please refresh the page and try saving again.'));
                    return;
                }
                responseData = { success: false, message: text?.slice(0, 200) || 'Invalid response' };
            }
            
            if (response.ok) {
                if (responseData.success) {
                    const message = isEditingExisting
                        ? t('อัปเดตโครงการสำเร็จแล้ว! โปรเจคได้รับการอัปเดตในโฟลเดอร์ Finished')
                        : t('บันทึกโครงการสำเร็จแล้ว! โปรเจคจะถูกเก็บไว้ในโฟลเดอร์ Finished');
                    alert(message);
                    
                    // อัปเดต localStorage ถ้าบันทึกเป็นโครงการใหม่
                    if (!isEditingExisting && responseData.field && responseData.field.id) {
                        localStorage.setItem('currentFieldId', responseData.field.id.toString());
                        localStorage.setItem('currentFieldName', finalProjectName);
                    } else if (isEditingExisting) {
                        // ✅ อัปเดต currentFieldName เมื่อบันทึกทับโครงการเดิม
                        // ใช้ชื่อจาก responseData.field.name หรือ finalProjectName
                        const fieldNameToSave = responseData.field?.name || finalProjectName;
                        if (fieldNameToSave) {
                            localStorage.setItem('currentFieldName', fieldNameToSave);
                        }
                    }
                    
                    // กลับไปหน้า home
                    router.visit('/');
                } else {
                    const errorMsg = responseData.message || 'Failed to save project';
                    console.error('Save failed:', errorMsg);
                    throw new Error(errorMsg);
                }
            } else {
                const serverMessage = responseData.message || responseData.error || 'Unknown error';
                const errorMsg = `Server error: ${response.status} - ${serverMessage}`;
                console.error('Save failed:', errorMsg);
                throw new Error(errorMsg);
            }
        } catch (error: any) {
            console.error('Error in performSaveProject:', error);
            
            // แสดง error message ที่ชัดเจนกว่า
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            alert(`${t('เกิดข้อผิดพลาดในการบันทึกโครงการ')}\n\nError: ${errorMessage}\n\n${t('กรุณาลองใหม่อีกครั้ง')}`);
        }
    };

    // ฟังก์ชันแก้ไขโครงการ
    const handleEditProject = () => {
        // ตั้งค่าสถานะการแก้ไข
        localStorage.setItem('isEditingExistingProject', 'true');

        // เตรียมข้อมูลสำหรับแต่ละ projectMode
        let projectDataToSave: any = null;

        switch (projectMode) {
            case 'horticulture':
                // ใช้ข้อมูลจาก projectData หรือสร้างใหม่
                projectDataToSave = projectData || {
                    projectName: 'โครงการพืชสวน',
                    customerName: 'ลูกค้า',
                    version: '4.0.0',
                    totalArea: 0,
                    mainArea: [],
                    pump: null,
                    zones: [],
                    mainPipes: [],
                    subMainPipes: [],
                    lateralPipes: [],
                    exclusionAreas: [],
                    plants: [],
                    useZones: false,
                    selectedPlantType: null,
                    availablePlants: [],
                    branchPipeSettings: {
                        defaultAngle: 0,
                        maxAngle: 45,
                        minAngle: -45,
                        angleStep: 5,
                    },
                    lateralPipeSettings: {
                        placementMode: 'over_plants',
                        snapThreshold: 0.5,
                        autoGenerateEmitters: true,
                        emitterDiameter: 4,
                    },
                    irrigationZones: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                // บันทึกข้อมูลครบถ้วนเหมือนกับ HorticultureResultsPage.tsx
                localStorage.setItem(
                    'horticultureIrrigationData',
                    JSON.stringify(projectDataToSave)
                );

                // บันทึกข้อมูลเพิ่มเติมที่จำเป็น
                if (horticultureSystemData) {
                    localStorage.setItem(
                        'horticultureSystemData',
                        JSON.stringify(horticultureSystemData)
                    );
                }
                if (projectStats) {
                    localStorage.setItem('horticultureProjectStats', JSON.stringify(projectStats));
                }
                if (zoneInputs) {
                    localStorage.setItem('horticultureZoneInputs', JSON.stringify(zoneInputs));
                }
                if (zoneSprinklers) {
                    localStorage.setItem(
                        'horticultureZoneSprinklers',
                        JSON.stringify(zoneSprinklers)
                    );
                }
                if (selectedPipes) {
                    localStorage.setItem(
                        'horticultureSelectedPipes',
                        JSON.stringify(selectedPipes)
                    );
                }
                // ✅ Save selectedPipeMaterials to localStorage
                if (selectedPipeMaterials) {
                    localStorage.setItem(
                        'horticultureSelectedPipeMaterials',
                        JSON.stringify(selectedPipeMaterials)
                    );
                }
                if (sprinklerEquipmentSets) {
                    localStorage.setItem(
                        'horticultureSprinklerEquipmentSets',
                        JSON.stringify(sprinklerEquipmentSets)
                    );
                }
                if (connectionEquipments) {
                    localStorage.setItem(
                        'horticultureConnectionEquipments',
                        JSON.stringify(connectionEquipments)
                    );
                }
                if (results) {
                    localStorage.setItem('horticultureResults', JSON.stringify(results));
                }

                router.visit('/horticulture/planner');
                break;

            case 'garden':
                // ล้างแคชแล้วเก็บข้อมูลโครงการนี้ เพื่อให้ planner แสดงตามที่บันทึกไว้
                clearGardenDataCache();
                if (gardenData) {
                    localStorage.setItem('gardenPlannerData', JSON.stringify(gardenData));
                }
                if (gardenStats) {
                    localStorage.setItem('gardenStats', JSON.stringify(gardenStats));
                }
                router.visit('/home-garden/planner');
                break;

            case 'field-crop':
                // เก็บข้อมูล field-crop
                if (fieldCropData) {
                    localStorage.setItem('fieldCropData', JSON.stringify(fieldCropData));
                }
                router.visit('/field-crop/planner');
                break;

            case 'greenhouse':
                // เก็บข้อมูล greenhouse
                if (greenhouseData) {
                    localStorage.setItem('greenhouseData', JSON.stringify(greenhouseData));
                }
                router.visit('/greenhouse/planner');
                break;

            default:
                // Default to horticulture
                projectDataToSave = projectData || {
                    projectName: 'โครงการพืชสวน',
                    customerName: 'ลูกค้า',
                    version: '4.0.0',
                    totalArea: 0,
                    mainArea: [],
                    pump: null,
                    zones: [],
                    mainPipes: [],
                    subMainPipes: [],
                    lateralPipes: [],
                    exclusionAreas: [],
                    plants: [],
                    useZones: false,
                    selectedPlantType: null,
                    availablePlants: [],
                    branchPipeSettings: {
                        defaultAngle: 0,
                        maxAngle: 45,
                        minAngle: -45,
                        angleStep: 5,
                    },
                    lateralPipeSettings: {
                        placementMode: 'over_plants',
                        snapThreshold: 0.5,
                        autoGenerateEmitters: true,
                        emitterDiameter: 4,
                    },
                    irrigationZones: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                localStorage.setItem(
                    'horticultureIrrigationData',
                    JSON.stringify(projectDataToSave)
                );
                router.visit('/horticulture/planner');
        }
    };

    // ฟังก์ชันสร้างโครงการใหม่
    const handleNewProject = () => {
        // ล้างข้อมูลเก่าทั้งหมด
        localStorage.removeItem('isEditingExistingProject');
        localStorage.removeItem('editingProjectData');
        localStorage.removeItem('editingProjectMode');
        localStorage.removeItem('currentFieldId');
        localStorage.removeItem('currentFieldName');

        // ล้างข้อมูลตาม projectMode
        switch (projectMode) {
            case 'horticulture':
                localStorage.removeItem('horticultureIrrigationData');
                localStorage.removeItem('horticultureSystemData');
                break;
            case 'garden':
                localStorage.removeItem('gardenPlannerData');
                localStorage.removeItem('gardenStats');
                localStorage.removeItem('gardenSystemData');
                break;
            case 'field-crop':
                localStorage.removeItem('fieldCropData');
                localStorage.removeItem('field_crop_pipe_calculations');
                break;
            case 'greenhouse':
                localStorage.removeItem('greenhouseData');
                localStorage.removeItem('greenhouseSystemData');
                localStorage.removeItem('greenhouse_pipe_calculations');
                break;
        }

        // ไปยังหน้า planner ตาม projectMode
        switch (projectMode) {
            case 'horticulture':
                router.visit('/horticulture/planner');
                break;
            case 'garden':
                clearGardenDataCache();
                router.visit('/home-garden/planner');
                break;
            case 'field-crop':
                router.visit('/field-crop/planner');
                break;
            case 'greenhouse':
                router.visit('/greenhouse/planner');
                break;
            default:
                router.visit('/horticulture/planner');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <Navbar />
            <div className="max-w-8xl mx-auto p-6 pt-20">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                        <div className="sticky top-6">
                            <div className="max-h-[90vh] overflow-auto rounded-lg bg-gray-800 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-blue-400">
                                        📐 {t('แผนผัง')}
                                    </h2>
                                    {/* Enhanced image status indicator */}
                                    {imageLoading && (
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-400"></div>
                                            <span className="text-xs text-blue-400">
                                                Loading...
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {imageLoading ? (
                                    <div className="flex h-[280px] items-center justify-center rounded-lg bg-gray-700">
                                        <div className="text-center">
                                            <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-400"></div>
                                            <p className="text-sm text-gray-400">กำลังโหลดภาพ...</p>
                                        </div>
                                    </div>
                                ) : projectImage ? (
                                    <div
                                        className="group relative flex items-center justify-center"
                                        style={{ minHeight: 0 }}
                                        data-tour="project-image"
                                    >
                                        <img
                                            src={projectImage}
                                            alt={`${
                                                projectMode === 'garden'
                                                    ? t('สวนบ้าน')
                                                    : projectMode === 'field-crop'
                                                      ? t('พืชไร่')
                                                      : projectMode === 'greenhouse'
                                                        ? t('โรงเรือน')
                                                        : t('พืชสวน')
                                            } Project`}
                                            className="aspect-video max-h-[280px] w-full cursor-pointer rounded-lg object-contain transition-transform hover:scale-105"
                                            style={{ maxHeight: '280px', minHeight: '280px' }}
                                            onClick={() => setShowImageModal(true)}
                                            onError={() => {
                                                setImageLoadError('Failed to load image');
                                                setProjectImage(null);
                                            }}
                                        />
                                        <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                            <label className="h-6 w-6 cursor-pointer rounded-full bg-blue-600 text-xs hover:bg-blue-700">
                                                📷
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    className="hidden"
                                                />
                                            </label>
                                            <button
                                                onClick={handleImageDelete}
                                                className="h-6 w-6 rounded-full bg-red-600 text-xs hover:bg-red-700"
                                                title="Delete image"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border-2 border-dashed border-gray-600" data-tour="project-image">
                                        <label className="flex h-[280px] cursor-pointer flex-col items-center justify-center hover:border-blue-500">
                                            <div className="text-4xl text-gray-500">📷</div>
                                            <p className="mt-2 text-sm text-gray-400">
                                                {projectMode === 'garden'
                                                    ? t('เพิ่มรูปแผนผังสวนบ้าน')
                                                    : projectMode === 'field-crop'
                                                      ? t('เพิ่มรูปแผนผังพืชไร่')
                                                      : projectMode === 'greenhouse'
                                                        ? t('เพิ่มรูปแผนผังโรงเรือน')
                                                        : t('เพิ่มรูปแผนผังพืชสวน')}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {projectMode === 'garden'
                                                    ? t('หรือส่งออกจากหน้าสรุปผลสวนบ้าน')
                                                    : projectMode === 'field-crop'
                                                      ? t('หรือส่งออกจากหน้าสรุปผลพืชไร่')
                                                      : projectMode === 'greenhouse'
                                                        ? t('หรือส่งออกจากหน้าสรุปผลโรงเรือน')
                                                        : t('หรือส่งออกจากหน้าสรุปผลพืชสวน')}
                                            </p>
                                            {imageLoadError && (
                                                <p className="mt-2 text-xs text-red-400">
                                                    {imageLoadError}
                                                </p>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                            {zones.length > 1 && (
                                <div className="mb-4 mt-4 flex flex-wrap gap-2" data-tour="zone-selection">
                                    {zones.map((zone, zoneIndex) => {
                                        const isActive = String(activeZoneId) === String(zone.id);

                                        // Use getZoneColor based on zone index instead of stored zone.color
                                        const zoneColor = getZoneColor(zoneIndex);

                                        const buttonStyle = {
                                            backgroundColor: zoneColor,
                                            color: 'black',
                                        };

                                        return (
                                            <button
                                                key={zone.id}
                                                onClick={() => setActiveZoneId(zone.id)}
                                                className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                                                    isActive
                                                        ? 'border-2 border-blue-600 text-blue-400 ring-2 ring-blue-400'
                                                        : 'opacity-80'
                                                }`}
                                                style={buttonStyle}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span>{zone.name}</span>
                                                    {/* แสดงติ๊กถูกทุกโซนตั้งแต่แรก = โซนที่เปิดแล้ว */}
                                                    <span className="text-xs text-green-700">
                                                        ✓
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="mb-4 rounded-lg bg-gray-800 p-4" data-tour="pump-option">
                                <div>
                                    <h3 className="mb-3 text-lg font-semibold text-purple-400">
                                        ⚡ {t('ตัวเลือกปั๊มน้ำ')}
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={showPumpOption}
                                                onChange={(e) => setShowPumpOption(e.target.checked)}
                                                className="rounded"
                                            />
                                            <span className="text-sm font-medium">
                                                {t('ต้องการใช้ปั๊มน้ำในระบบ')}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            {/* {zones.length > 1 && (
                                <div className="mb-6 rounded-lg bg-gray-800 p-4">
                                    <div className="rounded bg-blue-900 p-3">
                                        <h4 className="mb-2 text-sm font-medium text-blue-300">
                                            🎯 {t('เลือกรูปแบบการเปิดโซน:')}
                                        </h4>
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                            <label className="flex cursor-pointer items-center gap-2 rounded bg-blue-800 p-1 hover:bg-blue-700">
                                                <input
                                                    type="radio"
                                                    name="zoneOperation"
                                                    value="sequential"
                                                    checked={zoneOperationMode === 'sequential'}
                                                    onChange={() =>
                                                        handleZoneOperationModeChange('sequential')
                                                    }
                                                    className="rounded"
                                                />
                                                <div>
                                                    <p className="text-xs font-medium">
                                                        {t('เปิดทีละโซน')}
                                                    </p>
                                                </div>
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2 rounded bg-blue-800 p-1 hover:bg-blue-700">
                                                <input
                                                    type="radio"
                                                    name="zoneOperation"
                                                    value="simultaneous"
                                                    checked={zoneOperationMode === 'simultaneous'}
                                                    onChange={() =>
                                                        handleZoneOperationModeChange(
                                                            'simultaneous'
                                                        )
                                                    }
                                                    className="rounded"
                                                />
                                                <div>
                                                    <p className="text-xs font-medium">
                                                        {t('เปิดพร้อมกันทุกโซน')}
                                                    </p>
                                                </div>
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2 rounded bg-blue-800 p-1 hover:bg-blue-700">
                                                <input
                                                    type="radio"
                                                    name="zoneOperation"
                                                    value="custom"
                                                    checked={zoneOperationMode === 'custom'}
                                                    onChange={() =>
                                                        handleZoneOperationModeChange('custom')
                                                    }
                                                    className="rounded"
                                                />
                                                <div>
                                                    <p className="text-xs font-medium">
                                                        {t('กำหนดเอง')}
                                                    </p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    {zoneOperationMode === 'custom' && (
                                        <div className="mt-4 rounded bg-purple-900 p-3">
                                            <div className="mb-3 flex items-center justify-between">
                                                <h4 className="text-sm font-medium text-purple-300">
                                                    📋 {t('จัดการกลุ่มการเปิดโซน:')}
                                                </h4>
                                                <button
                                                    onClick={addOperationGroup}
                                                    className="rounded bg-purple-600 px-3 py-1 text-xs hover:bg-purple-700"
                                                >
                                                    + {t('เพิ่มกลุ่ม')}
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {zoneOperationGroups.map((group) => (
                                                    <div
                                                        key={group.id}
                                                        className="rounded bg-purple-800 p-2"
                                                    >
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <p className="text-sm font-medium text-purple-200">
                                                                {group.label} ({t('ลำดับที่')}{' '}
                                                                {group.order})
                                                                {group.zones.length === 0 && (
                                                                    <span className="ml-2 text-red-300">
                                                                        ({t('ไม่มีโซน')})
                                                                    </span>
                                                                )}
                                                            </p>
                                                            {zoneOperationGroups.length > 1 && (
                                                                <button
                                                                    onClick={() =>
                                                                        removeOperationGroup(
                                                                            group.id
                                                                        )
                                                                    }
                                                                    className="text-xs text-red-400 hover:text-red-300"
                                                                >
                                                                    {t('ลบ')}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                                            {zones.map((zone) => (
                                                                <label
                                                                    key={zone.id}
                                                                    className="flex cursor-pointer items-center gap-1 text-xs"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={group.zones.includes(
                                                                            zone.id
                                                                        )}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                const otherGroups =
                                                                                    zoneOperationGroups.filter(
                                                                                        (g) =>
                                                                                            g.id !==
                                                                                            group.id
                                                                                    );
                                                                                otherGroups.forEach(
                                                                                    (g) => {
                                                                                        updateOperationGroup(
                                                                                            g.id,
                                                                                            g.zones.filter(
                                                                                                (
                                                                                                    z
                                                                                                ) =>
                                                                                                    z !==
                                                                                                    zone.id
                                                                                            )
                                                                                        );
                                                                                    }
                                                                                );
                                                                                updateOperationGroup(
                                                                                    group.id,
                                                                                    [
                                                                                        ...group.zones,
                                                                                        zone.id,
                                                                                    ]
                                                                                );
                                                                            } else {
                                                                                updateOperationGroup(
                                                                                    group.id,
                                                                                    group.zones.filter(
                                                                                        (z) =>
                                                                                            z !==
                                                                                            zone.id
                                                                                    )
                                                                                );
                                                                            }
                                                                        }}
                                                                        className="rounded"
                                                                    />
                                                                    <span>{zone.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-2 text-xs text-purple-200">
                                                💡 {t('โซนที่อยู่ในกลุ่มเดียวกันจะเปิดพร้อมกัน')}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )} */}

                            {/* Tab Navigation Buttons */}
                            <div className="mb-4 mt-3 rounded-lg bg-gray-800 p-3">
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {/* ปุ่มบันทึกโครงการ */}
                                    <button
                                        data-tour="save-project"
                                        onClick={handleSaveProject}
                                        className="flex items-center justify-center gap-1.5 rounded bg-green-600 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                                    >
                                        <svg
                                            className="h-4 w-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                                            />
                                        </svg>
                                        {t('บันทึกโครงการ')}
                                    </button>

                                    {/* ปุ่มแก้ไขโครงการ */}
                                    <button
                                        data-tour="edit-project"
                                        onClick={handleEditProject}
                                        className="flex items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                                    >
                                        <svg
                                            className="h-4 w-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                            />
                                        </svg>
                                        {t('แก้ไขโครงการ')}
                                    </button>

                                    {/* ปุ่มสร้างโครงการใหม่ */}
                                    <button
                                        data-tour="new-project"
                                        onClick={handleNewProject}
                                        className="flex items-center justify-center gap-1.5 rounded bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                                    >
                                        <svg
                                            className="h-4 w-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                            />
                                        </svg>
                                        {t('สร้างโครงการใหม่')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 lg:col-span-8">
                        <div className="mb-6 flex flex-row flex-wrap justify-center gap-3 rounded-lg bg-gray-800 p-4">
                            <div className="flex flex-row flex-wrap items-center gap-0">
                                {/* Tab 1: InputForm */}
                                <button
                                    data-tour="tab-input"
                                    onClick={() => {
                                        setActiveTab(1);
                                        setVisitedTabs((prev) => new Set([...prev, 1]));
                                    }}
                                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                                        activeTab === 1
                                            ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                            : visitedTabs.has(1)
                                              ? 'bg-green-600 text-white hover:bg-green-700'
                                              : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                                    }`}
                                >
                                    <span>📝</span>
                                    <span>{t('ดูข้อมูลพื้นที่')}</span>
                                    {visitedTabs.has(1) && activeTab !== 1 && (
                                        <span className="text-xs">✓</span>
                                    )}
                                </button>
                                {/* เส้นตรง + ลูกศร */}
                                <span className="flex items-center mx-1 select-none">
                                    <span className="mx-1 text-xl text-gray-400">{'➔'}</span>
                                </span>
                                
                                {/* Tab 2: SprinklerSelector */}
                                <button
                                    data-tour="tab-sprinkler"
                                    onClick={() => {
                                        setActiveTab(2);
                                        setVisitedTabs((prev) => new Set([...prev, 2]));
                                    }}
                                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                                        activeTab === 2
                                            ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                            : visitedTabs.has(2)
                                              ? 'bg-green-600 text-white hover:bg-green-700'
                                              : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                                    }`}
                                >
                                    <span>💧</span>
                                    <span>{t('เลือกสปริงเกอร์')}</span>
                                    {visitedTabs.has(2) && activeTab !== 2 && (
                                        <span className="text-xs">✓</span>
                                    )}
                                </button>
                                <span className="flex items-center mx-1 select-none">
                                    <span className="mx-1 text-xl text-gray-400">{'➔'}</span>
                                </span>

                                {/* Tab 3: PipeSelector + PipeSystemSummary */}
                                <button
                                    data-tour="tab-pipe"
                                    onClick={() => {
                                        setActiveTab(3);
                                        setVisitedTabs((prev) => new Set([...prev, 3]));
                                    }}
                                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                                        activeTab === 3
                                            ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                            : visitedTabs.has(3)
                                              ? 'bg-green-600 text-white hover:bg-green-700'
                                              : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                                    }`}
                                >
                                    <span>🔧</span>
                                    <span>{t('เลือกระบบท่อ')}</span>
                                    {visitedTabs.has(3) && activeTab !== 3 && (
                                        <span className="text-xs">✓</span>
                                    )}
                                </button>
                                <span className="flex items-center mx-1 select-none">
                                    <span className="mx-1 text-xl text-gray-400">{'➔'}</span>
                                </span>

                                {/* Tab 4: PumpSelector - แสดงเฉพาะเมื่อ showPumpOption เป็น true */}
                                {showPumpOption && (
                                    <>
                                        <button
                                            data-tour="tab-pump"
                                            onClick={() => {
                                                setActiveTab(4);
                                                setVisitedTabs((prev) => new Set([...prev, 4]));
                                            }}
                                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                                                activeTab === 4
                                                    ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                                    : visitedTabs.has(4)
                                                      ? 'bg-green-600 text-white hover:bg-green-700'
                                                      : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                                            }`}
                                        >
                                            <span>⚡</span>
                                            <span>{t('เลือกปั๊มน้ำ')}</span>
                                            {visitedTabs.has(4) && activeTab !== 4 && (
                                                <span className="text-xs">✓</span> 
                                            )}
                                        </button>
                                        <span className="flex items-center mx-1 select-none">
                                            <span className="mx-1 text-xl text-gray-400">{'➔'}</span>
                                        </span>
                                    </>
                                )}

                                {/* Tab 5: CostSummary */}
                                <button
                                    data-tour="tab-cost"
                                    onClick={() => {
                                        setActiveTab(5);
                                        setVisitedTabs((prev) => new Set([...prev, 5]));
                                    }}
                                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                                        activeTab === 5
                                            ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                            : visitedTabs.has(5)
                                              ? 'bg-green-600 text-white hover:bg-green-700'
                                              : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                                    }`}
                                >
                                    <span>💰</span>
                                    <span>{t('สรุปค่าใช้จ่าย')}</span>
                                    {visitedTabs.has(5) && activeTab !== 5 && (
                                        <span className="text-xs">✓</span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Tab 1: InputForm */}
                        {activeTab === 1 && (
                            <InputForm
                                key={activeZoneId}
                                input={currentInput}
                                onInputChange={handleInputChange}
                                selectedSprinkler={currentSprinkler}
                                activeZone={activeZone}
                                projectMode={projectMode}
                                zoneAreaData={getZoneAreaData()}
                                greenhouseData={greenhouseData}
                                fieldCropSystemData={fieldCropData}
                                fieldCropIrrigationSettings={(() => {
                                    // Use the same irrigationSettingsData that field-crop-summary.tsx uses
                                    if (fieldCropData && (fieldCropData as any).irrigationSettings) {
                                        return (fieldCropData as any).irrigationSettings;
                                    }

                                    // Fallback to localStorage
                                    try {
                                        const data = localStorage.getItem('fieldCropData');
                                        if (data) {
                                            const parsed = JSON.parse(data) as {
                                                irrigationSettings?: Record<
                                                    string,
                                                    {
                                                        flow?: number;
                                                        coverageRadius?: number;
                                                        pressure?: number;
                                                    }
                                                >;
                                            };
                                            if (parsed.irrigationSettings) {
                                                return parsed.irrigationSettings;
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Error parsing fieldCropData:', error);
                                    }

                                    // Return default flow settings if no data found (same as field-crop-summary.tsx)
                                    return {
                                        sprinkler_system: { flow: 0, coverageRadius: 5 }, // Default 0 L/min for sprinklers
                                        pivot: { flow: 0, coverageRadius: 10 }, // Default 0 L/min for pivots
                                    };
                                })()}
                            />
                        )}

                        {/* Tab 2: SprinklerSelector */}
                        {activeTab === 2 && (
                            <SprinklerSelector
                                selectedSprinkler={currentSprinkler}
                                onSprinklerChange={handleSprinklerChange}
                                results={results}
                                activeZone={activeZone}
                                allZoneSprinklers={zoneSprinklers}
                                projectMode={projectMode}
                                gardenStats={gardenStats}
                                gardenData={gardenData}
                                greenhouseData={greenhouseData}
                                fieldCropData={fieldCropData}
                                input={currentInput}
                                onInputChange={handleInputChange}
                            />
                        )}

                        {/* Tab 3: PipeSelector + PipeSystemSummary - field-crop แสดงแม้โซนที่เลือกยังไม่มี sprinkler */}
                        {activeTab === 3 && (currentSprinkler || projectMode === 'field-crop') && (
                            <>
                                {zones.length > 1 && (
                                    <p className="mb-2 text-sm text-gray-400">
                                        {t('กำลังดูโซน')}: <span className="font-medium text-white">{activeZone?.name ?? activeZoneId}</span>
                                    </p>
                                )}
                                <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
                                    <PipeSelector
                                        pipeType="branch"
                                        results={results}
                                        input={currentInput}
                                        selectedPipe={effectiveEquipment.branchPipe}
                                        onPipeChange={handleBranchPipeChange}
                                        horticultureSystemData={horticultureSystemData}
                                        gardenSystemData={gardenSystemData}
                                        greenhouseSystemData={greenhouseData}
                                        fieldCropData={fieldCropData}
                                        activeZoneId={activeZoneId}
                                        selectedSprinkler={currentSprinkler}
                                        projectMode={projectMode}
                                        selectedPipeSizes={selectedPipeSizes}
                                        selectedPipeMaterial={selectedPipeMaterials[activeZoneId]?.branch}
                                        onPipeMaterialChange={handleBranchPipeMaterialChange}
                                    />
                                    {projectMode === 'garden' && gardenSystemData?.connectorSummary && (
                                        <GardenConnectorEquipmentsSelector
                                            connectorSummary={gardenSystemData.connectorSummary}
                                        />
                                    )}

                                    {shouldShowSecondaryPipe ? (
                                        <PipeSelector
                                            pipeType="secondary"
                                            results={results}
                                            input={currentInput}
                                            selectedPipe={effectiveEquipment.secondaryPipe}
                                            onPipeChange={handleSecondaryPipeChange}
                                            horticultureSystemData={horticultureSystemData}
                                            gardenSystemData={gardenSystemData}
                                            greenhouseSystemData={greenhouseData}
                                            fieldCropData={fieldCropData}
                                            activeZoneId={activeZoneId}
                                            selectedSprinkler={currentSprinkler}
                                            projectMode={projectMode}
                                            selectedPipeSizes={selectedPipeSizes}
                                            selectedPipeMaterial={selectedPipeMaterials[activeZoneId]?.secondary}
                                            onPipeMaterialChange={handleSecondaryPipeMaterialChange}
                                        />
                                    ) : null}

                                    {shouldShowMainPipe && (
                                        <PipeSelector
                                            pipeType="main"
                                            results={results}
                                            input={currentInput}
                                            selectedPipe={effectiveEquipment.mainPipe}
                                            onPipeChange={handleMainPipeChange}
                                            horticultureSystemData={horticultureSystemData}
                                            gardenSystemData={gardenSystemData}
                                            greenhouseSystemData={greenhouseData}
                                            fieldCropData={fieldCropData}
                                            activeZoneId={activeZoneId}
                                            selectedSprinkler={currentSprinkler}
                                            projectMode={projectMode}
                                            selectedPipeSizes={selectedPipeSizes}
                                            selectedPipeMaterial={selectedPipeMaterials[activeZoneId]?.main}
                                            onPipeMaterialChange={handleMainPipeMaterialChange}
                                        />
                                    )}

                                    {currentInput.longestEmitterPipeM &&
                                    currentInput.longestEmitterPipeM > 0 ? (
                                        <PipeSelector
                                            pipeType="emitter"
                                            results={results}
                                            input={currentInput}
                                            selectedPipe={effectiveEquipment.emitterPipe}
                                            onPipeChange={handleEmitterPipeChange}
                                            horticultureSystemData={horticultureSystemData}
                                            gardenSystemData={gardenSystemData}
                                            greenhouseSystemData={greenhouseData}
                                            fieldCropData={fieldCropData}
                                            activeZoneId={activeZoneId}
                                            selectedSprinkler={currentSprinkler}
                                            projectMode={projectMode}
                                            selectedPipeSizes={selectedPipeSizes}
                                            selectedPipeMaterial={selectedPipeMaterials[activeZoneId]?.emitter}
                                            onPipeMaterialChange={handleEmitterPipeMaterialChange}
                                        />
                                    ) : projectMode === 'horticulture' ? null : null}

                                    {/* อุปกรณ์เชื่อมต่อท่อ */}
                                    {connectionStats && connectionStats.length > 0 && (
                                        <ConnectionEquipmentsSelector
                                            connectionStats={connectionStats}
                                            activeZone={activeZone}
                                            activeZoneId={activeZoneId}
                                            projectMode={projectMode}
                                            fieldCropSystemData={fieldCropData}
                                            onConnectionEquipmentsChange={handleConnectionEquipmentsChange}
                                        />
                                    )}
                                </div>

                                {/* สรุปการคำนวณระบบท่อทั้งหมด */}
                                <PipeSystemSummary
                                    horticultureSystemData={horticultureSystemData}
                                    gardenSystemData={gardenSystemData}
                                    greenhouseData={greenhouseData}
                                    fieldCropData={fieldCropData}
                                    activeZoneId={activeZoneId}
                                    selectedPipes={{
                                        branch: effectiveEquipment.branchPipe,
                                        secondary: effectiveEquipment.secondaryPipe,
                                        main: effectiveEquipment.mainPipe,
                                        emitter: effectiveEquipment.emitterPipe,
                                    }}
                                    sprinklerPressure={
                                        projectMode === 'garden' &&
                                        gardenSystemData?.sprinklerConfig?.pressureBar
                                            ? {
                                                  pressureBar:
                                                      gardenSystemData.sprinklerConfig.pressureBar,
                                                  headM:
                                                      gardenSystemData.sprinklerConfig.pressureBar *
                                                      10,
                                                  head20PercentM:
                                                      gardenSystemData.sprinklerConfig.pressureBar *
                                                      10 *
                                                      0.2,
                                              }
                                            : projectMode === 'field-crop' &&
                                                (fieldCropData as any)?.irrigationSettings
                                                    ?.sprinkler_system?.pressure
                                              ? {
                                                    pressureBar: (fieldCropData as any)
                                                        .irrigationSettings.sprinkler_system
                                                        .pressure,
                                                    headM:
                                                        (fieldCropData as any).irrigationSettings
                                                            .sprinkler_system.pressure * 10,
                                                    head20PercentM:
                                                        (fieldCropData as any).irrigationSettings
                                                            .sprinkler_system.pressure *
                                                        10 *
                                                        0.2,
                                                }
                                              : projectMode === 'greenhouse'
                                                ? (() => {
                                                      // ลองหาจาก greenhouseSummaryData ก่อน
                                                      let pressureBar =
                                                          greenhouseSummaryData?.sprinklerPressure ||
                                                          2.5;

                                                      // ถ้าไม่มี ให้ใช้จาก sprinkler ที่เลือก
                                                      if (
                                                          pressureBar === 2.5 &&
                                                          currentSprinkler?.pressureBar
                                                      ) {
                                                          if (
                                                              Array.isArray(
                                                                  currentSprinkler.pressureBar
                                                              )
                                                          ) {
                                                              pressureBar =
                                                                  (currentSprinkler.pressureBar[0] +
                                                                      currentSprinkler
                                                                          .pressureBar[1]) /
                                                                  2;
                                                          } else if (
                                                              typeof currentSprinkler.pressureBar ===
                                                                  'string' &&
                                                              currentSprinkler.pressureBar.includes(
                                                                  '-'
                                                              )
                                                          ) {
                                                              const parts =
                                                                  currentSprinkler.pressureBar.split(
                                                                      '-'
                                                                  );
                                                              pressureBar =
                                                                  (parseFloat(parts[0]) +
                                                                      parseFloat(parts[1])) /
                                                                  2;
                                                          } else {
                                                              pressureBar = parseFloat(
                                                                  String(
                                                                      currentSprinkler.pressureBar
                                                                  )
                                                              );
                                                          }
                                                      }

                                                      return {
                                                          pressureBar: pressureBar,
                                                          headM: pressureBar * 10,
                                                          head20PercentM: pressureBar * 10 * 0.2,
                                                      };
                                                  })()
                                                : horticultureSystemData?.sprinklerConfig
                                                        ?.pressureBar
                                                  ? {
                                                        pressureBar:
                                                            horticultureSystemData.sprinklerConfig
                                                                .pressureBar,
                                                        headM:
                                                            horticultureSystemData.sprinklerConfig
                                                                .pressureBar * 10,
                                                        head20PercentM:
                                                            horticultureSystemData.sprinklerConfig
                                                                .pressureBar *
                                                            10 *
                                                            0.2,
                                                    }
                                                  : undefined
                                    }
                                    projectMode={projectMode}
                                />
                            </>
                        )}

                        {/* Tab 4: PumpSelector */}
                        {activeTab === 4 && showPumpOption && (
                            <>
                                <CalculationSummary
                                    results={results}
                                    input={currentInput}
                                    selectedSprinkler={currentSprinkler}
                                    selectedPump={effectiveEquipment.pump}
                                    selectedBranchPipe={effectiveEquipment.branchPipe}
                                    selectedSecondaryPipe={effectiveEquipment.secondaryPipe}
                                    selectedMainPipe={effectiveEquipment.mainPipe}
                                    activeZone={activeZone}
                                    selectedZones={zones.map((z) => z.id)}
                                    allZoneSprinklers={zoneSprinklers}
                                    projectMode={projectMode}
                                    showPump={showPumpOption}
                                    simultaneousZonesCount={
                                        zoneOperationMode === 'simultaneous'
                                            ? zones.length
                                            : zoneOperationMode === 'custom'
                                              ? Math.max(
                                                    ...zoneOperationGroups.map(
                                                        (g) => g.zones.length
                                                    )
                                                )
                                              : 1
                                    }
                                    zoneOperationGroups={zoneOperationGroups}
                                    getZoneName={getZoneNameForSummary}
                                    fieldCropData={fieldCropData}
                                    greenhouseData={greenhouseData}
                                    gardenStats={gardenStats}
                                    maxPumpHeadForProjectMode={finalMaxPumpHeadForProjectMode}
                                    onPumpHeadCalculated={handlePumpHeadCalculated}
                                />
                                <PumpSelector
                                    results={results}
                                    selectedPump={effectiveEquipment.pump}
                                    selectedSprinkler={zoneSprinklers[activeZoneId]}
                                    onPumpChange={handlePumpChange}
                                    zoneOperationGroups={zoneOperationGroups}
                                    zoneInputs={zoneInputs}
                                    zoneOperationMode={zoneOperationMode}
                                    simultaneousZonesCount={
                                        zoneOperationMode === 'simultaneous'
                                            ? zones.length
                                            : zoneOperationMode === 'custom'
                                              ? Math.max(
                                                    ...zoneOperationGroups.map(
                                                        (g) => g.zones.length
                                                    )
                                                )
                                              : 1
                                    }
                                    selectedZones={zones.map((z) => z.id)}
                                    allZoneResults={results?.allZoneResults}
                                    projectSummary={results?.projectSummary}
                                    projectMode={projectMode}
                                    fieldCropData={fieldCropData}
                                    maxPumpHeadForProjectMode={finalMaxPumpHeadForProjectMode}
                                />
                            </>
                        )}

                        {/* Tab 5: CostSummary */}
                        {activeTab === 5 && (
                            <CostSummary
                                    results={results}
                                    zoneSprinklers={zoneSprinklers}
                                    selectedPipes={selectedPipes}
                                    selectedPump={effectiveEquipment.pump}
                                    activeZoneId={activeZoneId}
                                    projectData={null}
                                    gardenData={gardenData}
                                    gardenStats={gardenStats}
                                    zoneInputs={zoneInputs}
                                    onQuotationClick={handleOpenQuotationModal}
                                    projectMode={projectMode}
                                    showPump={showPumpOption}
                                    fieldCropData={fieldCropData}
                                    greenhouseData={greenhouseData}
                                    sprinklerEquipmentSets={sprinklerEquipmentSets}
                                    connectionEquipments={connectionEquipments}
                            />
                        )}
                    </div>
                </div>
            </div>

            {showImageModal && projectImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                    onClick={() => setShowImageModal(false)}
                >
                    <div
                        className="relative max-h-[90vh] max-w-[90vw]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setShowImageModal(false)}
                            className="absolute -right-4 -top-4 rounded-full bg-red-600 p-2 text-white hover:bg-red-700"
                        >
                            ×
                        </button>
                        <div className="relative flex h-[90vh] w-[90vw] items-center justify-center">
                            <img
                                src={projectImage || undefined}
                                alt={`${
                                    projectMode === 'garden'
                                        ? t('สวนบ้าน')
                                        : projectMode === 'field-crop'
                                          ? t('พืชไร่')
                                          : projectMode === 'greenhouse'
                                            ? t('โรงเรือน')
                                            : t('พืชสวน')
                                } Project`}
                                className="max-h-full max-w-full rounded-lg"
                            />
                            <div className="absolute left-4 top-4">
                                <div
                                    className={`rounded-lg px-3 py-1 text-sm font-medium ${
                                        projectMode === 'garden'
                                            ? 'bg-green-600 text-white'
                                            : projectMode === 'field-crop'
                                              ? 'bg-yellow-600 text-white'
                                              : projectMode === 'greenhouse'
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-orange-600 text-white'
                                    }`}
                                >
                                    {projectMode === 'garden'
                                        ? t('🏡 สวนบ้าน')
                                        : projectMode === 'field-crop'
                                          ? t('🌾 พืชไร่')
                                          : projectMode === 'greenhouse'
                                            ? t('🏠 โรงเรือน')
                                            : t('🌱 พืชสวน')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Save Project Modal */}
            {showSaveProjectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
                    <div className="relative w-full max-w-lg rounded-lg bg-gray-800 p-6 shadow-xl">
                        <button
                            onClick={() => {
                                setShowSaveProjectModal(false);
                                setSaveAsNewProject(false);
                            }}
                            className="absolute right-4 top-4 text-3xl text-gray-400 hover:text-white"
                        >
                            ×
                        </button>

                        <h2 className="mb-4 text-2xl font-bold text-yellow-400">
                            💾 {t('บันทึกโครงการ')}
                        </h2>

                        <div className="mb-4">
                            <label className="mb-2 block text-sm font-medium text-gray-300">
                                {t('ชื่อโครงการ')}
                            </label>
                            <input
                                type="text"
                                value={saveProjectName}
                                onChange={(e) => setSaveProjectName(e.target.value)}
                                className="w-full rounded-lg border border-gray-600 bg-gray-700 p-3 text-white focus:border-blue-500 focus:outline-none"
                                placeholder={t('กรอกชื่อโครงการ...')}
                            />
                        </div>

                        {/* แสดงปุ่มเลือกถ้ามี draft เดิม */}
                        {localStorage.getItem('currentFieldId') && 
                         !localStorage.getItem('currentFieldId')?.startsWith('mock-') && (
                            <div className="mb-4 rounded-lg bg-gray-700 p-4">
                                <p className="mb-3 text-sm text-gray-300">
                                    {t('เลือกวิธีการบันทึก:')}
                                </p>
                                <div className="space-y-2">
                                    <button
                                        onClick={async () => {
                                            setShowSaveProjectModal(false);
                                            await performSaveProject(saveProjectName, false);
                                        }}
                                        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 transition-colors"
                                    >
                                        📝 {t('บันทึกทับงานเดิม')}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!saveProjectName || saveProjectName.trim() === '' || saveProjectName === 'โครงการใหม่') {
                                                alert(t('กรุณาตั้งชื่อโครงการใหม่'));
                                                return;
                                            }
                                            setShowSaveProjectModal(false);
                                            await performSaveProject(saveProjectName, true);
                                        }}
                                        className="w-full rounded-lg bg-green-600 px-4 py-3 text-white hover:bg-green-700 transition-colors"
                                    >
                                        ➕ {t('บันทึกเป็นงานใหม่')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ถ้าไม่มี draft → แสดงปุ่มบันทึกเดียว */}
                        {(!localStorage.getItem('currentFieldId') || 
                          localStorage.getItem('currentFieldId')?.startsWith('mock-')) && (
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => {
                                        setShowSaveProjectModal(false);
                                        setSaveAsNewProject(false);
                                    }}
                                    className="rounded-lg bg-gray-600 px-6 py-2 text-white hover:bg-gray-700"
                                >
                                    {t('ยกเลิก')}
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!saveProjectName || saveProjectName.trim() === '' || saveProjectName === 'โครงการใหม่') {
                                            alert(t('กรุณาตั้งชื่อโครงการ'));
                                            return;
                                        }
                                        setShowSaveProjectModal(false);
                                        await performSaveProject(saveProjectName, false);
                                    }}
                                    className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
                                >
                                    💾 {t('บันทึก')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <QuotationModal
                show={showQuotationModal}
                quotationData={quotationData}
                quotationDataCustomer={quotationDataCustomer}
                onQuotationDataChange={setQuotationData}
                onQuotationDataCustomerChange={setQuotationDataCustomer}
                onClose={() => setShowQuotationModal(false)}
                onConfirm={handleQuotationModalConfirm}
                t={t}
            />

            {results && (
                <QuotationDocument
                    show={showQuotation}
                    results={results!}
                    quotationData={quotationData}
                    quotationDataCustomer={quotationDataCustomer}
                    selectedSprinkler={currentSprinkler}
                    selectedPump={effectiveEquipment.pump}
                    selectedBranchPipe={effectiveEquipment.branchPipe}
                    selectedSecondaryPipe={effectiveEquipment.secondaryPipe}
                    selectedMainPipe={effectiveEquipment.mainPipe}
                    selectedExtraPipe={selectedExtraPipe}
                    projectImage={projectImage}
                    projectData={projectData}
                    horticultureSystemData={horticultureSystemData}
                    gardenData={gardenData}
                    greenhouseData={greenhouseData}
                    zoneSprinklers={zoneSprinklers}
                    selectedPipes={selectedPipes}
                    sprinklerEquipmentSets={sprinklerEquipmentSets}
                    connectionEquipments={connectionEquipments}
                    zoneInputs={zoneInputs}
                    gardenStats={gardenStats}
                    fieldCropData={fieldCropData}
                    onClose={() => setShowQuotation(false)}
                    projectMode={projectMode}
                    showPump={showPumpOption}
                    maxPumpHeadForProjectMode={finalMaxPumpHeadForProjectMode}
                />
            )}

            {/* field-crop: hidden PipeSelectors สำหรับโซนที่ยังไม่ active — ให้ shouldCorrectToRecommended ทำงานได้โดยไม่ต้องรอ user กดเปิดทีละโซน */}
            {projectMode === 'field-crop' &&
                fieldCropData?.zones?.info &&
                fieldCropData.zones.info
                    .filter((zone) => {
                        const zid = String(zone.id);
                        if (zid === activeZoneId) return false; // visible zone แสดงอยู่แล้ว
                        return true; // render hidden สำหรับทุกโซนที่ไม่ active
                    })
                    .map((zone) => {
                        const zid = String(zone.id);
                        const zp = selectedPipes[zid] || {};
                        const zSizes = {
                            branch: zp.branch?.sizeMM || 0,
                            secondary: zp.secondary?.sizeMM || 0,
                            main: zp.main?.sizeMM || 0,
                            emitter: zp.emitter?.sizeMM || 0,
                        };
                        const zInput = zoneInputs[zid] || currentInput;
                        const zSprinkler = zoneSprinklers[zid] || currentSprinkler;
                        return (
                            <div
                                key={`hidden-pipe-${zid}`}
                                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden', pointerEvents: 'none' }}
                                aria-hidden="true"
                            >
                                <PipeSelector
                                    pipeType="branch"
                                    results={results}
                                    input={zInput}
                                    selectedPipe={zp.branch}
                                    onPipeChange={(p: any) => handlePipeChangeForZone('branch', p, zid)}
                                    horticultureSystemData={horticultureSystemData}
                                    gardenSystemData={gardenSystemData}
                                    greenhouseSystemData={greenhouseData}
                                    fieldCropData={fieldCropData}
                                    activeZoneId={zid}
                                    selectedSprinkler={zSprinkler}
                                    projectMode={projectMode}
                                    selectedPipeSizes={zSizes}
                                    selectedPipeMaterial={selectedPipeMaterials[zid]?.branch}
                                    onPipeMaterialChange={handleBranchPipeMaterialChange}
                                />
                                {shouldShowSecondaryPipe && (
                                    <PipeSelector
                                        pipeType="secondary"
                                        results={results}
                                        input={zInput}
                                        selectedPipe={zp.secondary}
                                        onPipeChange={(p: any) => handlePipeChangeForZone('secondary', p, zid)}
                                        horticultureSystemData={horticultureSystemData}
                                        gardenSystemData={gardenSystemData}
                                        greenhouseSystemData={greenhouseData}
                                        fieldCropData={fieldCropData}
                                        activeZoneId={zid}
                                        selectedSprinkler={zSprinkler}
                                        projectMode={projectMode}
                                        selectedPipeSizes={zSizes}
                                        selectedPipeMaterial={selectedPipeMaterials[zid]?.secondary}
                                        onPipeMaterialChange={handleSecondaryPipeMaterialChange}
                                    />
                                )}
                                {shouldShowMainPipe && (
                                    <PipeSelector
                                        pipeType="main"
                                        results={results}
                                        input={zInput}
                                        selectedPipe={zp.main}
                                        onPipeChange={(p: any) => handlePipeChangeForZone('main', p, zid)}
                                        horticultureSystemData={horticultureSystemData}
                                        gardenSystemData={gardenSystemData}
                                        greenhouseSystemData={greenhouseData}
                                        fieldCropData={fieldCropData}
                                        activeZoneId={zid}
                                        selectedSprinkler={zSprinkler}
                                        projectMode={projectMode}
                                        selectedPipeSizes={zSizes}
                                        selectedPipeMaterial={selectedPipeMaterials[zid]?.main}
                                        onPipeMaterialChange={handleMainPipeMaterialChange}
                                    />
                                )}
                            </div>
                        );
                    })}

            {/* Smart Onboarding Tour */}
            <SmartOnboardingTour
                isVisible={showOnboardingTour}
                onComplete={handleTourComplete}
                onSkip={handleTourSkip}
                onDontShowAgain={handleTourDontShowAgain}
                steps={tourSteps}
                t={t}
                storageKey={PRODUCT_TOUR_STORAGE_KEY}
            />

            <Footer />
        </div>
    );
}
