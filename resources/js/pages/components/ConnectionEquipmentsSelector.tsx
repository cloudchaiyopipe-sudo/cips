/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import SearchableDropdown from './SearchableDropdown';
import { ConnectionPointStats } from '../../utils/horticultureProjectStats';

export interface ConnectionPointEquipment {
    zoneId: string;
    zoneName: string;
    connectionType:
        | 'endToEnd'
        | 'mainToSubMain'
        | 'subMainToMainMid'
        | 'subMainToLateral'
        | 'subMainToMainIntersection'
        | 'lateralToSubMainIntersection'
        | 'junction'
        | 'crossing'
        | 'l_shape'
        | 't_shape'
        | 'cross_shape';
    connectionTypeName: string;
    color: string;
    count: number;
    category: 'agricultural_fittings' | 'pvc_fittings' | null;
    equipment: any | null;
}

interface EquipmentCategory {
    id: number;
    name: string;
    display_name: string;
    description: string;
    icon: string;
}

interface ConnectionEquipmentsSelectorProps {
    connectionStats?: ConnectionPointStats[];
    activeZone?: any;
    activeZoneId?: string;
    projectMode?: 'horticulture' | 'garden' | 'field-crop' | 'greenhouse';
    fieldCropSystemData?: any;
    onConnectionEquipmentsChange?: (equipments: ConnectionPointEquipment[]) => void;
}

const ConnectionEquipmentsSelector: React.FC<ConnectionEquipmentsSelectorProps> = ({
    connectionStats,
    activeZone,
    activeZoneId,
    projectMode = 'horticulture',
    fieldCropSystemData,
    onConnectionEquipmentsChange,
}) => {
    const { t } = useLanguage();

    const [connectionPointEquipments, setConnectionPointEquipments] = useState<
        ConnectionPointEquipment[]
    >([]);
    const [equipmentCategories, setEquipmentCategories] = useState<EquipmentCategory[]>([]);
    const [connectionEquipments, setConnectionEquipments] = useState<any[]>([]);
    const [loadingConnectionCategories, setLoadingConnectionCategories] = useState(false);
    const [loadingConnectionEquipments, setLoadingConnectionEquipments] = useState(false);

    const fieldCropSystemDataRef = useRef(fieldCropSystemData);
    fieldCropSystemDataRef.current = fieldCropSystemData;

    const initializeConnectionPointEquipments = useCallback(() => {
        const zoneId = activeZoneId || activeZone?.id;

        if (projectMode === 'field-crop' && fieldCropSystemDataRef.current) {
            const equipments: ConnectionPointEquipment[] = [];

            const savedSelections = localStorage.getItem('connectionPointEquipmentSelections');
            const selections = savedSelections ? JSON.parse(savedSelections) : {};

            let activeZoneData: any = null;
            if (
                fieldCropSystemDataRef.current.zones &&
                Array.isArray(fieldCropSystemDataRef.current.zones)
            ) {
                activeZoneData = fieldCropSystemDataRef.current.zones.find(
                    (z: any) => z.id === zoneId
                );
            } else if (
                fieldCropSystemDataRef.current.zones?.info &&
                Array.isArray(fieldCropSystemDataRef.current.zones.info)
            ) {
                activeZoneData = fieldCropSystemDataRef.current.zones.info.find(
                    (z: any) => z.id === zoneId
                );
            }
            if (activeZoneData && activeZoneData.connectionPoints) {
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

            setConnectionPointEquipments(equipments);

            const categoriesToLoad = new Set<string>();
            equipments.forEach((eq) => {
                if (eq.category && eq.equipment) {
                    categoriesToLoad.add(eq.category);
                }
            });

            categoriesToLoad.forEach((category) => {
                fetchConnectionEquipments(category);
            });

            return;
        } else if (projectMode === 'field-crop') {
            return;
        }

        if (!connectionStats || connectionStats.length === 0) {
            return;
        }

        const savedSelections = localStorage.getItem('connectionPointEquipmentSelections');
        const selections = savedSelections ? JSON.parse(savedSelections) : {};

        const equipments: ConnectionPointEquipment[] = [];

        const filteredStats =
            zoneId && zoneId.trim() !== ''
                ? connectionStats.filter((zoneStats) => zoneStats.zoneId === zoneId)
                : [];

        filteredStats.forEach((zoneStats) => {
            const connectionTypes = [
                { key: 'endToEnd', name: 'ปลาย-ปลาย', color: '#DC2626' },
                { key: 'mainToSubMain', name: 'ปลายเมน-ระหว่างเมนรอง', color: '#3B82F6' },
                { key: 'subMainToMainMid', name: 'เมนรอง-กลางเมน', color: '#8B5CF6' },
                { key: 'subMainToLateral', name: 'เมนรอง-ท่อย่อย', color: '#F59E0B' },
                { key: 'subMainToMainIntersection', name: 'เมนรอง-ท่อเมน (ตัด)', color: '#3B82F6' },
                {
                    key: 'lateralToSubMainIntersection',
                    name: 'ตัดท่อย่อย-เมนรอง',
                    color: '#10B981',
                },
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

        const categoriesToLoad = new Set<string>();
        equipments.forEach((eq) => {
            if (eq.category && eq.equipment) {
                categoriesToLoad.add(eq.category);
            }
        });

        categoriesToLoad.forEach((category) => {
            fetchConnectionEquipments(category);
        });
    }, [connectionStats, activeZoneId, activeZone?.id, projectMode]);

    const fetchConnectionCategories = useCallback(async () => {
        setLoadingConnectionCategories(true);
        try {
            const response = await fetch('/api/equipment-categories');
            if (response.ok) {
                const categories = await response.json();
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
                updated[index].equipment = null;

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

        fetchConnectionEquipments(category);
    };

    const updateConnectionEquipment = (equipmentId: string, equipment: any) => {
        setConnectionPointEquipments((prev) => {
            const updated = [...prev];
            const index = updated.findIndex(
                (eq) => `${eq.zoneId}-${eq.connectionType}` === equipmentId
            );
            if (index !== -1) {
                updated[index].equipment = equipment;

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

    useEffect(() => {
        initializeConnectionPointEquipments();
    }, [initializeConnectionPointEquipments]);

    useEffect(() => {
        if (connectionPointEquipments.length > 0) {
            fetchConnectionCategories();
        }
    }, [connectionPointEquipments.length, fetchConnectionCategories]);

    const onConnectionEquipmentsChangeRef = useRef(onConnectionEquipmentsChange);
    onConnectionEquipmentsChangeRef.current = onConnectionEquipmentsChange;

    useEffect(() => {
        if (onConnectionEquipmentsChangeRef.current) {
            onConnectionEquipmentsChangeRef.current(connectionPointEquipments);
        }
    }, [connectionPointEquipments]);

    return (
        <div className="rounded-lg bg-green-300 p-6">
            <div>
                <div className="mb-2 flex flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="m-0 p-0 text-2xl font-bold text-green-800">
                            🔗 {t('อุปกรณ์เชื่อมต่อท่อ')}
                        </h3>
                    </div>
                </div>

                {activeZone && (
                    <div className="mb-2 rounded bg-green-900 p-2">
                        <h4 className="flex items-center gap-4 text-[12px] font-medium text-green-300">
                            โซน: <span className="text-green-200">{activeZone.name}</span>
                        </h4>
                    </div>
                )}

                <div className="mt-4 rounded-lg bg-gray-700 px-2 py-4">
                    {connectionPointEquipments.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-1">
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
                                                            let label = eq.name || eq.product_code;
                                                            if (eq.name && eq.product_code) {
                                                                label = `${eq.name} (${eq.product_code})`;
                                                            }

                                                            const attributes: string[] = [];
                                                            if (eq.main_pipe_inch)
                                                                attributes.push(
                                                                    `ขนาด: ${eq.main_pipe_inch}นิ้ว`
                                                                );
                                                            if (eq.size_inch)
                                                                attributes.push(
                                                                    `ขนาด: ${eq.size_inch}นิ้ว`
                                                                );

                                                            if (attributes.length > 0) {
                                                                label += ` - ${attributes.join(', ')}`;
                                                            }

                                                            return {
                                                                value: String(eq.id),
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

                                        {equipment.equipment && (
                                            <div className="mt-2 rounded bg-gray-500 p-2">
                                                <div className="flex gap-3">
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

                                                    <div className="flex-1 text-xs text-gray-200">
                                                        <div className="flex justify-between">
                                                            <span>{t('รหัสสินค้า')}:</span>
                                                            <span>
                                                                {equipment.equipment.product_code}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t('ชื่อสินค้า')}:</span>
                                                            <span>
                                                                {equipment.equipment.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t('ราคา/ชิ้น')}:</span>
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
                                                        {/* <div className="flex justify-between">
                                                            <span>{t('ราคารวม')}:</span>
                                                            <span className="font-semibold text-green-300">
                                                                {(
                                                                    equipment.equipment.price *
                                                                    equipment.count
                                                                ).toLocaleString()}{' '}
                                                                {t('บาท')}
                                                            </span>
                                                        </div> */}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded bg-gray-600 p-4 text-center text-sm text-gray-400">
                            {t('ไม่มีจุดเชื่อมต่อท่อสำหรับโซนนี้')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConnectionEquipmentsSelector;

