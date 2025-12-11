// 1. Import
import { Head, router } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import { useState, useEffect } from 'react';
import { getTranslations } from './utils/language';
import { motion } from 'framer-motion';

// 2. Component
function UpgradePro() {
    // State for translations
    const [translations, setTranslations] = useState(getTranslations());

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

    const handleBack = () => {
        const referrer = document.referrer;
        if (window.history.length > 1 && referrer) {
            window.history.back();
        } else {
            router.visit('/free-plan');
        }
    };
    
    const handleUpgrade = () => {
        router.visit('/free-plan/payment-qr');
    };

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 50 } }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-200">
            <Head title="CIPS Pro" />

            {/* Sticky Navbar */}
            <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <FreeNav />
            </div>

            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12"
            >
                {/* Header Section */}
                <motion.div variants={itemVariants} className="mb-8 flex items-center gap-4">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleBack}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white hover:border-slate-500"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </motion.button>
                    <div>
                        <h1 className="text-3xl font-bold text-white md:text-4xl bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            {translations.cipsPro}
                        </h1>
                        <p className="text-sm text-slate-400">
                            {translations.forProfessionalUsers}
                        </p>
                    </div>
                </motion.div>

                {/* Pro Plan Card - Premium Look */}
                <motion.div 
                    variants={itemVariants}
                    className="relative mx-auto max-w-2xl"
                >
                    {/* Glow Effects behind the card */}
                    <div className="absolute -inset-0.5 rounded-[2rem] bg-gradient-to-r from-blue-600 to-purple-600 opacity-30 blur-2xl transition duration-1000 group-hover:opacity-100 animate-pulse-slow"></div>
                    
                    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl md:p-10">
                        {/* Background Decorations */}
                        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-[80px]"></div>
                        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/20 blur-[80px]"></div>

                        {/* Pro Badge */}
                        <div className="mb-8 flex justify-center">
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.3, type: "spring" }}
                                className="relative rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 p-[1px]"
                            >
                                <div className="rounded-full bg-slate-900/90 px-8 py-2 backdrop-blur-sm">
                                    <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-sm font-bold uppercase tracking-widest text-transparent">
                                        {translations.proPlan}
                                    </span>
                                </div>
                            </motion.div>
                        </div>

                        {/* Features List */}
                        <div className="mb-10 space-y-5">
                            {[
                                { text: translations.tokensPerMonth, icon: '💎' },
                                { text: translations.tokensDaily, icon: '⚡' },
                                { text: translations.advancedIrrigationPlanning, icon: '🗺️' },
                                { text: translations.prioritySupport, icon: '👑' },
                                { text: translations.exportCapabilities, icon: '📤' },
                                { text: translations.advancedAnalytics, icon: '📊' }
                            ].map((feature, index) => (
                                <motion.div 
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 + (index * 0.1) }}
                                    className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-3 backdrop-blur-sm transition-colors hover:bg-white/10"
                                >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-lg">
                                        {feature.icon}
                                    </div>
                                    <span className="text-base font-medium text-slate-200">{feature.text}</span>
                                </motion.div>
                            ))}
                        </div>

                        {/* Pricing Button */}
                        <div className="text-center">
                            <motion.button
                                whileHover={{ scale: 1.02, boxShadow: "0 0 30px -5px rgba(79, 70, 229, 0.5)" }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleUpgrade}
                                className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-5 text-xl font-bold text-white shadow-lg transition-all"
                            >
                                <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100"></div>
                                <span className="relative flex items-center justify-center gap-2">
                                    {translations.pricing}
                                    <svg className="h-6 w-6 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                </span>
                            </motion.button>

                            {/* Additional info */}
                            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
                                <svg className="h-4 w-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {translations.cancelAnytime}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Additional Benefits */}
                <motion.div variants={itemVariants} className="mt-8 grid gap-4 md:grid-cols-3">
                    <div className="group rounded-2xl border border-white/5 bg-slate-800/40 p-6 text-center backdrop-blur-sm transition-all hover:border-blue-500/30 hover:bg-slate-800/60 hover:-translate-y-1">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-2xl group-hover:scale-110 transition-transform">🚀</div>
                        <h3 className="font-semibold text-white">{translations.startImmediately}</h3>
                        <p className="mt-1 text-xs text-slate-400">{translations.availableImmediately}</p>
                    </div>
                    
                    <div className="group rounded-2xl border border-white/5 bg-slate-800/40 p-6 text-center backdrop-blur-sm transition-all hover:border-purple-500/30 hover:bg-slate-800/60 hover:-translate-y-1">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-2xl group-hover:scale-110 transition-transform">💳</div>
                        <h3 className="font-semibold text-white">{translations.easyPayment}</h3>
                        <p className="mt-1 text-xs text-slate-400">{translations.multiplePaymentMethods}</p>
                    </div>
                    
                    <div className="group rounded-2xl border border-white/5 bg-slate-800/40 p-6 text-center backdrop-blur-sm transition-all hover:border-emerald-500/30 hover:bg-slate-800/60 hover:-translate-y-1">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl group-hover:scale-110 transition-transform">🔒</div>
                        <h3 className="font-semibold text-white">{translations.secure}</h3>
                        <p className="mt-1 text-xs text-slate-400">{translations.dataSecure}</p>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}

// 3. Export
export default UpgradePro;
