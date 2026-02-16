/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import SearchableDropdown from './SearchableDropdown';

const STORAGE_KEY = 'gardenConnectorEquipmentSelections';

export type ConnectorSummary = {
    byWays: { [ways: number]: number };
    straightCouplers: number;
};

type ConnectorItem = {
    key: string;
    label: string;
    count: number;
    category: string | null;
    equipment: any;
};

interface GardenConnectorEquipmentsSelectorProps {
    connectorSummary: ConnectorSummary | null | undefined;
}

const GardenConnectorEquipmentsSelector: React.FC<GardenConnectorEquipmentsSelectorProps> = ({
    connectorSummary,
}) => {
    const { t } = useLanguage();
    const [items, setItems] = useState<ConnectorItem[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [equipments, setEquipments] = useState<any[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [equipmentsLoading, setEquipmentsLoading] = useState(false);

    useEffect(() => {
        if (!connectorSummary) {
            setItems([]);
            return;
        }
        const byWays = connectorSummary.byWays || {};
        const straight = connectorSummary.straightCouplers ?? 0;
        const list: ConnectorItem[] = [];
        Object.entries(byWays)
            .sort(([a], [b]) => Number(a) - Number(b))
            .forEach(([ways, count]) => {
                if (count > 0) {
                    list.push({
                        key: `way-${ways}`,
                        label: `${t('ข้อต่อ')} ${ways} ${t('ทาง')}`,
                        count,
                        category: null,
                        equipment: null,
                    });
                }
            });
        if (straight > 0) {
            list.push({
                key: 'straight',
                label: t('ต่อตรง'),
                count: straight,
                category: null,
                equipment: null,
            });
        }
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            const selections = saved ? JSON.parse(saved) : {};
            list.forEach((it) => {
                const s = selections[it.key];
                if (s) {
                    it.category = s.category || null;
                    it.equipment = s.equipment || null;
                }
            });
        } catch (_) {
            /* ignore */
        }
        setItems(list);
    }, [connectorSummary, t]);

    useEffect(() => {
        if (items.length === 0) return;
        setCategoriesLoading(true);
        fetch('/api/equipment-categories')
            .then((r) => (r.ok ? r.json() : []))
            .then((cats: any[]) => {
                const filtered = (cats || []).filter(
                    (c: any) => c.name === 'agricultural_fittings' || c.name === 'pvc_fittings'
                );
                setCategories(filtered);
            })
            .catch(() => setCategories([]))
            .finally(() => setCategoriesLoading(false));
    }, [items.length]);

    const updateCategory = useCallback((key: string, category: string) => {
        setItems((prev) => {
            const next = prev.map((it) =>
                it.key === key ? { ...it, category, equipment: null } : it
            );
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                const selections = saved ? JSON.parse(saved) : {};
                if (!selections[key]) selections[key] = {};
                selections[key].category = category;
                selections[key].equipment = null;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
            } catch (_) {}
            return next;
        });
        setEquipmentsLoading(true);
        fetch(`/api/equipments/by-category/${category}`)
            .then((r) => (r.ok ? r.json() : []))
            .then(setEquipments)
            .catch(() => setEquipments([]))
            .finally(() => setEquipmentsLoading(false));
    }, []);

    const updateEquipment = useCallback((key: string, equipment: any) => {
        setItems((prev) => {
            const next = prev.map((it) => (it.key === key ? { ...it, equipment } : it));
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                const selections = saved ? JSON.parse(saved) : {};
                if (!selections[key]) selections[key] = {};
                selections[key].equipment = equipment;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
            } catch (_) {}
            return next;
        });
    }, []);

    if (!connectorSummary || items.length === 0) return null;

    return (
        <div className="rounded-lg bg-yellow-300 p-6">
            <h3 className="m-0 mb-3 p-0 text-xl font-bold text-yellow-800">
                🔗 {t('ข้อต่อที่ต้องใช้')}
            </h3>
            <div className="grid grid-cols-1 gap-3">
                {items.map((item) => (
                    <div key={item.key} className="rounded bg-gray-700 p-3">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{item.label}</span>
                            <span className="text-xs text-gray-300">
                                {item.count} {t('อัน')}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                            <div>
                                <label className="mb-1 block text-xs text-gray-300">{t('หมวดหมู่')}</label>
                                {categories.length > 0 ? (
                                    <SearchableDropdown
                                        options={categories.map((c: any) => ({
                                            value: c.name,
                                            label: c.display_name || c.name,
                                        }))}
                                        value={item.category || ''}
                                        onChange={(value) => updateCategory(item.key, value as string)}
                                        placeholder={t('หมวดหมู่')}
                                        className="text-sm"
                                    />
                                ) : (
                                    <div className="rounded border border-gray-500 bg-gray-600 p-2 text-xs text-gray-400">
                                        {categoriesLoading ? t('กำลังโหลด...') : t('ไม่พบหมวดหมู่')}
                                    </div>
                                )}
                            </div>
                            <div className="sm:col-span-3">
                                <label className="mb-1 block text-xs text-gray-300">{t('อุปกรณ์')}</label>
                                {item.category ? (
                                    <SearchableDropdown
                                        options={equipments.map((eq: any) => {
                                            let label = eq.name || eq.product_code || '';
                                            if (eq.name && eq.product_code) label = `${eq.name} (${eq.product_code})`;
                                            const attrs: string[] = [];
                                            if (eq.main_pipe_inch) attrs.push(`ขนาด: ${eq.main_pipe_inch}นิ้ว`);
                                            if (eq.size_inch) attrs.push(`ขนาด: ${eq.size_inch}นิ้ว`);
                                            if (attrs.length) label += ` - ${attrs.join(', ')}`;
                                            return { value: String(eq.id), label };
                                        })}
                                        value={item.equipment?.id ? String(item.equipment.id) : ''}
                                        onChange={(value) => {
                                            const eq = equipments.find((e: any) => String(e.id) === String(value));
                                            updateEquipment(item.key, eq || null);
                                        }}
                                        placeholder={t('เลือกอุปกรณ์')}
                                        className="text-sm"
                                    />
                                ) : (
                                    <div className="rounded border border-gray-500 bg-gray-600 p-2 text-xs text-gray-400">
                                        {t('กรุณาเลือกหมวดหมู่ก่อน')}
                                    </div>
                                )}
                            </div>
                        </div>
                        {item.equipment && (
                            <div className="mt-2 flex gap-3 rounded bg-gray-600 p-2 text-xs text-gray-200">
                                {item.equipment.image && (
                                    <img
                                        src={item.equipment.image}
                                        alt={item.equipment.name || item.equipment.product_code}
                                        className="h-12 w-12 rounded object-cover"
                                    />
                                )}
                                <div>
                                    <div>{item.equipment.product_code} — {item.equipment.name}</div>
                                    <div>{t('ราคา')}: {item.equipment.price?.toLocaleString()} {t('บาท')} · {t('จำนวนที่ต้องการ')}: {item.count} {t('ชิ้น')}</div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GardenConnectorEquipmentsSelector;
