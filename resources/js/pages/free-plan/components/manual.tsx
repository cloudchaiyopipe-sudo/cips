// Manual/Tutorial Component
import { useState } from 'react';
import { getTranslations } from '../utils/language';

interface ManualProps {
    onClose: () => void;
}

// Manual pages content
const manualPages = [
    {
        title: 'ยินดีต้อนรับสู่ Free Plan',
        description: 'ระบบออกแบบระบบน้ำหยดอัตโนมัติสำหรับเกษตรกร',
        image: '/freePlanImg/freeManual/manual_1.jpg',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-80 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-700 md:h-96">
                        <img
                            src="/freePlanImg/freeManual/manual_1.jpg"
                            alt="เริ่มต้นใช้งาน"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                    target.parentElement.innerHTML = '<div class="flex h-full w-full items-center justify-center text-slate-400">ไม่มีรูปภาพ</div>';
                                }
                            }}
                        />
                    </div>
                    <h3 className="text-xl font-bold text-white">เริ่มต้นใช้งาน</h3>
                </div>
            </div>
        ),
    },
    {
        title: 'ขั้นตอนที่ 1: เลือกพืช',
        description: 'เลือกพืชที่คุณต้องการปลูก',
        image: '/freePlanImg/freeManual/manual_2.jpg',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-80 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-700 md:h-96">
                        <img
                            src="/freePlanImg/freeManual/manual_2.jpg"
                            alt="เลือกพืช"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                    target.parentElement.innerHTML = '<div class="flex h-full w-full items-center justify-center text-slate-400">ไม่มีรูปภาพ</div>';
                                }
                            }}
                        />
                    </div>
                    <h3 className="text-xl font-bold text-white">เลือกพืช</h3>
                </div>
            </div>
        ),
    },
    {
        title: 'ขั้นตอนที่ 2: วาดแผนที่',
        description: 'วาดพื้นที่แปลงเกษตรของคุณบนแผนที่',
        image: '/freePlanImg/freeManual/manual_3.jpg',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-80 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-700 md:h-96">
                        <img
                            src="/freePlanImg/freeManual/manual_3.jpg"
                            alt="วาดแผนที่"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                    target.parentElement.innerHTML = '<div class="flex h-full w-full items-center justify-center text-slate-400">ไม่มีรูปภาพ</div>';
                                }
                            }}
                        />
                    </div>
                    <h3 className="text-xl font-bold text-white">วาดแผนที่</h3>
                </div>
            </div>
        ),
    },
    {
        title: 'ขั้นตอนที่ 3: วางตำแหน่งพืช',
        description: 'วางตำแหน่งพืชบนแผนที่',
        image: '/freePlanImg/freeManual/manual_4.jpg',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-80 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-700 md:h-96">
                        <img
                            src="/freePlanImg/freeManual/manual_4.jpg"
                            alt="วางตำแหน่งพืช"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                    target.parentElement.innerHTML = '<div class="flex h-full w-full items-center justify-center text-slate-400">ไม่มีรูปภาพ</div>';
                                }
                            }}
                        />
                    </div>
                    <h3 className="text-xl font-bold text-white">วางตำแหน่งพืช</h3>
                </div>
            </div>
        ),
    },
    {
        title: 'ขั้นตอนที่ 4: วางท่อ',
        description: 'วางท่อเมน ท่อย่อย และท่อแขนง',
        image: '/freePlanImg/freeManual/manual_5.jpg',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-80 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-700 md:h-96">
                        <img
                            src="/freePlanImg/freeManual/manual_5.jpg"
                            alt="วางท่อ"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                    target.parentElement.innerHTML = '<div class="flex h-full w-full items-center justify-center text-slate-400">ไม่มีรูปภาพ</div>';
                                }
                            }}
                        />
                    </div>
                    <h3 className="text-xl font-bold text-white">วางท่อ</h3>
                </div>
            </div>
        ),
    },
];

function Manual({ onClose }: ManualProps) {
    const [currentPage, setCurrentPage] = useState(0);
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [translations] = useState(getTranslations());

    const handleNext = () => {
        if (currentPage < manualPages.length - 1) {
            setCurrentPage(currentPage + 1);
        } else {
            handleClose();
        }
    };

    const handlePrev = () => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleClose = () => {
        if (dontShowAgain) {
            // Save to localStorage to not show again
            localStorage.setItem('manualDontShowAgain', 'true');
        }
        onClose();
    };

    const handleSkip = () => {
        handleClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative mx-4 w-full max-w-2xl rounded-2xl bg-slate-800 p-6 shadow-2xl md:p-8 lg:max-w-3xl">
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
                >
                    ✕
                </button>

                {/* Header */}
                <div className="mb-6 text-center">
                    <h2 className="mb-2 text-2xl font-bold text-white">
                        {manualPages[currentPage].title}
                    </h2>
                </div>

                {/* Content */}
                <div className="mb-6 min-h-[350px] md:min-h-[400px]">
                    {manualPages[currentPage].content}
                </div>

                {/* Progress Indicators */}
                <div className="mb-6 flex items-center justify-center gap-2">
                    {manualPages.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentPage(index)}
                            className={`h-3 w-3 rounded-full transition-colors ${
                                index === currentPage
                                    ? 'w-8 bg-blue-400'
                                    : 'bg-slate-500 hover:bg-slate-400'
                            }`}
                        />
                    ))}
                </div>

                {/* Navigation Controls */}
                <div className="mb-4 flex items-center justify-between">
                    <button
                        onClick={handlePrev}
                        disabled={currentPage === 0}
                        className={`rounded px-4 py-2 text-sm text-white transition-colors ${
                            currentPage === 0
                                ? 'cursor-not-allowed bg-slate-600 opacity-50'
                                : 'bg-slate-600 hover:bg-slate-700'
                        }`}
                    >
                        {translations.back || 'ย้อนกลับ'}
                    </button>

                    <button
                        onClick={handleSkip}
                        className="rounded px-4 py-2 text-sm text-slate-400 transition-colors hover:text-white"
                    >
                        ข้าม
                    </button>

                    <button
                        onClick={handleNext}
                        className="rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                    >
                        {currentPage === manualPages.length - 1
                            ? 'เสร็จสิ้น'
                            : translations.next || 'ถัดไป'}
                    </button>
                </div>

                {/* Don't Show Again Checkbox */}
                <div className="flex items-center justify-center gap-2 border-t border-slate-700 pt-4">
                    <input
                        type="checkbox"
                        id="dontShowAgain"
                        checked={dontShowAgain}
                        onChange={(e) => setDontShowAgain(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <label
                        htmlFor="dontShowAgain"
                        className="cursor-pointer select-none text-sm text-slate-300"
                    >
                        ไม่แสดงคู่มือนี้อีก
                    </label>
                </div>
            </div>
        </div>
    );
}

export default Manual;
