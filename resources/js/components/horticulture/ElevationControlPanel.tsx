import React, { useState } from 'react';
import { FaMountain, FaMousePointer, FaRoute, FaTimes } from 'react-icons/fa';
import ElevationClickHandler from './ElevationClickHandler';
import ElevationProfile from './ElevationProfile';

interface ElevationControlPanelProps {
    map: google.maps.Map | null;
    isVisible: boolean;
    onClose: () => void;
    t: (key: string) => string;
}

type ElevationMode = 'click' | 'profile' | null;

const ElevationControlPanel: React.FC<ElevationControlPanelProps> = ({
    map,
    isVisible,
    onClose,
    t,
}) => {
    const [activeMode, setActiveMode] = useState<ElevationMode>(null);

    if (!isVisible) return null;

    const handleModeSelect = (mode: ElevationMode) => {
        setActiveMode(mode);
    };

    const handleClose = () => {
        setActiveMode(null);
        onClose();
    };

    return (
        <>
            {/* Main Control Panel */}
            <div className="fixed left-4 top-4 z-[1000] max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FaMountain className="text-blue-600" size={18} />
                        <h3 className="font-semibold text-gray-800">
                            {t('เครื่องมือความสูงต่ำ') || 'เครื่องมือความสูงต่ำ'}
                        </h3>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 transition-colors hover:text-gray-600"
                    >
                        <FaTimes size={16} />
                    </button>
                </div>

                <div className="space-y-3">
                    <div className="mb-3 text-sm text-gray-600">
                        {t('เลือกเครื่องมือที่ต้องการใช้:') || 'เลือกเครื่องมือที่ต้องการใช้:'}
                    </div>

                    {/* Elevation Click Button */}
                    <button
                        onClick={() => handleModeSelect('click')}
                        className={`w-full rounded-lg border-2 p-3 transition-all ${
                            activeMode === 'click'
                                ? 'border-green-300 bg-green-50 text-green-800'
                                : 'border-gray-200 text-gray-700 hover:border-green-200 hover:bg-green-50'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                                <FaMousePointer className="text-green-600" size={18} />
                            </div>
                            <div className="text-left">
                                <div className="font-medium">
                                    {t('คลิกเพื่อดูความสูง') || 'คลิกเพื่อดูความสูง'}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {t('คลิกบนแผนที่เพื่อดูความสูง ณ จุดนั้น') ||
                                        'คลิกบนแผนที่เพื่อดูความสูง ณ จุดนั้น'}
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* Elevation Profile Button */}
                    <button
                        onClick={() => handleModeSelect('profile')}
                        className={`w-full rounded-lg border-2 p-3 transition-all ${
                            activeMode === 'profile'
                                ? 'border-purple-300 bg-purple-50 text-purple-800'
                                : 'border-gray-200 text-gray-700 hover:border-purple-200 hover:bg-purple-50'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                                <FaRoute className="text-purple-600" size={18} />
                            </div>
                            <div className="text-left">
                                <div className="font-medium">
                                    {t('กราฟแสดงความสูง') || 'กราฟแสดงความสูง'}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {t('ลากเส้นเพื่อดูกราฟกราฟแสดงความสูง') ||
                                        'ลากเส้นเพื่อดูกราฟกราฟแสดงความสูง'}
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* Instructions */}
                    <div className="mt-4 rounded-lg bg-gray-50 p-3">
                        <div className="text-xs text-gray-600">
                            <div className="mb-1 font-medium">
                                {t('วิธีใช้งาน:') || 'วิธีใช้งาน:'}
                            </div>
                            <div className="space-y-1">
                                <div>
                                    •{' '}
                                    {t('เลือกเครื่องมือที่ต้องการ') || 'เลือกเครื่องมือที่ต้องการ'}
                                </div>
                                <div>• {t('ทำตามคำแนะนำบนหน้าจอ') || 'ทำตามคำแนะนำบนหน้าจอ'}</div>
                                <div>
                                    •{' '}
                                    {t('กดปุ่ม X เพื่อปิดเครื่องมือ') ||
                                        'กดปุ่ม X เพื่อปิดเครื่องมือ'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Elevation Click Handler Component */}
            <ElevationClickHandler
                map={map}
                isActive={activeMode === 'click'}
                onToggle={() => setActiveMode(null)}
                t={t}
            />

            {/* Elevation Profile Component */}
            <ElevationProfile
                map={map}
                isActive={activeMode === 'profile'}
                onToggle={() => setActiveMode(null)}
                t={t}
            />
        </>
    );
};

export default ElevationControlPanel;
