// 1. Import
import { Head, router } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import { useState, useEffect } from 'react';
import { getTranslations } from './utils/language';

// 2. Component
function UpgradePro() {
    // State for translations
    const [translations, setTranslations] = useState(getTranslations());

    // Listen for language changes
    useEffect(() => {
        const handleLanguageChange = () => {
            setTranslations(getTranslations());
        };

        // Listen for storage changes (when language is changed in other components)
        window.addEventListener('storage', handleLanguageChange);

        // Listen for custom language change event
        window.addEventListener('languageChanged', handleLanguageChange);

        // Also check on focus (when user comes back to tab)
        window.addEventListener('focus', handleLanguageChange);

        return () => {
            window.removeEventListener('storage', handleLanguageChange);
            window.removeEventListener('languageChanged', handleLanguageChange);
            window.removeEventListener('focus', handleLanguageChange);
        };
    }, []);

    const handleBack = () => {
        // ตรวจสอบ referrer ว่ามาจากหน้าไหน
        const referrer = document.referrer;

        // ถ้ามี history ให้กลับไปหน้าก่อนหน้า
        if (window.history.length > 1 && referrer) {
            window.history.back();
        } else {
            // ถ้าไม่มี history หรือ referrer ให้ไปหน้า free-plan
            router.visit('/free-plan');
        }
    };

    const handleUpgrade = () => {
        router.visit('/free-plan/payment-qr');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
            <Head title="CIPS Pro" />

            {/* Navbar */}
            <FreeNav />

            <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
                {/* Header */}
                <div className="mb-8 flex items-center gap-4 text-white">
                    <button
                        onClick={handleBack}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700/50 text-white transition-all duration-200 hover:scale-105 hover:bg-slate-600/50"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white md:text-4xl">
                            {translations.cipsPro}
                        </h1>
                        <p className="text-lg text-slate-300">
                            {translations.forProfessionalUsers}
                        </p>
                    </div>
                </div>

                {/* Pro Plan Card */}
                <div className="mx-auto max-w-2xl">
                    <div className="relative overflow-hidden rounded-2xl border border-slate-600/30 bg-gradient-to-br from-slate-700/40 to-slate-600/40 p-8 shadow-2xl backdrop-blur-sm">
                        {/* Decorative elements */}
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-500/10 blur-xl"></div>
                        <div className="absolute -bottom-4 -left-4 h-32 w-32 rounded-full bg-purple-500/10 blur-xl"></div>

                        {/* Pro Badge */}
                        <div className="mb-6 flex justify-center">
                            <div className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-2 text-sm font-semibold text-white shadow-lg">
                                {translations.proPlan}
                            </div>
                        </div>

                        {/* Features List */}
                        <div className="mb-8 space-y-4">
                            <div className="flex items-center gap-3 text-white">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </div>
                                <span className="text-lg">{translations.tokensPerMonth}</span>
                            </div>

                            <div className="flex items-center gap-3 text-white">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </div>
                                <span className="text-lg">{translations.tokensDaily}</span>
                            </div>

                            <div className="flex items-center gap-3 text-white">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </div>
                                <span className="text-lg">
                                    {translations.advancedIrrigationPlanning}
                                </span>
                            </div>

                            <div className="flex items-center gap-3 text-white">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </div>
                                <span className="text-lg">{translations.prioritySupport}</span>
                            </div>

                            <div className="flex items-center gap-3 text-white">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </div>
                                <span className="text-lg">{translations.exportCapabilities}</span>
                            </div>

                            <div className="flex items-center gap-3 text-white">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                </div>
                                <span className="text-lg">{translations.advancedAnalytics}</span>
                            </div>
                        </div>

                        {/* Pricing Button */}
                        <div className="text-center">
                            <button
                                onClick={handleUpgrade}
                                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-4 text-xl font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:from-blue-500 hover:to-blue-600 hover:shadow-xl active:scale-95"
                            >
                                {translations.pricing}
                            </button>

                            {/* Additional info */}
                            <p className="mt-3 text-sm text-slate-400">
                                {translations.cancelAnytime}
                            </p>
                        </div>
                    </div>

                    {/* Additional Benefits */}
                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        <div className="rounded-lg bg-slate-700/30 p-4 text-center text-white">
                            <div className="mb-2 text-2xl">🚀</div>
                            <div className="font-semibold">{translations.startImmediately}</div>
                            <div className="text-xs text-slate-300">
                                {translations.availableImmediately}
                            </div>
                        </div>
                        <div className="rounded-lg bg-slate-700/30 p-4 text-center text-white">
                            <div className="mb-2 text-2xl">💳</div>
                            <div className="font-semibold">{translations.easyPayment}</div>
                            <div className="text-xs text-slate-300">
                                {translations.multiplePaymentMethods}
                            </div>
                        </div>
                        <div className="rounded-lg bg-slate-700/30 p-4 text-center text-white">
                            <div className="mb-2 text-2xl">🔒</div>
                            <div className="font-semibold">{translations.secure}</div>
                            <div className="text-xs text-slate-300">{translations.dataSecure}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 3. Export
export default UpgradePro;
