// 1. Import
import { Head, router, usePage, useForm } from '@inertiajs/react';
import { route } from 'ziggy-js';
import FreeNav from './components/freeNav';
import { useState, useEffect, FormEventHandler } from 'react';
import { getTranslations } from './utils/language';
import { SharedData } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

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
    status?: string;
    [key: string]: unknown;
}

// 2. Component
function AcCount() {
    // Get user data from Inertia page props
    const page = usePage<PageProps & SharedData>();
    const user = page.props.auth?.user;
    const isAdmin = page.props.auth?.user?.is_admin || false;

    // State
    const [translations, setTranslations] = useState(getTranslations());
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    const [showLineIdModal, setShowLineIdModal] = useState(false);
    const [lineId, setLineId] = useState<string>('@fang.nitipoom');
    const [lineIdInput, setLineIdInput] = useState<string>('');
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<string | null>(
        page.props.status === 'verification-link-sent' ? 'sent' : null
    );
    const [sendingVerification, setSendingVerification] = useState(false);

    // Generate user initials from name (same logic as freeNav)
    const getUserInitials = (name: string | undefined | null): string => {
        if (!name || name.trim().length === 0) {
            return 'U';
        }
        
        const nameParts = name.trim().split(/\s+/);
        
        if (nameParts.length === 1) {
            // Single word: use first 2 characters
            const firstTwo = nameParts[0].substring(0, 2).toUpperCase();
            return firstTwo.length === 1 ? firstTwo + firstTwo : firstTwo;
        } else {
            // Multiple words: use first letter of first and last word
            const firstInitial = nameParts[0].charAt(0).toUpperCase();
            const lastInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
            return firstInitial + lastInitial;
        }
    };
    
    const userInitials = getUserInitials(user?.name);

    // Check for status from session on mount
    useEffect(() => {
        if (page.props.status === 'verification-link-sent') {
            setVerificationStatus('sent');
            setTimeout(() => setVerificationStatus(null), 5000);
        }
    }, [page.props.status]);

    // Forms
    const { data, setData, put, processing, errors, reset, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const { 
        data: profileData, 
        setData: setProfileData, 
        patch: patchProfile, 
        processing: profileProcessing, 
        errors: profileErrors, 
        reset: resetProfile,
        recentlySuccessful: profileRecentlySuccessful
    } = useForm({
        name: user?.name || '',
    });

    // Load LINE ID from localStorage
    useEffect(() => {
        const savedLineId = localStorage.getItem('lineId');
        if (savedLineId) {
            setLineId(savedLineId);
        }
    }, []);

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
        const fromNewsArticle = sessionStorage.getItem('fromNewsArticle');
        if (fromNewsArticle === 'true') {
            sessionStorage.removeItem('fromNewsArticle');
            router.visit('/free-plan');
            return;
        }
        
        const referrer = document.referrer;
        if (referrer && (referrer.includes('/admin/articles') || referrer.includes('/admin/articles/create'))) {
            router.visit('/free-plan');
            return;
        }
        
        if (window.history.length > 1) {
            window.history.back();
        } else {
            router.visit('/free-plan');
        }
    };

    const handleUpgrade = () => router.visit('/free-plan/upgradePro');
    const handleEditProfile = () => {
        setIsEditingProfile(true);
        setProfileData('name', user?.name || '');
    };
    const handleCancelEdit = () => {
        setIsEditingProfile(false);
        resetProfile();
    };
    const handleChangePassword = () => setShowChangePasswordModal(true);
    const handleManageAds = () => router.visit('/free-plan/ads');
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

    const handleSendVerificationEmail = () => {
        setSendingVerification(true);
        setVerificationStatus(null);
        router.post(route('verification.send'), {}, {
            preserveScroll: true,
            onSuccess: () => {
                setVerificationStatus('sent');
                setSendingVerification(false);
                setTimeout(() => setVerificationStatus(null), 5000);
            },
            onError: () => {
                setVerificationStatus('error');
                setSendingVerification(false);
                setTimeout(() => setVerificationStatus(null), 5000);
            },
        });
    };

    const updatePassword: FormEventHandler = (e) => {
        e.preventDefault();
        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setTimeout(() => setShowChangePasswordModal(false), 1500);
            },
            onError: (errors) => {
                if (errors.password) reset('password', 'password_confirmation');
                if (errors.current_password) reset('current_password');
            },
        });
    };

    const updateProfile: FormEventHandler = (e) => {
        e.preventDefault();
        patchProfile(route('profile.update'), {
            preserveScroll: true,
            onSuccess: () => setTimeout(() => setIsEditingProfile(false), 1500),
        });
    };

    const handleLogout = () => {
        router.post('/logout', {}, { onSuccess: () => router.visit('/login') });
    };

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 50 } }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-200">
            <Head title="User Profile" />

            {/* Sticky Navbar */}
            <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <FreeNav />
            </div>

            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-10"
            >
                {/* Header Section */}
                <motion.div variants={cardVariants} className="mb-8 flex items-center gap-4">
                    <button 
                        onClick={handleBack} 
                        className="group flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 transition-all hover:bg-slate-700 hover:text-white hover:border-slate-500"
                    >
                        <svg className="h-5 w-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold md:text-3xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            {translations.userProfile}
                        </h1>
                        <p className="text-sm text-slate-400">
                            {translations.manageAccountInfo}
                        </p>
                    </div>
                </motion.div>

                {/* Main Grid Layout */}
                <div className="grid gap-6 md:grid-cols-3">
                    
                    {/* Left Column: Profile & Stats */}
                    <div className="md:col-span-2 space-y-6">
                        
                        {/* Profile Card */}
                        <motion.div variants={cardVariants} className="overflow-hidden rounded-2xl border border-white/5 bg-slate-800/40 backdrop-blur-sm">
                            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-6 pb-0">
                                <div className="flex items-end justify-between">
                                    <div className="relative -mb-6">
                                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white shadow-lg ring-4 ring-slate-800">
                                            {userInitials}
                                        </div>
                                    </div>
                                    {/* Role Badge */}
                                    <div className="mb-4">
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                                            user?.tier === 'pro' 
                                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                                                : 'bg-slate-700 text-slate-300 border border-slate-600'
                                        }`}>
                                            {user?.tier ? user.tier : translations.freePlanName} Plan
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-6 pt-10">
                                <form onSubmit={updateProfile} className="space-y-5">
                                    {/* Name Input */}
                                    <div className="group">
                                        <label className="mb-1 block text-xs font-medium uppercase text-slate-500 group-focus-within:text-blue-400">
                                            {translations.fullName}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                disabled={!isEditingProfile}
                                                value={isEditingProfile ? profileData.name : (user?.name || 'User')}
                                                onChange={(e) => setProfileData('name', e.target.value)}
                                                className={`w-full rounded-xl border px-4 py-3 transition-all ${
                                                    isEditingProfile
                                                        ? 'border-blue-500/50 bg-slate-900/80 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                                        : 'border-transparent bg-transparent text-lg font-semibold text-white px-0 py-0'
                                                }`}
                                            />
                                            {isEditingProfile && (
                                                <svg className="absolute right-3 top-3 h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            )}
                                        </div>
                                        {profileErrors.name && (
                                            <p className="mt-1 text-xs text-red-400">{profileErrors.name}</p>
                                        )}
                                        {profileRecentlySuccessful && isEditingProfile && (
                                            <p className="mt-1 flex items-center gap-1 text-xs text-green-400">
                                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                {translations.passwordChangedSuccessfully || 'บันทึกเรียบร้อยแล้ว'}
                                            </p>
                                        )}
                                    </div>

                                    {/* Email Input (Read Only) */}
                                    <div>
                                        <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                                            {translations.emailAddress}
                                        </label>
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                            <span>{user?.email || 'user@example.com'}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="pt-2">
                                        {!isEditingProfile ? (
                                            <button
                                                type="button"
                                                onClick={handleEditProfile}
                                                className="rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                                            >
                                                {translations.editProfile}
                                            </button>
                                        ) : (
                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEdit}
                                                    className="rounded-xl border border-slate-600 bg-transparent px-6 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                                                >
                                                    {translations.cancel || 'ยกเลิก'}
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={profileProcessing}
                                                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 disabled:opacity-50"
                                                >
                                                    {profileProcessing ? (
                                                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    ) : (
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    )}
                                                    {profileProcessing ? translations.saving : translations.save}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </motion.div>

                        {/* Admin Sections */}
                        {isAdmin && (
                            <motion.div variants={cardVariants} className="grid gap-4 sm:grid-cols-2">
                                <button
                                    onClick={handleManageAds}
                                    className="group relative overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-900/20 to-slate-900/40 p-5 text-left transition-all hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-900/20"
                                >
                                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                                    </div>
                                    <h3 className="font-semibold text-white">{translations.advertisementManagement}</h3>
                                    <p className="text-xs text-slate-400 mt-1">{translations.uploadManageAds}</p>
                                </button>

                                <button
                                    onClick={() => router.visit('/admin/articles')}
                                    className="group relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-slate-900/40 p-5 text-left transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-900/20"
                                >
                                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </div>
                                    <h3 className="font-semibold text-white">จัดการบทความ</h3>
                                    <p className="text-xs text-slate-400 mt-1">เขียนและแก้ไขข่าวสาร</p>
                                </button>
                            </motion.div>
                        )}

                        {/* Stats Card */}
                        <motion.div variants={cardVariants} className="rounded-2xl border border-white/5 bg-slate-800/40 p-6 backdrop-blur-sm">
                            <h3 className="mb-4 text-sm font-semibold uppercase text-slate-500">{translations.accountStatistics}</h3>
                            <div className="flex items-center gap-4">
                                <div className="rounded-xl bg-slate-700/50 p-3">
                                    <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-400">{translations.memberSince}</div>
                                    <div className="font-semibold text-white">
                                        {user?.created_at ? new Date(user.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column: Plan & Security */}
                    <div className="space-y-6">
                        {/* Plan Card */}
                        <motion.div variants={cardVariants} className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold uppercase text-slate-500">{translations.subscriptionPlan}</h3>
                                <div className="mt-2 text-2xl font-bold text-white">
                                    {user?.tier ? user.tier.charAt(0).toUpperCase() + user.tier.slice(1) : translations.freePlanName}
                                </div>
                                <div className="mt-1 text-sm text-slate-400">
                                    {user?.tier === 'pro' ? translations.advancedFeatures : translations.basicFeatures}
                                </div>
                            </div>
                            
                            {user?.tier === 'free' && (
                                <button
                                    onClick={handleUpgrade}
                                    className="group w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 font-semibold text-white shadow-lg shadow-blue-900/20 transition-all hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-900/40"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        {translations.upgradeToProButton}
                                        <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                    </span>
                                </button>
                            )}
                        </motion.div>

                        {/* Security Card */}
                        <motion.div variants={cardVariants} className="rounded-2xl border border-white/5 bg-slate-800/40 p-6 backdrop-blur-sm">
                            <h3 className="mb-4 text-sm font-semibold uppercase text-slate-500">{translations.accountSecurity}</h3>
                            
                            {/* Email Verification */}
                            <div className={`mb-6 rounded-xl border p-4 ${user?.email_verified_at ? 'border-green-500/20 bg-green-500/5' : 'border-yellow-500/20 bg-yellow-500/5'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-300">Email Status</span>
                                    {user?.email_verified_at ? (
                                        <span className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-900/30 px-2 py-1 rounded-lg">
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            VERIFIED
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs font-bold text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded-lg">
                                            ⚠ UNVERIFIED
                                        </span>
                                    )}
                                </div>

                                {!user?.email_verified_at && (
                                    <div className="mt-3">
                                        {verificationStatus === 'sent' ? (
                                            <div className="flex items-center gap-2 text-sm text-green-400">
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                {translations.verificationEmailSent || 'Email sent!'}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={handleSendVerificationEmail}
                                                disabled={sendingVerification}
                                                className="mt-2 text-sm text-blue-400 hover:text-blue-300 hover:underline disabled:opacity-50"
                                            >
                                                {sendingVerification ? 'Sending...' : (translations.sendVerificationEmail || 'Resend Verification Email')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="space-y-3">
                                {isAdmin && (
                                    <button
                                        onClick={handleOpenLineIdModal}
                                        className="flex w-full items-center justify-between rounded-xl border border-green-900/30 bg-green-900/10 px-4 py-3 text-sm text-green-400 transition-colors hover:bg-green-900/20 hover:text-green-300"
                                    >
                                        <span>จัดการ LINE ID</span>
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </button>
                                )}

                                <button
                                    onClick={handleChangePassword}
                                    className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                                >
                                    <span>{translations.changePassword}</span>
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center justify-between rounded-xl border border-red-900/30 bg-red-900/10 px-4 py-3 text-sm text-red-400 transition-colors hover:bg-red-900/20 hover:text-red-300"
                                >
                                    <span>{translations.logout}</span>
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.div>
            
            {/* Change Password Modal */}
            <AnimatePresence>
                {showChangePasswordModal && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-800 p-6 shadow-2xl"
                        >
                            <button
                                onClick={() => { setShowChangePasswordModal(false); reset(); }}
                                className="absolute right-4 top-4 text-slate-400 hover:text-white"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            
                            <h2 className="mb-6 text-xl font-bold text-white">
                                {translations.changePassword}
                            </h2>
                            
                            <form onSubmit={updatePassword} className="space-y-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-400">{translations.currentPassword || 'Current Password'}</label>
                                    <input
                                        type="password"
                                        value={data.current_password}
                                        onChange={(e) => setData('current_password', e.target.value)}
                                        className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    {errors.current_password && <p className="mt-1 text-xs text-red-400">{errors.current_password}</p>}
                                </div>
                                
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-400">{translations.newPassword || 'New Password'}</label>
                                    <input
                                        type="password"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
                                </div>
                                
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-400">{translations.confirmPassword || 'Confirm Password'}</label>
                                    <input
                                        type="password"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    {errors.password_confirmation && <p className="mt-1 text-xs text-red-400">{errors.password_confirmation}</p>}
                                </div>

                                {recentlySuccessful && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg bg-green-500/10 p-3 text-center text-sm text-green-400">
                                        {translations.passwordChangedSuccessfully || 'Password changed successfully'}
                                    </motion.div>
                                )}
                                
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => { setShowChangePasswordModal(false); reset(); }}
                                        className="flex-1 rounded-xl border border-slate-600 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                                    >
                                        {translations.cancel || 'Cancel'}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 disabled:opacity-50"
                                    >
                                        {processing ? 'Saving...' : (translations.save || 'Save')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* LINE ID Management Modal */}
            <AnimatePresence>
                {showLineIdModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleCloseLineIdModal}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            transition={{ duration: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-800 p-6 shadow-2xl"
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
                                    <p className="mt-1 text-xs text-slate-500">
                                        LINE ID ปัจจุบัน: <span className="text-green-400">{lineId}</span>
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        type="button"
                                        onClick={handleCloseLineIdModal}
                                        className="flex-1 rounded-xl border border-slate-600 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                                    >
                                        {translations.cancel || 'ยกเลิก'}
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        type="button"
                                        onClick={handleSaveLineId}
                                        className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-green-900/20 hover:bg-green-500"
                                    >
                                        {translations.save || 'บันทึก'}
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
export default AcCount;
