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
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-600">
                        <svg
                            className="h-10 w-10 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">เริ่มต้นใช้งาน</h3>
                </div>
                <div className="space-y-2 text-slate-300">
                    <p>ระบบนี้จะช่วยคุณออกแบบระบบน้ำหยดสำหรับแปลงเกษตรของคุณ</p>
                    <p>ทำตามขั้นตอนง่ายๆ เพียงไม่กี่คลิก</p>
                </div>
            </div>
        ),
    },
    {
        title: 'ขั้นตอนที่ 1: เลือกพืช',
        description: 'เลือกพืชที่คุณต้องการปลูก',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-600">
                        <svg
                            className="h-10 w-10 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">เลือกพืช</h3>
                </div>
                <div className="space-y-2 text-slate-300">
                    <p>1. คลิกปุ่ม "เพิ่มแปลง"</p>
                    <p>2. เลือกพืชที่ต้องการปลูก</p>
                    <p>3. ระบบจะคำนวณความต้องการน้ำอัตโนมัติ</p>
                </div>
            </div>
        ),
    },
    {
        title: 'ขั้นตอนที่ 2: วาดแผนที่',
        description: 'วาดพื้นที่แปลงเกษตรของคุณบนแผนที่',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-purple-600">
                        <svg
                            className="h-10 w-10 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                            />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">วาดแผนที่</h3>
                </div>
                <div className="space-y-2 text-slate-300">
                    <p>1. ใช้เครื่องมือวาดบนแผนที่เพื่อกำหนดพื้นที่แปลง</p>
                    <p>2. ระบุตำแหน่งแหล่งน้ำและปั๊ม</p>
                    <p>3. แบ่งโซนการให้น้ำตามต้องการ</p>
                </div>
            </div>
        ),
    },
    {
        title: 'ขั้นตอนที่ 3: วางตำแหน่งพืช',
        description: 'วางตำแหน่งพืชบนแผนที่',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-600">
                        <svg
                            className="h-10 w-10 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                            />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">วางตำแหน่งพืช</h3>
                </div>
                <div className="space-y-2 text-slate-300">
                    <p>1. คลิกบนแผนที่เพื่อวางตำแหน่งพืช</p>
                    <p>2. ระบบจะนับจำนวนพืชอัตโนมัติ</p>
                    <p>3. คำนวณความต้องการน้ำตามจำนวนพืช</p>
                </div>
            </div>
        ),
    },
    {
        title: 'ขั้นตอนที่ 4: วางท่อ',
        description: 'วางท่อเมน ท่อย่อย และท่อแขนง',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-600">
                        <svg
                            className="h-10 w-10 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">วางท่อ</h3>
                </div>
                <div className="space-y-2 text-slate-300">
                    <p>1. วางท่อเมนจากปั๊มไปยังโซน</p>
                    <p>2. วางท่อย่อยในแต่ละโซน</p>
                    <p>3. วางท่อแขนงเชื่อมต่อกับท่อย่อย</p>
                </div>
            </div>
        ),
    },
    {
        title: 'ขั้นตอนที่ 5: ดูผลลัพธ์',
        description: 'ดูสรุปและคำแนะนำอุปกรณ์',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600">
                        <svg
                            className="h-10 w-10 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">ดูผลลัพธ์</h3>
                </div>
                <div className="space-y-2 text-slate-300">
                    <p>1. ดูสรุปข้อมูลแปลงและพืช</p>
                    <p>2. ดูคำแนะนำขนาดท่อและปั๊ม</p>
                    <p>3. บันทึกโปรเจคเพื่อใช้งานในอนาคต</p>
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
                    <p className="text-sm text-slate-300">{manualPages[currentPage].description}</p>
                </div>

                {/* Content */}
                <div className="mb-6 min-h-[300px] md:min-h-[350px]">
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
