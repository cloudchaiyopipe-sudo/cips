import React, { useState } from 'react';
import { FaWater, FaTimes, FaRoute } from 'react-icons/fa';

interface AutoLateralPipeModalProps {
    isVisible: boolean;
    onModeSelect: (mode: 'through_submain' | 'from_submain', selectedZoneId?: string) => void;
    onCancel: () => void;
    zones?: Array<{
        id: string;
        name: string;
        plants: unknown[];
    }>;
    t: (key: string) => string;
}

const AutoLateralPipeModal: React.FC<AutoLateralPipeModalProps> = ({
    isVisible,
    onModeSelect,
    onCancel,
    zones = [],
    t,
}) => {
    const [selectedZone, setSelectedZone] = useState<string>('all');

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 w-full max-w-2xl rounded-lg border border-gray-200 bg-gray-800 p-6 shadow-2xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                        <FaWater className="text-blue-600" />
                        {t('เลือกโหมดลากท่อย่อยอัตโนมัติ') || 'เลือกโหมดลากท่อย่อยอัตโนมัติ'}
                    </h3>
                    <button
                        onClick={onCancel}
                        className="text-white transition-colors hover:text-gray-400"
                        title={t('ปิด') || 'ปิด'}
                    >
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Zone Selection */}
                <div className="mb-6">
                    <h4 className="mb-3 text-lg font-semibold text-white">
                        🎯 {t('เลือกโซนที่ต้องการสร้างท่อย่อย') || 'เลือกโซนที่ต้องการสร้างท่อย่อย'}
                    </h4>
                    <div className="space-y-2">
                        {/* All Zones Option */}
                        <label className="flex cursor-pointer items-center rounded-lg border border-gray-600 p-3 hover:bg-gray-700">
                            <input
                                type="radio"
                                name="zone"
                                value="all"
                                checked={selectedZone === 'all'}
                                onChange={(e) => setSelectedZone(e.target.value)}
                                className="mr-3 h-4 w-4 text-blue-600"
                            />
                            <div>
                                <div className="font-medium text-white">
                                    🌍 {t('ทุกโซน') || 'ทุกโซน'}
                                </div>
                                <div className="text-sm text-gray-400">
                                    {t('สร้างท่อย่อยในทุกโซนพร้อมกัน') ||
                                        'สร้างท่อย่อยในทุกโซนพร้อมกัน'}
                                </div>
                            </div>
                        </label>

                        {/* Individual Zone Options */}
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                            {zones.map((zone) => (
                                <label
                                    key={zone.id}
                                    className="flex cursor-pointer items-center rounded-lg border border-gray-600 p-3 hover:bg-gray-700"
                                >
                                    <input
                                        type="radio"
                                        name="zone"
                                        value={zone.id}
                                        checked={selectedZone === zone.id}
                                        onChange={(e) => setSelectedZone(e.target.value)}
                                        className="mr-3 h-4 w-4 text-blue-600"
                                    />
                                    <div>
                                        <div className="font-medium text-white">🏷️ {zone.name}</div>
                                        <div className="text-sm text-gray-400">
                                            {zone.plants.length} {t('ต้นไม้') || 'ต้นไม้'}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Mode Options */}
                <div className="mb-6">
                    <div className="flex flex-col gap-4 md:flex-row">
                        {/* Mode 1: Through SubMain */}
                        <button
                            onClick={() =>
                                onModeSelect(
                                    'through_submain',
                                    selectedZone === 'all' ? undefined : selectedZone
                                )
                            }
                            className="group w-full md:w-1/2 rounded-lg border-2 border-gray-200 p-6 text-left transition-all hover:border-blue-300 hover:bg-blue-600"
                        >
                            <h3 className="mb-4 text-xl font-semibold text-white text-center">
                                {t('ลากผ่านท่อ Sub Main') || 'ลากผ่านท่อ Sub Main'}
                            </h3>
                            <div className="flex items-center gap-6">
                                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 transition-colors group-hover:bg-blue-200">
                                    <FaRoute className="text-green-600" size={32} />
                                </div>
                                <div className="flex-1">

                                    <p className="text-sm text-gray-300">
                                        {t('ท่อย่อยจะลากตัดผ่านท่อ Sub Main ตามแนวต้นไม้ในโซน') ||
                                            'ท่อย่อยจะลากตัดผ่านท่อ Sub Main ตามแนวต้นไม้ในโซน'}
                                    </p>
                                </div>
                            </div>
                        </button>

                        {/* Mode 2: From SubMain */}
                        <button
                            onClick={() =>
                                onModeSelect(
                                    'from_submain',
                                    selectedZone === 'all' ? undefined : selectedZone
                                )
                            }
                            className="group w-full md:w-1/2 rounded-lg border-2 border-gray-200 p-6 text-left transition-all hover:border-green-300 hover:bg-green-600"
                        >
                            <h3 className="mb-4 text-xl font-semibold text-white text-center">
                                {t('เริ่มจากท่อ Sub Main') || 'เริ่มจากท่อ Sub Main'}
                            </h3>
                            <div className="flex items-center gap-6">
                                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-green-100 transition-colors group-hover:bg-green-200">
                                    <FaRoute className="text-yellow-600" size={32} />
                                </div>
                                <div className="flex-1">

                                    <p className="text-sm text-gray-300">
                                        {t(
                                            'ท่อย่อยจะเริ่มต้นจากท่อ Sub Main และลากออกไปตามแนวต้นไม้'
                                        ) || 'ท่อย่อยจะเริ่มต้นจากท่อ Sub Main และลากออกไปตามแนวต้นไม้'}
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Cancel Button */}
                <div className="mt-6">
                    <button
                        onClick={onCancel}
                        className="w-full rounded-md bg-gray-600 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-700"
                    >
                        {t('ยกเลิก') || 'ยกเลิก'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AutoLateralPipeModal;
