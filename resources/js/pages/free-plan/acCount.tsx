// 1. Import
import { Head, router, usePage } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import { useState, useEffect } from 'react';
import { getTranslations } from './utils/language';
import { SharedData } from '@/types';

// Types
interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at?: string;
    created_at: string;
    tier?: string;
    tokens?: number;
    monthly_tokens?: number;
}

interface PageProps {
    auth: {
        user: User | null;
    };
    [key: string]: unknown;
}

// 2. Component
function AcCount() {
    // Get user data from Inertia page props
    const page = usePage<PageProps & SharedData>();
    const user = page.props.auth?.user;
    const isAdmin = page.props.auth?.user?.is_admin || false;

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
        // ตรวจสอบ sessionStorage ว่ามาจากหน้า newsArticle หรือไม่
        const fromNewsArticle = sessionStorage.getItem('fromNewsArticle');
        if (fromNewsArticle === 'true') {
            sessionStorage.removeItem('fromNewsArticle');
            router.visit('/free-plan');
            return;
        }
        
        // ตรวจสอบ referrer ว่ามาจากหน้า /admin/articles หรือไม่
        const referrer = document.referrer;
        if (referrer && (referrer.includes('/admin/articles') || referrer.includes('/admin/articles/create'))) {
            router.visit('/free-plan');
            return;
        }
        
        // ถ้ามี history ให้กลับไปหน้าก่อนหน้า
        if (window.history.length > 1) {
            window.history.back();
        } else {
            // ถ้าไม่มี history ให้ไปหน้า free-plan
            router.visit('/free-plan');
        }
    };
    const handleUpgrade = () => router.visit('/free-plan/upgradePro');
    const handleEditProfile = () => alert('Edit profile (demo)');
    const handleChangePassword = () => alert('Change password (demo)');
    const handleVerifyEmail = () => alert('Verify email (demo)');
    const handleManageAds = () => router.visit('/free-plan/ads');
    const handleLogout = () => {
        router.post(
            '/logout',
            {},
            {
                onSuccess: () => {
                    router.visit('/login');
                },
            }
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title="User Profile" />

            {/* Navbar */}
            <FreeNav />

            <div className="mx-auto max-w-4xl px-4 py-4 md:px-6 md:py-6">
                {/* Header */}
                <div className="mb-3 flex items-center gap-2 text-white">
                    <button onClick={handleBack} className="rounded bg-slate-700 px-2 py-1">
                        ◀
                    </button>
                    <div>
                        <div className="text-lg font-bold">{translations.userProfile}</div>
                        <div className="text-xs text-slate-300">
                            {translations.manageAccountInfo}
                        </div>
                    </div>
                </div>

                {/* Profile Card */}
                <div className="rounded-lg bg-slate-600/30 p-4 text-white">
                    <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 font-semibold">
                            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                            <div className="font-semibold">{user?.name || 'User'}</div>
                            <div className="text-xs text-slate-300">
                                {user?.email || 'user@example.com'}
                            </div>
                            <span className="mt-1 inline-block rounded bg-slate-700 px-2 py-0.5 text-xs">
                                {user?.tier
                                    ? user.tier.charAt(0).toUpperCase() + user.tier.slice(1)
                                    : translations.freePlanName}{' '}
                                Plan
                            </span>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <div className="mb-1 text-xs text-slate-300">
                                {translations.fullName}
                            </div>
                            <input
                                disabled
                                value={user?.name || 'User'}
                                className="w-full rounded bg-slate-800/60 px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <div className="mb-1 text-xs text-slate-300">
                                {translations.emailAddress}
                            </div>
                            <input
                                disabled
                                value={user?.email || 'user@example.com'}
                                className="w-full rounded bg-slate-800/60 px-3 py-2 text-sm"
                            />
                        </div>
                        <button
                            onClick={handleEditProfile}
                            className="rounded bg-slate-200 px-4 py-2 text-slate-900"
                        >
                            {translations.editProfile}
                        </button>
                    </div>
                </div>

                {/* Subscription Plan */}
                <div className="mt-4 rounded-lg bg-slate-600/30 p-4 text-white">
                    <div className="mb-2 font-semibold">{translations.subscriptionPlan}</div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1 flex items-center justify-center rounded bg-blue-900/40 p-3 text-center">
                            {user?.tier
                                ? user.tier.charAt(0).toUpperCase() + user.tier.slice(1)
                                : translations.freePlanName}
                        </div>
                        <div className="col-span-2 rounded bg-slate-700/40 p-3">
                            <div className="font-semibold">
                                {user?.tier
                                    ? user.tier.charAt(0).toUpperCase() + user.tier.slice(1)
                                    : translations.freePlanName}{' '}
                                Plan
                            </div>
                            <div className="text-xs text-slate-300">
                                {user?.tier === 'pro'
                                    ? translations.advancedFeatures
                                    : user?.tier === 'advanced'
                                      ? translations.premiumFeatures
                                      : translations.basicFeatures}
                            </div>
                        </div>
                    </div>
                    {user?.tier === 'free' && (
                        <button
                            onClick={handleUpgrade}
                            className="mt-3 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
                        >
                            {translations.upgradeToProButton}
                        </button>
                    )}
                </div>

                {/* Advertisement Management - แสดงเฉพาะ Admin */}
                {isAdmin && (
                    <div className="mt-4 rounded-lg bg-slate-600/30 p-4 text-white">
                        <div className="mb-2 font-semibold">{translations.advertisementManagement}</div>
                        <div className="mb-3 text-sm text-slate-300">
                            {translations.uploadManageAds}
                        </div>
                        <button
                            onClick={handleManageAds}
                            className="w-full rounded-lg bg-orange-600 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
                        >
                            {translations.manageAdvertisements}
                        </button>
                    </div>
                )}

                {/* Article Management - แสดงเฉพาะ Admin */}
                {isAdmin && (
                    <div className="mt-4 rounded-lg bg-slate-600/30 p-4 text-white">
                        <div className="mb-2 font-semibold">จัดการบทความ</div>
                        <div className="mb-3 text-sm text-slate-300">
                            จัดการและแก้ไขบทความที่แสดงในหน้าแรก
                        </div>
                        <button
                            onClick={() => router.visit('/admin/articles')}
                            className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition-colors hover:bg-purple-700"
                        >
                            📝 จัดการบทความ
                        </button>
                    </div>
                )}

                {/* Account Statistics */}
                <div className="mt-4 rounded-lg bg-slate-600/30 p-4 text-white">
                    <div className="mb-2 font-semibold">{translations.accountStatistics}</div>
                    <div className="text-sm">
                        {translations.memberSince}{' '}
                        {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </div>
                    <div className="text-sm">
                        {translations.emailStatus}{' '}
                        {user?.email_verified_at ? translations.verified : translations.unverified}
                    </div>
                    <div className="text-sm">
                        {translations.currentTokens} {user?.tokens || 0}
                    </div>
                    <div className="text-sm">
                        {translations.monthlyTokens} {user?.monthly_tokens || 100}
                    </div>
                </div>

                {/* Account Security */}
                <div className="mt-4 rounded-lg bg-slate-600/30 p-4 text-white">
                    <div className="mb-2 font-semibold">{translations.accountSecurity}</div>
                    <div className="flex flex-col gap-3 md:flex-row md:flex-nowrap md:items-center">
                        <button
                            onClick={handleChangePassword}
                            className="flex-1 rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700"
                        >
                            {translations.changePassword}
                        </button>
                        <button
                            onClick={handleVerifyEmail}
                            className="flex-1 rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
                        >
                            {translations.verifyEmail}
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex-1 rounded bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
                        >
                            {translations.logout}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 3. Export
export default AcCount;
