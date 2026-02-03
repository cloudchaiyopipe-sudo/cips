// 1. Import
import { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import { getTranslations } from './utils/language';
import { motion } from 'framer-motion';
// 2. Component
function FreeCheckout() {
    const [translations, setTranslations] = useState(getTranslations());
    // Contact modal (same as Navbar)
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactQrProgramError, setContactQrProgramError] = useState(false);
    const [contactQrInstallError, setContactQrInstallError] = useState(false);
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
        const savedFlowRateConfig = localStorage.getItem('flowRateConfig');
        const savedSprinklerMode = localStorage.getItem('sprinklerMode');
        const savedSummary = localStorage.getItem('freePlanSummary');

        let flowRateConfig = { flowRatePerMin: 2.5, waterPressure: 2.0, radius: 4.0, sprinklersPerPlant: 1 };
        if (savedFlowRateConfig) {
            try {
                const config = JSON.parse(savedFlowRateConfig);
                flowRateConfig = {
                    flowRatePerMin: config.flowRatePerMin || 2.5,
                    waterPressure: config.waterPressure || 2.0,
                    radius: config.radius || 4.0,
                    sprinklersPerPlant: config.sprinklersPerPlant ?? 1,
                };
            } catch (error) { console.error('Error loading config:', error); }
        }

        // Preset mode totalLPM: use freePlanSummary.flowRate.totalLPM so it matches summary/product
        let presetTotalLPM = 0;
        if (savedSummary) {
            try {
                const summary = JSON.parse(savedSummary);
                presetTotalLPM = summary?.flowRate?.totalLPM ?? 0;
                if (presetTotalLPM === 0 && summary?.plants?.total != null) {
                    const sprinklersPerPlant = flowRateConfig.sprinklersPerPlant ?? 1;
                    const flowRatePerMin = flowRateConfig.flowRatePerMin || 2.5;
                    presetTotalLPM = summary.plants.total * sprinklersPerPlant * flowRatePerMin;
                }
            } catch {
                // ignore
            }
        }

        setSprinklerSpecs({
            flowRatePerMin: flowRateConfig.flowRatePerMin,
            waterPressure: flowRateConfig.waterPressure,
            radius: flowRateConfig.radius,
            totalLPM: presetTotalLPM,
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
                            {translations.recommendedEquipmentList}
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
                                            ) : translations.loading}
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
                                                ) : translations.loading}
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
                                                ) : translations.loading}
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

{/* Right Column: ติดต่อ & Back */}
                    <motion.div variants={itemVariants} className="space-y-6 lg:col-span-1">
                        <div className="relative overflow-hidden rounded-3xl border border-green-500/30 bg-gradient-to-br from-green-900/40 to-slate-900/40 p-6 shadow-xl backdrop-blur-xl">
                            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-green-500/20 blur-3xl" />
                            <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
                            <div className="relative z-10 flex flex-col gap-3">
                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowContactModal(true)}
                                    className="w-full rounded-xl bg-[#06C755] py-3 font-semibold text-white shadow-lg shadow-green-900/30 transition-all hover:bg-[#05b34c]"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771z" />
                                        </svg>
                                        {translations.navContact}
                                    </span>
                                </motion.button>
                                <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleBack}
                                    className="w-full rounded-xl border border-slate-600 bg-slate-800/50 py-3 font-semibold text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
                                >
                                    {translations.back}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            {/* Contact Modal - same as Navbar (2 sections: Program support & Water system installation) */}
            {showContactModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-2 sm:p-4">
                    <div className="relative z-[10000] max-h-[95vh] sm:max-h-[90vh] w-full max-w-[calc(100vw-1rem)] sm:max-w-4xl overflow-y-auto rounded-2xl bg-slate-900 p-4 sm:p-6 md:p-8 mx-2 sm:mx-0">
                        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <h2 className="mb-1 sm:mb-2 text-xl sm:text-2xl md:text-3xl font-bold text-white">
                                    {translations.navContact}
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-400">
                                    {translations.contactModalChooseChannel}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowContactModal(false);
                                    setContactQrProgramError(false);
                                    setContactQrInstallError(false);
                                }}
                                className="text-slate-400 transition-colors hover:text-white flex-shrink-0"
                            >
                                <svg className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 sm:p-5 md:p-6">
                                <h3 className="mb-2 text-lg font-semibold text-white">
                                    {translations.contactModalProgram}
                                </h3>
                                <p className="mb-4 text-sm text-slate-400">
                                    {translations.contactModalProgramDesc}
                                </p>
                                <div className="flex flex-col items-center gap-4">
                                    <div className="flex flex-col items-center">
                                        <span className="mb-2 text-xs text-slate-500">{translations.contactModalScanQR}</span>
                                        <div className="h-32 w-32 rounded-lg border-2 border-slate-600 bg-white p-1 flex items-center justify-center overflow-hidden">
                                            {!contactQrProgramError ? (
                                                <img
                                                    src="/images/hacks.jpg"
                                                    alt="Line QR - โปรแกรม"
                                                    className="h-full w-full object-contain"
                                                    onError={() => setContactQrProgramError(true)}
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-500 text-xs text-center p-2">
                                                    QR Code
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-full text-center">
                                        <p className="mb-1 text-xs text-slate-500">{translations.contactModalLineId}</p>
                                        <p className="mb-2 font-mono text-sm font-medium text-green-400">hackskie</p>
                                        <a
                                            href="https://line.me/ti/p/~hackskie"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#05b04c]"
                                        >
                                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                                            </svg>
                                            {translations.contactModalOpenLine}
                                        </a>
                                    </div>
                                    <div className="w-full border-t border-slate-700 pt-4 text-center">
                                        <p className="mb-1 text-xs text-slate-500">{translations.contactModalPhone}</p>
                                        <a href="tel:0981586900" className="text-base font-medium text-white hover:text-teal-400">
                                            098-158-6900
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 sm:p-5 md:p-6">
                                <h3 className="mb-2 text-lg font-semibold text-white">
                                    {translations.contactModalWaterTeam}
                                </h3>
                                <p className="mb-4 text-sm text-slate-400">
                                    {translations.contactModalWaterTeamDesc}
                                </p>
                                <div className="flex flex-col items-center gap-4">
                                    <div className="flex flex-col items-center">
                                        <span className="mb-2 text-xs text-slate-500">{translations.contactModalScanQR}</span>
                                        <div className="h-32 w-32 rounded-lg border-2 border-slate-600 bg-white p-1 flex items-center justify-center overflow-hidden">
                                            {!contactQrInstallError ? (
                                                <img
                                                    src="/images/water.jpg"
                                                    alt="Line QR - ติดตั้งระบบน้ำ"
                                                    className="h-full w-full object-contain"
                                                    onError={() => setContactQrInstallError(true)}
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-500 text-xs text-center p-2">
                                                    QR Code
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-full text-center">
                                        <p className="mb-1 text-xs text-slate-500">{translations.contactModalLineId}</p>
                                        <p className="mb-2 font-mono text-sm font-medium text-green-400">-</p>
                                        <a
                                            href="https://line.me/ti/p/~"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#05b04c]"
                                        >
                                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                                            </svg>
                                            {translations.contactModalOpenLine}
                                        </a>
                                    </div>
                                    <div className="w-full border-t border-slate-700 pt-4 text-center">
                                        <p className="mb-1 text-xs text-slate-500">{translations.contactModalPhone}</p>
                                        <a href="tel:02-451-1111" className="text-base font-medium text-white hover:text-teal-400">
                                            02-451-1111 ต่อ 188
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 3. Export
export default FreeCheckout;
