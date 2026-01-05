/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { FaTimes, FaCheck, FaMagic } from 'react-icons/fa';

interface Zone {
    id: string;
    name: string;
    color: string;
    coordinates: { lat: number; lng: number }[];
}

interface IrrigationZone {
    id: string;
    name: string;
    color: string;
    plants: any[];
    coordinates: { lat: number; lng: number }[];
}

interface AutoLateralPipeModalProps {
    isOpen: boolean;
    onClose: () => void;
    zones: Zone[];
    irrigationZones: IrrigationZone[];
    onGenerate: (selectedZoneIds: string[], connectionMode: 'connect' | 'intersect') => void;
    t: (key: string) => string;
}

const AutoLateralPipeModal: React.FC<AutoLateralPipeModalProps> = ({
    isOpen,
    onClose,
    zones,
    irrigationZones,
    onGenerate,
    t,
}) => {
    const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
    const [connectionMode, setConnectionMode] = useState<'connect' | 'intersect'>('connect');
    const [isGenerating, setIsGenerating] = useState(false);

    // Combine zones and irrigation zones (deduplicate by id)
    const allZonesArray = [
        ...zones.map((z) => ({ id: z.id, name: z.name || `โซน ${zones.indexOf(z) + 1}`, color: z.color })),
        ...irrigationZones.map((z) => ({ id: z.id, name: z.name, color: z.color })),
    ];
    
    // Deduplicate zones by id
    const allZones = Array.from(
        new Map(allZonesArray.map((zone) => [zone.id, zone])).values()
    );

    useEffect(() => {
        if (isOpen) {
            // Default: select all zones (deduplicated)
            const uniqueZoneIds = Array.from(new Set(allZones.map((z) => z.id)));
            setSelectedZoneIds(uniqueZoneIds);
            setConnectionMode('connect');
            setIsGenerating(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleToggleZone = (zoneId: string) => {
        setSelectedZoneIds((prev) =>
            prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
        );
    };

    const handleSelectAll = () => {
        const uniqueZoneIds = Array.from(new Set(allZones.map((z) => z.id)));
        setSelectedZoneIds(uniqueZoneIds);
    };

    const handleDeselectAll = () => {
        setSelectedZoneIds([]);
    };

    const handleGenerate = async () => {
        if (selectedZoneIds.length === 0) {
            alert(t('กรุณาเลือกโซนอย่างน้อย 1 โซน'));
            return;
        }

        setIsGenerating(true);
        try {
            // Deduplicate selectedZoneIds before passing to onGenerate
            const uniqueZoneIds = Array.from(new Set(selectedZoneIds));
            await onGenerate(uniqueZoneIds, connectionMode);
            onClose();
        } catch (error) {
            console.error('Error generating auto lateral pipes:', error);
            alert(t('เกิดข้อผิดพลาดในการสร้างท่อย่อยอัตโนมัติ'));
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[9998] bg-black bg-opacity-50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-300 bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between rounded-t-lg bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-3 text-white">
                    <div className="flex items-center gap-2">
                        <FaMagic className="text-yellow-200" size={20} />
                        <span className="text-lg font-semibold">
                            {t('สร้างท่อย่อยอัตโนมัติ')}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-yellow-200 transition-colors hover:text-white"
                        title={t('ปิด')}
                        disabled={isGenerating}
                    >
                        <FaTimes size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="max-h-[70vh] overflow-y-auto p-6">
                    {/* Zone Selection */}
                    <div className="mb-6">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-800">
                                {t('เลือกโซนที่ต้องการสร้างท่อย่อย')}
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSelectAll}
                                    className="rounded-md bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200"
                                    disabled={isGenerating}
                                >
                                    {t('เลือกทั้งหมด')}
                                </button>
                                <button
                                    onClick={handleDeselectAll}
                                    className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                                    disabled={isGenerating}
                                >
                                    {t('ยกเลิกทั้งหมด')}
                                </button>
                            </div>
                        </div>

                        {allZones.length === 0 ? (
                            <div className="rounded-lg bg-yellow-50 p-4 text-center text-yellow-700">
                                {t('ไม่พบโซนในโครงการ กรุณาสร้างโซนก่อน')}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {allZones.map((zone) => (
                                    <label
                                        key={zone.id}
                                        className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-all ${
                                            selectedZoneIds.includes(zone.id)
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 bg-white hover:border-gray-300'
                                        } ${isGenerating ? 'cursor-not-allowed opacity-50' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedZoneIds.includes(zone.id)}
                                            onChange={() => handleToggleZone(zone.id)}
                                            disabled={isGenerating}
                                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="flex flex-1 items-center gap-2">
                                            <div
                                                className="h-4 w-4 rounded"
                                                style={{ backgroundColor: zone.color }}
                                            />
                                            <span className="font-medium text-gray-800">
                                                {zone.name}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Connection Mode Selection */}
                    <div className="mb-6">
                        <h3 className="mb-3 text-lg font-semibold text-gray-800">
                            {t('เลือกรูปแบบการเชื่อมต่อ')}
                        </h3>

                        <div className="space-y-3">
                            {/* Connect Mode */}
                            <label
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-all ${
                                    connectionMode === 'connect'
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                } ${isGenerating ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="connectionMode"
                                    value="connect"
                                    checked={connectionMode === 'connect'}
                                    onChange={() => setConnectionMode('connect')}
                                    disabled={isGenerating}
                                    className="mt-1 h-5 w-5 border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <div className="flex-1">
                                    <div className="mb-1 font-semibold text-gray-800">
                                        🔗 {t('เชื่อมกับท่อเมนรอง')}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {t(
                                            'ท่อย่อยจะเริ่มจากท่อเมนรองและวิ่งไปตามแถวต้นไม้ (เหมาะสำหรับระบบน้ำหยด)'
                                        )}
                                    </div>
                                </div>
                            </label>

                            {/* Intersect Mode */}
                            <label
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-all ${
                                    connectionMode === 'intersect'
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                } ${isGenerating ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="connectionMode"
                                    value="intersect"
                                    checked={connectionMode === 'intersect'}
                                    onChange={() => setConnectionMode('intersect')}
                                    disabled={isGenerating}
                                    className="mt-1 h-5 w-5 border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <div className="flex-1">
                                    <div className="mb-1 font-semibold text-gray-800">
                                        ⚡ {t('ตัดกับท่อเมนรอง')}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {t(
                                            'ท่อย่อยจะวิ่งผ่านท่อเมนรองตามแถวต้นไม้ (เหมาะสำหรับระบบสปริงเกอร์)'
                                        )}
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="rounded-lg bg-blue-50 p-4">
                        <div className="mb-2 font-semibold text-blue-800">
                            ℹ️ {t('หมายเหตุ')}:
                        </div>
                        <ul className="list-inside list-disc space-y-1 text-sm text-blue-700">
                            <li>{t('ระบบจะคำนวณแถวต้นไม้จากมุมเอียงและระยะห่างปัจจุบัน')}</li>
                            <li>{t('จะสร้างท่อย่อยในแถวที่ตัดฉากกับท่อเมนรองมากที่สุด')}</li>
                            <li>{t('ท่อย่อยจะหยุดที่ต้นไม้ต้นสุดท้ายของแต่ละแถว')}</li>
                            <li>
                                {t(
                                    'หากมีท่อเมนรองหลายเส้นในโซน จะเลือกเส้นที่ใกล้ที่สุดสำหรับแต่ละแถว'
                                )}
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 rounded-b-lg border-t border-gray-200 bg-gray-50 px-6 py-4">
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="rounded-md bg-gray-200 px-5 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t('ยกเลิก')}
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || selectedZoneIds.length === 0}
                        className="flex items-center gap-2 rounded-md bg-gradient-to-r from-yellow-500 to-orange-500 px-5 py-2 font-medium text-white transition-all hover:from-yellow-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isGenerating ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                <span>{t('กำลังสร้าง')}...</span>
                            </>
                        ) : (
                            <>
                                <FaCheck size={16} />
                                <span>{t('สร้างท่อย่อย')}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
};

export default AutoLateralPipeModal;

