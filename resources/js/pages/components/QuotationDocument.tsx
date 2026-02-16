/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import {
    CalculationResults,
    QuotationData,
    QuotationDataCustomer,
    IrrigationInput,
    PumpAccessory,
} from '../types/interfaces';
import { useLanguage } from '@/contexts/LanguageContext';
import { loadSprinklerConfig, calculateTotalFlowRate } from '../../utils/sprinklerUtils';
import {
    loadProjectData,
    calculateProjectSummary,
    formatWaterVolume,
} from '../../utils/horticultureUtils';

/** แปลงค่าเป็นข้อความแบบช่วง เหมือน SprinklerSelector (ให้สเปกหัวฉีดตรงกับที่เลือก) */
const formatRangeValue = (value: any): string => {
    if (value == null || value === '') return '-';
    if (Array.isArray(value)) return `${value[0]}-${value[1]}`;
    return String(value);
};

/** คำนวณพื้นที่โซนจาก coordinates (ตรงกับ product.tsx getZoneAreaData) */
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

type HorticultureZoneDisplayData = {
    areaInRai: number;
    plantCount: number;
    waterNeedPerSession: number;
    waterNeedPerMinute: number;
};

function buildHorticultureZoneDisplayData(zones: any[]): {
    byId: Record<string, HorticultureZoneDisplayData>;
    byIndex: HorticultureZoneDisplayData[];
} {
    const byId: Record<string, HorticultureZoneDisplayData> = {};
    const byIndex: HorticultureZoneDisplayData[] = [];
    if (!Array.isArray(zones) || zones.length === 0) return { byId, byIndex };
    for (const z of zones) {
        const id = z?.id;
        const areaM2 = Number(z?.area);
        const areaInRai = areaM2 > 0 ? areaM2 / 1600 : 0;
        const plantCount = Number(z?.plantCount) || 0;
        const waterNeedPerSession = Number(z?.totalWaterNeed) || 0;
        const waterNeedPerMinute = Number(z?.waterNeedPerMinute) || 0;
        const item: HorticultureZoneDisplayData = {
            areaInRai,
            plantCount,
            waterNeedPerSession,
            waterNeedPerMinute,
        };
        byIndex.push(item);
        if (id) byId[id] = item;
    }
    return { byId, byIndex };
}

/**
 * ดึงข้อมูลโซนจาก localStorage (ที่ Results บันทึก)
 */
const getHorticultureZoneDataFromSystemStorage = (): {
    byId: Record<string, HorticultureZoneDisplayData>;
    byIndex: HorticultureZoneDisplayData[];
} => {
    try {
        const str = localStorage.getItem('horticultureSystemData');
        if (!str) return { byId: {}, byIndex: [] };
        const data = JSON.parse(str);
        return buildHorticultureZoneDisplayData(data?.zones ?? []);
    } catch {
        return { byId: {}, byIndex: [] };
    }
};

/**
 * ดึงข้อมูลโซนให้ตรงกับ InputForm (ที่ได้จาก getZoneAreaData ใน product.tsx)
 * ใช้ horticultureSystemData จาก localStorage + projectData
 */
const getZoneAreaDataForZone = (
    zoneId: string,
    projectDataRef: any
): { areaInRai: number; plantCount: number; waterNeedPerMinute: number } | null => {
    try {
        const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
        if (!horticultureSystemDataStr) return null;
        const horticultureSystemData = JSON.parse(horticultureSystemDataStr);
        if (!horticultureSystemData?.zones?.length) return null;
        const zoneFromHorticultureData = (horticultureSystemData.zones as any[]).find(
            (z: any) => z.id === zoneId
        );
        if (!zoneFromHorticultureData) return null;
        const sprinklerConfig = loadSprinklerConfig();
        const flowRatePerPlant = sprinklerConfig?.flowRatePerMinute ?? 2.5;
        const sprinklersPerTree = sprinklerConfig?.sprinklersPerTree ?? 1;
        const originalZone = (projectDataRef?.zones as any[])?.find((z: any) => z.id === zoneId);
        const plantCount =
            originalZone?.plants?.length ??
            zoneFromHorticultureData?.plantCount ??
            0;
        const waterNeedPerMinute =
            plantCount > 0
                ? calculateTotalFlowRate(plantCount, flowRatePerPlant, sprinklersPerTree)
                : 0;
        let areaInRai = 0;
        if (zoneFromHorticultureData.area && zoneFromHorticultureData.area > 0) {
            areaInRai = zoneFromHorticultureData.area / 1600;
        } else if (originalZone?.coordinates?.length >= 3) {
            const areaInSquareMeters =
                originalZone.area ||
                calculatePolygonAreaForZone(originalZone.coordinates);
            areaInRai = areaInSquareMeters / 1600;
        }
        return { areaInRai, plantCount, waterNeedPerMinute };
    } catch {
        return null;
    }
};

import { calculatePipeRolls, getPipeLengthM, getPipePrice } from '../utils/calculations';

interface QuotationItem {
    id: string;
    seq: number;
    image: string;
    date: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxes: string;
    originalData?: any;
}

interface Equipment {
    id: number;
    productCode: string;
    name: string;
    brand: string;
    image: string;
    price: number;
    category_id: number;
    category?: {
        name: string;
        display_name: string;
    };
}

interface QuotationDocumentProps {
    show: boolean;
    results: CalculationResults;
    quotationData: QuotationData;
    quotationDataCustomer: QuotationDataCustomer;
    selectedSprinkler: any;
    selectedPump: any;
    selectedBranchPipe: any;
    selectedSecondaryPipe: any;
    selectedMainPipe: any;
    selectedEmitterPipe?: any;
    selectedExtraPipe?: any;
    projectImage?: string | null;
    projectMode: 'horticulture' | 'garden' | 'field-crop' | 'greenhouse';
    gardenData: any;
    projectData: any;
    /** ข้อมูลโซนจาก Results (ส่งจาก product page) — ใช้เป็นแหล่งหลักเพื่อให้โซน 1 ปริมาณน้ำรวมถูกในรอบแรก */
    horticultureSystemData?: any;
    greenhouseData?: any;
    showPump: boolean;
    zoneSprinklers: { [zoneId: string]: any };
    selectedPipes: {
        [zoneId: string]: { branch?: any; secondary?: any; main?: any; emitter?: any };
    };
    sprinklerEquipmentSets?: { [zoneId: string]: any };
    connectionEquipments?: { [zoneId: string]: any[] };
    zoneInputs?: { [zoneId: string]: IrrigationInput };
    gardenStats?: any;
    fieldCropData?: any;
    onClose: () => void;
    /** ค่า TDH (ความต้องการปั๊มรวม + 10%) เดียวกับที่ส่งไป PumpSelector เพื่อให้ข้อ 5 ตรงกับ ⚡ ความต้องการปั๊ม */
    maxPumpHeadForProjectMode?: number;
}
const QuotationDocument: React.FC<QuotationDocumentProps> = ({
    show,
    results,
    quotationData,
    quotationDataCustomer,
    selectedSprinkler,
    selectedPump,
    selectedBranchPipe,
    selectedSecondaryPipe,
    selectedMainPipe,
    selectedEmitterPipe,
    selectedExtraPipe,
    projectImage,
    projectData,
    horticultureSystemData,
    projectMode,
    gardenData,
    greenhouseData,
    zoneSprinklers,
    selectedPipes,
    sprinklerEquipmentSets = {},
    connectionEquipments = {},
    zoneInputs = {},
    gardenStats,
    fieldCropData,
    showPump,
    onClose,
    maxPumpHeadForProjectMode: maxPumpHeadForProjectModeProp,
}) => {
    const { t } = useLanguage();
    const [items, setItems] = useState<QuotationItem[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isEditing, setIsEditing] = useState(false);
    const [showEquipmentSelector, setShowEquipmentSelector] = useState(false);
    const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
    const [equipmentCategories, setEquipmentCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [equipmentSearchTerm, setEquipmentSearchTerm] = useState<string>('');
    const [isLoadingEquipment, setIsLoadingEquipment] = useState(false);

    const [editableProjectImage, setEditableProjectImage] = useState<string | null>(
        projectImage || null
    );

    const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    useEffect(() => {
        setEditableProjectImage(projectImage || null);
    }, [projectImage]);

    const hasProjectImagePage = !!editableProjectImage;

    const getZoneDisplayName = (zoneId: string): string => {
        if (projectData?.zones?.length) {
            const z = (projectData.zones as any[]).find((z: any) => z.id === zoneId);
            if (z?.name) return z.name;
        }
        if (fieldCropData?.zones?.info?.length) {
            const z = (fieldCropData.zones as any).info.find((z: any) => z.id === zoneId);
            if (z?.name) return z.name;
        }
        if (greenhouseData?.plots?.length) {
            const p = (greenhouseData.plots as any[]).find((p: any) => p.plotId === zoneId);
            if (p?.plotName) return p.plotName;
        }
        if (gardenStats?.zones?.length) {
            const z = (gardenStats.zones as any[]).find((z: any) => z.zoneId === zoneId);
            if (z?.name) return z.name;
        }
        return zoneId;
    };

    /** ดึง Friction Head จาก localStorage ตามที่ CalculationSummary / PipeSystemSummary / PipeSelector บันทึก (ไม่คำนวณเอง) */
    const getStoredPipeHeadLoss = (): {
        branch: number;
        secondary: number;
        main: number;
        emitter: number;
        total: number;
    } => {
        const toNum = (x: number | { total?: number } | undefined): number =>
            typeof x === 'number' ? x : (x && typeof (x as any).total === 'number' ? (x as any).total : 0);
        const fallback = () => ({
            branch: toNum((results?.headLoss as any)?.branch),
            secondary: toNum((results?.headLoss as any)?.secondary),
            main: toNum((results?.headLoss as any)?.main),
            emitter: toNum((results?.headLoss as any)?.emitter),
            total: results?.headLoss?.total ?? 0,
        });
        const storageKey =
            projectMode === 'garden'
                ? 'garden_pipe_calculations'
                : projectMode === 'greenhouse'
                  ? 'greenhouse_pipe_calculations'
                  : projectMode === 'field-crop'
                    ? 'field_crop_pipe_calculations'
                    : 'horticulture_pipe_calculations';
        try {
            const str = localStorage.getItem(storageKey);
            if (!str) return fallback();
            const calc = JSON.parse(str);
            const branch = calc?.branch?.headLoss ?? 0;
            const secondary = calc?.secondary?.headLoss ?? 0;
            const main = calc?.main?.headLoss ?? 0;
            const emitter = calc?.emitter?.headLoss ?? 0;
            const total =
                projectMode === 'greenhouse'
                    ? (main || 0) + (branch || 0)
                    : (branch || 0) + (secondary || 0) + (main || 0) + (emitter || 0);
            return { branch, secondary, main, emitter, total };
        } catch {
            return fallback();
        }
    };

    /** โซนละ Friction Head จาก localStorage (ตรงกับ PipeSelector บันทึกต่อโซน) — ใช้สำหรับ horticulture */
    const getStoredPipeHeadLossPerZone = (): Record<
        string,
        { branch: number; secondary: number; main: number; emitter: number; total: number }
    > => {
        if (projectMode !== 'horticulture') return {};
        try {
            const str = localStorage.getItem('horticulture_pipe_calculations');
            if (!str) return {};
            const data = JSON.parse(str);
            const zones = data?.zones;
            if (!zones || typeof zones !== 'object') return {};
            const out: Record<string, { branch: number; secondary: number; main: number; emitter: number; total: number }> = {};
            for (const [zoneId, zoneCalc] of Object.entries(zones)) {
                const z = zoneCalc as any;
                const branch = Number(z?.branch?.headLoss) || 0;
                const secondary = Number(z?.secondary?.headLoss) || 0;
                const main = Number(z?.main?.headLoss) || 0;
                const emitter = Number(z?.emitter?.headLoss) || 0;
                const total = branch + secondary + main + emitter;
                out[zoneId] = { branch, secondary, main, emitter, total };
            }
            return out;
        } catch {
            return {};
        }
    };

    /** ดึง Static Head จาก localStorage (InputForm/CalculationSummary บันทึก) หรือจาก results/zoneInputs */
    const getStoredStaticHeadM = (): number => {
        if (projectMode === 'horticulture') {
            try {
                const stored = localStorage.getItem('horticulture_elevation_diff_m');
                if (stored !== null) {
                    const value = parseFloat(stored);
                    if (isFinite(value)) return value;
                }
            } catch {
                // ignore
            }
        }
        const firstZone = results?.allZoneResults?.[0];
        if (firstZone != null && typeof firstZone.staticHead === 'number') return firstZone.staticHead;
        const critical = (results?.allZoneResults || []).reduce(
            (a: any, b: any) => ((a?.totalHead ?? 0) >= (b?.totalHead ?? 0) ? a : b),
            null
        );
        if (critical != null && typeof critical.staticHead === 'number') return critical.staticHead;
        if (zoneInputs && Object.keys(zoneInputs).length > 0) {
            const first = (zoneInputs as any)[Object.keys(zoneInputs)[0]];
            const v = Number(first?.staticHeadM);
            if (isFinite(v)) return v;
        }
        return 0;
    };

    /** Pressure Head (แรงดันสปริงเกอร์ bar×10) — ตรงกับ Head Loss หัวฉีด ใน CalculationSummary.tsx (calculateSprinklerHeadLoss) */
    const getPressureHeadM = (): number => {
        const spr =
            selectedSprinkler ||
            (zoneSprinklers as any)?.[Object.keys(zoneSprinklers || {})[0]];
        const pressureBarFromSprinkler = (s: any): number => {
            if (!s) return 2.5;
            const pb = s.pressureBar ?? s.pressure_bar;
            if (Array.isArray(pb)) return (pb[0] + pb[1]) / 2;
            if (typeof pb === 'string' && pb.includes('-')) {
                const parts = pb.split('-');
                return (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
            }
            const n = Number(pb);
            return isFinite(n) ? n : 2.5;
        };
        let sprinklerPressureBar = 2.5;
        if (projectMode === 'horticulture') {
            try {
                const horticultureSystemDataStr = localStorage.getItem('horticultureSystemData');
                if (horticultureSystemDataStr) {
                    const horticultureSystemData = JSON.parse(horticultureSystemDataStr);
                    if (horticultureSystemData?.sprinklerConfig?.pressureBar) {
                        sprinklerPressureBar = horticultureSystemData.sprinklerConfig.pressureBar;
                    }
                }
            } catch {
                // ignore
            }
            if (sprinklerPressureBar === 2.5 && spr && (spr.pressureBar ?? spr.pressure_bar)) {
                sprinklerPressureBar = pressureBarFromSprinkler(spr);
            }
        } else if (projectMode === 'garden') {
            if (gardenStats?.zones?.length === 1 && gardenStats.zones[0]?.sprinklerPressure != null) {
                sprinklerPressureBar = gardenStats.zones[0].sprinklerPressure;
            } else if (spr && (spr.pressureBar ?? spr.pressure_bar)) {
                sprinklerPressureBar = pressureBarFromSprinkler(spr);
            }
        } else if (projectMode === 'greenhouse') {
            try {
                const greenhouseSummaryDataStr = localStorage.getItem('greenhouseSummaryData');
                if (greenhouseSummaryDataStr) {
                    const greenhouseSummaryData = JSON.parse(greenhouseSummaryDataStr);
                    if (greenhouseSummaryData?.sprinklerPressure != null) {
                        sprinklerPressureBar = greenhouseSummaryData.sprinklerPressure;
                    }
                }
            } catch {
                // ignore
            }
            if (sprinklerPressureBar === 2.5 && spr && (spr.pressureBar ?? spr.pressure_bar)) {
                sprinklerPressureBar = pressureBarFromSprinkler(spr);
            }
        } else {
            if (projectMode === 'field-crop' && fieldCropData?.irrigationSettings?.sprinkler_system?.pressure != null) {
                const bar = Number(fieldCropData.irrigationSettings.sprinkler_system.pressure);
                if (isFinite(bar)) sprinklerPressureBar = bar;
                else if (spr) sprinklerPressureBar = pressureBarFromSprinkler(spr);
            } else if (spr && (spr.pressureBar ?? spr.pressure_bar)) {
                sprinklerPressureBar = pressureBarFromSprinkler(spr);
            }
        }
        return sprinklerPressureBar * 10;
    };

    /** อัตราการไหล (LPM) — ค่าเดียวกับที่ PumpSelector แสดงใน ⚡ ความต้องการปั๊ม */
    const getDisplayFlowLPM = (): number => {
        if (projectMode === 'garden' && gardenStats?.zones?.length) {
            try {
                const gardenPlannerStr = localStorage.getItem('garden_planner_data');
                let simultaneousZones = gardenStats.zones.length;
                if (gardenPlannerStr) {
                    const gp = JSON.parse(gardenPlannerStr);
                    if (gp?.zoneOperationMode === 'sequential') simultaneousZones = 1;
                    else if (gp?.zoneOperationMode === 'group')
                        simultaneousZones = gp.simultaneousZones || 1;
                }
                const zones = gardenStats.zones as any[];
                if (simultaneousZones >= zones.length) {
                    return zones.reduce(
                        (sum: number, z: any) => sum + (z.sprinklerFlowRate || 0) * (z.sprinklerCount || 0),
                        0
                    );
                }
                const maxZone = Math.max(
                    ...zones.map((z: any) => (z.sprinklerFlowRate || 0) * (z.sprinklerCount || 0))
                );
                return maxZone * simultaneousZones;
            } catch {
                // fallback
            }
        }
        if (projectMode === 'field-crop') {
            if (zoneInputs && Object.keys(zoneInputs).length > 0) {
                const flows = Object.values(zoneInputs as any).map(
                    (inp: any) => Number(inp?.waterPerTreeLiters) || 0
                );
                const maxFlow = Math.max(...flows, 0);
                if (maxFlow > 0) return maxFlow;
            }
            if (fieldCropData?.zoneSummaries) {
                const zoneFlows = Object.values(fieldCropData.zoneSummaries).map((zs: any) => {
                    const sprinklerFlow =
                        (zs.sprinklerCount || 0) *
                        (fieldCropData?.irrigationSettings?.sprinkler_system?.flow || 30);
                    const pivotFlow =
                        (zs.pivotCount || 0) *
                        (fieldCropData?.irrigationSettings?.pivot_system?.flow || 50);
                    return sprinklerFlow + pivotFlow;
                });
                return Math.max(...zoneFlows, 0);
            }
        }
        if (projectMode === 'horticulture' || projectMode === 'greenhouse') {
            try {
                const str = localStorage.getItem('horticultureSystemData') || localStorage.getItem('greenhouseSystemData');
                if (str) {
                    const data = JSON.parse(str);
                    const zones = data?.zones;
                    if (zones?.length) {
                        const mode = data?.zoneOperationMode || 'sequential';
                        if (mode === 'simultaneous') {
                            return zones.reduce(
                                (sum: number, z: any) => sum + (z.waterNeedPerMinute || 0),
                                0
                            );
                        }
                        return Math.max(
                            ...zones.map((z: any) => z.waterNeedPerMinute || 0),
                            0
                        );
                    }
                }
            } catch {
                // fallback
            }
        }
        return (
            results?.projectSummary?.selectedGroupFlowLPM ??
            results?.totalWaterRequiredLPM ??
            results?.flows?.main ??
            0
        );
    };

    const getItemsPerPage = (page: number, totalPages: number, totalItems: number) => {
        const imagePageOffset = hasProjectImagePage ? 1 : 0;
        const effectivePage = page - imagePageOffset;

        if (hasProjectImagePage && page === 1) {
            return 0;
        }

        if (effectivePage === 1) {
            if (totalItems <= 7) {
                return totalItems;
            } else if (totalItems === 8) {
                return 7;
            } else if (totalItems === 9) {
                return 8;
            } else if (totalItems === 10) {
                return 9;
            } else {
                return 10;
            }
        } else if (effectivePage === totalPages - imagePageOffset) {
            const firstPageItems = getItemsPerPage(1 + imagePageOffset, totalPages, totalItems);
            return totalItems - firstPageItems;
        } else {
            const firstPageItems = getItemsPerPage(1 + imagePageOffset, totalPages, totalItems);
            const remainingItems = totalItems - firstPageItems;
            const itemsInThisPage = remainingItems - (effectivePage - 2) * 13;

            if (itemsInThisPage <= 10) {
                return itemsInThisPage;
            } else if (itemsInThisPage === 11) {
                return 10;
            } else if (itemsInThisPage === 12) {
                return 11;
            } else if (itemsInThisPage === 13) {
                return 12;
            } else {
                return 13;
            }
        }
    };

    const calculateTotalPages = (totalItems: number) => {
        if (totalItems === 0) return hasProjectImagePage ? 1 : 0;

        let firstPageItems;
        if (totalItems <= 7) {
            firstPageItems = totalItems;
        } else if (totalItems === 8) {
            firstPageItems = 7;
        } else if (totalItems === 9) {
            firstPageItems = 8;
        } else if (totalItems === 10) {
            firstPageItems = 9;
        } else {
            firstPageItems = 10;
        }

        if (firstPageItems === totalItems) {
            return 1 + (hasProjectImagePage ? 1 : 0);
        }

        let remainingItems = totalItems - firstPageItems;
        let additionalPages = 0;

        while (remainingItems > 0) {
            if (remainingItems <= 10) {
                additionalPages += 1;
                break;
            } else if (remainingItems === 11) {
                additionalPages += 2;
                break;
            } else if (remainingItems === 12) {
                additionalPages += 2;
                break;
            } else if (remainingItems === 13) {
                additionalPages += 2;
                break;
            } else {
                remainingItems -= 13;
                additionalPages += 1;
            }
        }

        return 1 + additionalPages + (hasProjectImagePage ? 1 : 0);
    };

    const hasSummaryPage = !!(results && items.length > 0);
    const totalPagesForItems = calculateTotalPages(items.length);
    const totalPages = totalPagesForItems + (hasSummaryPage ? 1 : 0);

    useEffect(() => {
        if (show) {
            loadEquipmentCategories();
        }
    }, [show]);

    const loadEquipmentCategories = async () => {
        try {
            const response = await fetch('/api/equipment-categories');
            if (response.ok) {
                const categories = await response.json();
                setEquipmentCategories(categories);
            }
        } catch (error) {
            // Silently fail - equipment categories are optional
        }
    };

    const loadEquipmentByCategory = async (categoryId: string) => {
        if (!categoryId) {
            setEquipmentList([]);
            return;
        }

        setIsLoadingEquipment(true);
        try {
            const searchParams = new URLSearchParams({
                category_id: categoryId,
                is_active: 'true',
                per_page: '100',
            });

            if (equipmentSearchTerm) {
                searchParams.append('search', equipmentSearchTerm);
            }

            const response = await fetch(`/api/equipments?${searchParams}`);
            if (response.ok) {
                const data = await response.json();
                const equipments = data.data || data;
                setEquipmentList(equipments);
            }
        } catch (error) {
            // Silently fail - equipment loading is optional
        } finally {
            setIsLoadingEquipment(false);
        }
    };

    useEffect(() => {
        if (selectedCategory) {
            const timeoutId = setTimeout(() => {
                loadEquipmentByCategory(selectedCategory);
            }, 1000);

            return () => clearTimeout(timeoutId);
        }
    }, [selectedCategory, equipmentSearchTerm]);

    const handleProjectImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target?.result as string;
            setEditableProjectImage(imageUrl);
        };
        reader.readAsDataURL(file);
    };

    const handleProjectImageDelete = () => {
        setEditableProjectImage(null);
    };

    const openProjectImageDialog = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                handleProjectImageUpload(file);
            }
        };
        input.click();
    };

    const handleImageUpload = (itemId: string, file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target?.result as string;
            updateItem(itemId, 'image', imageUrl);
        };
        reader.readAsDataURL(file);
    };

    const openFileDialog = (itemId: string) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                handleImageUpload(itemId, file);
            }
        };
        input.click();
    };

    const addEquipmentFromDatabase = (equipment: Equipment) => {
        const newItem: QuotationItem = {
            id: `equipment_${equipment.id}_${Date.now()}`,
            seq: items.length + 1,
            image: equipment.image || '',
            date: '',
            description: `${equipment.productCode} - ${equipment.name}${equipment.brand ? ` (${equipment.brand})` : ''}`,
            quantity: 1,
            unitPrice: equipment.price,
            discount: 0.0,
            taxes: 'Output\nVAT\n7%',
            originalData: equipment,
        };

        setItems([...items, newItem]);
        setShowEquipmentSelector(false);

        setSelectedCategory('');
        setEquipmentSearchTerm('');
        setEquipmentList([]);
    };

    const moveItem = (index: number, direction: 'up' | 'down') => {
        const newItems = [...items];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newItems.length) return;

        [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];

        const updatedItems = newItems.map((item, i) => ({ ...item, seq: i + 1 }));
        setItems(updatedItems);
    };

    const getImageUrl = (item: QuotationItem) => {
        if (item.image) return item.image;

        if (item.originalData) {
            const data = item.originalData;
            return data.image_url || data.image || data.imageUrl;
        }

        return null;
    };

    useEffect(() => {
        if (!show) return;

        if (!results) {
            return;
        }

        const initialItems: QuotationItem[] = [];
        let seq = 1;

        // ใช้หลายโซนเมื่อมีมากกว่า 1 โซน (ให้ตรงกับ CostSummary ไม่ว่าโหมดไหน)
        const isMultiZone =
            (projectData?.useZones && projectData.zones && projectData.zones.length > 1) ||
            (projectMode === 'garden' && (gardenStats?.zones?.length ?? 0) > 1) ||
            (projectMode === 'field-crop' && (fieldCropData?.zones?.info?.length ?? 0) > 1);

        const isGreenhouseMode = projectMode === 'greenhouse' && greenhouseData;
        const isGreenhouseMultiPlot =
            isGreenhouseMode && greenhouseData.summary?.plotStats?.length > 1;

        if (isGreenhouseMultiPlot) {
            const totalPlantsInAllPlots = greenhouseData.summary.plotStats.reduce(
                (sum: number, plot: any) => sum + (plot.production?.totalPlants || 0),
                0
            );

            const equipmentMap = new Map();

            greenhouseData.summary.plotStats.forEach((plot: any) => {
                const zoneSprinkler = zoneSprinklers[plot.plotId];
                const zonePipes = selectedPipes[plot.plotId] || {};

                if (zoneSprinkler) {
                    let sprinklerQuantity = plot.equipmentCount?.sprinklers || 0;
                    if (sprinklerQuantity === 0) {
                        const totalPlants = plot.production?.totalPlants || 0;
                        const effectiveArea = plot.effectivePlantingArea || plot.area || 0;

                        if (totalPlants > 0) {
                            sprinklerQuantity = Math.ceil(totalPlants / 15);
                        } else if (effectiveArea > 0) {
                            sprinklerQuantity = Math.ceil(effectiveArea / 5);
                        } else {
                            sprinklerQuantity = 10;
                        }
                    }

                    const sprinklerKey = `sprinkler_${zoneSprinkler.id}`;
                    if (equipmentMap.has(sprinklerKey)) {
                        const existing = equipmentMap.get(sprinklerKey);
                        existing.quantity += sprinklerQuantity;
                        existing.zones.push(plot.plotName || `โซน ${plot.plotId}`);
                    } else {
                        equipmentMap.set(sprinklerKey, {
                            id: sprinklerKey,
                            seq: seq++,
                            image: zoneSprinkler.image_url || zoneSprinkler.image || '',
                            date: '',
                            description: `${zoneSprinkler.productCode || zoneSprinkler.product_code || ''} - ${zoneSprinkler.name || 'สปริงเกอร์'} (${zoneSprinkler.brand || ''})`,
                            quantity: sprinklerQuantity,
                            unitPrice: zoneSprinkler.price || 0,
                            discount: 0.0,
                            taxes: 'Output\nVAT\n7%',
                            originalData: zoneSprinkler,
                            zones: [plot.plotName || `โซน ${plot.plotId}`],
                        });
                    }
                }

                const branchPipe = zonePipes.branch || results.autoSelectedBranchPipe;
                if (branchPipe) {
                    const pipeKey = `branch_${branchPipe.id}`;
                    const plotRatio =
                        (plot.production?.totalPlants || 0) / Math.max(totalPlantsInAllPlots, 1);
                    const rolls = Math.max(
                        1,
                        Math.ceil((results.branchPipeRolls || 1) * plotRatio)
                    );

                    if (equipmentMap.has(pipeKey)) {
                        const existing = equipmentMap.get(pipeKey);
                        existing.quantity += rolls;
                        existing.zones.push(plot.plotName || `โซน ${plot.plotId}`);
                    } else {
                        equipmentMap.set(pipeKey, {
                            id: pipeKey,
                            seq: seq++,
                            image: branchPipe.image_url || branchPipe.image || '',
                            date: '',
                            description: `${branchPipe.productCode || branchPipe.product_code || ''} - ท่อย่อย ${branchPipe.pipeType || ''} ${branchPipe.sizeMM || ''}mm ยาว ${getPipeLengthM(branchPipe) || 100} ม./ม้วน`,
                            quantity: rolls,
                            unitPrice: getPipePrice(branchPipe),
                            discount: 0.0,
                            taxes: 'Output\nVAT\n7%',
                            originalData: branchPipe,
                            zones: [plot.plotName || `โซน ${plot.plotId}`],
                        });
                    }
                }
            });

            for (const [key, item] of equipmentMap.entries()) {
                if (item.zones && item.zones.length > 1) {
                    item.description += ` (ใช้ใน ${item.zones.length} แปลง)`;
                }
                delete item.zones;
                initialItems.push(item);
            }
        } else if (isMultiZone) {
            const equipmentMap = new Map();

            const totalTreesInAllZones =
                Object.values(zoneInputs || {}).reduce(
                    (sum: number, input: any) => sum + (input.totalTrees || 0),
                    0
                ) ||
                results?.totalSprinklers ||
                0;

            // รายการ zone IDs ให้ตรงกับ CostSummary: garden ใช้ gardenStats.zones, อื่นใช้ zoneSprinklers/zoneInputs/selectedPipes
            const multiZoneIds =
                projectMode === 'garden' && gardenStats?.zones?.length
                    ? gardenStats.zones.map((z: any) => z.zoneId)
                    : Array.from(
                          new Set([
                              ...Object.keys(zoneSprinklers || {}),
                              ...Object.keys(zoneInputs || {}),
                              ...Object.keys(selectedPipes || {}),
                          ])
                      ).filter((id) => id && id !== 'unknown');

            multiZoneIds.forEach((zoneId) => {
                const zoneSprinkler = zoneSprinklers[zoneId];
                const zoneInput = zoneInputs[zoneId];
                const zonePipes = selectedPipes[zoneId] || {};

                // โหมด garden: ใช้เฉพาะ gardenData.sprinklers + analyzedSprinklers (ราคาให้ตรงกับ CostSummary)
                if (projectMode === 'garden' && gardenData?.sprinklers && results?.analyzedSprinklers) {
                    const zoneSprinklersFromPlanner = gardenData.sprinklers.filter((s: any) => s.zoneId === zoneId);
                    const sprinklersByType = new Map<string, { type: any; count: number }>();
                    zoneSprinklersFromPlanner.forEach((s: any) => {
                        const key = (s.type?.nameTH || s.type?.nameEN || 'Sprinkler');
                        const existing = sprinklersByType.get(key);
                        if (existing) existing.count += 1;
                        else sprinklersByType.set(key, { type: s.type, count: 1 });
                    });
                    sprinklersByType.forEach(({ type, count }) => {
                        const matchingEquipment = results.analyzedSprinklers.find((eq: any) => {
                            const eqName = eq.name || '';
                            const typeName = type?.nameTH || type?.nameEN || '';
                            return eqName === typeName ||
                                (Math.abs((eq.waterVolumeLitersPerMinute || 0) - (type?.flowRate ?? 0)) < 0.5 &&
                                    Math.abs((eq.pressureBar || 0) - (type?.pressure ?? 0)) < 0.5);
                        });
                        if (matchingEquipment) {
                            const sprinklerKey = `sprinkler_${matchingEquipment.id}`;
                            if (equipmentMap.has(sprinklerKey)) {
                                const existing = equipmentMap.get(sprinklerKey);
                                existing.quantity += count;
                                if (zoneId && !existing.zones.includes(zoneId)) existing.zones.push(zoneId);
                            } else {
                                equipmentMap.set(sprinklerKey, {
                                    id: sprinklerKey,
                                    seq: seq++,
                                    image: matchingEquipment.image_url || matchingEquipment.image || '',
                                    date: '',
                                    description: `${matchingEquipment.productCode || matchingEquipment.product_code || ''} - ${matchingEquipment.name || 'สปริงเกอร์'} (${matchingEquipment.brand || ''})`,
                                    quantity: count,
                                    unitPrice: matchingEquipment.price || 0,
                                    discount: 0.0,
                                    taxes: 'Output\nVAT\n7%',
                                    originalData: matchingEquipment,
                                    zones: [zoneId],
                                });
                            }
                        }
                    });
                } else if (zoneSprinkler) {
                    let sprinklerQuantity = 0;
                    if (zoneInput) sprinklerQuantity = zoneInput.totalTrees || 0;
                    if (projectMode === 'horticulture' && sprinklerQuantity > 0) {
                        const config = loadSprinklerConfig();
                        sprinklerQuantity = sprinklerQuantity * (config?.sprinklersPerTree || 1);
                    }
                    if (sprinklerQuantity === 0 && results) {
                        const zoneCount = Math.max(multiZoneIds.length, 1);
                        sprinklerQuantity = Math.ceil((results.totalSprinklers || 0) / zoneCount);
                        if (projectMode === 'horticulture' && sprinklerQuantity > 0) {
                            const config = loadSprinklerConfig();
                            sprinklerQuantity = sprinklerQuantity * (config?.sprinklersPerTree || 1);
                        }
                    }
                    const sprinklerKey = `sprinkler_${zoneSprinkler.id}`;
                    if (equipmentMap.has(sprinklerKey)) {
                        const existing = equipmentMap.get(sprinklerKey);
                        existing.quantity += sprinklerQuantity || 1;
                        if (zoneId && !existing.zones.includes(zoneId)) existing.zones.push(zoneId);
                    } else {
                        equipmentMap.set(sprinklerKey, {
                            id: sprinklerKey,
                            seq: seq++,
                            image: (zoneSprinkler as any).image_url || (zoneSprinkler as any).image || '',
                            date: '',
                            description: `${(zoneSprinkler as any).productCode || (zoneSprinkler as any).product_code || ''} - ${(zoneSprinkler as any).name || 'สปริงเกอร์'} (${(zoneSprinkler as any).brand || ''})`,
                            quantity: sprinklerQuantity || 1,
                            unitPrice: (zoneSprinkler as any).price || 0,
                            discount: 0.0,
                            taxes: 'Output\nVAT\n7%',
                            originalData: zoneSprinkler,
                            zones: [zoneId],
                        });
                    }
                }

                // จัดการ pipes - ใช้วิธีเดียวกับ CostSummary.tsx (ราคา/ความยาวจาก getPipePrice/getPipeLengthM)
                const branchPipe = zonePipes.branch || results.autoSelectedBranchPipe;
                const branchLength =
                    projectMode === 'garden' && gardenStats?.zones
                        ? (zoneInput && Number(zoneInput.totalBranchPipeM) > 0
                              ? Number(zoneInput.totalBranchPipeM)
                              : (gardenStats.zones.find((z: any) => z.zoneId === zoneId)?.totalPipeLength ?? 0))
                        : (zoneInput ? Number(zoneInput.totalBranchPipeM) || 0 : 0);
                if (branchPipe && branchLength > 0) {
                    const pipeKey = `branch_${branchPipe.id}`;

                    // คำนวณ extraLength (เหมือน CostSummary.tsx)
                    let extraLength = 0;
                    if (
                        zoneInput?.extraPipePerSprinkler &&
                        (zoneInput.extraPipePerSprinkler.pipeId === branchPipe.id ||
                            zoneInput.extraPipePerSprinkler.pipeId === branchPipe.productCode) &&
                        zoneInput.extraPipePerSprinkler.lengthPerHead > 0
                    ) {
                        const sprinklerCount = zoneInput.totalTrees || 0;
                        if (projectMode === 'horticulture' && sprinklerCount > 0) {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            extraLength =
                                sprinklerCount *
                                sprinklersPerTree *
                                zoneInput.extraPipePerSprinkler.lengthPerHead;
                        } else {
                            extraLength =
                                sprinklerCount * zoneInput.extraPipePerSprinkler.lengthPerHead;
                        }
                    }

                    const totalLength = branchLength + extraLength;
                    const lenM = getPipeLengthM(branchPipe) || 100;
                    const rolls = calculatePipeRolls(totalLength, lenM);

                    if (equipmentMap.has(pipeKey)) {
                        const existing = equipmentMap.get(pipeKey);
                        existing.quantity += rolls;
                        if (zoneId && !existing.zones.includes(zoneId)) {
                            existing.zones.push(zoneId);
                        }
                    } else {
                        equipmentMap.set(pipeKey, {
                            id: pipeKey,
                            seq: seq++,
                            image: (branchPipe as any).image_url || (branchPipe as any).image || '',
                            date: '',
                            description: `${(branchPipe as any).productCode || (branchPipe as any).product_code || ''} - ท่อย่อย ${(branchPipe as any).pipeType || ''} ${(branchPipe as any).sizeMM || ''}mm ยาว ${lenM} ม./ม้วน`,
                            quantity: rolls,
                            unitPrice: getPipePrice(branchPipe),
                            discount: 0.0,
                            taxes: 'Output\nVAT\n7%',
                            originalData: branchPipe,
                            zones: [zoneId],
                        });
                    }
                }

                const secondaryPipe = zonePipes.secondary || results.autoSelectedSecondaryPipe;
                if (
                    secondaryPipe &&
                    results.hasValidSecondaryPipe &&
                    zoneInput &&
                    zoneInput.totalSecondaryPipeM > 0
                ) {
                    const pipeKey = `secondary_${secondaryPipe.id}`;

                    // คำนวณ extraLength (เหมือน CostSummary.tsx)
                    let extraLength = 0;
                    if (
                        zoneInput.extraPipePerSprinkler &&
                        zoneInput.extraPipePerSprinkler.pipeId === secondaryPipe.id &&
                        zoneInput.extraPipePerSprinkler.lengthPerHead > 0
                    ) {
                        const sprinklerCount = zoneInput.totalTrees || 0;
                        if (projectMode === 'horticulture' && sprinklerCount > 0) {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            extraLength =
                                sprinklerCount *
                                sprinklersPerTree *
                                zoneInput.extraPipePerSprinkler.lengthPerHead;
                        } else {
                            extraLength =
                                sprinklerCount * zoneInput.extraPipePerSprinkler.lengthPerHead;
                        }
                    }

                    const totalLength = zoneInput.totalSecondaryPipeM + extraLength;
                    const lenM = getPipeLengthM(secondaryPipe) || 100;
                    const rolls = calculatePipeRolls(totalLength, lenM);

                    if (equipmentMap.has(pipeKey)) {
                        const existing = equipmentMap.get(pipeKey);
                        existing.quantity += rolls;
                        if (zoneId && !existing.zones.includes(zoneId)) {
                            existing.zones.push(zoneId);
                        }
                    } else {
                        equipmentMap.set(pipeKey, {
                            id: pipeKey,
                            seq: seq++,
                            image:
                                (secondaryPipe as any).image_url ||
                                (secondaryPipe as any).image ||
                                '',
                            date: '',
                            description: `${(secondaryPipe as any).productCode || (secondaryPipe as any).product_code || ''} - ท่อรอง ${(secondaryPipe as any).pipeType || ''} ${(secondaryPipe as any).sizeMM || ''}mm ยาว ${lenM} ม./ม้วน`,
                            quantity: rolls,
                            unitPrice: getPipePrice(secondaryPipe),
                            discount: 0.0,
                            taxes: 'Output\nVAT\n7%',
                            originalData: secondaryPipe,
                            zones: [zoneId],
                        });
                    }
                }

                const mainPipe = zonePipes.main || results.autoSelectedMainPipe;
                if (
                    mainPipe &&
                    results.hasValidMainPipe &&
                    zoneInput &&
                    zoneInput.totalMainPipeM > 0
                ) {
                    const pipeKey = `main_${mainPipe.id}`;

                    // คำนวณ extraLength (เหมือน CostSummary.tsx)
                    let extraLength = 0;
                    if (
                        zoneInput.extraPipePerSprinkler &&
                        zoneInput.extraPipePerSprinkler.pipeId === mainPipe.id &&
                        zoneInput.extraPipePerSprinkler.lengthPerHead > 0
                    ) {
                        const sprinklerCount = zoneInput.totalTrees || 0;
                        if (projectMode === 'horticulture' && sprinklerCount > 0) {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            extraLength =
                                sprinklerCount *
                                sprinklersPerTree *
                                zoneInput.extraPipePerSprinkler.lengthPerHead;
                        } else {
                            extraLength =
                                sprinklerCount * zoneInput.extraPipePerSprinkler.lengthPerHead;
                        }
                    }

                    const totalLength = zoneInput.totalMainPipeM + extraLength;
                    const lenM = getPipeLengthM(mainPipe) || 100;
                    const rolls = calculatePipeRolls(totalLength, lenM);

                    if (equipmentMap.has(pipeKey)) {
                        const existing = equipmentMap.get(pipeKey);
                        existing.quantity += rolls;
                        if (zoneId && !existing.zones.includes(zoneId)) {
                            existing.zones.push(zoneId);
                        }
                    } else {
                        equipmentMap.set(pipeKey, {
                            id: pipeKey,
                            seq: seq++,
                            image: (mainPipe as any).image_url || (mainPipe as any).image || '',
                            date: '',
                            description: `${(mainPipe as any).productCode || (mainPipe as any).product_code || ''} - ท่อหลัก ${(mainPipe as any).pipeType || ''} ${(mainPipe as any).sizeMM || ''}mm ยาว ${lenM} ม./ม้วน`,
                            quantity: rolls,
                            unitPrice: getPipePrice(mainPipe),
                            discount: 0.0,
                            taxes: 'Output\nVAT\n7%',
                            originalData: mainPipe,
                            zones: [zoneId],
                        });
                    }
                }
            });

            for (const [key, item] of equipmentMap.entries()) {
                // แก้ไข NaN quantity
                if (isNaN(item.quantity) || item.quantity <= 0) {
                    item.quantity = 1;
                }

                if (item.zones && item.zones.length > 1) {
                    item.description += ``;
                } else if (item.zones && item.zones.length === 1) {
                    item.description += ``;
                }
                delete item.zones;
                initialItems.push(item);
            }
        } else {
            // Single zone - ให้ราคาหัวฉีดตรงกับ CostSummary (โหมด garden ใช้ gardenData.sprinklers + analyzedSprinklers)
            if (projectMode === 'garden' && gardenData?.sprinklers && results?.analyzedSprinklers) {
                const sprinklersByType = new Map<string, { type: any; count: number }>();
                (gardenData.sprinklers || []).forEach((s: any) => {
                    const key = (s.type?.nameTH || s.type?.nameEN || 'Sprinkler');
                    const existing = sprinklersByType.get(key);
                    if (existing) existing.count += 1;
                    else sprinklersByType.set(key, { type: s.type, count: 1 });
                });
                sprinklersByType.forEach(({ type, count }) => {
                    const matchingEquipment = results.analyzedSprinklers.find((eq: any) => {
                        const eqName = eq.name || '';
                        const typeName = type?.nameTH || type?.nameEN || '';
                        return eqName === typeName ||
                            (Math.abs((eq.waterVolumeLitersPerMinute || 0) - (type?.flowRate ?? 0)) < 0.5 &&
                                Math.abs((eq.pressureBar || 0) - (type?.pressure ?? 0)) < 0.5);
                    });
                    if (matchingEquipment && count > 0) {
                        initialItems.push({
                            id: `sprinkler_${matchingEquipment.id}`,
                            seq: seq++,
                            image: matchingEquipment.image_url || matchingEquipment.image || '',
                            date: '',
                            description: `${matchingEquipment.productCode || matchingEquipment.product_code || ''} - ${matchingEquipment.name || 'สปริงเกอร์'} (${matchingEquipment.brand || ''})`,
                            quantity: count,
                            unitPrice: matchingEquipment.price || 0,
                            discount: 0.0,
                            taxes: 'Output\nVAT\n7%',
                            originalData: matchingEquipment,
                        });
                    }
                });
            } else {
                Object.keys(zoneSprinklers || {}).forEach((zoneId) => {
                    const zoneSprinkler = zoneSprinklers[zoneId];
                    const zoneInput = zoneInputs[zoneId];

                    if (zoneSprinkler && zoneInput) {
                        let sprinklerQuantity = zoneInput.totalTrees || results.totalSprinklers || 0;
                        if (projectMode === 'horticulture') {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            sprinklerQuantity = sprinklerQuantity * sprinklersPerTree;
                        }

                        if (sprinklerQuantity > 0) {
                            initialItems.push({
                                id: `sprinkler_${zoneSprinkler.id}`,
                                seq: seq++,
                                image:
                                    (zoneSprinkler as any).image_url ||
                                    (zoneSprinkler as any).image ||
                                    '',
                                date: '',
                                description: `${(zoneSprinkler as any).productCode || (zoneSprinkler as any).product_code || ''} - ${(zoneSprinkler as any).name || 'สปริงเกอร์'} (${(zoneSprinkler as any).brand || ''})`,
                                quantity: sprinklerQuantity,
                                unitPrice: (zoneSprinkler as any).price || 0,
                                discount: 0.0,
                                taxes: 'Output\nVAT\n7%',
                                originalData: zoneSprinkler,
                            });
                        }
                    } else if (zoneSprinkler) {
                    // ถ้ามี zoneSprinkler แต่ไม่มี zoneInput ให้แสดงด้วย (fallback)
                    let sprinklerQuantity = results?.totalSprinklers || 0;
                    if (projectMode === 'horticulture' && sprinklerQuantity > 0) {
                        const config = loadSprinklerConfig();
                        const sprinklersPerTree = config?.sprinklersPerTree || 1;
                        sprinklerQuantity = sprinklerQuantity * sprinklersPerTree;
                    }
                    if (sprinklerQuantity === 0 && projectData?.plants?.length) {
                        sprinklerQuantity = projectData.plants.length;
                        if (projectMode === 'horticulture') {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            sprinklerQuantity = sprinklerQuantity * sprinklersPerTree;
                        }
                    }

                    initialItems.push({
                        id: `sprinkler_${zoneSprinkler.id}`,
                        seq: seq++,
                        image:
                            (zoneSprinkler as any).image_url || (zoneSprinkler as any).image || '',
                        date: '',
                        description: `${(zoneSprinkler as any).productCode || (zoneSprinkler as any).product_code || ''} - ${(zoneSprinkler as any).name || 'สปริงเกอร์'} (${(zoneSprinkler as any).brand || ''})`,
                        quantity: sprinklerQuantity || 1,
                        unitPrice: (zoneSprinkler as any).price || 0,
                        discount: 0.0,
                        taxes: 'Output\nVAT\n7%',
                        originalData: zoneSprinkler,
                    });
                }
            });
            }

            // ถ้ายังไม่มี sprinkler ให้ลองใช้ zoneSprinklers โดยไม่ต้องมี zoneInput
            const hasSprinkler = initialItems.some((item) => item.id.startsWith('sprinkler_'));

            if (!hasSprinkler) {
                const zoneSprinklerKeys = Object.keys(zoneSprinklers || {});
                let singleZoneSprinkler: any = null;
                let zoneIdToUse: string | null = null;

                // ลองหา 'main-area' ก่อน
                if (zoneSprinklers['main-area']) {
                    singleZoneSprinkler = zoneSprinklers['main-area'];
                    zoneIdToUse = 'main-area';
                } else if (zoneSprinklerKeys.length > 0) {
                    // ใช้ key แรก
                    zoneIdToUse = zoneSprinklerKeys[0];
                    if (zoneIdToUse) {
                        singleZoneSprinkler = zoneSprinklers[zoneIdToUse];
                    }
                }

                // ถ้ายังไม่มี ให้ใช้ selectedSprinkler
                if (!singleZoneSprinkler) {
                    singleZoneSprinkler = selectedSprinkler;
                }

                // แสดง sprinkler ถ้ามี sprinkler ถูกเลือก (ไม่ต้องรอ quantity > 0)
                if (singleZoneSprinkler) {
                    let sprinklerQuantity = 0;

                    // ลองใช้ zoneInput ถ้ามี
                    if (zoneIdToUse && zoneInputs[zoneIdToUse]) {
                        sprinklerQuantity = zoneInputs[zoneIdToUse].totalTrees || 0;
                    }

                    // ถ้ายังไม่มี ให้ใช้ results.totalSprinklers
                    if (sprinklerQuantity === 0 && results) {
                        sprinklerQuantity = results.totalSprinklers || 0;
                    }

                    // สำหรับ horticulture mode ให้คูณด้วย sprinklersPerTree
                    if (projectMode === 'horticulture' && sprinklerQuantity > 0) {
                        const config = loadSprinklerConfig();
                        const sprinklersPerTree = config?.sprinklersPerTree || 1;
                        sprinklerQuantity = sprinklerQuantity * sprinklersPerTree;
                    }

                    // ถ้ายังเป็น 0 ให้ลองใช้จำนวนต้นไม้
                    if (sprinklerQuantity === 0 && projectData?.plants?.length) {
                        sprinklerQuantity = projectData.plants.length;
                        if (projectMode === 'horticulture') {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            sprinklerQuantity = sprinklerQuantity * sprinklersPerTree;
                        }
                    }

                    // แสดง sprinkler แม้ว่า quantity จะเป็น 0 ก็ตาม (อย่างน้อย 1 ตัว)
                    // เพื่อให้ผู้ใช้เห็นว่ามีการเลือก sprinkler แล้ว
                    initialItems.push({
                        id: 'sprinkler',
                        seq: seq++,
                        image:
                            (singleZoneSprinkler as any).image_url ||
                            (singleZoneSprinkler as any).image ||
                            '',
                        date: '',
                        description: `${(singleZoneSprinkler as any).productCode || (singleZoneSprinkler as any).product_code || ''} - ${(singleZoneSprinkler as any).name || 'สปริงเกอร์'} (${(singleZoneSprinkler as any).brand || ''})`,
                        quantity: sprinklerQuantity || 1, // อย่างน้อย 1 ตัว
                        unitPrice: (singleZoneSprinkler as any).price || 0,
                        discount: 0.0,
                        taxes: 'Output\nVAT\n7%',
                        originalData: singleZoneSprinkler,
                    });
                }
            }

            // สำหรับ single zone - ใช้ zoneInput ถ้ามี (ให้ตรงกับ CostSummary รวมทั้งหมด)
            const singleZoneInput =
                Object.values(zoneInputs || {})[0] ||
                (Object.keys(zoneInputs || {}).length > 0
                    ? zoneInputs[Object.keys(zoneInputs || {})[0]]
                    : null);

            // ใช้ท่อที่เลือกหรือ auto-selected เหมือน CostSummary เพื่อให้ Subtotal ตรงกับ รวมทั้งหมด
            const effectiveBranchPipe = selectedBranchPipe || results?.autoSelectedBranchPipe;
            const effectiveSecondaryPipe = selectedSecondaryPipe || results?.autoSelectedSecondaryPipe;
            const effectiveMainPipe = selectedMainPipe || results?.autoSelectedMainPipe;
            const effectiveEmitterPipe = selectedEmitterPipe || results?.autoSelectedEmitterPipe;

            if (effectiveBranchPipe && results) {
                let quantity = results.branchPipeRolls || 0;

                if (singleZoneInput && Number(singleZoneInput.totalBranchPipeM) > 0) {
                    let extraLength = 0;
                    if (
                        singleZoneInput.extraPipePerSprinkler &&
                        (singleZoneInput.extraPipePerSprinkler.pipeId === effectiveBranchPipe.id ||
                            singleZoneInput.extraPipePerSprinkler.pipeId === effectiveBranchPipe.productCode) &&
                        singleZoneInput.extraPipePerSprinkler.lengthPerHead > 0
                    ) {
                        const sprinklerCount = singleZoneInput.totalTrees || 0;
                        if (projectMode === 'horticulture' && sprinklerCount > 0) {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            extraLength =
                                sprinklerCount *
                                sprinklersPerTree *
                                singleZoneInput.extraPipePerSprinkler.lengthPerHead;
                        } else {
                            extraLength =
                                sprinklerCount *
                                singleZoneInput.extraPipePerSprinkler.lengthPerHead;
                        }
                    }
                    const totalLength = Number(singleZoneInput.totalBranchPipeM) + extraLength;
                    quantity = calculatePipeRolls(totalLength, getPipeLengthM(effectiveBranchPipe) || 100);
                }

                initialItems.push({
                    id: 'branchPipe',
                    seq: seq++,
                    image: effectiveBranchPipe.image_url || effectiveBranchPipe.image || '',
                    date: '',
                    description: `${effectiveBranchPipe.productCode || effectiveBranchPipe.product_code || ''} - ท่อย่อย ${effectiveBranchPipe.pipeType || ''} ${effectiveBranchPipe.sizeMM || ''}mm ยาว ${getPipeLengthM(effectiveBranchPipe) || 100} ม./ม้วน`,
                    quantity: quantity,
                    unitPrice: getPipePrice(effectiveBranchPipe),
                    discount: 0.0,
                    taxes: 'Output\nVAT\n7%',
                    originalData: effectiveBranchPipe,
                });
            }

            if (effectiveSecondaryPipe && results) {
                let quantity = results.secondaryPipeRolls || 0;

                if (singleZoneInput && Number(singleZoneInput.totalSecondaryPipeM) > 0) {
                    let extraLength = 0;
                    if (
                        singleZoneInput.extraPipePerSprinkler &&
                        (singleZoneInput.extraPipePerSprinkler.pipeId === effectiveSecondaryPipe.id ||
                            singleZoneInput.extraPipePerSprinkler.pipeId === effectiveSecondaryPipe.productCode) &&
                        singleZoneInput.extraPipePerSprinkler.lengthPerHead > 0
                    ) {
                        const sprinklerCount = singleZoneInput.totalTrees || 0;
                        if (projectMode === 'horticulture' && sprinklerCount > 0) {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            extraLength =
                                sprinklerCount *
                                sprinklersPerTree *
                                singleZoneInput.extraPipePerSprinkler.lengthPerHead;
                        } else {
                            extraLength =
                                sprinklerCount *
                                singleZoneInput.extraPipePerSprinkler.lengthPerHead;
                        }
                    }
                    const totalLength = Number(singleZoneInput.totalSecondaryPipeM) + extraLength;
                    quantity = calculatePipeRolls(
                        totalLength,
                        getPipeLengthM(effectiveSecondaryPipe) || 100
                    );
                }

                initialItems.push({
                    id: 'secondaryPipe',
                    seq: seq++,
                    image: effectiveSecondaryPipe.image_url || effectiveSecondaryPipe.image || '',
                    date: '',
                    description: `${effectiveSecondaryPipe.productCode || effectiveSecondaryPipe.product_code || ''} - ท่อรอง ${effectiveSecondaryPipe.pipeType || ''} ${effectiveSecondaryPipe.sizeMM || ''}mm ยาว ${getPipeLengthM(effectiveSecondaryPipe) || 100} ม./ม้วน`,
                    quantity: quantity,
                    unitPrice: getPipePrice(effectiveSecondaryPipe),
                    discount: 0.0,
                    taxes: 'Output\nVAT\n7%',
                    originalData: effectiveSecondaryPipe,
                });
            }

            if (effectiveMainPipe && results) {
                let quantity = results.mainPipeRolls || 0;

                if (singleZoneInput && Number(singleZoneInput.totalMainPipeM) > 0) {
                    let extraLength = 0;
                    if (
                        singleZoneInput.extraPipePerSprinkler &&
                        (singleZoneInput.extraPipePerSprinkler.pipeId === effectiveMainPipe.id ||
                            singleZoneInput.extraPipePerSprinkler.pipeId === effectiveMainPipe.productCode) &&
                        singleZoneInput.extraPipePerSprinkler.lengthPerHead > 0
                    ) {
                        const sprinklerCount = singleZoneInput.totalTrees || 0;
                        if (projectMode === 'horticulture' && sprinklerCount > 0) {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            extraLength =
                                sprinklerCount *
                                sprinklersPerTree *
                                singleZoneInput.extraPipePerSprinkler.lengthPerHead;
                        } else {
                            extraLength =
                                sprinklerCount *
                                singleZoneInput.extraPipePerSprinkler.lengthPerHead;
                        }
                    }
                    const totalLength = Number(singleZoneInput.totalMainPipeM) + extraLength;
                    quantity = calculatePipeRolls(totalLength, getPipeLengthM(effectiveMainPipe) || 100);
                }

                initialItems.push({
                    id: 'mainPipe',
                    seq: seq++,
                    image: effectiveMainPipe.image_url || effectiveMainPipe.image || '',
                    date: '',
                    description: `${effectiveMainPipe.productCode || effectiveMainPipe.product_code || ''} - ท่อหลัก ${effectiveMainPipe.pipeType || ''} ${effectiveMainPipe.sizeMM || ''}mm ยาว ${getPipeLengthM(effectiveMainPipe) || 100} ม./ม้วน`,
                    quantity: quantity,
                    unitPrice: getPipePrice(effectiveMainPipe),
                    discount: 0.0,
                    taxes: 'Output\nVAT\n7%',
                    originalData: effectiveMainPipe,
                });
            }

            if (effectiveEmitterPipe && results) {
                let quantity = results.emitterPipeRolls || 0;

                if (singleZoneInput && Number(singleZoneInput.totalEmitterPipeM) > 0) {
                    let extraLength = 0;
                    if (
                        singleZoneInput.extraPipePerSprinkler &&
                        (singleZoneInput.extraPipePerSprinkler.pipeId === effectiveEmitterPipe.id ||
                            singleZoneInput.extraPipePerSprinkler.pipeId === effectiveEmitterPipe.productCode) &&
                        singleZoneInput.extraPipePerSprinkler.lengthPerHead > 0
                    ) {
                        const sprinklerCount = singleZoneInput.totalTrees || 0;
                        if (projectMode === 'horticulture' && sprinklerCount > 0) {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            extraLength =
                                sprinklerCount *
                                sprinklersPerTree *
                                singleZoneInput.extraPipePerSprinkler.lengthPerHead;
                        } else {
                            extraLength =
                                sprinklerCount *
                                singleZoneInput.extraPipePerSprinkler.lengthPerHead;
                        }
                    }
                    const totalLength = Number(singleZoneInput.totalEmitterPipeM) + extraLength;
                    quantity = calculatePipeRolls(totalLength, getPipeLengthM(effectiveEmitterPipe) || 100);
                }

                initialItems.push({
                    id: 'emitterPipe',
                    seq: seq++,
                    image: effectiveEmitterPipe.image_url || effectiveEmitterPipe.image || '',
                    date: '',
                    description: `${effectiveEmitterPipe.productCode || effectiveEmitterPipe.product_code || ''} - ท่อย่อยแยก ${effectiveEmitterPipe.pipeType || ''} ${effectiveEmitterPipe.sizeMM || ''}mm ยาว ${getPipeLengthM(effectiveEmitterPipe) || 100} ม./ม้วน`,
                    quantity: quantity,
                    unitPrice: getPipePrice(effectiveEmitterPipe),
                    discount: 0.0,
                    taxes: 'Output\nVAT\n7%',
                    originalData: effectiveEmitterPipe,
                });
            }
        }

        const effectivePump = selectedPump || results?.autoSelectedPump;
        if (effectivePump && results && showPump) {
            const pumpDescription = `${effectivePump.productCode || effectivePump.product_code || ''} - ${effectivePump.name || ''} ${effectivePump.powerHP || ''}HP ${effectivePump.phase || ''}เฟส (${effectivePump.brand || ''})`;

            initialItems.push({
                id: 'pump',
                seq: seq++,
                image: effectivePump.image_url || effectivePump.image || '',
                date: '',
                description: pumpDescription,
                quantity: 1,
                unitPrice: effectivePump.price || 0,
                discount: 0.0,
                taxes: 'Output\nVAT\n7%',
                originalData: effectivePump,
            });

            const accessories: PumpAccessory[] = effectivePump.pumpAccessories || effectivePump.pumpAccessory || [];

            if (accessories && accessories.length > 0) {
                // ดึง selectedGroupId จาก localStorage (เหมือนกับ PumpSelector.tsx)
                const getStoredSelectedGroupId = (pumpId: number | undefined): number | string | null => {
                    if (!pumpId) return null;
                    try {
                        const stored = localStorage.getItem(`pump_${pumpId}_selectedGroupId`);
                        return stored ? (isNaN(Number(stored)) ? stored : Number(stored)) : null;
                    } catch {
                        return null;
                    }
                };
                
                // ดึง selectedGroupId จาก localStorage
                const selectedGroupId = getStoredSelectedGroupId(effectivePump.id);
                
                accessories
                    .sort(
                        (a: PumpAccessory, b: PumpAccessory) =>
                            (a.sort_order || 0) - (b.sort_order || 0)
                    )
                    .forEach(
                        (accessory: PumpAccessory) => {
                            // ถ้าเป็นกลุ่ม (มี group_id และ group_items) ให้แสดงรายการอุปกรณ์ในกลุ่ม
                            if (accessory.group_id && accessory.group_items && accessory.group_items.length > 0) {
                                // แสดงเฉพาะกลุ่มที่เลือก (ถ้ามี selectedGroupId) หรือแสดงทุกกลุ่ม (ถ้าไม่มี selectedGroupId)
                                if (selectedGroupId && accessory.group_id !== selectedGroupId) {
                                    return; // ข้ามกลุ่มที่ไม่ใช่กลุ่มที่เลือก
                                }
                                
                                accessory.group_items.forEach((item: any) => {
                                    const equipment = item.equipment || item;
                                    const itemPrice = Number(item.unit_price || item.total_price || equipment?.price || 0);
                                    const itemQuantity = Number(item.quantity || 1);
                                    
                                    // แสดงเฉพาะรายการที่มีราคา > 0 หรือไม่ใช่ is_included
                                    if (itemPrice > 0 || !accessory.is_included) {
                                        initialItems.push({
                                            id: `pump_accessory_group_${accessory.group_id}_item_${item.id || item.equipment_id || seq}`,
                                            seq: seq++,
                                            image: equipment?.image || equipment?.image_url || equipment?.imageUrl || '',
                                            date: '',
                                            description: `${equipment?.product_code || equipment?.productCode || ''} - ${equipment?.name || item.name || 'อุปกรณ์'}`,
                                            quantity: itemQuantity,
                                            unitPrice: itemPrice,
                                            discount: 0.0,
                                            taxes: 'Output\nVAT\n7%',
                                            originalData: equipment || item,
                                        });
                                    }
                                });
                            } else {
                                // ถ้าเป็นอุปกรณ์เดี่ยว ให้แสดงตามเดิม
                                if (
                                    !accessory.is_included ||
                                    (accessory.price && accessory.price > 0)
                                ) {
                                    const accessoryTypeMap: { [key: string]: string } = {
                                        foot_valve: 'Foot Valve',
                                        check_valve: 'Check Valve',
                                        ball_valve: 'Ball Valve',
                                        pressure_gauge: 'เกจวัดแรงดัน',
                                        other: 'อุปกรณ์เสริม',
                                    };

                                    const typeName =
                                        (accessory.accessory_type && accessoryTypeMap[accessory.accessory_type]) ||
                                        accessory.accessory_type ||
                                        '';

                                    initialItems.push({
                                        id: `pump_accessory_${accessory.id || seq}`,
                                        seq: seq++,
                                        image: accessory.image_url || accessory.image || '',
                                        date: '',
                                        description: `${accessory.name}${accessory.size ? ` ขนาด ${accessory.size}` : ''}`,
                                        quantity: accessory.quantity || 1,
                                        unitPrice: accessory.is_included ? 0 : accessory.price || 0,
                                        discount: accessory.is_included ? 0 : 0.0,
                                        taxes: 'Output\nVAT\n7%',
                                        originalData: accessory,
                                    });
                                }
                            }
                        }
                    );
            }
        }

        if (selectedExtraPipe && selectedExtraPipe.pipe) {
            const lenM = getPipeLengthM(selectedExtraPipe.pipe) || 1;
            const quantity = lenM > 0 ? calculatePipeRolls(selectedExtraPipe.totalLength, lenM) : 0;
            initialItems.push({
                id: 'extraPipe',
                seq: seq++,
                image: selectedExtraPipe.pipe.image_url || selectedExtraPipe.pipe.image || '',
                date: '',
                description: `${selectedExtraPipe.pipe.productCode || selectedExtraPipe.pipe.product_code || ''} - ท่อเสริม (Riser/แขนง) ${selectedExtraPipe.pipe.sizeMM || ''}mm ยาว ${lenM} ม./ม้วน`,
                quantity,
                unitPrice: getPipePrice(selectedExtraPipe.pipe),
                discount: 0.0,
                taxes: 'Output\nVAT\n7%',
                originalData: selectedExtraPipe.pipe,
            });
        }
        
        Object.entries(sprinklerEquipmentSets).forEach(([zoneId, equipmentSet]) => {
            if (
                equipmentSet &&
                equipmentSet.selectedItems &&
                equipmentSet.selectedItems.length > 0
            ) {
                
                // หาจำนวนสปริงเกอร์ของโซนนี้
                let totalSprinklers = 0;
                
                if (projectMode === 'garden' && gardenStats) {
                    const zone = gardenStats.zones.find((z: any) => z.zoneId === zoneId);
                    if (zone) {
                        // ⚠️ ใช้ zone.zoneId จริงๆ ไม่ใช้ hardcoded 'main-area'
                        const effectiveZoneId = zoneId;
                        const zoneInput = zoneInputs[effectiveZoneId];
                        totalSprinklers = zoneInput?.totalTrees || zone.sprinklerCount || 0;
                    }
                } else if (projectMode === 'field-crop' && fieldCropData) {
                    const zone = fieldCropData.zones?.info?.find((z: any) => z.id === zoneId);
                    if (zone) {
                        const zoneSummary = fieldCropData.zoneSummaries?.[zoneId];
                        if (zoneSummary?.totalIrrigationPoints && zoneSummary.totalIrrigationPoints > 0) {
                            totalSprinklers = zoneSummary.totalIrrigationPoints;
                        } else if (zoneSummary?.sprinklerCount && zoneSummary.sprinklerCount > 0) {
                            totalSprinklers = zoneSummary.sprinklerCount;
                        } else {
                            const zoneInput = zoneInputs[zoneId];
                            totalSprinklers = zoneInput?.totalTrees || zone.sprinklerCount || 0;
                        }
                    }
                } else if (projectMode === 'greenhouse' && greenhouseData) {
                    const plot = greenhouseData.summary?.plotStats?.find((p: any) => p.plotId === zoneId);
                    if (plot) {
                        totalSprinklers = plot.equipmentCount?.sprinklers || plot.production?.totalPlants || 0;
                    }
                } else {
                    // horticulture mode
                    const zoneInput = zoneInputs[zoneId];
                    if (zoneInput) {
                        totalSprinklers = zoneInput.totalTrees || 0;
                        if (projectMode === 'horticulture') {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            totalSprinklers = totalSprinklers * sprinklersPerTree;
                        }
                    } else {
                        // Fallback: ใช้ results.totalSprinklers
                        totalSprinklers = results.totalSprinklers || 0;
                        if (projectMode === 'horticulture') {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            totalSprinklers = totalSprinklers * sprinklersPerTree;
                        }
                    }
                }
                
                equipmentSet.selectedItems.forEach((item: any) => {
                    if (item.equipment) {
                        // กรอง pipe ออก เพราะ pipe ถูกแสดงในส่วนท่อแล้ว (branch/secondary/main/emitter)
                        const categoryName = item.equipment.category?.name?.toLowerCase();
                        const isPipe = categoryName === 'pipe' || categoryName?.includes('pipe');
                        
                        if (!isPipe) {
                            // item.quantity เป็น quantity per head ต้องคูณกับจำนวนสปริงเกอร์
                            const quantityPerHead = item.quantity || 0;
                            const totalQuantity = quantityPerHead * totalSprinklers;
                            
                            if (totalQuantity > 0) {
                                const unitPrice = item.unit_price || item.equipment.price || 0;
                                
                                initialItems.push({
                                    id: `sprinkler_equipment_${zoneId}_${item.equipment.id}`,
                                    seq: seq++,
                                    image: item.equipment.image || '',
                                    date: '',
                                    description: `${item.equipment.product_code || ''} - ${item.equipment.name || ''} (${item.equipment.brand || ''})`,
                                    quantity: totalQuantity,
                                    unitPrice: unitPrice,
                                    discount: 0.0,
                                    taxes: 'Output\nVAT\n7%',
                                    originalData: item.equipment,
                                });
                            }
                        }
                    }
                });
            }
        });

        Object.entries(connectionEquipments).forEach(([zoneId, equipments]) => {
            if (equipments && equipments.length > 0) {
                equipments.forEach((equipment: any) => {
                    if (equipment.equipment && equipment.count > 0) {
                        initialItems.push({
                            id: `connection_equipment_${zoneId}_${equipment.connectionType}_${equipment.equipment.id}`,
                            seq: seq++,
                            image: equipment.equipment.image || '',
                            date: '',
                            description: `${equipment.equipment.product_code || ''} - ${equipment.equipment.name || ''} (${equipment.equipment.brand || ''})`,
                            quantity: equipment.count,
                            unitPrice: equipment.equipment.price || 0,
                            discount: 0.0,
                            taxes: 'Output\nVAT\n7%',
                            originalData: equipment.equipment,
                        });
                    }
                });
            }
        });

        // โหมด garden: อุปกรณ์ข้อต่อที่เลือกจาก GardenConnectorEquipmentsSelector (localStorage)
        const GARDEN_CONNECTOR_STORAGE_KEY = 'gardenConnectorEquipmentSelections';
        if (projectMode === 'garden' && gardenStats?.summary?.connectorSummary) {
            const summary = gardenStats.summary.connectorSummary;
            const byWays = summary.byWays || {};
            const straightCouplers = summary.straightCouplers ?? 0;
            try {
                const saved = localStorage.getItem(GARDEN_CONNECTOR_STORAGE_KEY);
                const selections = saved ? JSON.parse(saved) : {};
                Object.entries(byWays).forEach(([ways, count]) => {
                    const numCount = Number(count);
                    if (numCount <= 0) return;
                    const key = `way-${ways}`;
                    const sel = selections[key];
                    const equipment = sel?.equipment;
                    if (!equipment) return;
                    const unitPrice = equipment.price ?? equipment.price_per_unit ?? 0;
                    initialItems.push({
                        id: `connection_equipment_garden_${key}_${equipment.id ?? key}`,
                        seq: seq++,
                        image: equipment.image || '',
                        date: '',
                        description: `${t('ข้อต่อ')} ${ways} ${t('ทาง')} - ${equipment.product_code || equipment.productCode || ''} - ${equipment.name || ''} (${equipment.brand || ''})`,
                        quantity: numCount,
                        unitPrice: Number(unitPrice) || 0,
                        discount: 0.0,
                        taxes: 'Output\nVAT\n7%',
                        originalData: equipment,
                    });
                });
                if (straightCouplers > 0) {
                    const sel = selections['straight'];
                    const equipment = sel?.equipment;
                    if (equipment) {
                        const unitPrice = equipment.price ?? equipment.price_per_unit ?? 0;
                        initialItems.push({
                            id: `connection_equipment_garden_straight_${equipment.id ?? 'straight'}`,
                            seq: seq++,
                            image: equipment.image || '',
                            date: '',
                            description: `${t('ต่อตรง')} - ${equipment.product_code || equipment.productCode || ''} - ${equipment.name || ''} (${equipment.brand || ''})`,
                            quantity: straightCouplers,
                            unitPrice: Number(unitPrice) || 0,
                            discount: 0.0,
                            taxes: 'Output\nVAT\n7%',
                            originalData: equipment,
                        });
                    }
                }
            } catch (_) {
                /* ignore */
            }
        }

        // เรียงลำดับ items ตาม seq
        const sortedItems = [...initialItems].sort((a, b) => a.seq - b.seq);
        setItems(sortedItems);
        if (hasProjectImagePage && initialItems.length > 0) {
            setCurrentPage(1);
        } else if (hasProjectImagePage && initialItems.length === 0) {
            setCurrentPage(1);
        } else if (!hasProjectImagePage && initialItems.length > 0) {
            setCurrentPage(1);
        } else {
            setCurrentPage(1);
        }
    }, [
        show,
        selectedSprinkler,
        selectedPump,
        selectedBranchPipe,
        selectedSecondaryPipe,
        selectedMainPipe,
        selectedEmitterPipe,
        results,
        zoneSprinklers,
        selectedPipes,
        projectData,
        selectedExtraPipe,
        sprinklerEquipmentSets,
        connectionEquipments,
        zoneInputs,
        gardenStats,
        fieldCropData,
        projectMode,
        greenhouseData,
        t,
    ]);

    const calculateItemAmount = (item: QuotationItem) => {
        const unitPrice =
            typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(item.unitPrice) || 0;
        return unitPrice * item.quantity - unitPrice * (item.discount / 100);
    };

    const calculateTotal = () => {
        // Calculate breakdown by category
        let sprinklerCost = 0;
        let pumpCost = 0;
        let pumpAccessoriesCost = 0;
        let pipeCost = 0;
        let connectionCost = 0;
        let sprinklerEquipmentCost = 0;
        let otherCost = 0;
        
        items.forEach((item) => {
            const amount = calculateItemAmount(item);
            const id = item.id.toString();
            
            if (id.includes('sprinkler_') && !id.includes('sprinkler_equipment_')) {
                sprinklerCost += amount;
            } else if (id.includes('pump_') && !id.includes('pump_accessory')) {
                pumpCost += amount;
            } else if (id.includes('pump_accessory')) {
                pumpAccessoriesCost += amount;
            } else if (id.includes('pipe_')) {
                pipeCost += amount;
            } else if (id.includes('connection_equipment_')) {
                connectionCost += amount;
            } else if (id.includes('sprinkler_equipment_')) {
                sprinklerEquipmentCost += amount;
            } else {
                otherCost += amount;
            }
        });
        
        const total = items.reduce((sum, item) => sum + calculateItemAmount(item), 0);
        
        return total;
    };

    const updateItem = (id: string, field: keyof QuotationItem, value: any) => {
        setItems((prevItems) =>
            prevItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
        );
    };

    const addNewItem = () => {
        const newItem: QuotationItem = {
            id: `item_${Date.now()}`,
            seq: items.length + 1,
            image: '',
            date: '',
            description: 'รายการใหม่',
            quantity: 1,
            unitPrice: 0,
            discount: 0,
            taxes: 'Output\nVAT\n7%',
        };
        setItems([...items, newItem]);
    };

    const removeItem = (id: string) => {
        setItems((prevItems) => {
            const filteredItems = prevItems.filter((item) => item.id !== id);
            return filteredItems.map((item, index) => ({ ...item, seq: index + 1 }));
        });
    };

    const getItemsForPage = (page: number) => {
        const imagePageOffset = hasProjectImagePage ? 1 : 0;

        if (hasProjectImagePage && page === 1) {
            return [];
        }
        if (hasSummaryPage && page === totalPages) {
            return [];
        }

        const effectivePage = page - imagePageOffset;
        const itemsPerPage = getItemsPerPage(page, totalPagesForItems, items.length);

        if (effectivePage === 1) {
            return items.slice(0, itemsPerPage);
        } else {
            let firstPageItems;
            if (items.length <= 7) {
                firstPageItems = items.length;
            } else if (items.length === 8) {
                firstPageItems = 7;
            } else if (items.length === 9) {
                firstPageItems = 8;
            } else if (items.length === 10) {
                firstPageItems = 9;
            } else {
                firstPageItems = 10;
            }

            const startIndex = firstPageItems + (effectivePage - 2) * 13;
            const endIndex = startIndex + itemsPerPage;
            return items.slice(startIndex, endIndex);
        }
    };

    const renderTotalTable = (grandTotal: number, isForPrint: boolean = false) => {
        const tableClasses = isForPrint
            ? 'w-[250px] border-collapse border-gray-400 text-sm'
            : 'w-[250px] border-collapse border-gray-400 text-sm';

        const cellClasses = isForPrint
            ? 'border border-x-0 border-gray-400 p-1 text-left align-top font-bold'
            : 'border border-x-0 border-gray-400 p-1 text-left align-top font-bold';

        const valueCellClasses = isForPrint
            ? 'w-[100px] border border-x-0 border-gray-400 p-1 text-right align-top'
            : 'w-[100px] border border-x-0 border-gray-400 p-1 text-right align-top';

        return `
            <table class="${tableClasses}">
                <tbody>
                    <tr class="border-gray-400">
                        <td class="${cellClasses}">Subtotal</td>
                        <td class="${valueCellClasses}">${grandTotal.toFixed(2)} ฿</td>
                    </tr>
                    <tr class="border-gray-400">
                        <td class="${cellClasses}">Vat 7%</td>
                        <td class="${valueCellClasses}">${(grandTotal * 0.07).toFixed(2)} ฿</td>
                    </tr>
                    <tr class="border-gray-400">
                        <td class="${cellClasses}">Subtotal Without Discount</td>
                        <td class="${valueCellClasses}">${(grandTotal * 1.07).toFixed(2)} ฿</td>
                    </tr>
                    <tr class="border-gray-400">
                        <td class="${cellClasses}">Discount Subtotal</td>
                        <td class="${valueCellClasses}">0.00 ฿</td>
                    </tr>
                    <tr class="border-gray-400">
                        <td class="${cellClasses}">Total</td>
                        <td class="${valueCellClasses}">${(grandTotal * 1.07).toFixed(2)} ฿</td>
                    </tr>
                </tbody>
            </table>
        `;
    };

    const EquipmentSelector = React.memo(() => {
        const [localSearchTerm, setLocalSearchTerm] = useState(equipmentSearchTerm);
        const [localSelectedCategory, setLocalSelectedCategory] = useState(selectedCategory);

        useEffect(() => {
            const timeoutId = setTimeout(() => {
                setEquipmentSearchTerm(localSearchTerm);
            }, 300);
            return () => clearTimeout(timeoutId);
        }, [localSearchTerm]);

        useEffect(() => {
            setSelectedCategory(localSelectedCategory);
        }, [localSelectedCategory]);

        useEffect(() => {
            if (localSelectedCategory !== selectedCategory) {
                setLocalSearchTerm('');
                setEquipmentSearchTerm('');
            }
        }, [localSelectedCategory, selectedCategory]);

        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
                <div className="max-h-[80vh] w-[800px] overflow-auto rounded-lg bg-white p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-800">
                            {t('เลือกอุปกรณ์จากฐานข้อมูล')}
                        </h3>
                        <button
                            onClick={() => {
                                setShowEquipmentSelector(false);
                                setLocalSearchTerm('');
                                setLocalSelectedCategory('');
                            }}
                            className="px-2 py-1 text-xl text-gray-500 hover:text-gray-700"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            {t('เลือกประเภทอุปกรณ์')}
                        </label>
                        <select
                            value={localSelectedCategory}
                            onChange={(e) => setLocalSelectedCategory(e.target.value)}
                            className="w-full rounded border border-gray-300 p-2 text-gray-800 focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">-- {t('เลือกประเภท')} --</option>
                            {equipmentCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.display_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {localSelectedCategory && (
                        <div className="mb-4">
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                {t('ค้นหาอุปกรณ์')}
                            </label>
                            <input
                                key={`search-${localSelectedCategory}`}
                                type="text"
                                value={localSearchTerm}
                                onChange={(e) => setLocalSearchTerm(e.target.value)}
                                placeholder={t('ชื่อ, รุ่น, แบรนด์...')}
                                className="w-full rounded border border-gray-300 bg-white p-2 text-gray-800 focus:border-blue-500 focus:outline-none"
                                autoComplete="off"
                            />
                        </div>
                    )}

                    {isLoadingEquipment ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-gray-500">{t('กำลังโหลด...')}</div>
                        </div>
                    ) : (
                        <div className="max-h-[400px] overflow-auto">
                            {equipmentList.length === 0 && localSelectedCategory ? (
                                <div className="py-8 text-center text-gray-500">
                                    {t('ไม่พบอุปกรณ์')}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {equipmentList.map((equipment) => (
                                        <div
                                            key={equipment.id}
                                            className="flex items-center justify-between rounded border border-gray-200 p-3 hover:bg-gray-50"
                                        >
                                            <div className="flex items-center space-x-3">
                                                {equipment.image ? (
                                                    <img
                                                        src={equipment.image}
                                                        alt={equipment.name}
                                                        className="h-10 w-10 rounded object-cover"
                                                        onError={(e) => {
                                                            (
                                                                e.target as HTMLImageElement
                                                            ).style.display = 'none';
                                                            const fallback = (
                                                                e.target as HTMLElement
                                                            ).nextElementSibling as HTMLElement;
                                                            if (fallback)
                                                                fallback.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div
                                                    className="flex h-10 w-10 items-center justify-center rounded bg-gray-200 text-xs text-gray-500"
                                                    style={{
                                                        display: equipment.image ? 'none' : 'flex',
                                                    }}
                                                >
                                                    📦
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-800">
                                                        {equipment.productCode}
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        {equipment.name}
                                                        {equipment.brand && ` (${equipment.brand})`}
                                                    </div>
                                                    <div className="text-sm font-medium text-blue-600">
                                                        {equipment.price.toLocaleString()} บาท
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    addEquipmentFromDatabase(equipment);
                                                    setLocalSearchTerm('');
                                                    setLocalSelectedCategory('');
                                                }}
                                                className="rounded bg-blue-500 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-600"
                                            >
                                                {t('เพิ่ม')}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    });

    const handlePrint = () => {
        const currentItems = items;
        const currentTotalPagesForItems = calculateTotalPages(currentItems.length);
        const currentHasSummaryPage = !!(results && currentItems.length > 0);
        const currentTotalPages = currentTotalPagesForItems + (currentHasSummaryPage ? 1 : 0);

        const printContainer = document.createElement('div');
        printContainer.className = 'print-document-container';
        printContainer.style.display = 'none';

        let allPagesHTML = '';
        for (let page = 1; page <= currentTotalPages; page++) {
            const imagePageOffset = hasProjectImagePage ? 1 : 0;

            if (currentHasSummaryPage && page === currentTotalPages) {
                const summaryPageHTML = `
                    <div class="mx-auto flex h-[1123px] w-[794px] flex-col bg-white p-8 text-black shadow-lg">
                        <div class="print-page flex min-h-full flex-col">
                            ${renderHeaderLogoOnly()}
                            <div class="mt-2 flex-1 text-sm">
                                <h3 class="mb-3 text-base font-bold">${t('สรุปผลการคำนวณ')}</h3>
                                <p>${t('รายละเอียดตามที่แสดงในเอกสาร')}</p>
                            </div>
                            ${renderFooter(page)}
                        </div>
                    </div>
                `;
                allPagesHTML += summaryPageHTML;
                continue;
            }

            if (hasProjectImagePage && page === 1) {
                const imagePageHTML = `
                    <div class="mx-auto flex h-[1123px] w-[794px] flex-col bg-white p-8 text-black shadow-lg" style="page-break-after: always;">
                        <div class="print-page flex min-h-full flex-col">
                            ${renderHeader()}
                            
                            <div class="flex flex-col items-center justify-center">
                                <h1 class="text-2xl font-bold mb-8 text-center">แผนผังโครงการ</h1>
                                <div class="flex items-center justify-center w-full max-h-[800px]">
                                    <img
                                        src="${editableProjectImage}"
                                        alt="Project Layout"
                                        class="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                                    />
                                </div>
                            </div>
                            
                            ${renderFooter(page)}
                        </div>
                    </div>
                `;
                allPagesHTML += imagePageHTML;
                continue;
            }

            let pageItems;
            const itemsPerPage = getItemsPerPage(page, currentTotalPagesForItems, currentItems.length);

            if (page === 1 + imagePageOffset) {
                pageItems = currentItems.slice(0, itemsPerPage);
            } else {
                let firstPageItems;
                if (currentItems.length <= 7) {
                    firstPageItems = currentItems.length;
                } else if (currentItems.length === 8) {
                    firstPageItems = 7;
                } else if (currentItems.length === 9) {
                    firstPageItems = 8;
                } else if (currentItems.length === 10) {
                    firstPageItems = 9;
                } else {
                    firstPageItems = 10;
                }

                const startIndex = firstPageItems + (page - 2 - imagePageOffset) * 13;
                const endIndex = startIndex + itemsPerPage;
                pageItems = currentItems.slice(startIndex, endIndex);
            }

            const headerHTML = renderHeader();

            const customerInfoHTML =
                page === 1 + imagePageOffset
                    ? `
                <div class="print-customer-info mb-6 self-end text-left text-sm">
                    <p class="font-semibold">[1234] ${quotationDataCustomer.name || '-'}</p>
                    <p>${quotationDataCustomer.projectName || '-'}</p>
                    <p>${quotationDataCustomer.address || '-'}</p>
                    <p>${quotationDataCustomer.phone || '-'}</p>
                </div>
            `
                    : '';

            const quotationDetailsHTML =
                page === 1 + imagePageOffset
                    ? `
                <h1 class="print-title mb-4 text-xl font-bold">Quotation # QT1234567890</h1>
                <div class="print-details mb-4 flex flex-row gap-9 text-left text-sm">
                    <div>
                        <strong>Your Reference:</strong>
                        <p>${quotationData.yourReference || '-'}</p>
                    </div>
                    <div>
                        <strong>Quotation Date:</strong>
                        <p>${quotationData.quotationDate || '-'}</p>
                    </div>
                    <div>
                        <strong>Salesperson:</strong>
                        <p>${quotationData.salesperson || '-'}</p>
                    </div>
                    <div>
                        <strong>Payment Terms:</strong>
                        <p>${quotationData.paymentTerms || '-'}</p>
                    </div>
                </div>
            `
                    : '';


            const tableHeaderHTML = `
                <thead>
                    <tr class="bg-gray-100">
                        <th class="border border-gray-400 p-2 text-center" colspan="5">
                            ${t('Commitment')}
                        </th>
                        <th class="border border-gray-400 p-2 text-center" colspan="5">
                            ${t('Disc. Fixed')}
                        </th>
                    </tr>
                    <tr class="bg-gray-100">
                        <th class="w-[50px] border border-gray-400 p-1 text-center">${t('Seq')}</th>
                        <th class="w-[60px] border border-gray-400 p-1 text-center">${t('Image')}</th>
                        <th class="w-[80px] border border-gray-400 p-1 text-center">${t('Date')}</th>
                        <th class="w-[250px] border border-gray-400 p-1 text-center">${t('Description')}</th>
                        <th class="w-[80px] border border-gray-400 p-1 text-center">${t('Quantity')}</th>
                        <th class="w-[80px] border border-gray-400 p-1 text-center">${t('Unit Price')}</th>
                        <th class="w-[80px] border border-gray-400 p-1 text-center">${t('Disc.(%)')}</th>
                        <th class="w-[80px] border border-gray-400 p-1 text-center">${t('Amount')}</th>
                        <th class="w-[80px] border border-gray-400 p-1 text-center">${t('Taxes')}</th>
                        <th class="w-[80px] border border-gray-400 p-1 text-center">${t('Amount')}</th>
                    </tr>
                </thead>
            `;

            const tableRows = pageItems
                .map((item) => {
                    const itemAmount = calculateItemAmount(item);
                    const imageUrl = getImageUrl(item);
                    const imageHTML = imageUrl
                        ? `<img src="${imageUrl}" alt="item image" class="w-10 h-10 mx-auto object-cover" />`
                        : '';

                    return `
                    <tr>
                        <td class="border border-gray-400 p-1 text-center align-top">${item.seq}</td>
                        <td class="border border-gray-400 p-1 text-center align-top">${imageHTML}</td>
                        <td class="border border-gray-400 p-1 text-center align-top">${item.date}</td>
                        <td class="border border-gray-400 p-1 text-left align-top">${item.description}</td>
                        <td class="border border-gray-400 p-1 text-right align-top">
                            ${item.quantity.toFixed(4)}<br />${t('Unit')}
                        </td>
                        <td class="border border-gray-400 p-1 text-right align-top">${(typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(item.unitPrice) || 0).toFixed(4)}</td>
                        <td class="border border-gray-400 p-1 text-right align-top">${item.discount.toFixed(3)}</td>
                        <td class="border border-gray-400 p-1 text-right align-top">${((typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(item.unitPrice) || 0) * (item.discount / 100)).toFixed(2)}</td>
                        <td class="border border-gray-400 p-1 text-right align-top">${item.taxes.replace(/\n/g, '<br />')}</td>
                        <td class="border border-gray-400 p-1 text-right align-top">${itemAmount.toFixed(2)} ฿</td>
                    </tr>
                `;
                })
                .join('');

            const tableHTML = `
                <table class="print-table w-full border-collapse border border-gray-400 text-xs">
                    ${tableHeaderHTML}
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            `;

            const grandTotal = calculateTotal();
            const totalHTML =
                page === currentTotalPagesForItems
                    ? `
                <div class="mt-4 flex justify-end">
                    ${renderTotalTable(grandTotal, true)}
                </div>
            `
                    : '';

            const footerHTML = renderFooter(page);

            const pageBreak = page < currentTotalPages ? 'page-break-after: always;' : '';
            allPagesHTML += `
                <div class="mx-auto flex h-[1123px] w-[794px] flex-col bg-white p-8 text-black shadow-lg" style="${pageBreak}">
                    <div class="print-page flex min-h-full flex-col">
                        ${headerHTML}
                        ${customerInfoHTML}
                        ${quotationDetailsHTML}
                        ${tableHTML}
                        ${totalHTML}
                        ${footerHTML}
                    </div>
                </div>
            `;
        }

        printContainer.innerHTML = allPagesHTML;
        document.body.appendChild(printContainer);

        setTimeout(() => {
            printContainer.style.display = 'block';
            window.print();

            setTimeout(() => {
                if (document.body.contains(printContainer)) {
                    document.body.removeChild(printContainer);
                }
            }, 2000);
        }, 100);
    };

    const renderHeader = () =>
        `<div class="print-header mb-2 flex items-center justify-between">
            <div class="flex items-center">
                <img
                    src="https://f.btwcdn.com/store-50036/store/e4c1b5ae-cf8e-5017-536b-66ecd994018d.jpg"
                    alt="logo"
                    class="print-logo h-10 w-10"
                />
            </div>
        </div>
        <hr class="print-hr mb-4 border-gray-800" />
        <div class="print-company-info mb-4 self-start text-sm">
            <p class="font-semibold">${t('บจก. กนกโปรดักส์ (สำนักงานใหญ่)')}</p> 
            <p>${t('15 ซ. พระยามนธาตุ แยก 10')}</p>
            <p>${t('แขวงคลองบางบอน เขตบางบอน')}</p>
            <p>${t('กรุงเทพมหานคร 10150')}</p>
        </div>`;

    const renderHeaderLogoOnly = () =>
        `<div class="print-header mb-4 flex items-center justify-between">
            <div class="flex items-center">
                <img
                    src="https://f.btwcdn.com/store-50036/store/e4c1b5ae-cf8e-5017-536b-66ecd994018d.jpg"
                    alt="logo"
                    class="print-logo h-10 w-10"
                />
            </div>
        </div>`;

    const renderFooter = (page: number) =>
        `<div class="print-footer-container mt-auto text-center text-xs">
            <hr class="print-footer-hr mb-2 border-gray-800" />
            <div class="print-footer">
                <p>${t('Phone:')} 02-451-1111 ${t('Tax ID:')} 0105549044446</p>
                <p>${t('Page:')} ${page} / ${totalPages}</p>
            </div>
        </div>`;

    const renderCustomerInfo = () => (
        <div className="print-customer-info mb-6 self-end text-left text-sm">
            <p className="font-semibold">[1234] {quotationDataCustomer.name || '-'}</p>
            <p>{quotationDataCustomer.projectName || '-'}</p>
            <p>{quotationDataCustomer.address || '-'}</p>
            <p>{quotationDataCustomer.phone || '-'}</p>
        </div>
    );

    const renderQuotationDetails = () => (
        <>
            <h1 className="print-title mb-4 text-xl font-bold">Quotation # QT1234567890</h1>
            <div className="print-details mb-4 flex flex-row gap-9 text-left text-sm">
                <div>
                    <strong>Your Reference:</strong>
                    <p>{quotationData.yourReference || '-'}</p>
                </div>
                <div>
                    <strong>Quotation Date:</strong>
                    <p>{quotationData.quotationDate || '-'}</p>
                </div>
                <div>
                    <strong>Salesperson:</strong>
                    <p>{quotationData.salesperson || '-'}</p>
                </div>
                <div>
                    <strong>Payment Terms:</strong>
                    <p>{quotationData.paymentTerms || '-'}</p>
                </div>
            </div>
        </>
    );


    const renderTableHeader = () => (
        <thead>
            <tr className="bg-gray-100">
                <th className="border border-gray-400 p-2 text-center" colSpan={5}>
                    Commitment
                </th>
                <th className="border border-gray-400 p-2 text-center" colSpan={5}>
                    Disc. Fixed
                </th>
            </tr>
            <tr className="bg-gray-100">
                <th className="w-[50px] border border-gray-400 p-1 text-center">Seq</th>
                <th className="w-[60px] border border-gray-400 p-1 text-center">Image</th>
                <th className="w-[80px] border border-gray-400 p-1 text-center">Date</th>
                <th className="w-[250px] border border-gray-400 p-1 text-center">Description</th>
                <th className="w-[80px] border border-gray-400 p-1 text-center">Quantity</th>
                <th className="w-[80px] border border-gray-400 p-1 text-center">Unit Price</th>
                <th className="w-[80px] border border-gray-400 p-1 text-center">Disc.(%)</th>
                <th className="w-[80px] border border-gray-400 p-1 text-center">Amount</th>
                <th className="w-[80px] border border-gray-400 p-1 text-center">Taxes</th>
                <th className="w-[80px] border border-gray-400 p-1 text-center">Amount</th>
                {isEditing && (
                    <th className="no-print w-[120px] border border-gray-400 p-1 text-center">
                        Actions
                    </th>
                )}
            </tr>
        </thead>
    );

    const renderTableRow = (item: QuotationItem, index: number) => {
        const imageUrl = getImageUrl(item);
        const currentPageItems = getItemsForPage(currentPage);
        const currentIndex = currentPageItems.findIndex((i) => i.id === item.id);
        const imagePageOffset = hasProjectImagePage ? 1 : 0;
        const effectivePage = currentPage - imagePageOffset;

        let firstPageItems;
        if (items.length <= 7) {
            firstPageItems = items.length;
        } else if (items.length === 8) {
            firstPageItems = 7;
        } else if (items.length === 9) {
            firstPageItems = 8;
        } else if (items.length === 10) {
            firstPageItems = 9;
        } else {
            firstPageItems = 10;
        }

        const absoluteIndex =
            effectivePage === 1
                ? currentIndex
                : firstPageItems + (effectivePage - 2) * 13 + currentIndex;

        return (
            <tr key={item.id}>
                <td className="border border-gray-400 p-1 text-center align-top">{item.seq}</td>
                <td className="border border-gray-400 p-1 text-center align-top">
                    {isEditing ? (
                        <div
                            className="group relative mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-300 hover:border-blue-400"
                            onClick={() => openFileDialog(item.id)}
                            title={t('คลิกเพื่อเพิ่มรูปภาพ')}
                        >
                            {imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt="item image"
                                    className="h-full w-full rounded object-cover"
                                />
                            ) : (
                                <span className="text-xs text-gray-400 group-hover:text-blue-400">
                                    📷
                                </span>
                            )}
                            <div className="absolute inset-0 rounded bg-black bg-opacity-0 transition-all duration-200 group-hover:bg-opacity-20"></div>
                        </div>
                    ) : imageUrl ? (
                        <img
                            src={imageUrl}
                            alt="item image"
                            className="mx-auto h-10 w-10 object-cover"
                        />
                    ) : (
                        ''
                    )}
                </td>
                <td className="border border-gray-400 p-1 text-center align-top">
                    {isEditing ? (
                        <input
                            type="date"
                            value={item.date}
                            onChange={(e) => updateItem(item.id, 'date', e.target.value)}
                            className="w-full border-none bg-transparent text-center text-xs"
                        />
                    ) : (
                        item.date
                    )}
                </td>
                <td className="border border-gray-400 p-1 text-left align-top">
                    {isEditing ? (
                        <textarea
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            className="h-12 w-full resize-none border-none bg-transparent text-xs"
                            rows={2}
                        />
                    ) : (
                        item.description
                    )}
                </td>
                <td className="border border-gray-400 p-1 text-right align-top">
                    {isEditing ? (
                        <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                                updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                            }
                            className="w-full border-none bg-transparent text-right text-xs"
                            step="0.0001"
                        />
                    ) : (
                        `${item.quantity.toFixed(4)}`
                    )}
                    <br />
                    {t('Unit')}
                </td>
                <td className="border border-gray-400 p-1 text-right align-top">
                    {isEditing ? (
                        <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) =>
                                updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                            }
                            className="w-full border-none bg-transparent text-right text-xs"
                            step="0.001"
                        />
                    ) : (
                        (typeof item.unitPrice === 'number'
                            ? item.unitPrice
                            : parseFloat(item.unitPrice) || 0
                        ).toFixed(4)
                    )}
                </td>
                <td className="border border-gray-400 p-1 text-right align-top">
                    {isEditing ? (
                        <input
                            type="number"
                            value={item.discount}
                            onChange={(e) =>
                                updateItem(item.id, 'discount', parseFloat(e.target.value) || 0)
                            }
                            className="w-full border-none bg-transparent text-right text-xs"
                            step="0.001"
                            max="100"
                            min="0"
                        />
                    ) : (
                        item.discount.toFixed(3)
                    )}
                </td>
                <td className="border border-gray-400 p-1 text-right align-top">
                    {(
                        (typeof item.unitPrice === 'number'
                            ? item.unitPrice
                            : parseFloat(item.unitPrice) || 0) *
                        (item.discount / 100)
                    ).toFixed(2)}
                </td>
                <td className="border border-gray-400 p-1 text-right align-top">
                    {item.taxes.split('\n').map((line, i) => (
                        <React.Fragment key={i}>
                            {line}
                            {i < item.taxes.split('\n').length - 1 && <br />}
                        </React.Fragment>
                    ))}
                </td>
                <td className="border border-gray-400 p-1 text-right align-top">
                    {calculateItemAmount(item).toFixed(2)} ฿
                </td>
                {isEditing && (
                    <td className="no-print border border-gray-400 p-1 text-center align-top">
                        <div className="flex flex-col space-y-1">
                            <div className="flex space-x-1">
                                <button
                                    onClick={() => moveItem(absoluteIndex, 'up')}
                                    disabled={absoluteIndex === 0}
                                    className="rounded px-1 py-0.5 text-xs text-blue-500 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    title={t('ขึ้น')}
                                >
                                    ↑
                                </button>
                                <button
                                    onClick={() => moveItem(absoluteIndex, 'down')}
                                    disabled={absoluteIndex === items.length - 1}
                                    className="rounded px-1 py-0.5 text-xs text-blue-500 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    title={t('ลง')}
                                >
                                    ↓
                                </button>
                            </div>
                            <button
                                onClick={() => removeItem(item.id)}
                                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                            >
                                {t('ลบ')}
                            </button>
                        </div>
                    </td>
                )}
            </tr>
        );
    };

    const renderProjectImagePage = () => (
        <div className="mx-auto flex h-[1123px] w-[794px] flex-col bg-white p-8 text-black shadow-lg">
            <div className="print-page flex min-h-full flex-col">
                <div className="print-header mb-2 flex items-center justify-between">
                    <div className="flex items-center">
                        <img
                            src="https://f.btwcdn.com/store-50036/store/e4c1b5ae-cf8e-5017-536b-66ecd994018d.jpg"
                            alt="logo"
                            className="print-logo h-10 w-10"
                        />
                    </div>
                </div>
                <hr className="print-hr mb-4 border-gray-800" />
                <div className="print-company-info mb-4 self-start text-sm">
                    <p className="font-semibold">บจก. กนกโปรดักส์ (สำนักงานใหญ่)</p>
                    <p>{t('15 ซ. พระยามนธาตุ แยก 10')}</p>
                    <p>{t('แขวงคลองบางบอน เขตบางบอน')}</p>
                    <p>{t('กรุงเทพมหานคร 10150')}</p>
                </div>

                <div className="flex flex-col items-center justify-center">
                    <h1 className="mb-8 text-center text-2xl font-bold">
                        {t('แผนผังโครงการ')}
                    </h1>
                    <div className="relative flex max-h-[800px] w-full items-center justify-center">
                        {isEditing ? (
                            <div className="group relative">
                                {editableProjectImage ? (
                                    <img
                                        src={editableProjectImage}
                                        alt="Project Layout"
                                        className="max-h-full max-w-full cursor-pointer rounded-lg object-contain shadow-lg"
                                        onClick={openProjectImageDialog}
                                        title={t('คลิกเพื่อเปลี่ยนรูปภาพ')}
                                    />
                                ) : (
                                    <div
                                        className="flex h-[400px] w-[600px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-blue-400"
                                        onClick={openProjectImageDialog}
                                        title={t('คลิกเพื่อเพิ่มรูปภาพ')}
                                    >
                                        <div className="text-center">
                                            <div className="mb-4 text-6xl text-gray-400">📷</div>
                                            <p className="text-gray-500">
                                                {t('คลิกเพื่อเพิ่มรูปแผนผัง')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {editableProjectImage && (
                                    <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openProjectImageDialog();
                                            }}
                                            className="rounded-full bg-blue-500 p-2 text-white shadow-lg hover:bg-blue-600"
                                            title={t('เปลี่ยนรูปภาพ')}
                                        >
                                            📷
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleProjectImageDelete();
                                            }}
                                            className="rounded-full bg-red-500 p-2 text-white shadow-lg hover:bg-red-600"
                                            title={t('ลบรูปภาพ')}
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : editableProjectImage ? (
                            <img
                                src={editableProjectImage}
                                alt="Project Layout"
                                className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
                            />
                        ) : (
                            <div className="flex h-[400px] w-[600px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                                <div className="text-center">
                                    <div className="mb-4 text-6xl text-gray-400">📷</div>
                                    <p className="text-gray-500">{t('ไม่มีรูปแผนผัง')}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    {!isEditing && totalPages > 1 && (
                        <div className="no-print mt-4 rounded bg-blue-100 p-4 text-center text-blue-800">
                            <p className="text-sm font-medium">
                                📋 {t('กดปุ่ม')} "{t('ถัดไป')}" {t('ด้านบนเพื่อดูรายการอุปกรณ์')}
                            </p>
                            <p className="text-xs text-blue-600">
                                {t('หน้านี้แสดงแผนผังโปรเจค')}{' '}
                                {t('หน้าถัดไปจะแสดงตารางอุปกรณ์และราคา')}
                            </p>
                        </div>
                    )}
                </div>

                <div className="print-footer-container mt-auto text-center text-xs">
                    <hr className="print-footer-hr mb-2 border-gray-800" />
                    <div className="print-footer">
                        <p>
                            {t('Phone:')} 02-451-1111 {t('Tax ID:')} 0105549044446
                        </p>
                        <p>
                            {t('Page:')} 1 / {totalPages}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    if (!show) return null;

    const imagePageOffset = hasProjectImagePage ? 1 : 0;
    const isImagePage = hasProjectImagePage && currentPage === 1;
    const isEquipmentPage = !isImagePage;

    return (
        <div className="fixed inset-0 z-50 overflow-auto bg-gray-800">
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page {
                            size: A4 portrait;
                            margin: 0;
                        }
                        
                        * {
                            -webkit-print-color-adjust: exact !important;
                            color-adjust: exact !important;
                            box-sizing: border-box !important;
                        }
                        
                        body > *:not(.print-document-container) {
                            display: none !important;
                        }
                        
                        .print-document-container {
                            display: block !important;
                            position: static !important;
                            width: 100% !important;
                            height: auto !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif !important;
                        }
                        
                        .mx-auto { margin-left: auto !important; margin-right: auto !important; }
                        .flex { display: flex !important; }
                        .h-\\[1123px\\] { height: 1123px !important; }
                        .w-\\[794px\\] { width: 794px !important; }
                        .flex-col { flex-direction: column !important; }
                        .bg-white { background-color: white !important; }
                        .p-8 { padding: 2rem !important; }
                        .text-black { color: black !important; }
                        .shadow-lg { box-shadow: none !important; }
                        
                        .print-page { 
                            display: flex !important; 
                            min-height: 100% !important; 
                            flex-direction: column !important; 
                        }
                        
                        .mb-2 { margin-bottom: 0.5rem !important; }
                        .mb-4 { margin-bottom: 1rem !important; }
                        .mb-6 { margin-bottom: 1.5rem !important; }
                        .mb-8 { margin-bottom: 2rem !important; }
                        .mt-auto { margin-top: auto !important; }
                        .mt-4 { margin-top: 1rem !important; }
                        
                        .items-center { align-items: center !important; }
                        .justify-between { justify-content: space-between !important; }
                        .justify-center { justify-content: center !important; }
                        .justify-end { justify-content: flex-end !important; }
                        .self-start { align-self: flex-start !important; }
                        .self-end { align-self: flex-end !important; }
                        .flex-1 { flex: 1 !important; }
                        
                        .h-10 { height: 2.5rem !important; }
                        .w-10 { width: 2.5rem !important; }
                        .w-full { width: 100% !important; }
                        .max-w-full { max-width: 100% !important; }
                        .max-h-full { max-height: 100% !important; }
                        .max-h-\\[800px\\] { max-height: 800px !important; }
                        
                        .border-gray-800 { border-color: rgb(31, 41, 55) !important; }
                        .border-gray-400 { border-color: rgb(156, 163, 175) !important; }
                        .bg-gray-100 { background-color: rgb(243, 244, 246) !important; }
                        
                        .text-sm { font-size: 0.875rem !important; line-height: 1.25rem !important; }
                        .text-xs { font-size: 0.75rem !important; line-height: 1rem !important; }
                        .text-xl { font-size: 1.25rem !important; line-height: 1.75rem !important; }
                        .text-2xl { font-size: 1.5rem !important; line-height: 2rem !important; }
                        .text-lg { font-size: 1.125rem !important; line-height: 1.75rem !important; }
                        
                        .font-semibold { font-weight: 600 !important; }
                        .font-bold { font-weight: 700 !important; }
                        
                        .text-left { text-align: left !important; }
                        .text-right { text-align: right !important; }
                        .text-center { text-align: center !important; }
                        
                        .flex-row { flex-direction: row !important; }
                        .gap-9 { gap: 2.25rem !important; }
                        
                        .border-collapse { border-collapse: collapse !important; }
                        .border { border-width: 1px !important; }
                        .border-x-0 { border-left-width: 0 !important; border-right-width: 0 !important; }
                        
                        .w-\\[50px\\] { width: 50px !important; }
                        .w-\\[60px\\] { width: 60px !important; }
                        .w-\\[80px\\] { width: 80px !important; }
                        .w-\\[100px\\] { width: 100px !important; }
                        .w-\\[120px\\] { width: 120px !important; }
                        .w-\\[200px\\] { width: 200px !important; }
                        .w-\\[250px\\] { width: 250px !important; }
                        .w-\\[600px\\] { width: 600px !important; }
                        .h-\\[400px\\] { height: 400px !important; }
                        .p-1 { padding: 0.25rem !important; }
                        .p-2 { padding: 0.5rem !important; }
                        .align-top { vertical-align: top !important; }
                        
                        .object-contain { object-fit: contain !important; }
                        .rounded-lg { border-radius: 0.5rem !important; }
                        
                        .no-print { display: none !important; }
                        
                        strong { font-weight: bold !important; }
                        
                        hr { 
                            border: none !important; 
                            border-top: 1px solid !important; 
                        }
                    }
                `,
                }}
            />

            <div className="mx-auto my-8 max-w-4xl p-4">
                {/* Note สำหรับผู้ใช้ - แสดงด้านซ้ายของกระดาษ */}
                <div className="no-print fixed left-4 top-20 w-64 rounded-lg border-2 border-yellow-500 bg-yellow-50 p-4 shadow-lg">
                    <div className="flex items-start">
                        <div className="mr-2 text-2xl">⚠️</div>
                        <div className="text-sm text-gray-800">
                            <p className="mb-2 font-bold text-yellow-800">
                                {t('หมายเหตุสำคัญ:')}
                            </p>
                            <p className="leading-relaxed">
                                {t('นี่เป็นเพียงการประเมินจำนวนและราคาของอุปกรณ์จากโปรแกรม ซึ่งอาจมีความคลาดเคลื่อนจากหน้างานจริง กรุณาติดต่อทีมผู้เชี่ยวชาญของบริษัทเพื่อตรวจสอบจากหน้างานจริงอีกครั้ง')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Debug info */}
                <div className="no-print fixed bottom-4 left-4 rounded bg-gray-900 p-2 text-xs text-white">
                    <div>Items: {items.length}</div>
                    <div>Has image page: {hasProjectImagePage ? 'Yes' : 'No'}</div>
                    <div>
                        Page: {currentPage}/{totalPages}
                    </div>
                    <div>
                        Items on this page: {isImagePage ? 0 : getItemsForPage(currentPage).length}
                    </div>
                    <div>Editing: {isEditing ? 'Yes' : 'No'}</div>
                </div>

                {isEditing && (
                    <div className="no-print fixed left-1/2 top-16 z-50 max-w-md -translate-x-1/2 transform rounded border border-yellow-400 bg-yellow-100 px-4 py-3 text-yellow-700 shadow-lg">
                        <div className="flex">
                            <div className="py-1">
                                <svg
                                    className="mr-4 h-6 w-6 fill-current text-yellow-500"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-bold">{t('หมายเหตุ:')}</p>
                                <p className="text-sm">
                                    {t('รายการที่เพิ่มใหม่จะหายไปเมื่อรีเฟรชหน้า')}
                                    {t('เนื่องจากข้อจำกัดของระบบ')}{' '}
                                    {t('กรุณาพิมพ์หรือบันทึกก่อนออกจากหน้านี้')}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="no-print fixed left-0 right-0 top-0 z-50 flex justify-between bg-gray-900 px-8 py-4">
                    <div className="flex space-x-2">
                        <button
                            onClick={onClose}
                            className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
                        >
                            {t('ปิด')}
                        </button>
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={`rounded px-4 py-2 text-white ${
                                isEditing
                                    ? 'bg-green-500 hover:bg-green-600'
                                    : 'bg-yellow-500 hover:bg-yellow-600'
                            }`}
                        >
                            {isEditing ? t('เสร็จสิ้น') : t('แก้ไข')}
                        </button>
                        {isEditing && !isImagePage && (
                            <>
                                <button
                                    onClick={addNewItem}
                                    className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                                >
                                    {t('เพิ่มรายการ')}
                                </button>
                                <button
                                    onClick={() => setShowEquipmentSelector(true)}
                                    className="rounded bg-purple-500 px-4 py-2 text-white hover:bg-purple-600"
                                >
                                    {t('เลือกจากฐานข้อมูล')}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex items-center space-x-4">
                        {totalPages > 1 && (
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                        disabled={currentPage === 1}
                                        className="rounded bg-gray-600 px-3 py-1 text-white disabled:opacity-50"
                                    >
                                        ← {t('ก่อนหน้า')}
                                    </button>

                                    {/* แสดงข้อมูลหน้าปัจจุบันให้ชัดเจน */}
                                    <div className="text-center text-white">
                                        <div className="text-sm">
                                            {t('หน้า')} {currentPage} / {totalPages}
                                        </div>
                                        <div className="text-xs text-gray-300">
                                            {isImagePage && '📷 ' + t('แผนผัง')}
                                            {!isImagePage &&
                                                hasProjectImagePage &&
                                                '📋 ' + t('อุปกรณ์')}
                                            {!isImagePage &&
                                                !hasProjectImagePage &&
                                                '📋 ' + t('รายการ')}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() =>
                                            setCurrentPage(Math.min(totalPages, currentPage + 1))
                                        }
                                        disabled={currentPage === totalPages}
                                        className="rounded bg-gray-600 px-3 py-1 text-white disabled:opacity-50"
                                    >
                                        {t('ถัดไป')} →
                                    </button>
                                </div>

                                {/* เพิ่มปุ่มข้ามไปหน้าอุปกรณ์โดยตรง */}
                                {hasProjectImagePage && isImagePage && totalPages > 1 && (
                                    <button
                                        onClick={() => setCurrentPage(2)}
                                        className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                                    >
                                        📋 {t('ดูรายการอุปกรณ์')}
                                    </button>
                                )}

                                {/* เพิ่มปุ่มกลับไปหน้าแผนผัง */}
                                {hasProjectImagePage && !isImagePage && (
                                    <button
                                        onClick={() => setCurrentPage(1)}
                                        className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                                    >
                                        📷 {t('ดูแผนผัง')}
                                    </button>
                                )}
                            </div>
                        )}

                        {!isEditing && (
                            <button
                                onClick={handlePrint}
                                className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                            >
                                {t('พิมพ์')}
                            </button>
                        )}
                    </div>
                </div>

                {showEquipmentSelector && <EquipmentSelector />}

                {isImagePage ? (
                    renderProjectImagePage()
                ) : items.length === 0 ? (
                    <div className="mx-auto flex h-[1123px] w-[794px] flex-col bg-white p-8 text-black shadow-lg">
                        <div className="print-page flex min-h-full flex-col">
                            {/* header */}
                            {renderHeader()}

                            <div className="flex flex-1 items-center justify-center">
                                <div className="text-center">
                                    <div className="mb-4 text-6xl text-gray-400">📋</div>
                                    <h2 className="mb-2 text-xl font-bold text-gray-600">
                                        {t('ไม่พบรายการอุปกรณ์')}
                                    </h2>
                                    <p className="text-gray-500">
                                        {t('กรุณาเลือกสปริงเกอร์และอุปกรณ์อื่นๆ ก่อนออกใบเสนอราคา')}
                                    </p>
                                    {hasProjectImagePage && (
                                        <button
                                            onClick={() => setCurrentPage(1)}
                                            className="no-print mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                                        >
                                            📷 {t('ดูแผนผังโปรเจค')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* footer */}
                            {renderFooter(currentPage)}
                        </div>
                    </div>
                ) : currentPage === totalPages && hasSummaryPage ? (
                    /* หน้าสุดท้าย: สรุปผลการคำนวณ — แสดงเฉพาะโลโก้ ไม่แสดงที่อยู่บริษัท */
                    <div className="mx-auto flex h-[1123px] w-[794px] flex-col bg-white p-8 text-black shadow-lg">
                        <div className="print-page flex min-h-full flex-col">
                            <div className="print-header mb-4 flex items-center justify-between">
                                <div className="flex items-center">
                                    <img
                                        src="https://f.btwcdn.com/store-50036/store/e4c1b5ae-cf8e-5017-536b-66ecd994018d.jpg"
                                        alt="logo"
                                        className="print-logo h-10 w-10"
                                    />
                                </div>
                            </div>

                            {currentPage === totalPages && results && (
                                <div className="mt-2 flex-1 bg-white text-black print:bg-white print:text-black">
                                    <h3 className="mb-3 text-base font-bold">
                                        {t('สรุปผลการคำนวณ')}
                                    </h3>

                                    {(projectData?.selectedPlantType?.name ||
                                        projectData?.zones?.[0]?.plantData?.name ||
                                        (zoneInputs && Object.keys(zoneInputs).length > 0)) && (
                                        <div className="mb-3 text-sm">
                                            <p className="font-bold">
                                                {t('1. ข้อมูลพืชและความต้องการน้ำ')}
                                            </p>
                                            <p className="ml-2">
                                                {t('ชื่อพืช')}:{' '}
                                                {(projectData?.selectedPlantType as any)?.name ||
                                                    (projectData?.zones as any[])?.[0]?.plantData
                                                        ?.name ||
                                                    (fieldCropData?.zones as any)?.info?.[0]
                                                        ?.cropType ||
                                                    (greenhouseData?.plots as any[])?.[0]
                                                        ?.cropType ||
                                                    '-'}
                                            </p>
                                            {((projectData?.zones as any[])?.[0]?.plantData ||
                                                (projectData?.selectedPlantType as any)) && (
                                                <p className="ml-2">
                                                    {t('ระยะการปลูก')}:{' '}
                                                    {[
                                                        (projectData?.zones as any[])?.[0]
                                                            ?.plantData?.plantSpacing ||
                                                            (projectData?.selectedPlantType as any)
                                                                ?.plantSpacing,
                                                        (projectData?.zones as any[])?.[0]
                                                            ?.plantData?.rowSpacing ||
                                                            (projectData?.selectedPlantType as any)
                                                                ?.rowSpacing,
                                                    ]
                                                        .filter((v) => v != null && v !== undefined)
                                                        .join(' × ') || '-'}{' '}
                                                    {t('ม.')}
                                                </p>
                                            )}
                                            {zoneInputs &&
                                                Object.keys(zoneInputs).length > 0 && (
                                                    <p className="ml-2">
                                                        {t('ความต้องการน้ำของพืชต่อการรด 1 ครั้ง')}:{' '}
                                                        {projectMode === 'horticulture'
                                                            ? (() => {
                                                                  const horticultureData = loadProjectData();
                                                                  if (horticultureData?.plants?.length) {
                                                                      const summary = calculateProjectSummary(horticultureData);
                                                                      return formatWaterVolume(summary.totalWaterNeedPerSession);
                                                                  }
                                                                  const first = (zoneInputs as any)[Object.keys(zoneInputs)[0]];
                                                                  const w = first?.waterPerTreeLiters ?? 0;
                                                                  const min = first?.irrigationTimeMinutes ?? 1;
                                                                  const perIrrigation = Number(w) * Number(min);
                                                                  return `${Number(w).toFixed(2)} ${t('ลิตร/นาที/ต้น')} × ${min} ${t('นาที')} = ${perIrrigation.toFixed(2)} ${t('ลิตร/ต้น/ครั้ง')}`;
                                                              })()
                                                            : (() => {
                                                                  const first = (zoneInputs as any)[Object.keys(zoneInputs)[0]];
                                                                  const w = first?.waterPerTreeLiters ?? 0;
                                                                  const min = first?.irrigationTimeMinutes ?? 1;
                                                                  const perIrrigation = Number(w) * Number(min);
                                                                  return `${Number(w).toFixed(2)} ${t('ลิตร/นาที/ต้น')} × ${min} ${t('นาที')} = ${perIrrigation.toFixed(2)} ${t('ลิตร/ต้น/ครั้ง')}`;
                                                              })()}
                                                    </p>
                                                )}
                                        </div>
                                    )}

                                    {zoneInputs && Object.keys(zoneInputs).length > 0 && (
                                        <div className="mb-3 text-sm">
                                            <p className="font-bold">
                                                {t('2. พื้นที่และโซน')}
                                            </p>
                                            <p className="ml-2">
                                                {t('พื้นที่ทั้งหมด')}:{' '}
                                                {Object.values(zoneInputs)
                                                    .reduce(
                                                        (sum: number, inp: any) =>
                                                            sum + (Number(inp?.farmSizeRai) || 0),
                                                        0
                                                    )
                                                    .toFixed(2)}{' '}
                                                {t('ไร่')}
                                            </p>
                                            <p className="ml-2">
                                                {t('ต้นไม้ทั้งหมด')}:{' '}
                                                {Object.values(zoneInputs).reduce(
                                                    (sum: number, inp: any) =>
                                                        sum + (Number(inp?.totalTrees) || 0),
                                                    0
                                                )}{' '}
                                                {t('ต้น')}
                                            </p>
                                            <p className="ml-2">
                                                {t('แบ่งออกเป็น')}{' '}
                                                {Object.keys(zoneInputs).length}{' '}
                                                {t('โซน')}
                                            </p>
                                        </div>
                                    )}

                                    {(() => {
                                        const hasZoneResults = (results.allZoneResults?.length ?? 0) > 0;
                                        const hasZoneInputs = zoneInputs && Object.keys(zoneInputs).length > 0;
                                        const horticultureProjectData = projectMode === 'horticulture' ? loadProjectData() : null;
                                        const horticultureSummary =
                                            projectMode === 'horticulture' && horticultureProjectData
                                                ? calculateProjectSummary(horticultureProjectData)
                                                : null;
                                        const horticultureZoneDetails = (horticultureSummary?.zoneDetails ?? []) as any[];
                                        const { byId: horticultureSystemZonesById, byIndex: horticultureSystemZonesByIndex } =
                                            horticultureSystemData?.zones?.length > 0
                                                ? buildHorticultureZoneDisplayData(horticultureSystemData.zones)
                                                : getHorticultureZoneDataFromSystemStorage();
                                        const zoneIdsFromResults = (results.allZoneResults ?? []).map((z: any) => z.zoneId);
                                        const zoneIdsFromSystem = Object.keys(horticultureSystemZonesById);
                                        const zoneIdsFromProject =
                                            horticultureProjectData?.zones?.map((z: any) => z.id) ??
                                            (projectData?.zones as any[])?.map((z: any) => z.id) ??
                                            [];
                                        // โซนให้ใช้ลำดับจาก horticultureSystemData ก่อน — ให้ byIndex ตรงกับโซนจริง (แก้โซน 1 ปริมาณน้ำรวมผิด)
                                        const zoneIdList =
                                            zoneIdsFromSystem.length > 0
                                                ? zoneIdsFromSystem
                                                : zoneIdsFromResults.length > 0
                                                  ? zoneIdsFromResults
                                                  : zoneIdsFromProject.length > 0
                                                    ? zoneIdsFromProject
                                                    : hasZoneInputs
                                                      ? Object.keys(zoneInputs!)
                                                      : [];
                                        const showSection3 =
                                            zoneIdList.length > 0 &&
                                            (hasZoneResults || results.totalWaterRequiredLPM !== undefined || hasZoneInputs);
                                        if (!showSection3) return null;
                                        return (
                                            <div className="mb-3 text-sm">
                                                <p className="font-bold">{t('3. รายละเอียดแต่ละโซน')}</p>
                                                {zoneIdList.map((zoneId, zoneIndex) => {
                                                    const inp = (zoneInputs as any)?.[zoneId];
                                                    const irrigationTimeMinutes =
                                                        Number(inp?.irrigationTimeMinutes) || 45;
                                                    let rai: number;
                                                    let trees: number;
                                                    let flowLPM: number;
                                                    let totalWaterLiters: number | null = null;
                                                    if (projectMode === 'horticulture') {
                                                        const zoneDetail = horticultureZoneDetails.find(
                                                            (z: any) => z.zoneId === zoneId
                                                        );
                                                        const systemZone =
                                                            horticultureSystemZonesById[zoneId] ??
                                                            horticultureSystemZonesByIndex[zoneIndex];
                                                        const rawTotalWater =
                                                            systemZone?.waterNeedPerSession ?? zoneDetail?.waterNeedPerSession;
                                                        totalWaterLiters =
                                                            rawTotalWater != null && Number(rawTotalWater) >= 0
                                                                ? Number(rawTotalWater)
                                                                : null;
                                                        rai =
                                                            (systemZone?.areaInRai != null && systemZone.areaInRai >= 0
                                                                ? systemZone.areaInRai
                                                                : zoneDetail?.areaInRai != null && zoneDetail.areaInRai > 0
                                                                  ? zoneDetail.areaInRai
                                                                  : (() => {
                                                                        const zoneData = getZoneAreaDataForZone(
                                                                            zoneId,
                                                                            projectData
                                                                        );
                                                                        if (zoneData?.areaInRai != null && zoneData.areaInRai >= 0)
                                                                            return zoneData.areaInRai;
                                                                        return Number(inp?.farmSizeRai) || 0;
                                                                    })());
                                                        trees =
                                                            (systemZone?.plantCount != null
                                                                ? systemZone.plantCount
                                                                : zoneDetail?.plantCount != null
                                                                  ? zoneDetail.plantCount
                                                                  : (() => {
                                                                        const zoneData = getZoneAreaDataForZone(
                                                                            zoneId,
                                                                            projectData
                                                                        );
                                                                        if (zoneData?.plantCount != null) return zoneData.plantCount;
                                                                        return Number(inp?.totalTrees) || 0;
                                                                    })());
                                                        const zoneResultFlow = (results.allZoneResults ?? []).find(
                                                            (z: any) => z.zoneId === zoneId
                                                        )?.totalFlowLPM;
                                                        flowLPM =
                                                            typeof zoneResultFlow === 'number' && zoneResultFlow >= 0
                                                                ? zoneResultFlow
                                                                : (systemZone?.waterNeedPerMinute != null && systemZone.waterNeedPerMinute >= 0
                                                                      ? systemZone.waterNeedPerMinute
                                                                      : (() => {
                                                                            const zoneData = getZoneAreaDataForZone(
                                                                                zoneId,
                                                                                projectData
                                                                            );
                                                                            if (
                                                                                zoneData?.waterNeedPerMinute != null &&
                                                                                zoneData.waterNeedPerMinute >= 0
                                                                            )
                                                                                return zoneData.waterNeedPerMinute;
                                                                            return Number(inp?.waterPerTreeLiters) || 0;
                                                                        })());
                                                    } else {
                                                        rai = Number(inp?.farmSizeRai) || 0;
                                                        trees = Number(inp?.totalTrees) || 0;
                                                        const waterPerTreeLiters = Number(inp?.waterPerTreeLiters) || 0;
                                                        if (projectMode === 'field-crop') {
                                                            flowLPM = trees * waterPerTreeLiters;
                                                        } else if (
                                                            projectMode === 'greenhouse' ||
                                                            projectMode === 'garden'
                                                        ) {
                                                            flowLPM = trees * (waterPerTreeLiters / irrigationTimeMinutes);
                                                        } else {
                                                            flowLPM = waterPerTreeLiters;
                                                        }
                                                    }
                                                    const zoneResult = (results.allZoneResults ?? []).find(
                                                        (z: any) => z.zoneId === zoneId
                                                    );
                                                    const systemZoneForFlow =
                                                        projectMode === 'horticulture'
                                                            ? (horticultureSystemZonesById[zoneId] ??
                                                                horticultureSystemZonesByIndex[zoneIndex])
                                                            : null;
                                                    const displayFlowLPM =
                                                        systemZoneForFlow?.waterNeedPerMinute != null &&
                                                        systemZoneForFlow.waterNeedPerMinute >= 0
                                                            ? systemZoneForFlow.waterNeedPerMinute
                                                            : (zoneResult?.totalFlowLPM ?? flowLPM);
                                                    const displayTimeMinutes =
                                                        projectMode === 'horticulture' &&
                                                        totalWaterLiters != null &&
                                                        totalWaterLiters >= 0 &&
                                                        displayFlowLPM > 0
                                                            ? totalWaterLiters / displayFlowLPM
                                                            : null;
                                                    const quantityLabel =
                                                        projectMode === 'greenhouse' ||
                                                        projectMode === 'garden' ||
                                                        projectMode === 'field-crop'
                                                            ? t('หัวฉีด')
                                                            : t('ต้น');
                                                    return (
                                                        <p key={zoneId} className="ml-2">
                                                            {getZoneDisplayName(zoneId)}: {rai.toFixed(2)}{' '}
                                                            {t('ไร่')}, {trees.toLocaleString()} {quantityLabel}
                                                            {totalWaterLiters != null && (
                                                                <>
                                                                    , {formatWaterVolume(totalWaterLiters)}{' '}
                                                                    {t('ปริมาณน้ำรวม')}
                                                                </>
                                                            )}
                                                            , {displayFlowLPM.toFixed(0)} {t('ลิตร/นาที')},{' '}
                                                            {t('เวลารด')}{' '}
                                                            {displayTimeMinutes != null
                                                                ? `${displayTimeMinutes.toFixed(1)}`
                                                                : irrigationTimeMinutes}{' '}
                                                            {t('นาที')}
                                                        </p>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    {(selectedSprinkler ||
                                        (zoneSprinklers &&
                                            Object.keys(zoneSprinklers).length > 0)) && (
                                        <div className="mb-3 text-sm">
                                            <p className="font-bold">
                                                {t('4. สเปกหัวฉีดที่เลือก')}
                                            </p>
                                            {(() => {
                                                const zones = zoneSprinklers || {};
                                                const byId = new Map<number | string, any>();
                                                Object.values(zones).forEach((s) => {
                                                    if (s) {
                                                        const key =
                                                            (s as any).id ??
                                                            (s as any).productCode ??
                                                            (s as any).product_code ??
                                                            `name-${(s as any).name ?? ''}-${(s as any).brand ?? ''}`;
                                                        if (!byId.has(key)) byId.set(key, s);
                                                    }
                                                });
                                                if (byId.size === 0 && selectedSprinkler) {
                                                    const s = selectedSprinkler;
                                                    const key =
                                                        (s as any).id ??
                                                        (s as any).productCode ??
                                                        (s as any).product_code ??
                                                        `name-${(s as any).name ?? ''}-${(s as any).brand ?? ''}`;
                                                    byId.set(key, s);
                                                }
                                                const uniqueList = Array.from(byId.values());
                                                if (uniqueList.length === 0) return null;
                                                return (
                                                    <div className="ml-2 space-y-1">
                                                        {uniqueList.map((spr: any, idx: number) => {
                                                            const name =
                                                                spr.name ||
                                                                spr.productCode ||
                                                                spr.product_code ||
                                                                '-';
                                                            const brand =
                                                                spr.brand ||
                                                                spr.brand_name ||
                                                                '-';
                                                            const pressureStr = formatRangeValue(
                                                                spr.pressureBar ?? spr.pressure_bar
                                                            );
                                                            const flowStr = formatRangeValue(
                                                                spr.waterVolumeLitersPerMinute ??
                                                                spr.water_volume_liters_per_minute
                                                            );
                                                            const radiusStr = formatRangeValue(
                                                                spr.radiusMeters ?? spr.radius_meters
                                                            );
                                                            return (
                                                                <p key={idx}>
                                                                    {name} ({brand}) — {t('แรงดัน')}{' '}
                                                                    {pressureStr} {t('บาร์')}, {t('อัตราไหล')}{' '}
                                                                    {flowStr} LPM, {t('รัศมี')} {radiusStr}{' '}
                                                                    {t('เมตร')}
                                                                </p>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {showPump && results && (
                                        <div className="mb-3 text-sm">
                                            <p className="font-bold">
                                                {t('5. การคำนวณ TDH สำหรับปั๊มน้ำ')}
                                            </p>
                                            {(() => {
                                                const allZones = results.allZoneResults || [];
                                                const criticalZoneResult =
                                                    allZones.length > 0
                                                        ? allZones.reduce((a: any, b: any) =>
                                                              (a?.totalHead ?? 0) >=
                                                              (b?.totalHead ?? 0)
                                                                  ? a
                                                                  : b
                                                          )
                                                        : null;
                                                const maxFrictionTotal =
                                                    allZones.length > 0
                                                        ? Math.max(
                                                              ...allZones.map(
                                                                  (z: any) =>
                                                                      z?.headLoss?.total ?? 0
                                                              )
                                                          )
                                                        : 0;
                                                const staticHeadM =
                                                    criticalZoneResult?.staticHead != null
                                                        ? criticalZoneResult.staticHead
                                                        : getStoredStaticHeadM();
                                                const pressureHeadM = getPressureHeadM();
                                                /* TDH = ค่าเดียวกับ PumpSelector.tsx (maxPumpHeadWithSafety) ลำดับที่มา:
                                                   1. maxPumpHeadForProjectMode (prop จาก product - เหมือนที่ส่งไป PumpSelector)
                                                   2. max(allZoneResults.totalHead) * 1.1
                                                   3. results.pumpHeadRequired * 1.1 (fallback) */
                                                const tdhValue =
                                                    maxPumpHeadForProjectModeProp !== undefined &&
                                                    maxPumpHeadForProjectModeProp > 0
                                                        ? maxPumpHeadForProjectModeProp
                                                        : results.allZoneResults?.length
                                                          ? (() => {
                                                                const maxHead = Math.max(
                                                                    ...results.allZoneResults!.map(
                                                                        (z: any) => z.totalHead || 0
                                                                    )
                                                                );
                                                                return maxHead > 0
                                                                    ? maxHead + maxHead * 0.1
                                                                    : (results.pumpHeadRequired ?? 0) * 1.1;
                                                            })()
                                                          : (results.pumpHeadRequired ?? 0) * 1.1;
                                                const pumpHead = tdhValue;
                                                const pumpFlow = getDisplayFlowLPM();
                                                const requiredHorsepower =
                                                    pumpFlow > 0 && pumpHead > 0
                                                        ? Math.ceil(
                                                              (pumpFlow * pumpHead) /
                                                                  (4500 * 0.6)
                                                          )
                                                        : 0;
                                                return (
                                                    <>
                                                        <p className="ml-2">
                                                            {t('Static Head')} ({t('ความสูงจากปั๊มไปหัวฉีดที่สูงที่สุด')}):{' '}
                                                            {staticHeadM.toFixed(2)} m
                                                        </p>
                                                        <p className="ml-2 font-medium">
                                                            {t('Friction Head')} ({t('การสูญเสียจากแรงเสียดทาน')})
                                                        </p>
                                                        {allZones.length > 0 ? (
                                                            (() => {
                                                                const perZoneStored = projectMode === 'horticulture' ? getStoredPipeHeadLossPerZone() : {};
                                                                const zoneRows = allZones.map((z: any) => {
                                                                    const zoneId = z?.zoneId ?? '';
                                                                    const stored = perZoneStored[zoneId];
                                                                    const hl = z?.headLoss;
                                                                    const branch = stored
                                                                        ? stored.branch
                                                                        : typeof hl?.branch === 'number'
                                                                          ? hl.branch
                                                                          : 0;
                                                                    const secondary = stored
                                                                        ? stored.secondary
                                                                        : typeof hl?.secondary === 'number'
                                                                          ? hl.secondary
                                                                          : 0;
                                                                    const main = stored
                                                                        ? stored.main
                                                                        : typeof hl?.main === 'number'
                                                                          ? hl.main
                                                                          : 0;
                                                                    const emitter = stored
                                                                        ? stored.emitter
                                                                        : typeof (hl as any)?.emitter === 'number'
                                                                          ? (hl as any).emitter
                                                                          : 0;
                                                                    const total = stored
                                                                        ? stored.total
                                                                        : typeof hl?.total === 'number'
                                                                          ? hl.total
                                                                          : branch + secondary + main + emitter;
                                                                    return { z, zoneId, branch, secondary, main, emitter, total };
                                                                });
                                                                const maxFrictionTotalDisplay = zoneRows.length > 0
                                                                    ? Math.max(...zoneRows.map((r) => r.total))
                                                                    : 0;
                                                                return zoneRows.map(({ z, zoneId, branch, secondary, main, emitter, total }) => {
                                                                    const zoneName = getZoneDisplayName(z?.zoneId ?? '');
                                                                    const isMaxLoss = total >= maxFrictionTotalDisplay && maxFrictionTotalDisplay > 0;
                                                                    return (
                                                                        <p
                                                                            key={zoneId || zoneName}
                                                                            className="ml-4 text-sm"
                                                                        >
                                                                            {zoneName}
                                                                            {isMaxLoss && (
                                                                                <span className="text-amber-400">
                                                                                    {' '}
                                                                                    ({t('โซนที่ loss สูงสุด')})
                                                                                </span>
                                                                            )}
                                                                            : {t('ท่อย่อย')}{' '}
                                                                            {branch.toFixed(2)} m,{' '}
                                                                            {t('ท่อเมนรอง')}{' '}
                                                                            {secondary.toFixed(2)} m,{' '}
                                                                            {t('ท่อเมน')}{' '}
                                                                            {main.toFixed(2)} m
                                                                            {emitter > 0 &&
                                                                                `, ${t('ท่ออีมิเตอร์')} ${emitter.toFixed(2)} m`}{' '}
                                                                            — {t('รวม')}{' '}
                                                                            {total.toFixed(2)} m
                                                                        </p>
                                                                    );
                                                                });
                                                            })()
                                                        ) : (
                                                            <p className="ml-4 text-sm text-gray-500">
                                                                {t('ไม่มีข้อมูล loss ต่อโซน')} —{' '}
                                                                {t('ท่อย่อย')}{' '}
                                                                {getStoredPipeHeadLoss().branch.toFixed(2)} m,{' '}
                                                                {t('ท่อเมนรอง')}{' '}
                                                                {getStoredPipeHeadLoss().secondary.toFixed(2)} m,{' '}
                                                                {t('ท่อเมน')}{' '}
                                                                {getStoredPipeHeadLoss().main.toFixed(2)} m —{' '}
                                                                {t('รวม')}{' '}
                                                                {getStoredPipeHeadLoss().total.toFixed(2)} m (
                                                                {t('ค่าจากการบันทึก')})
                                                            </p>
                                                        )}
                                                        <p className="ml-2">
                                                            {t('Pressure Head')} ({t('แรงดันสปริงเกอร์')} bar×10):{' '}
                                                            {pressureHeadM.toFixed(2)} m
                                                        </p>
                                                        <p className="ml-2 font-bold">
                                                            {t('TDH')} ({t('รวม')} + 10%):{' '}
                                                            {pumpHead.toFixed(1)} {t('เมตร')}
                                                        </p>
                                                        <p className="ml-2 font-bold">
                                                            {t('สรุป')}: {t('ต้องใช้ปั๊มน้ำ')} —{' '}
                                                            {t('อัตราการไหล')}{' '}
                                                            {Number(Number(pumpFlow).toFixed(2)).toLocaleString()} {t('LPM')},{' '}
                                                            {t('Pump Head')} {pumpHead.toFixed(1)}{' '}
                                                            {t('เมตร')}
                                                            {requiredHorsepower > 0 && (
                                                                <>
                                                                    , {t('ต้องการปั๊มอย่างน้อย')}{' '}
                                                                    {requiredHorsepower} {t('HP')}
                                                                </>
                                                            )}
                                                        </p>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {(selectedBranchPipe ||
                                        selectedSecondaryPipe ||
                                        selectedMainPipe ||
                                        results.autoSelectedBranchPipe ||
                                        results.autoSelectedSecondaryPipe ||
                                        results.autoSelectedMainPipe) && (
                                        <div className="mb-3 text-sm">
                                            <p className="font-bold">
                                                {t('6. ท่อที่เลือก')}
                                            </p>
                                            {[
                                                {
                                                    label: t('ท่อย่อย'),
                                                    pipe:
                                                        selectedBranchPipe ||
                                                        results.autoSelectedBranchPipe,
                                                },
                                                {
                                                    label: t('ท่อเมนรอง'),
                                                    pipe:
                                                        selectedSecondaryPipe ||
                                                        results.autoSelectedSecondaryPipe,
                                                },
                                                {
                                                    label: t('ท่อเมน'),
                                                    pipe:
                                                        selectedMainPipe ||
                                                        results.autoSelectedMainPipe,
                                                },
                                            ].map(
                                                (item) =>
                                                    item.pipe && (
                                                        <p key={item.label} className="ml-2">
                                                            {item.label}:{' '}
                                                            {(item.pipe as any).productCode ||
                                                                (item.pipe as any).product_code}{' '}
                                                            {(item.pipe as any).pipeType || ''}{' '}
                                                            {(item.pipe as any).sizeMM ||
                                                                (item.pipe as any).size_mm ||
                                                                ''}
                                                            mm,{' '}
                                                            {(item.pipe as any).lengthM ||
                                                                (item.pipe as any).length_m ||
                                                                ''}{' '}
                                                            m/{t('ม้วน')}
                                                        </p>
                                                    )
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="print-footer-container mt-auto text-center text-xs">
                                <hr className="print-footer-hr mb-2 border-gray-800" />
                                <div className="print-footer">
                                    <p>
                                        {t('Page:')} {currentPage} / {totalPages}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mx-auto flex h-[1123px] w-[794px] flex-col bg-white p-8 text-black shadow-lg">
                        <div className="print-page flex min-h-full flex-col">
                            <div className="print-header mb-2 flex items-center justify-between">
                                <div className="flex items-center">
                                    <img
                                        src="https://f.btwcdn.com/store-50036/store/e4c1b5ae-cf8e-5017-536b-66ecd994018d.jpg"
                                        alt="logo"
                                        className="print-logo h-10 w-10"
                                    />
                                </div>
                            </div>
                            <hr className="print-hr mb-4 border-gray-800" />
                            <div className="print-company-info mb-4 self-start text-sm">
                                <p className="font-semibold">
                                    {t('บจก. กนกโปรดักส์ (สำนักงานใหญ่)')}
                                </p>
                                <p>{t('15 ซ. พระยามนธาตุ แยก 10')}</p>
                                <p>{t('แขวงคลองบางบอน เขตบางบอน')}</p>
                                <p>{t('กรุงเทพมหานคร 10150')}</p>
                            </div>

                            {currentPage === 1 + imagePageOffset && (
                                <>
                                    {renderCustomerInfo()}
                                    {renderQuotationDetails()}
                                </>
                            )}

                            <table className="print-table w-full border-collapse border border-gray-400 text-xs">
                                {renderTableHeader()}
                                <tbody>
                                    {getItemsForPage(currentPage).map((item, index) =>
                                        renderTableRow(item, index)
                                    )}
                                </tbody>
                            </table>

                            <div className="mt-4 flex justify-end">
                                {currentPage === totalPagesForItems && (
                                    <>
                                        <table className="w-[250px] border-collapse border-gray-400 text-sm">
                                            <tbody>
                                                <tr className="border-gray-400">
                                                    <td className="border border-x-0 border-gray-400 p-1 text-left align-top font-bold">
                                                        {t('Subtotal')}
                                                    </td>
                                                    <td className="w-[100px] border border-x-0 border-gray-400 p-1 text-right align-top">
                                                        {calculateTotal().toFixed(2)} {t('฿')}
                                                    </td>
                                                </tr>
                                                <tr className="border-gray-400">
                                                    <td className="border border-x-0 border-gray-400 p-1 text-left align-top font-bold">
                                                        {t('Vat 7%')}
                                                    </td>
                                                    <td className="w-[100px] border border-x-0 border-gray-400 p-1 text-right align-top">
                                                        {(calculateTotal() * 0.07).toFixed(2)} {t('฿')}
                                                    </td>
                                                </tr>
                                                <tr className="border-gray-400">
                                                    <td className="border border-x-0 border-gray-400 p-1 text-left align-top font-bold">
                                                        {t('Subtotal Without Discount')}
                                                    </td>
                                                    <td className="w-[100px] border border-x-0 border-gray-400 p-1 text-right align-top">
                                                        {(calculateTotal() * 1.07).toFixed(2)} {t('฿')}
                                                    </td>
                                                </tr>
                                                <tr className="border-gray-400">
                                                    <td className="border border-x-0 border-gray-400 p-1 text-left align-top font-bold">
                                                        {t('Discount Subtotal')}
                                                    </td>
                                                    <td className="w-[100px] border border-x-0 border-gray-400 p-1 text-right align-top">
                                                        0.00 {t('฿')}
                                                    </td>
                                                </tr>
                                                <tr className="border-gray-400">
                                                    <td className="border border-x-0 border-gray-400 p-1 text-left align-top font-bold">
                                                        {t('Total')}
                                                    </td>
                                                    <td className="w-[100px] border border-x-0 border-gray-400 p-1 text-right align-top">
                                                        {(calculateTotal() * 1.07).toFixed(2)} {t('฿')}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </>
                                )}
                            </div>

                            <div className="print-footer-container mt-auto text-center text-xs">
                                <hr className="print-footer-hr mb-2 border-gray-800" />
                                <div className="print-footer">
                                    <p>
                                        {t('Phone:')} 02-451-1111 {t('Tax ID:')} 0105549044446
                                    </p>
                                    <p>
                                        {t('Page:')} {currentPage} / {totalPages}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuotationDocument;
