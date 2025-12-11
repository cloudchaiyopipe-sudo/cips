// 1. Import
import { useState, useEffect, useRef } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import QRCodeSVG from 'react-qr-code';
import FreeNav from './components/freeNav';
import { getTranslations } from './utils/language';
import { motion, AnimatePresence } from 'framer-motion';
import { SharedData } from '@/types';

// 2. Component
function FreeCheckout() {
    // Get user data from Inertia page props
    const page = usePage<SharedData>();
    const user = page.props.auth?.user;
    const isAdmin = user?.is_admin || false;
    // LINE Official Account ID - Load from localStorage or use default
    const [lineId, setLineId] = useState<string>('@fang.nitipoom');
    const [showLineIdModal, setShowLineIdModal] = useState(false);
    const [lineIdInput, setLineIdInput] = useState<string>('');

    const LINE_FRIEND_URL = `https://line.me/R/ti/p/${lineId}`;

    const [translations, setTranslations] = useState(getTranslations());
    const qrCodeRef = useRef<HTMLDivElement>(null);
    const [sprinklerSpecs, setSprinklerSpecs] = useState<{
        flowRatePerMin: number;
        waterPressure: number;
        radius: number;
        totalLPM: number;
    } | null>(null);
    const [calculatedSprinklerSpecs, setCalculatedSprinklerSpecs] = useState<{
        flowRatePerMin: number;
        waterPressure: number;
        radius: number;
        totalLPM: number;
    } | null>(null);
    const [sprinklerMode, setSprinklerMode] = useState<'preset' | 'calculated'>('preset');
    const [pipeRecommendations, setPipeRecommendations] = useState<{
        main: { sizeMM: number; sizeInch: string; reason: string };
        subMain: { sizeMM: number; sizeInch: string; reason: string };
        lateral: { sizeMM: number; sizeInch: string; reason: string };
    } | null>(null);
    const [pipeTypeRecommendations, setPipeTypeRecommendations] = useState<{
        main?: {
            pe?: { sizeMM: number; sizeInch: string; pressureLoss?: number };
            pvc?: { sizeMM: number; sizeInch: string; pressureLoss?: number };
        };
        subMain?: {
            pe?: { sizeMM: number; sizeInch: string; pressureLoss?: number };
            pvc?: { sizeMM: number; sizeInch: string; pressureLoss?: number };
        };
        lateral?: {
            pe?: { sizeMM: number; sizeInch: string; pressureLoss?: number };
            pvc?: { sizeMM: number; sizeInch: string; pressureLoss?: number };
        };
    } | null>(null);
    const [pumpRecommendations, setPumpRecommendations] = useState<{
        flowRate: number;
        head: number;
        power: number;
        reason: string;
        specifications: string;
    } | null>(null);

    // Listen for language changes
    useEffect(() => {
        const handleLanguageChange = () => setTranslations(getTranslations());
        window.addEventListener('storage', handleLanguageChange);
        window.addEventListener('languageChanged', handleLanguageChange);
        window.addEventListener('focus', handleLanguageChange);
        return () => {
            window.removeEventListener('storage', handleLanguageChange);
            window.removeEventListener('languageChanged', handleLanguageChange);
            window.removeEventListener('focus', handleLanguageChange);
        };
    }, []);

    // Load data from localStorage (Logic preserved)
    useEffect(() => {
        // Load LINE ID from localStorage
        const savedLineId = localStorage.getItem('lineId');
        if (savedLineId) {
            setLineId(savedLineId);
        }

        const savedFlowRateConfig = localStorage.getItem('flowRateConfig');
        const savedSprinklerMode = localStorage.getItem('sprinklerMode');

        let flowRateConfig = { flowRatePerMin: 2.5, waterPressure: 2.0, radius: 4.0 };
        if (savedFlowRateConfig) {
            try {
                const config = JSON.parse(savedFlowRateConfig);
                flowRateConfig = {
                    flowRatePerMin: config.flowRatePerMin || 2.5,
                    waterPressure: config.waterPressure || 2.0,
                    radius: config.radius || 4.0,
                };
            } catch (error) { console.error('Error loading config:', error); }
        }

        setSprinklerSpecs({
            flowRatePerMin: flowRateConfig.flowRatePerMin,
            waterPressure: flowRateConfig.waterPressure,
            radius: flowRateConfig.radius,
            totalLPM: 0,
        });

        if (savedSprinklerMode) setSprinklerMode(savedSprinklerMode as 'preset' | 'calculated');

        const savedCalculatedSpecs = localStorage.getItem('calculatedSprinklerSpecs');
        if (savedCalculatedSpecs) {
            try { setCalculatedSprinklerSpecs(JSON.parse(savedCalculatedSpecs)); } 
            catch (error) { console.error('Error loading calculated specs:', error); }
        }

        const savedPipeRecs = localStorage.getItem('pipeRecommendations');
        if (savedPipeRecs) {
            try { setPipeRecommendations(JSON.parse(savedPipeRecs)); }
            catch (error) { console.error('Error loading pipe recs:', error); }
        }

        const savedPipeTypeRecs = localStorage.getItem('pipeTypeRecommendations');
        if (savedPipeTypeRecs) {
            try { setPipeTypeRecommendations(JSON.parse(savedPipeTypeRecs)); }
            catch (error) { console.error('Error loading pipe type recs:', error); }
        }

        const savedPumpRecs = localStorage.getItem('pumpRecommendations');
        if (savedPumpRecs) {
            try { setPumpRecommendations(JSON.parse(savedPumpRecs)); }
            catch (error) { console.error('Error loading pump recs:', error); }
        }
    }, []);

    const handleBack = () => {
        router.visit('/free-plan/product');
    };

    const handleSaveImage = async () => {
        if (!qrCodeRef.current) return;
        try {
            const { default: html2canvas } = await import('html2canvas');
            const canvas = await html2canvas(qrCodeRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                logging: false,
            });
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `chaiyo-line-qr.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 'image/png');
        } catch (error) {
            console.error('Error saving image:', error);
            alert('ไม่สามารถบันทึกภาพได้ กรุณาลองอีกครั้ง');
        }
    };

    const handleOpenLineIdModal = () => {
        setLineIdInput(lineId);
        setShowLineIdModal(true);
    };

    const handleCloseLineIdModal = () => {
        setShowLineIdModal(false);
        setLineIdInput('');
    };

    const handleSaveLineId = () => {
        if (!lineIdInput.trim()) {
            alert('กรุณากรอก LINE ID');
            return;
        }
        // Remove @ if user includes it
        const cleanLineId = lineIdInput.trim().startsWith('@') 
            ? lineIdInput.trim() 
            : `@${lineIdInput.trim()}`;
        
        setLineId(cleanLineId);
        localStorage.setItem('lineId', cleanLineId);
        setShowLineIdModal(false);
    };

    const currentSpecs = sprinklerMode === 'preset' ? sprinklerSpecs : calculatedSprinklerSpecs;

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-200">
            <Head title={translations.checkout} />

            {/* Navbar */}
            <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <FreeNav />
            </div>

            {/* Main Content */}
            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8"
            >
                {/* Header */}
                <motion.div variants={itemVariants} className="mb-8 text-center">
                    <h1 className="mb-2 text-3xl font-bold text-white md:text-4xl bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                        {translations.checkoutModalTitle}
                    </h1>
                    <p className="text-slate-400">
                        {translations.checkoutModalMessage}
                    </p>
                </motion.div>

                <div className="grid gap-8 lg:grid-cols-3">
                    {/* Left Column: Specifications (2/3 width on large screens) */}
                    <div className="space-y-4 lg:col-span-2">
                        <motion.h2 variants={itemVariants} className="text-xl font-semibold text-white">
                            รายการอุปกรณ์ที่แนะนำ
                        </motion.h2>

                        {/* Sprinkler Card */}
                        <motion.div variants={itemVariants} className="group overflow-hidden rounded-2xl border border-white/5 bg-slate-800/40 backdrop-blur-sm transition-all hover:border-emerald-500/30 hover:bg-slate-800/60">
                            <div className="flex flex-col items-center gap-4 p-5 text-center">
                                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-emerald-500/10 p-2">
                                    <img src="/freePlanImg/sprinkler.png" alt="Sprinkler" className="h-full w-full object-contain drop-shadow-md" />
                                </div>
                                <h3 className="text-lg font-bold text-emerald-400">{translations.sprinklerSelector}</h3>
                                <div className="mt-2 grid w-full grid-cols-3 gap-2 text-sm">
                                    <div className="rounded-lg bg-slate-900/50 p-2 text-center">
                                        <div className="text-xs text-slate-500">{translations.flowRateProduct}</div>
                                        <div className="font-semibold text-white">{currentSpecs?.flowRatePerMin.toFixed(2) || '-'} LPM</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-900/50 p-2 text-center">
                                        <div className="text-xs text-slate-500">{translations.pressureProduct}</div>
                                        <div className="font-semibold text-white">{currentSpecs?.waterPressure || '-'} Bar</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-900/50 p-2 text-center">
                                        <div className="text-xs text-slate-500">{translations.radiusProduct}</div>
                                        <div className="font-semibold text-white">{currentSpecs?.radius || '-'} m</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Pipe Cards (Hierarchical Layout) */}
                        <motion.div variants={itemVariants} className="space-y-6">
                            {/* Main Pipe - Full Width */}
                            <div className="relative rounded-2xl border border-white/5 bg-slate-800/40 p-5 backdrop-blur-sm transition-all hover:border-rose-500/30 hover:bg-slate-800/60">
                                <div className="flex flex-col items-center gap-4 text-center">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-rose-500/10 p-2">
                                        <img src="/freePlanImg/pvc-pipes.png" alt="Main Pipe" className="h-full w-full object-contain drop-shadow-md" />
                                    </div>
                                    <h4 className="text-lg font-bold text-rose-300">{translations.mainPipeSelection}</h4>
                                    <div className="w-full rounded-lg bg-slate-900/50 p-3">
                                        <div className="text-lg font-semibold text-white">
                                            {pipeRecommendations?.main ? (
                                                (() => {
                                                    const pe = pipeTypeRecommendations?.main?.pe;
                                                    const pvc = pipeTypeRecommendations?.main?.pvc;
                                                    const parts: string[] = [];
                                                    if (pvc) parts.push(`PVC ${pvc.sizeInch}`);
                                                    if (pe) parts.push(`PE ${pe.sizeMM.toFixed(0)}mm`);
                                                    return parts.length > 0 ? parts.join(' / ') : `${pipeRecommendations.main.sizeMM.toFixed(0)}mm`;
                                                })()
                                            ) : 'Loading...'}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Connection Lines from Main to Sub Pipes */}
                                <div className="absolute bottom-0 left-1/4 h-6 w-0.5 -translate-x-1/2 translate-y-full bg-gradient-to-b from-rose-500/60 via-rose-500/40 to-violet-500/60"></div>
                                <div className="absolute bottom-0 left-3/4 h-6 w-0.5 -translate-x-1/2 translate-y-full bg-gradient-to-b from-rose-500/60 via-rose-500/40 to-amber-500/60"></div>
                            </div>

                            {/* Sub Pipes Row - Half Width Each with Connection Lines */}
                            <div className="relative grid grid-cols-2 gap-4">
                                {/* SubMain Pipe - Left Half */}
                                <div className="relative rounded-2xl border border-white/5 bg-slate-800/40 p-5 backdrop-blur-sm transition-all hover:border-violet-500/30 hover:bg-slate-800/60">
                                    {/* Connection Line from Main */}
                                    <div className="absolute left-1/2 top-0 h-6 w-0.5 -translate-x-1/2 -translate-y-full bg-gradient-to-b from-violet-500/60 to-violet-500/40"></div>
                                    
                                    <div className="flex flex-col items-center gap-4 text-center">
                                        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-violet-500/10 p-2">
                                            <img src="/freePlanImg/pvc-pipes.png" alt="SubMain Pipe" className="h-full w-full object-contain drop-shadow-md" />
                                        </div>
                                        <h4 className="text-lg font-bold text-violet-300">{translations.subMainPipeSelection}</h4>
                                        <div className="w-full rounded-lg bg-slate-900/50 p-3">
                                            <div className="text-lg font-semibold text-white">
                                                {pipeRecommendations?.subMain ? (
                                                    (() => {
                                                        const pe = pipeTypeRecommendations?.subMain?.pe;
                                                        const pvc = pipeTypeRecommendations?.subMain?.pvc;
                                                        const parts: string[] = [];
                                                        if (pvc) parts.push(`PVC ${pvc.sizeInch}`);
                                                        if (pe) parts.push(`PE ${pe.sizeMM.toFixed(0)}mm`);
                                                        return parts.length > 0 ? parts.join(' / ') : `${pipeRecommendations.subMain.sizeMM.toFixed(0)}mm`;
                                                    })()
                                                ) : 'Loading...'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Lateral Pipe - Right Half */}
                                <div className="relative rounded-2xl border border-white/5 bg-slate-800/40 p-5 backdrop-blur-sm transition-all hover:border-amber-500/30 hover:bg-slate-800/60">
                                    {/* Connection Line from Main */}
                                    <div className="absolute left-1/2 top-0 h-6 w-0.5 -translate-x-1/2 -translate-y-full bg-gradient-to-b from-amber-500/60 to-amber-500/40"></div>
                                    
                                    <div className="flex flex-col items-center gap-4 text-center">
                                        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-amber-500/10 p-2">
                                            <img src="/freePlanImg/pvc-pipes.png" alt="Lateral Pipe" className="h-full w-full object-contain drop-shadow-md" />
                                        </div>
                                        <h4 className="text-lg font-bold text-amber-300">{translations.lateralPipeSelection}</h4>
                                        <div className="w-full rounded-lg bg-slate-900/50 p-3">
                                            <div className="text-lg font-semibold text-white">
                                                {pipeRecommendations?.lateral ? (
                                                    (() => {
                                                        const pe = pipeTypeRecommendations?.lateral?.pe;
                                                        const pvc = pipeTypeRecommendations?.lateral?.pvc;
                                                        const parts: string[] = [];
                                                        if (pvc) parts.push(`PVC ${pvc.sizeInch}`);
                                                        if (pe) parts.push(`PE ${pe.sizeMM.toFixed(0)}mm`);
                                                        return parts.length > 0 ? parts.join(' / ') : `${pipeRecommendations.lateral.sizeMM.toFixed(0)}mm`;
                                                    })()
                                                ) : 'Loading...'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Pump Card */}
                        <motion.div variants={itemVariants} className="overflow-hidden rounded-2xl border border-white/5 bg-slate-800/40 backdrop-blur-sm transition-all hover:border-sky-500/30 hover:bg-slate-800/60">
                            <div className="flex flex-col items-center gap-4 p-5 text-center">
                                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-sky-500/10 p-2">
                                    <img src="/images/water-pump.png" alt="Pump" className="h-full w-full object-contain drop-shadow-md" />
                                </div>
                                <h3 className="text-lg font-bold text-sky-400">{translations.pumpSelection}</h3>
                                <div className="mt-2 grid w-full grid-cols-3 gap-2 text-sm">
                                    <div className="rounded-lg bg-slate-900/50 p-2 text-center">
                                        <div className="text-xs text-slate-500">{translations.flowRateProduct}</div>
                                        <div className="font-semibold text-white">{pumpRecommendations?.flowRate || '-'} LPM</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-900/50 p-2 text-center">
                                        <div className="text-xs text-slate-500">{translations.headProduct}</div>
                                        <div className="font-semibold text-white">{pumpRecommendations?.head || '-'} m</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-900/50 p-2 text-center">
                                        <div className="text-xs text-slate-500">{translations.powerProduct}</div>
                                        <div className="font-semibold text-white">{pumpRecommendations?.power || '-'} HP</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

{/* Right Column: QR Code & Actions */}
<motion.div variants={itemVariants} className="space-y-6 lg:col-span-1">
                        <div className="relative overflow-hidden rounded-3xl border border-green-500/30 bg-gradient-to-br from-green-900/40 to-slate-900/40 p-6 shadow-xl backdrop-blur-xl">
                            {/* Decorative Elements */}
                            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-green-500/20 blur-3xl" />
                            <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />

                            <div className="relative z-10 text-center">
                                <div className="mb-2 flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-green-400">
                                        {translations.addFriendOnLine}
                                    </h3>
                                    {isAdmin && (
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={handleOpenLineIdModal}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20 text-green-400 transition-colors hover:bg-green-500/30"
                                            title="จัดการ LINE ID"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </motion.button>
                                    )}
                                </div>
                                <p className="mb-6 text-sm text-slate-300">
                                    {translations.scanQRCodeToContact}
                                </p>

                                {/* QR Code Container (White background for scanning) */}
                                <div className="mx-auto w-fit overflow-hidden rounded-xl bg-white p-4 shadow-2xl">
                                    <div ref={qrCodeRef} className="bg-white p-2">
                                        <QRCodeSVG
                                            value={LINE_FRIEND_URL}
                                            size={200}
                                            level="H"
                                        />
                                        <div className="mt-2 text-center text-xs font-bold text-slate-900">
                                            {lineId}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-col gap-3">
                                    {/* --- ส่วนที่เพิ่มใหม่: ปุ่มกดแอดไลน์ --- */}
                                    <motion.a
                                        href={LINE_FRIEND_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="w-full cursor-pointer rounded-xl bg-[#06C755] py-3 font-semibold text-white shadow-lg shadow-green-900/30 transition-all hover:bg-[#05b34c]"
                                    >
                                        <span className="flex items-center justify-center gap-2">
                                            {/* Icon LINE (แบบเรียบง่าย) หรือ Icon เพิ่มเพื่อน */}
                                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.5 5.51 4.14 7.23-.2.8-.75 2.06-1.54 2.84 0 0-.27.27.15.36.4.08 3.56.32 5.5-1.09 1.25.35 2.58.54 3.93.54 5.52 0 10-4.03 10-9S17.52 2 12 2z" />
                                            </svg>
                                            แอดไลน์ (เพิ่มเพื่อน)
                                        </span>
                                    </motion.a>
                                    {/* ------------------------------------- */}

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleSaveImage}
                                        className="w-full rounded-xl bg-slate-700 py-3 font-semibold text-white shadow-lg transition-all hover:bg-slate-600"
                                    >
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            บันทึก QR Code
                                        </span>
                                    </motion.button>
                                    
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleBack}
                                        className="w-full rounded-xl border border-slate-600 bg-slate-800/50 py-3 font-semibold text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
                                    >
                                        {translations.back}
                                    </motion.button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            {/* LINE ID Management Modal */}
            <AnimatePresence>
                {showLineIdModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleCloseLineIdModal}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ duration: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl"
                        >
                            <button
                                onClick={handleCloseLineIdModal}
                                className="absolute right-4 top-4 text-slate-400 hover:text-white"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            <h2 className="mb-6 text-xl font-bold text-white">
                                จัดการ LINE ID
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        LINE ID <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={lineIdInput}
                                        onChange={(e) => setLineIdInput(e.target.value)}
                                        placeholder="@fang.nitipoom"
                                        className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                    />
                                    <p className="mt-2 text-xs text-slate-400">
                                        ตัวอย่าง: @fang.nitipoom หรือ fang.nitipoom (ระบบจะเพิ่ม @ ให้อัตโนมัติ)
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        type="button"
                                        onClick={handleCloseLineIdModal}
                                        className="flex-1 rounded-xl border border-slate-600 bg-transparent px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                                    >
                                        ยกเลิก
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        type="button"
                                        onClick={handleSaveLineId}
                                        className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-green-900/20 hover:bg-green-500"
                                    >
                                        บันทึก
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// 3. Export
export default FreeCheckout;
