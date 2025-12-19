import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { useLanguage } from '../../contexts/LanguageContext';

interface AreaInputMethodProps {
    crops?: string;
}

export default function AreaInputMethod({ crops }: AreaInputMethodProps) {
    const { t } = useLanguage();
    const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

    // Parse crops from URL parameter
    useEffect(() => {
        if (crops) {
            const cropArray = crops.split(',').filter(Boolean);
            setSelectedCrops(cropArray);
        }
    }, [crops]);

    const handleMethodSelect = (method: string) => {
        setSelectedMethod(method);
    };

    const handleProceed = () => {
        if (selectedMethod === 'draw') {
            // Navigate to greenhouse planner with draw mode
            window.location.href = `/greenhouse-planner?crops=${selectedCrops.join(',')}&method=draw`;
        } else if (selectedMethod === 'import') {
            // Navigate to file import page (not yet created)
            alert(t('ฟีเจอร์นำเข้าไฟล์กำลังพัฒนา กรุณาเลือก "วาดพื้นที่เอง" ก่อน'));
            // window.location.href = `/greenhouse-import?crops=${selectedCrops.join(',')}&method=import`;
        }
    };

    const handleBack = () => {
        // Save current data
        const currentData = {
            crops: selectedCrops.join(','),
            selectedMethod: selectedMethod,
            updatedAt: new Date().toISOString(),
        };
        localStorage.setItem('areaInputData', JSON.stringify(currentData));

        // Go back to crop selection page with selected crop data
        const queryParams = new URLSearchParams();
        if (selectedCrops.length > 0) {
            queryParams.set('crops', selectedCrops.join(','));
        }

        window.location.href = `/greenhouse-crop?${queryParams.toString()}`;
    };

    return (
        <div className="h-screen overflow-hidden bg-gray-900 text-white">
            {/* Fixed Navbar */}
            <div className="fixed left-0 right-0 top-0 z-50">
                <Navbar />
            </div>

            {/* Main Content with top padding to account for fixed navbar */}
            <div className="h-full overflow-y-auto pt-20">
                <div className="mx-auto max-w-6xl p-6">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="mb-4 flex items-center justify-between">
                            <button
                                onClick={handleBack}
                                className="flex items-center text-sm text-blue-400 hover:text-blue-300"
                            >
                                <svg
                                    className="mr-1 h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                                    />
                                </svg>
                                {t('กลับ')}
                            </button>

                            {/* Progress Indicator */}
                            <div className="flex items-center space-x-2 text-sm text-gray-400">
                                <span className="text-green-400">{t('เลือกพืช')}</span>
                                <span>→</span>
                                <span className="font-medium text-blue-400">
                                    {t('เลือกวิธีการวางแผน')}
                                </span>
                                <span>→</span>
                                <span>{t('ออกแบบพื้นที่')}</span>
                                <span>→</span>
                                <span>{t('ระบบน้ำ')}</span>
                            </div>
                        </div>

                        <h1 className="mb-2 text-3xl font-bold">
                            📐 {t('เลือกวิธีการวางแผนพื้นที่')}
                        </h1>
                        <p className="text-gray-400">
                            {t('เลือกวิธีการที่คุณต้องการใช้ในการกำหนดพื้นที่โรงเรือน')}
                        </p>
                    </div>

                    {/* Selected Crops Summary */}
                    {selectedCrops.length > 0 && (
                        <div className="mb-8 rounded-lg bg-gray-800 p-4">
                            <h3 className="mb-2 text-sm font-medium text-gray-300">
                                {t('พืชที่เลือก')} ({selectedCrops.length} {t('ชนิด')})
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {selectedCrops.map((crop, index) => (
                                    <span
                                        key={index}
                                        className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white"
                                    >
                                        {crop}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Method Selection Cards */}
                    <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Draw Method Card */}
                        <div
                            className={`group cursor-pointer rounded-xl border-2 bg-gray-800 p-8 transition-all hover:scale-105 ${
                                selectedMethod === 'draw'
                                    ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/50'
                                    : 'border-gray-600 hover:border-gray-500'
                            }`}
                            onClick={() => handleMethodSelect('draw')}
                        >
                            <div className="text-center">
                                <div className="mb-4 text-6xl">✏️</div>
                                <h3 className="mb-3 text-xl font-bold text-white">
                                    {t('วาดพื้นที่เอง')}
                                </h3>
                                <p className="mb-4 text-gray-400">
                                    {t('ใช้เครื่องมือวาดในระบบเพื่อกำหนดรูปร่างและขนาดโรงเรือน')}
                                </p>

                                <div className="space-y-2 text-left">
                                    <div className="flex items-center text-sm text-gray-300">
                                        <svg
                                            className="mr-2 h-4 w-4 text-green-400"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        {t('ง่ายและรวดเร็ว')}
                                    </div>
                                    <div className="flex items-center text-sm text-gray-300">
                                        <svg
                                            className="mr-2 h-4 w-4 text-green-400"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        {t('เหมาะสำหรับผู้เริ่มต้น')}
                                    </div>
                                    <div className="flex items-center text-sm text-gray-300">
                                        <svg
                                            className="mr-2 h-4 w-4 text-green-400"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        {t('ไม่ต้องเตรียมไฟล์')}
                                    </div>
                                    <div className="flex items-center text-sm text-gray-300">
                                        <svg
                                            className="mr-2 h-4 w-4 text-green-400"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        {t('มีเทมเพลตให้เลือก')}
                                    </div>
                                </div>

                                {selectedMethod === 'draw' && (
                                    <div className="mt-4">
                                        <span className="inline-flex items-center rounded-full bg-blue-500 px-3 py-1 text-sm font-medium text-white">
                                            ✓ {t('เลือกแล้ว')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Import Method Card */}
                        <div
                            className={`group cursor-pointer rounded-xl border-2 bg-gray-800 p-8 transition-all hover:scale-105 ${
                                selectedMethod === 'import'
                                    ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/50'
                                    : 'border-gray-600 hover:border-gray-500'
                            }`}
                            onClick={() => handleMethodSelect('import')}
                        >
                            <div className="text-center">
                                <div className="mb-4 text-6xl">📁</div>
                                <h3 className="mb-3 text-xl font-bold text-white">
                                    {t('นำเข้าไฟล์แบบแปลน')}
                                </h3>
                                <p className="mb-4 text-gray-400">
                                    {t('อัปโหลดไฟล์แบบแปลนที่มีอยู่แล้วเพื่อวาดทับและปรับแต่ง')}
                                </p>

                                <div className="space-y-2 text-left">
                                    <div className="flex items-center text-sm text-gray-300">
                                        <svg
                                            className="mr-2 h-4 w-4 text-green-400"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        {t('รองรับไฟล์ AutoCAD (DWG, DXF)')}
                                    </div>
                                    <div className="flex items-center text-sm text-gray-300">
                                        <svg
                                            className="mr-2 h-4 w-4 text-green-400"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        {t('รองรับไฟล์รูปภาพ (PNG, JPG)')}
                                    </div>
                                    <div className="flex items-center text-sm text-gray-300">
                                        <svg
                                            className="mr-2 h-4 w-4 text-green-400"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        {t('รองรับไฟล์ PDF')}
                                    </div>
                                    <div className="flex items-center text-sm text-gray-300">
                                        <svg
                                            className="mr-2 h-4 w-4 text-orange-400"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        {t('ต้องมีความรู้ด้านแบบแปลน')}
                                    </div>
                                </div>

                                {selectedMethod === 'import' && (
                                    <div className="mt-4">
                                        <span className="inline-flex items-center rounded-full bg-orange-500 px-3 py-1 text-sm font-medium text-white">
                                            ✓ {t('เลือกแล้ว')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Recommendation */}
                    <div className="mb-8 rounded-lg border border-blue-500/30 bg-blue-900/20 p-6">
                        <div className="flex items-start space-x-3">
                            <div className="text-2xl">💡</div>
                            <div>
                                <h4 className="mb-2 font-semibold text-blue-300">
                                    {t('คำแนะนำสำหรับผู้เริ่มต้น')}
                                </h4>
                                <p className="text-blue-100">
                                    {t(
                                        'หากคุณเป็นผู้เริ่มต้นหรือไม่มีไฟล์แบบแปลน แนะนำให้เลือก "วาดพื้นที่เอง" เพราะจะง่ายกว่าและมีเทมเพลตโรงเรือนมาตรฐานให้เลือกใช้'
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex justify-between">
                        <button
                            onClick={handleBack}
                            className="rounded-lg bg-gray-600 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700"
                        >
                            ← {t('กลับไปเลือกพืช')}
                        </button>

                        <button
                            onClick={handleProceed}
                            disabled={!selectedMethod}
                            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:opacity-50"
                        >
                            {selectedMethod === 'draw' && t('เริ่มวาดพื้นที่ →')}
                            {selectedMethod === 'import' && t('นำเข้าไฟล์ →')}
                            {!selectedMethod && t('เลือกวิธีการ →')}
                        </button>
                    </div>

                    {/* Method Preview */}
                    {selectedMethod && (
                        <div className="mt-8 rounded-lg bg-gray-800 p-6">
                            <h4 className="mb-4 text-lg font-semibold text-white">
                                {selectedMethod === 'draw' && '🎨 ' + t('ตัวอย่างการวาดพื้นที่')}
                                {selectedMethod === 'import' && '📋 ' + t('ขั้นตอนการนำเข้าไฟล์')}
                            </h4>

                            {selectedMethod === 'draw' && (
                                <div className="space-y-3 text-gray-300">
                                    <div className="flex items-center">
                                        <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                                            1
                                        </div>
                                        <span>{t('เลือกเทมเพลตโรงเรือนหรือวาดแบบอิสระ')}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                                            2
                                        </div>
                                        <span>{t('กำหนดขนาดและรูปร่างโรงเรือน')}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                                            3
                                        </div>
                                        <span>{t('เพิ่มแปลงปลูกและพื้นที่เดิน')}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                                            4
                                        </div>
                                        <span>{t('ยืนยันและไปขั้นตอนถัดไป')}</span>
                                    </div>
                                </div>
                            )}

                            {selectedMethod === 'import' && (
                                <div className="space-y-3 text-gray-300">
                                    <div className="flex items-center">
                                        <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
                                            1
                                        </div>
                                        <span>
                                            {t('อัปโหลดไฟล์แบบแปลน (DWG, DXF, PDF, หรือรูปภาพ)')}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
                                            2
                                        </div>
                                        <span>{t('ปรับขนาดและตำแหน่งให้ถูกต้อง')}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
                                            3
                                        </div>
                                        <span>{t('วาดทับพื้นที่โรงเรือนและแปลงปลูก')}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
                                            4
                                        </div>
                                        <span>{t('ยืนยันและไปขั้นตอนถัดไป')}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Add bottom padding to ensure content is not cut off */}
                    <div className="pb-8"></div>
                </div>
            </div>
        </div>
    );
}
