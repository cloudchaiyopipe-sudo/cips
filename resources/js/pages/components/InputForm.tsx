/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    IrrigationInput,
    ProjectMode,
    SprinklerSetGroup,
    SprinklerSetItem,
} from '../types/interfaces';
import { formatNumber } from '../utils/calculations';
import { Zone, PlantData } from '../../utils/horticultureUtils';
import {
    getLongestBranchPipeStats,
    getSubMainPipeBranchCount,
    getDetailedBranchPipeStats,
} from '../../utils/horticultureProjectStats';
import { useCalculations } from '../hooks/useCalculations';
import { useLanguage } from '@/contexts/LanguageContext';
import SearchableDropdown from './SearchableDropdown';
import { ConnectionPointStats } from '../../utils/horticultureProjectStats';

interface InputFormProps {
    input: IrrigationInput;
    onInputChange: (input: IrrigationInput) => void;
    selectedSprinkler?: any;
    activeZone?: Zone;
    projectMode?: ProjectMode;
    maxZones?: number;
    zoneAreaData?: {
        zoneId: string;
        zoneName: string;
        areaInRai: number;
        coordinates?: { lat: number; lng: number }[];
    };
    connectionStats?: ConnectionPointStats[];
    onConnectionEquipmentsChange?: (equipments: ConnectionPointEquipment[]) => void;
    greenhouseData?: any; // เพิ่มสำหรับ greenhouse projectMode
    fieldCropSystemData?: any; // เพิ่มสำหรับ field-crop projectMode
}

interface BranchPipeStats {
    longestBranchPlantCount: number;
    longestBranchLength: number;
    maxBranchesPerSubMain: number;
    totalSubMainPipes: number;
    zoneName: string;
}

interface SprinklerPressureInfo {
    pressureBar: number;
    pressureM: number;
    range: string;
    sprinklerName: string;
}

interface PlantDataWithCategory extends PlantData {
    category?: string;
}

const hasCategory = (plantData: PlantData): plantData is PlantDataWithCategory => {
    return 'category' in plantData;
};

// Interface สำหรับอุปกรณ์จุดเชื่อมต่อ
interface ConnectionPointEquipment {
    zoneId: string;
    zoneName: string;
    connectionType:
        | 'mainToSubMain'
        | 'subMainToMainMid'
        | 'subMainToLateral'
        | 'subMainToMainIntersection'
        | 'lateralToSubMainIntersection';
    connectionTypeName: string;
    color: string;
    count: number;
    category: 'agricultural_fittings' | 'pvc_fittings' | null;
    equipment: any | null;
}

// Interface สำหรับหมวดหมู่อุปกรณ์
interface EquipmentCategory {
    id: number;
    name: string;
    display_name: string;
    description: string;
    icon: string;
}

const InputForm: React.FC<InputFormProps> = ({
    input,
    onInputChange,
    selectedSprinkler,
    activeZone,
    projectMode = 'horticulture' as ProjectMode,
    zoneAreaData,
    connectionStats = [],
    onConnectionEquipmentsChange,
    greenhouseData,
    fieldCropSystemData,
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [validationMessages, setValidationMessages] = useState<string[]>([]);
    const [pipeData, setPipeData] = useState<any[]>([]);
    const [gardenWaterRequirement, setGardenWaterRequirement] = useState<number>(0);
    const [sprinklerGroups, setSprinklerGroups] = useState<SprinklerSetGroup[]>([]);
    const [selectedSprinklerItems, setSelectedSprinklerItems] = useState<SprinklerSetItem[]>([]);
    const [loadingSprinklerGroups, setLoadingSprinklerGroups] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [equipments, setEquipments] = useState<any[]>([]);
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [selectedEquipment, setSelectedEquipment] = useState<number | null>(null);
    const [loadingEquipments, setLoadingEquipments] = useState(false);

    // State สำหรับจัดการอุปกรณ์จุดเชื่อมต่อ
    const [connectionPointEquipments, setConnectionPointEquipments] = useState<
        ConnectionPointEquipment[]
    >([]);
    const [equipmentCategories, setEquipmentCategories] = useState<EquipmentCategory[]>([]);
    const [connectionEquipments, setConnectionEquipments] = useState<any[]>([]);
    const [loadingConnectionCategories, setLoadingConnectionCategories] = useState(false);
    const [loadingConnectionEquipments, setLoadingConnectionEquipments] = useState(false);

    const { t } = useLanguage();

    // ใช้ useRef เพื่อเก็บ reference ของ fieldCropSystemData
    const fieldCropSystemDataRef = useRef(fieldCropSystemData);
    fieldCropSystemDataRef.current = fieldCropSystemData;

    // Debug logging for field-crop mode (ใช้ useMemo เพื่อป้องกัน infinite loop)
    const fieldCropDebugInfo = useMemo(() => {
        if (projectMode === 'field-crop') {
            console.log('🔍 InputForm field-crop debug:');
            console.log('- input.totalTrees:', input.totalTrees);
            console.log('- input.waterPerTreeLiters:', input.waterPerTreeLiters);
            console.log('- activeZone:', activeZone);
            console.log('- fieldCropSystemData:', fieldCropSystemData);
        }
        return null;
    }, [projectMode, input.totalTrees, input.waterPerTreeLiters, activeZone, fieldCropSystemData]);

    // ฟังก์ชันสำหรับจัดการข้อมูล connection points
    const initializeConnectionPointEquipments = useCallback(() => {
        console.log('🔍 initializeConnectionPointEquipments called for projectMode:', projectMode);
        const activeZoneId = activeZone?.id;

        // สำหรับ field-crop mode ให้ใช้ fieldCropSystemData
        if (projectMode === 'field-crop' && fieldCropSystemDataRef.current) {
            console.log('🔍 Field-crop mode: fieldCropSystemData found');
            const equipments: ConnectionPointEquipment[] = [];

            // โหลดการเลือกอุปกรณ์ที่เก็บไว้
            const savedSelections = localStorage.getItem('connectionPointEquipmentSelections');
            const selections = savedSelections ? JSON.parse(savedSelections) : {};

            // หาโซนที่ active
            const activeZoneData = fieldCropSystemDataRef.current.zones?.find(
                (z: any) => z.id === activeZoneId
            );
            console.log('🔍 Active zone data:', activeZoneData);
            console.log('🔍 Active zone connection points:', activeZoneData?.connectionPoints);
            if (activeZoneData && activeZoneData.connectionPoints) {
                // สร้างอุปกรณ์สำหรับแต่ละประเภทจุดเชื่อมต่อ
                const connectionTypes = [
                    { key: 'junction', name: 'จุดเชื่อมต่อ', color: '#FFD700' },
                    { key: 'crossing', name: 'จุดข้ามท่อ', color: '#4CAF50' },
                    { key: 'l_shape', name: 'จุดเชื่อมต่อรูปตัว L', color: '#F44336' },
                    { key: 't_shape', name: 'จุดเชื่อมต่อรูปตัว T', color: '#2196F3' },
                    { key: 'cross_shape', name: 'จุดเชื่อมต่อรูปตัว +', color: '#9C27B0' },
                ];

                connectionTypes.forEach((type) => {
                    const pointsOfType = activeZoneData.connectionPoints.filter(
                        (cp: any) => cp.type === type.key
                    );
                    if (pointsOfType.length > 0) {
                        const equipmentId = `${activeZoneData.id}-${type.key}`;
                        const savedSelection = selections[equipmentId];

                        const equipmentData = {
                            zoneId: activeZoneData.id,
                            zoneName: activeZoneData.name,
                            connectionType: type.key as any,
                            connectionTypeName: type.name,
                            color: type.color,
                            count: pointsOfType.length,
                            category: savedSelection?.category || null,
                            equipment: savedSelection?.equipment || null,
                        };
                        equipments.push(equipmentData);
                    }
                });
            }

            console.log('🔍 Field-crop equipments created:', equipments);
            setConnectionPointEquipments(equipments);

            // Load equipment options for any category that already has selected equipment
            const categoriesToLoad = new Set<string>();
            equipments.forEach((eq) => {
                if (eq.category && eq.equipment) {
                    categoriesToLoad.add(eq.category);
                }
            });

            console.log('🔍 Categories to load for field-crop:', Array.from(categoriesToLoad));

            // Load equipment for each category that has selected equipment
            categoriesToLoad.forEach((category) => {
                fetchConnectionEquipments(category);
            });

            return;
        } else if (projectMode === 'field-crop') {
            console.log('❌ Field-crop mode but no fieldCropSystemData or no active zone');
            console.log('- fieldCropSystemDataRef.current:', fieldCropSystemDataRef.current);
            console.log('- activeZoneId:', activeZoneId);
        }

        // สำหรับ horticulture mode (เดิม)
        if (!connectionStats || connectionStats.length === 0) {
            return;
        }

        // โหลดการเลือกอุปกรณ์ที่เก็บไว้
        const savedSelections = localStorage.getItem('connectionPointEquipmentSelections');
        const selections = savedSelections ? JSON.parse(savedSelections) : {};

        const equipments: ConnectionPointEquipment[] = [];

        // กรองเฉพาะโซนที่ active
        const filteredStats = activeZoneId
            ? connectionStats.filter((zoneStats) => zoneStats.zoneId === activeZoneId)
            : connectionStats;

        filteredStats.forEach((zoneStats) => {
            // สร้างอุปกรณ์สำหรับแต่ละประเภทจุดเชื่อมต่อ (แก้ไขให้ตรงกับการแสดงผลในแผนที่)
            const connectionTypes = [
                { key: 'mainToSubMain', name: 'ปลาย-ปลาย', color: '#DC2626' }, // สีแดง - endToEndConnections
                { key: 'subMainToMainMid', name: 'ปลายเมน-ระหว่างเมนรอง', color: '#3B82F6' }, // สีน้ำเงิน - mainToSubMainConnections + subMainToMainIntersections
                { key: 'subMainToLateral', name: 'เมนรอง-กลางเมน', color: '#8B5CF6' }, // สีม่วง - midConnections
                { key: 'subMainToMainIntersection', name: 'เมนรอง-ท่อย่อย', color: '#F59E0B' }, // สีเหลือง - subMainToLateralConnections (ลบสีเขียวออกแล้ว)
                {
                    key: 'lateralToSubMainIntersection',
                    name: 'ตัดท่อย่อย-เมนรอง',
                    color: '#10B981',
                }, // สีเขียว - lateralToSubMainIntersections
            ];

            connectionTypes.forEach((type) => {
                const count = zoneStats[type.key as keyof ConnectionPointStats] as number;
                if (count > 0) {
                    const equipmentId = `${zoneStats.zoneId}-${type.key}`;
                    const savedSelection = selections[equipmentId];

                    const equipmentData = {
                        zoneId: zoneStats.zoneId,
                        zoneName: zoneStats.zoneName,
                        connectionType: type.key as any,
                        connectionTypeName: type.name,
                        color: type.color,
                        count: count,
                        category: savedSelection?.category || null,
                        equipment: savedSelection?.equipment || null,
                    };
                    equipments.push(equipmentData);
                }
            });
        });

        setConnectionPointEquipments(equipments);

        // Load equipment options for any category that already has selected equipment
        const categoriesToLoad = new Set<string>();
        equipments.forEach((eq) => {
            if (eq.category && eq.equipment) {
                categoriesToLoad.add(eq.category);
            }
        });

        // Load equipment for each category that has selected equipment
        categoriesToLoad.forEach((category) => {
            fetchConnectionEquipments(category);
        });
    }, [connectionStats, activeZone?.id, projectMode]);

    // ฟังก์ชันโหลดหมวดหมู่อุปกรณ์ connection points
    const fetchConnectionCategories = useCallback(async () => {
        setLoadingConnectionCategories(true);
        try {
            const response = await fetch('/api/equipment-categories');
            if (response.ok) {
                const categories = await response.json();
                // กรองเฉพาะหมวดหมู่ที่ต้องการ
                const filteredCategories = categories.filter(
                    (cat: any) =>
                        cat.name === 'agricultural_fittings' || cat.name === 'pvc_fittings'
                );
                setEquipmentCategories(filteredCategories);
            }
        } catch (error) {
            console.error('Error fetching connection categories:', error);
        } finally {
            setLoadingConnectionCategories(false);
        }
    }, []);

    // ฟังก์ชันโหลดอุปกรณ์ในหมวดหมู่
    const fetchConnectionEquipments = async (categoryName: string) => {
        setLoadingConnectionEquipments(true);
        try {
            const response = await fetch(`/api/equipments/by-category/${categoryName}`);
            if (response.ok) {
                const equipments = await response.json();
                setConnectionEquipments(equipments);
            }
        } catch (error) {
            console.error('Error fetching connection equipments:', error);
        } finally {
            setLoadingConnectionEquipments(false);
        }
    };

    // ฟังก์ชันอัปเดตหมวดหมู่ของอุปกรณ์
    const updateConnectionEquipmentCategory = (
        equipmentId: string,
        category: 'agricultural_fittings' | 'pvc_fittings'
    ) => {
        setConnectionPointEquipments((prev) => {
            const updated = [...prev];
            const index = updated.findIndex(
                (eq) => `${eq.zoneId}-${eq.connectionType}` === equipmentId
            );
            if (index !== -1) {
                updated[index].category = category;
                updated[index].equipment = null; // รีเซ็ตอุปกรณ์เมื่อเปลี่ยนหมวดหมู่

                // บันทึกการเลือกหมวดหมู่
                const savedSelections = localStorage.getItem('connectionPointEquipmentSelections');
                const selections = savedSelections ? JSON.parse(savedSelections) : {};
                selections[equipmentId] = { category, equipment: null };
                localStorage.setItem(
                    'connectionPointEquipmentSelections',
                    JSON.stringify(selections)
                );
            }
            return updated;
        });

        // โหลดอุปกรณ์ในหมวดหมู่ใหม่
        fetchConnectionEquipments(category);
    };

    // ฟังก์ชันอัปเดตอุปกรณ์ที่เลือก
    const updateConnectionEquipment = (equipmentId: string, equipment: any) => {
        setConnectionPointEquipments((prev) => {
            const updated = [...prev];
            const index = updated.findIndex(
                (eq) => `${eq.zoneId}-${eq.connectionType}` === equipmentId
            );
            if (index !== -1) {
                updated[index].equipment = equipment;

                // บันทึกการเลือกอุปกรณ์
                const savedSelections = localStorage.getItem('connectionPointEquipmentSelections');
                const selections = savedSelections ? JSON.parse(savedSelections) : {};
                if (!selections[equipmentId]) {
                    selections[equipmentId] = {};
                }
                selections[equipmentId].equipment = equipment;
                localStorage.setItem(
                    'connectionPointEquipmentSelections',
                    JSON.stringify(selections)
                );
            }
            return updated;
        });
    };

    // ฟังก์ชันคำนวณพื้นที่โซนจาก coordinates (นำมาจาก HorticultureResultsPage.tsx)
    const calculatePolygonArea = (coords: { lat: number; lng: number }[]): number => {
        if (!coords || coords.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < coords.length; i++) {
            const j = (i + 1) % coords.length;
            area += coords[i].lat * coords[j].lng;
            area -= coords[j].lat * coords[i].lng;
        }
        area = Math.abs(area) / 2;

        // แปลงจากองศา² เป็นตารางเมตร (โดยประมาณ)
        const metersPerDegree = 111320; // ประมาณการ
        return area * metersPerDegree * metersPerDegree;
    };

    // ฟังก์ชันได้รับพื้นที่โซนในไร่
    const getZoneAreaInRai = (): number => {
        if (zoneAreaData?.areaInRai && zoneAreaData.areaInRai > 0) {
            return zoneAreaData.areaInRai;
        }

        if (zoneAreaData?.coordinates && zoneAreaData.coordinates.length > 0) {
            const areaInSquareMeters = calculatePolygonArea(zoneAreaData.coordinates);
            return areaInSquareMeters / 1600; // แปลงเป็นไร่
        }

        return 0;
    };

    useEffect(() => {
        const fetchPipeData = async () => {
            try {
                const endpoints = [
                    '/api/equipments/by-category/pipe',
                    '/api/equipments/category/pipe',
                    '/api/equipments?category=pipe',
                    '/api/equipments/by-category-name/pipe',
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
                    } catch (error) {
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
                                      item.category?.name === 'pipe' ||
                                      item.category?.display_name?.toLowerCase().includes('pipe');
                                  return categoryMatch;
                              })
                            : [];
                    }
                }
                setPipeData(data);
            } catch (error) {
                setPipeData([]);
            }
        };
        fetchPipeData();
    }, []);

    // Initialize connection point equipments when connectionStats or activeZone changes
    useEffect(() => {
        initializeConnectionPointEquipments();
    }, [connectionStats, activeZone?.id, projectMode, initializeConnectionPointEquipments]);

    // Load connection equipment categories (แยกออกจาก connection equipments)
    useEffect(() => {
        if (connectionPointEquipments.length > 0) {
            fetchConnectionCategories();
        }
    }, [connectionPointEquipments.length, fetchConnectionCategories]); // เพิ่ม fetchConnectionCategories ใน dependencies

    // ใช้ useRef เพื่อเก็บ reference ของ callback function
    const onConnectionEquipmentsChangeRef = useRef(onConnectionEquipmentsChange);
    onConnectionEquipmentsChangeRef.current = onConnectionEquipmentsChange;

    // ส่งข้อมูล connection equipments ไปยัง parent component (แยก useEffect)
    useEffect(() => {
        if (onConnectionEquipmentsChangeRef.current) {
            onConnectionEquipmentsChangeRef.current(connectionPointEquipments);
        }
    }, [connectionPointEquipments]);

    // Load sprinkler equipment groups from SprinklerSET
    useEffect(() => {
        const fetchSprinklerGroups = async () => {
            setLoadingSprinklerGroups(true);
            try {
                const response = await fetch('/api/equipment-sets/by-name/SprinklerSET');
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        // Get all groups from the first SprinklerSET (assuming there's only one)
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
                console.error('Error loading sprinkler groups:', error);
                setSprinklerGroups([]);
            } finally {
                setLoadingSprinklerGroups(false);
            }
        };
        fetchSprinklerGroups();
    }, []);

    // Sync sprinkler equipment sets when activeZone changes
    useEffect(() => {
        if (activeZone && input.sprinklerEquipmentSet) {
            setSelectedSprinklerItems(input.sprinklerEquipmentSet.selectedItems || []);
        } else {
            setSelectedSprinklerItems([]);
        }
    }, [activeZone, input.sprinklerEquipmentSet]);

    // Load categories for adding new items
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
                console.error('Error loading categories:', error);
                setCategories([]);
            }
        };
        fetchCategories();
    }, []);

    // Load equipments by category
    const fetchEquipmentsByCategory = async (categoryId: number) => {
        setLoadingEquipments(true);
        try {
            const response = await fetch(`/api/equipments/by-category-id/${categoryId}`);
            if (response.ok) {
                const data = await response.json();
                setEquipments(Array.isArray(data) ? data : []);
            } else {
                console.error('Failed to fetch equipments, status:', response.status);
                setEquipments([]);
            }
        } catch (error) {
            console.error('Error loading equipments:', error);
            setEquipments([]);
        } finally {
            setLoadingEquipments(false);
        }
    };

    // Garden mode: ดึงข้อมูล water requirement จาก garden statistics (แยกแต่ละโซน)
    useEffect(() => {
        if (projectMode === 'garden' && activeZone) {
            try {
                const gardenStatsStr = localStorage.getItem('garden_statistics');
                if (gardenStatsStr) {
                    const gardenStats = JSON.parse(gardenStatsStr);
                    if (gardenStats.zones && gardenStats.zones.length > 0) {
                        // หาข้อมูลของโซนปัจจุบัน
                        const currentZoneStats = gardenStats.zones.find(
                            (zone: any) => zone.zoneId === activeZone.id
                        );

                        if (
                            currentZoneStats &&
                            currentZoneStats.sprinklerFlowRate &&
                            currentZoneStats.sprinklerCount
                        ) {
                            const zoneWaterRequirement =
                                currentZoneStats.sprinklerFlowRate *
                                currentZoneStats.sprinklerCount;

                            setGardenWaterRequirement(zoneWaterRequirement);

                            // Update input.waterPerTreeLiters with zone-specific value (only if significantly different)
                            if (
                                zoneWaterRequirement > 0 &&
                                Math.abs(zoneWaterRequirement - input.waterPerTreeLiters) > 0.01
                            ) {
                                onInputChange({
                                    ...input,
                                    waterPerTreeLiters: zoneWaterRequirement,
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading garden zone statistics:', error);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectMode, activeZone?.id]);

    const isMultiZone = input.numberOfZones > 1;

    const updateInput = (field: keyof IrrigationInput, value: number) => {
        let validatedValue = value;

        switch (field) {
            case 'farmSizeRai':
                validatedValue = Math.max(0, value);
                break;
            case 'totalTrees':
                validatedValue = Math.max(1, Math.round(value));
                break;
            case 'waterPerTreeLiters':
                validatedValue = Math.max(0.1, value);
                break;
            case 'numberOfZones':
                validatedValue = Math.max(1, Math.round(value));
                break;
            case 'simultaneousZones':
                validatedValue = Math.max(1, Math.min(Math.round(value), input.numberOfZones));
                break;
            case 'irrigationTimeMinutes':
                validatedValue = Math.max(1, Math.min(300, value));
                break;
            case 'staticHeadM':
            case 'pressureHeadM':
                validatedValue = Math.max(0, value);
                break;
            case 'pipeAgeYears':
                validatedValue = Math.max(0, Math.min(50, value));
                break;
            default:
                validatedValue = Math.max(0, value);
        }

        const formattedValue = [
            'farmSizeRai',
            'waterPerTreeLiters',
            'irrigationTimeMinutes',
            'staticHeadM',
            'pressureHeadM',
            'longestBranchPipeM',
            'totalBranchPipeM',
            'longestSecondaryPipeM',
            'totalSecondaryPipeM',
            'longestMainPipeM',
            'totalMainPipeM',
        ].includes(field)
            ? formatNumber(validatedValue, 3)
            : Math.round(validatedValue);

        onInputChange({
            ...input,
            [field]: formattedValue,
        });
    };

    const updateInputOnBlur = (field: keyof IrrigationInput, value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || value === '') {
            let defaultValue = 0;
            switch (field) {
                case 'totalTrees':
                    defaultValue = 1;
                    break;
                case 'waterPerTreeLiters':
                    defaultValue = 0.1;
                    break;
                case 'numberOfZones':
                    defaultValue = 1;
                    break;
                case 'irrigationTimeMinutes':
                    defaultValue = 45;
                    break;
                case 'sprinklersPerTree':
                    defaultValue = 1;
                    break;
                case 'sprinklersPerLongestBranch':
                case 'sprinklersPerBranch':
                    defaultValue = input.sprinklersPerBranch || 1;
                    break;
                case 'branchesPerLongestSecondary':
                case 'branchesPerSecondary':
                    defaultValue = input.branchesPerSecondary || 1;
                    break;
                default:
                    defaultValue = 0;
            }
            updateInput(field, defaultValue);
        } else {
            updateInput(field, numValue);
        }
    };

    const calculateEstimatedVelocity = (input: IrrigationInput): number => {
        let estimatedFlowLPM: number;

        // Fix: Correct calculation for different project modes
        if (projectMode === 'greenhouse' || projectMode === 'garden') {
            // waterPerTreeLiters is per irrigation session, convert to LPM
            estimatedFlowLPM =
                (input.totalTrees * input.waterPerTreeLiters) / (input.irrigationTimeMinutes || 30);
        } else if (projectMode === 'field-crop') {
            // For field crop, waterPerTreeLiters should be flow rate per minute
            // If it's per session, need to convert to per minute
            estimatedFlowLPM = input.totalTrees * input.waterPerTreeLiters; // Assuming it's already LPM per tree
        } else {
            // Horticulture mode: waterPerTreeLiters is now in LPM (liters per minute)
            estimatedFlowLPM = input.totalTrees * input.waterPerTreeLiters;
        }

        // Convert LPM to m³/s for velocity calculation
        const flowM3s = estimatedFlowLPM / 60000;

        // Use a standard 32mm pipe diameter for estimation
        const diameterM = 0.032;
        const pipeArea = Math.PI * Math.pow(diameterM / 2, 2);

        return flowM3s / pipeArea;
    };

    const getSprinklerPressureInfo = (): SprinklerPressureInfo | null => {
        if (!selectedSprinkler) return null;

        try {
            let minPressure: number, maxPressure: number;
            const pressureData = selectedSprinkler.pressureBar || selectedSprinkler.pressure_bar;

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

            if (isNaN(minPressure) || isNaN(maxPressure)) {
                return null;
            }

            const optimalPressureBar = minPressure + (maxPressure - minPressure) * 0.7;
            const pressureM = optimalPressureBar * 10.2;

            return {
                pressureBar: optimalPressureBar,
                pressureM: pressureM,
                range: `${minPressure}-${maxPressure} บาร์`,
                sprinklerName: selectedSprinkler.productCode,
            };
        } catch (error) {
            console.error('Error calculating sprinkler pressure:', error);
            return null;
        }
    };

    const calculateBranchPipeStats = (): BranchPipeStats | null => {
        if (
            projectMode === 'garden' ||
            projectMode === 'field-crop' ||
            projectMode === 'greenhouse'
        ) {
            return null;
        }

        try {
            const longestBranchStats = getLongestBranchPipeStats();
            const subMainBranchCount = getSubMainPipeBranchCount();

            if (!longestBranchStats || !subMainBranchCount) {
                return null;
            }

            let zoneStats: BranchPipeStats | null = null;
            if (activeZone) {
                const longestStat = longestBranchStats.find(
                    (stat) => stat.zoneId === activeZone.id
                );
                const subMainStat = subMainBranchCount.find(
                    (stat) => stat.zoneId === activeZone.id
                );

                if (longestStat && subMainStat) {
                    zoneStats = {
                        longestBranchPlantCount: longestStat.longestBranchPipe.plantCount,
                        longestBranchLength: longestStat.longestBranchPipe.length,
                        maxBranchesPerSubMain:
                            subMainStat.subMainPipes.length > 0
                                ? Math.max(...subMainStat.subMainPipes.map((sm) => sm.branchCount))
                                : 0,
                        totalSubMainPipes: subMainStat.subMainPipes.length,
                        zoneName: longestStat.zoneName,
                    };
                }
            } else {
                if (longestBranchStats.length > 0 && subMainBranchCount.length > 0) {
                    zoneStats = {
                        longestBranchPlantCount: longestBranchStats[0].longestBranchPipe.plantCount,
                        longestBranchLength: longestBranchStats[0].longestBranchPipe.length,
                        maxBranchesPerSubMain:
                            subMainBranchCount[0].subMainPipes.length > 0
                                ? Math.max(
                                      ...subMainBranchCount[0].subMainPipes.map(
                                          (sm) => sm.branchCount
                                      )
                                  )
                                : 0,
                        totalSubMainPipes: subMainBranchCount[0].subMainPipes.length,
                        zoneName: longestBranchStats[0].zoneName,
                    };
                }
            }

            return zoneStats;
        } catch (error) {
            console.error('Error calculating branch pipe stats:', error);
            return null;
        }
    };

    const branchStats = calculateBranchPipeStats();
    const sprinklerPressure = getSprinklerPressureInfo();

    const getProjectIcon = () => {
        switch (projectMode) {
            case 'garden':
                return '🏡';
            case 'field-crop':
                return '🌾';
            case 'greenhouse':
                return '🏠';
            default:
                return '🌱';
        }
    };

    const getItemName = () => {
        switch (projectMode) {
            case 'garden':
                return t('หัวฉีด');
            case 'field-crop':
                return t('หัวฉีด');
            case 'greenhouse':
                return t('หัวฉีด');
            default:
                return t('ต้นไม้');
        }
    };

    const getAreaUnit = () => {
        switch (projectMode) {
            case 'garden':
            case 'greenhouse':
            case 'field-crop':
            case 'horticulture':
            default:
                return t('ไร่'); // Fix: All project modes now use rai consistently
        }
    };

    const getAreaConversionFactor = () => {
        // Fix: All project modes now store farmSizeRai in rai units
        // No conversion needed for display - all are already in rai
        return 1; // Always 1 since farmSizeRai is now consistently in rai
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

    const getWaterPerItemLabel = () => {
        switch (projectMode) {
            case 'field-crop':
                return t('น้ำต่อหัวฉีด (ลิตร/นาที)');
            case 'greenhouse':
                return t('น้ำต่อหัวฉีด (ลิตร/ครั้ง)');
            case 'garden':
                return t('ต้องการน้ำ (ลิตร/นาที)');
            case 'horticulture':
                return t('ต้องการน้ำ (ลิตร/นาที)');
            default:
                return t('น้ำต่อ') + getItemName() + t(' (ลิตร/ครั้ง)');
        }
    };

    const getQuantityLabel = () => {
        switch (projectMode) {
            case 'greenhouse':
                return t('จำนวนหัวฉีด');
            case 'garden':
                return t('จำนวนหัวฉีด');
            case 'field-crop':
                return t('จำนวนหัวฉีด');
            default:
                return t('จำนวนต้นไม้');
        }
    };

    const shouldShowSprinklersPerTree = () => {
        return (
            projectMode !== 'field-crop' && projectMode !== 'greenhouse' && projectMode !== 'garden'
        );
    };

    // Functions for managing sprinkler equipment groups
    const handleSprinklerGroupChange = (groupId: string) => {
        const selectedGroupId = groupId
            ? isNaN(parseInt(groupId))
                ? groupId
                : parseInt(groupId)
            : null;

        if (selectedGroupId) {
            const selectedGroup = sprinklerGroups.find((group) => group.id == selectedGroupId);
            if (selectedGroup && selectedGroup.items && selectedGroup.items.length > 0) {
                // Get items from the selected group
                setSelectedSprinklerItems(selectedGroup.items);

                onInputChange({
                    ...input,
                    sprinklerEquipmentSet: {
                        selectedGroupId,
                        selectedItems: selectedGroup.items,
                    },
                });
            }
        } else {
            setSelectedSprinklerItems([]);
            onInputChange({
                ...input,
                sprinklerEquipmentSet: {
                    selectedGroupId: null,
                    selectedItems: [],
                },
            });
        }
    };

    // Helper function to check if equipment is pipe category
    const isPipeEquipment = (item: SprinklerSetItem): boolean => {
        const categoryName = item.equipment.category?.name?.toLowerCase();
        return categoryName === 'pipe' || categoryName?.includes('pipe') || false;
    };

    const updateSprinklerItem = (itemIndex: number, field: keyof SprinklerSetItem, value: any) => {
        const updatedItems = [...selectedSprinklerItems];
        updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            [field]: value,
            ...(field === 'quantity' && {
                total_price: value * updatedItems[itemIndex].unit_price,
            }),
        };

        setSelectedSprinklerItems(updatedItems);
        onInputChange({
            ...input,
            sprinklerEquipmentSet: {
                selectedGroupId: input.sprinklerEquipmentSet?.selectedGroupId || null,
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
        if (!selectedCategory || !selectedEquipment) {
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
            id: Date.now(), // temporary ID
            group_id:
                typeof input.sprinklerEquipmentSet?.selectedGroupId === 'string'
                    ? parseInt(input.sprinklerEquipmentSet.selectedGroupId)
                    : input.sprinklerEquipmentSet?.selectedGroupId || 0,
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
            quantity: isPipe ? 1.0 : 1, // Default 1.0 for pipe, 1 for others
            unit_price: selectedEquipmentData.price || 0,
            total_price: selectedEquipmentData.price || 0,
            sort_order: selectedSprinklerItems.length,
        };

        const updatedItems = [...selectedSprinklerItems, newItem];
        setSelectedSprinklerItems(updatedItems);
        onInputChange({
            ...input,
            sprinklerEquipmentSet: {
                selectedGroupId: input.sprinklerEquipmentSet?.selectedGroupId || null,
                selectedItems: updatedItems,
            },
        });

        setShowAddItemModal(false);
    };

    const removeSprinklerItem = (itemIndex: number) => {
        const updatedItems = selectedSprinklerItems.filter((_, index) => index !== itemIndex);
        setSelectedSprinklerItems(updatedItems);
        onInputChange({
            ...input,
            sprinklerEquipmentSet: {
                selectedGroupId: input.sprinklerEquipmentSet?.selectedGroupId || null,
                selectedItems: updatedItems,
            },
        });
    };

    return (
        <div className="mb-6 rounded-lg bg-gray-800 p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-green-400">
                        📋 {t('ข้อมูลพื้นฐาน')}
                    </h2>

                    <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-700 p-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                {projectMode === 'field-crop'
                                    ? t('ขนาดพื้นที่โซน')
                                    : t('ขนาดพื้นที่')}{' '}
                                ({getAreaUnit()})
                            </label>
                            <input
                                type="number"
                                defaultValue={input.farmSizeRai.toFixed(2)} // Fix: Always display rai since all modes store in rai
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    updateInput('farmSizeRai', value); // Fix: Direct assignment since value is already in rai
                                }}
                                onBlur={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || isNaN(parseFloat(value))) {
                                        e.target.value = input.farmSizeRai.toFixed(2); // Fix: Always show rai
                                    }
                                }}
                                step="0.1"
                                min="0"
                                className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-white focus:border-blue-400"
                            />
                            <p className="mt-1 text-xs text-gray-400">
                                (
                                {(input.farmSizeRai * 1600).toLocaleString(undefined, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                })}{' '}
                                {t('ตร.ม.')})
                            </p>
                        </div>

                        {/* แสดงข้อมูลพื้นที่โซน (ถ้ามี)
                        {zoneAreaData && (
                            <div>
                                <label className="mb-2 block text-sm font-medium text-green-400">
                                    {t('พื้นที่โซน')}: {zoneAreaData.zoneName}
                                </label>
                                <div className="rounded border border-green-500 bg-green-900/20 p-2">
                                    <div className="text-lg font-bold text-green-400">
                                        {getZoneAreaInRai() > 0 ? `${getZoneAreaInRai().toFixed(2)} ${t('ไร่')}` : t('ไม่ระบุ')}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        ({(getZoneAreaInRai() * 1600).toFixed(2)} {t('ตร.ม.')})
                                    </div>
                                </div>
                            </div>
                        )} */}

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                {getQuantityLabel()}
                            </label>
                            <input
                                type="number"
                                defaultValue={input.totalTrees}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value)) {
                                        updateInput('totalTrees', value);
                                    }
                                }}
                                onBlur={(e) => updateInputOnBlur('totalTrees', e.target.value)}
                                min="1"
                                step="1"
                                className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-white focus:border-blue-400"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                {getWaterPerItemLabel()}
                            </label>
                            <input
                                type="number"
                                value={input.waterPerTreeLiters}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    // Allow empty string for controlled input
                                    if (value === '') {
                                        updateInput('waterPerTreeLiters', 0);
                                    } else {
                                        const num = parseFloat(value);
                                        if (!isNaN(num)) {
                                            updateInput('waterPerTreeLiters', num);
                                        }
                                    }
                                }}
                                onBlur={(e) =>
                                    updateInputOnBlur('waterPerTreeLiters', e.target.value)
                                }
                                step="0.1"
                                min="0.1"
                                className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-white focus:border-blue-400"
                            />
                        </div>

                        {/* <div>
                            <label className="mb-2 block text-sm font-medium">
                                {t('เวลารดน้ำ (นาที/ครั้ง)')}
                            </label>
                            <input
                                type="number"
                                step="1"
                                defaultValue={input.irrigationTimeMinutes}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value)) {
                                        updateInput('irrigationTimeMinutes', value);
                                    }
                                }}
                                onBlur={(e) => updateInputOnBlur('irrigationTimeMinutes', e.target.value)}
                                className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-white focus:border-blue-400"
                            />
                        </div> */}
                    </div>

                    <div className="rounded-lg bg-gray-700 p-2">
                        <h3 className="mb-3 text-lg font-semibold text-orange-400">
                            ⚙️ {t('การตั้งค่าระบบ')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {shouldShowSprinklersPerTree() && (
                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        {t('หัวฉีดต่อต้น')}
                                    </label>
                                    <input
                                        type="number"
                                        step="1"
                                        defaultValue={input.sprinklersPerTree}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value);
                                            if (!isNaN(value)) {
                                                updateInput('sprinklersPerTree', value);
                                            }
                                        }}
                                        onBlur={(e) =>
                                            updateInputOnBlur('sprinklersPerTree', e.target.value)
                                        }
                                        min="1"
                                        max="5"
                                        className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-white focus:border-blue-400"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    {t('ความสูงจาก')}
                                    {getWaterSourceLabel()}
                                    {t('ไปจุดสูงสุด (ม.)')}
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    defaultValue={input.staticHeadM.toFixed(1)}
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value);
                                        if (!isNaN(value)) {
                                            updateInput('staticHeadM', value);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const value = e.target.value;
                                        if (value === '' || isNaN(parseFloat(value))) {
                                            e.target.value = input.staticHeadM.toFixed(1);
                                        }
                                    }}
                                    min="0"
                                    className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-white focus:border-blue-400"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg bg-gray-700 p-3">
                        <h4 className="mb-3 text-lg font-semibold text-blue-300">
                            🔧 {t('ท่อเสริมต่อหัวสปริงเกอร์')}
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    {t('เลือกกลุ่มอุปกรณ์')}
                                </label>
                                <select
                                    value={input.sprinklerEquipmentSet?.selectedGroupId || ''}
                                    onChange={(e) => handleSprinklerGroupChange(e.target.value)}
                                    className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-white focus:border-blue-400"
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

                            {/* Display selected equipment items */}
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
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-blue-400">🔧 {t('ข้อมูลท่อ')}</h3>

                    <div className="rounded-lg bg-gray-700 p-3">
                        <h4 className="mb-2 text-sm font-medium text-purple-300">
                            🔹 {t('ท่อย่อย (Branch Pipe)')}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-sm">
                                    {t('ท่อเส้นที่ยาวที่สุด (ม.)')}
                                </label>
                                <input
                                    type="number"
                                    defaultValue={input.longestBranchPipeM.toFixed(1)}
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value);
                                        if (!isNaN(value)) {
                                            updateInput('longestBranchPipeM', value);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const value = e.target.value;
                                        if (value === '' || isNaN(parseFloat(value))) {
                                            e.target.value = input.longestBranchPipeM.toFixed(1);
                                        }
                                    }}
                                    step="0.1"
                                    min="0"
                                    className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm">
                                    {t('ท่อรวมทั้งหมด (ม.)')}
                                </label>
                                <input
                                    type="number"
                                    defaultValue={input.totalBranchPipeM.toFixed(1)}
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value);
                                        if (!isNaN(value)) {
                                            updateInput('totalBranchPipeM', value);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const value = e.target.value;
                                        if (value === '' || isNaN(parseFloat(value))) {
                                            e.target.value = input.totalBranchPipeM.toFixed(1);
                                        }
                                    }}
                                    step="0.1"
                                    min="0"
                                    className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg bg-gray-700 p-3">
                        {input.longestSecondaryPipeM > 0 ? (
                            <>
                                <h4 className="mb-2 text-sm font-medium text-orange-300">
                                    🔸 {t('ท่อเมนรอง (Secondary)')}
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1 block text-sm">
                                            {t('ท่อเส้นที่ยาวที่สุด (ม.)')}
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue={input.longestSecondaryPipeM.toFixed(1)}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    updateInput('longestSecondaryPipeM', value);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || isNaN(parseFloat(value))) {
                                                    e.target.value =
                                                        input.longestSecondaryPipeM.toFixed(1);
                                                }
                                            }}
                                            step="0.1"
                                            min="0"
                                            className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">
                                            {t('ท่อรวมทั้งหมด (ม.)')}
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue={input.totalSecondaryPipeM.toFixed(1)}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    updateInput('totalSecondaryPipeM', value);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || isNaN(parseFloat(value))) {
                                                    e.target.value =
                                                        input.totalSecondaryPipeM.toFixed(1);
                                                }
                                            }}
                                            step="0.1"
                                            min="0"
                                            className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="text-center text-gray-400">
                                    <div className="mb-1 text-2xl">➖</div>
                                    <p className="text-sm">{t('ไม่ใช้ท่อเมนรอง')}</p>
                                </div>
                                {(projectMode === 'horticulture' ||
                                    projectMode === 'field-crop' ||
                                    projectMode === 'greenhouse') && (
                                    <button
                                        onClick={() => updateInput('longestSecondaryPipeM', 50)}
                                        className="text-sm text-blue-400 hover:text-blue-300"
                                    >
                                        + {t('เพิ่มท่อเมนรอง')}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg bg-gray-700 p-3">
                        {input.longestMainPipeM > 0 ? (
                            <>
                                <h4 className="mb-2 text-sm font-medium text-cyan-300">
                                    🔷 {t('ท่อเมนหลัก')} (Main)
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1 block text-sm">
                                            {t('ท่อเส้นที่ยาวที่สุด (ม.)')}
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue={input.longestMainPipeM.toFixed(1)}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    updateInput('longestMainPipeM', value);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || isNaN(parseFloat(value))) {
                                                    e.target.value =
                                                        input.longestMainPipeM.toFixed(1);
                                                }
                                            }}
                                            step="0.1"
                                            min="0"
                                            className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">
                                            {t('ท่อรวมทั้งหมด (ม.)')}
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue={input.totalMainPipeM.toFixed(1)}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    updateInput('totalMainPipeM', value);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || isNaN(parseFloat(value))) {
                                                    e.target.value =
                                                        input.totalMainPipeM.toFixed(1);
                                                }
                                            }}
                                            step="0.1"
                                            min="0"
                                            className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="text-center text-gray-400">
                                    <div className="mb-1 text-2xl">➖</div>
                                    <p className="text-sm">{t('ไม่ใช้ท่อเมนหลัก')}</p>
                                </div>
                                {(projectMode === 'horticulture' ||
                                    projectMode === 'field-crop' ||
                                    projectMode === 'greenhouse') && (
                                    <button
                                        onClick={() => updateInput('longestMainPipeM', 100)}
                                        className="text-sm text-blue-400 hover:text-blue-300"
                                    >
                                        + {t('เพิ่มท่อเมนหลัก')}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {input.longestEmitterPipeM && input.longestEmitterPipeM > 0 ? (
                        <>
                            <div className="rounded-lg bg-gray-700 p-3">
                                <h4 className="mb-2 text-sm font-medium text-green-300">
                                    🌿 {t('ท่อย่อยแยก (Emitter Pipe)')}
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1 block text-sm">
                                            {t('ท่อเส้นที่ยาวที่สุด (ม.)')}
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue={
                                                input.longestEmitterPipeM?.toFixed(1) || '0.0'
                                            }
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    updateInput('longestEmitterPipeM', value);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || isNaN(parseFloat(value))) {
                                                    e.target.value =
                                                        input.longestEmitterPipeM?.toFixed(1) ||
                                                        '0.0';
                                                }
                                            }}
                                            step="0.1"
                                            min="0"
                                            className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm">
                                            {t('ท่อรวมทั้งหมด (ม.)')}
                                        </label>
                                        <input
                                            type="number"
                                            defaultValue={
                                                input.totalEmitterPipeM?.toFixed(1) || '0.0'
                                            }
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    updateInput('totalEmitterPipeM', value);
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || isNaN(parseFloat(value))) {
                                                    e.target.value =
                                                        input.totalEmitterPipeM?.toFixed(1) ||
                                                        '0.0';
                                                }
                                            }}
                                            step="0.1"
                                            min="0"
                                            className="w-full rounded border border-gray-500 bg-gray-600 p-2 text-sm text-white focus:border-blue-400"
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
                {/* ส่วนแสดงและเลือกอุปกรณ์จุดเชื่อมต่อ */}
                {connectionPointEquipments.length > 0 ? (
                    <div className="col-span-2 rounded-lg bg-gray-700 p-4">
                        <h4 className="mb-3 text-sm font-semibold text-green-300">
                            🔗 {t('อุปกรณ์เชื่อมต่อท่อ')}
                            {activeZone && (
                                <span className="text-blue-300"> - {activeZone.name}</span>
                            )}
                            <span className="ml-2 text-xs text-gray-400">
                                (หมวดหมู่: {equipmentCategories.length})
                            </span>
                        </h4>

                        {/* แสดงจุดเชื่อมต่อของโซนที่เลือก */}
                        <div className="grid grid-cols-2 gap-3">
                            {connectionPointEquipments.map((equipment, index) => {
                                const equipmentId = `${equipment.zoneId}-${equipment.connectionType}`;
                                return (
                                    <div key={equipmentId} className="rounded bg-gray-600 p-3">
                                        <div className="mb-2 flex items-center gap-2">
                                            <div
                                                className="h-4 w-4 rounded-full"
                                                style={{ backgroundColor: equipment.color }}
                                            ></div>
                                            <span className="text-sm font-medium text-white">
                                                {equipment.connectionTypeName}
                                            </span>
                                            <span className="text-xs text-gray-300">
                                                ({equipment.count} {t('จุด')})
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                                            {/* เลือกหมวดหมู่ */}
                                            <div className="col-span-1">
                                                <label className="mb-1 block text-xs text-gray-300">
                                                    {t('หมวดหมู่')}
                                                </label>
                                                {equipmentCategories.length > 0 ? (
                                                    <SearchableDropdown
                                                        options={equipmentCategories.map((cat) => ({
                                                            value: cat.name,
                                                            label: cat.display_name,
                                                        }))}
                                                        value={equipment.category || ''}
                                                        onChange={(value) =>
                                                            updateConnectionEquipmentCategory(
                                                                equipmentId,
                                                                value as any
                                                            )
                                                        }
                                                        placeholder={t('หมวดหมู่')}
                                                        className="text-sm"
                                                    />
                                                ) : (
                                                    <div className="rounded border border-gray-500 bg-gray-600 p-2 text-sm text-gray-400">
                                                        {loadingConnectionCategories
                                                            ? t('กำลังโหลด...')
                                                            : t('ไม่พบหมวดหมู่')}
                                                    </div>
                                                )}
                                            </div>

                                            {/* เลือกอุปกรณ์ */}
                                            <div className="col-span-3">
                                                <label className="mb-1 block text-xs text-gray-300">
                                                    {t('อุปกรณ์')}
                                                </label>
                                                {equipment.category ? (
                                                    <SearchableDropdown
                                                        options={connectionEquipments.map((eq) => {
                                                            // สร้าง label ที่แสดงชื่อ, รหัส, และคุณสมบัติ
                                                            let label = eq.name || eq.product_code;
                                                            if (eq.name && eq.product_code) {
                                                                label = `${eq.name} (${eq.product_code})`;
                                                            }

                                                            // เพิ่มคุณสมบัติที่สำคัญ
                                                            const attributes: string[] = [];
                                                            if (eq.main_pipe_inch)
                                                                attributes.push(
                                                                    `ท่อหลัก: ${eq.main_pipe_inch}`
                                                                );
                                                            if (eq.branch_pipe_mm)
                                                                attributes.push(
                                                                    `ท่อแยก: ${eq.branch_pipe_mm}มม.`
                                                                );
                                                            if (eq.size_inch)
                                                                attributes.push(
                                                                    `ขนาด: ${eq.size_inch}`
                                                                );
                                                            if (eq.diameter_mm)
                                                                attributes.push(
                                                                    `เส้นผ่านศูนย์กลาง: ${eq.diameter_mm}มม.`
                                                                );

                                                            if (attributes.length > 0) {
                                                                label += ` - ${attributes.join(', ')}`;
                                                            }

                                                            return {
                                                                value: String(eq.id), // Convert to string to match localStorage
                                                                label: label,
                                                                productCode: eq.product_code,
                                                                price: eq.price,
                                                                image: eq.image,
                                                                brand: eq.brand,
                                                                name: eq.name,
                                                                description: eq.description,
                                                            };
                                                        })}
                                                        value={
                                                            equipment.equipment?.id
                                                                ? String(equipment.equipment.id)
                                                                : ''
                                                        }
                                                        onChange={(value) => {
                                                            const selectedEquipment =
                                                                connectionEquipments.find(
                                                                    (eq) =>
                                                                        String(eq.id) ===
                                                                        String(value)
                                                                );
                                                            updateConnectionEquipment(
                                                                equipmentId,
                                                                selectedEquipment
                                                            );
                                                        }}
                                                        placeholder={t('เลือกอุปกรณ์')}
                                                        className="text-sm"
                                                    />
                                                ) : (
                                                    <div className="rounded border border-gray-500 bg-gray-600 p-2 text-sm text-gray-400">
                                                        {t('กรุณาเลือกหมวดหมู่ก่อน')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* แสดงข้อมูลอุปกรณ์ที่เลือก */}
                                        {equipment.equipment && (
                                            <div className="mt-2 rounded bg-gray-500 p-2">
                                                <div className="flex gap-3">
                                                    {/* รูปภาพอุปกรณ์ */}
                                                    {equipment.equipment.image ? (
                                                        <div className="flex-shrink-0">
                                                            <img
                                                                src={equipment.equipment.image}
                                                                alt={
                                                                    equipment.equipment.name ||
                                                                    equipment.equipment.product_code
                                                                }
                                                                className="h-16 w-16 rounded border border-gray-400 object-cover"
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display =
                                                                        'none';
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex h-16 w-16 items-center justify-center rounded border border-gray-500 bg-gray-600 text-xs text-gray-300">
                                                            {t('ไม่มีรูป')}
                                                        </div>
                                                    )}

                                                    {/* ข้อมูลอุปกรณ์ */}
                                                    <div className="flex-1 text-xs text-gray-200">
                                                        <div className="flex justify-between">
                                                            <span>{t('รหัสสินค้า')}:</span>
                                                            <span>
                                                                {equipment.equipment.product_code}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t('ราคา')}:</span>
                                                            <span>
                                                                {equipment.equipment.price?.toLocaleString()}{' '}
                                                                {t('บาท')}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t('จำนวนที่ต้องการ')}:</span>
                                                            <span>
                                                                {equipment.count} {t('ชิ้น')}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t('ราคารวม')}:</span>
                                                            <span className="font-semibold text-green-300">
                                                                {(
                                                                    equipment.equipment.price *
                                                                    equipment.count
                                                                ).toLocaleString()}{' '}
                                                                {t('บาท')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg bg-gray-700 p-4">
                        <div className="text-center text-gray-400">
                            <p className="text-sm">🔗 {t('ไม่มีข้อมูลจุดเชื่อมต่อ')}</p>
                            <p className="mt-1 text-xs">
                                {t('กรุณาสร้างโปรเจกต์ที่มีท่อและจุดเชื่อมต่อก่อน')}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Item Modal */}
            {showAddItemModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md rounded-lg bg-gray-800 p-6 shadow-xl">
                        <h3 className="mb-4 text-lg font-semibold text-white">
                            {t('เพิ่มรายการใหม่')}
                        </h3>

                        <div className="space-y-4">
                            {/* Category Selection */}
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

                            {/* Equipment Selection */}
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
                                            // สร้าง label ที่แสดงชื่อ, รหัส, และคุณสมบัติ
                                            let label = eq.name || eq.product_code;
                                            if (eq.name && eq.product_code) {
                                                label = `${eq.name} (${eq.product_code})`;
                                            }

                                            // เพิ่มคุณสมบัติที่สำคัญ
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

                                        // ถ้าไม่มีข้อมูลให้แสดงข้อความ
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

                            {/* Selected Equipment Preview */}
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

                        {/* Modal Actions */}
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
        </div>
    );
};

export default InputForm;
