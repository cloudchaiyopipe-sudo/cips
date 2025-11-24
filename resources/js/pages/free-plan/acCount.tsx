// 1. Import
import { Head, router, usePage, useForm } from '@inertiajs/react';
import { route } from 'ziggy-js';
import FreeNav from './components/freeNav';
import { useState, useEffect, FormEventHandler } from 'react';
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
    status?: string;
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
    
    // State for change password modal
    const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
    
    // State for edit profile mode
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    
    // State for email verification
    const [verificationStatus, setVerificationStatus] = useState<string | null>(
        page.props.status === 'verification-link-sent' ? 'sent' : null
    );
    const [sendingVerification, setSendingVerification] = useState(false);
    
    // Check for status from session on mount
    useEffect(() => {
        if (page.props.status === 'verification-link-sent') {
            setVerificationStatus('sent');
            // Clear status after 5 seconds
            setTimeout(() => {
                setVerificationStatus(null);
            }, 5000);
        }
    }, [page.props.status]);
    
    // Form for changing password
    const { data, setData, put, processing, errors, reset, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });
    
    // Form for editing profile (name only)
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
    
    const handleSendVerificationEmail = () => {
        setSendingVerification(true);
        setVerificationStatus(null);
        
        router.post(route('verification.send'), {}, {
            preserveScroll: true,
            onSuccess: () => {
                setVerificationStatus('sent');
                setSendingVerification(false);
                // Clear status after 5 seconds
                setTimeout(() => {
                    setVerificationStatus(null);
                }, 5000);
            },
            onError: () => {
                setVerificationStatus('error');
                setSendingVerification(false);
                // Clear error after 5 seconds
                setTimeout(() => {
                    setVerificationStatus(null);
                }, 5000);
            },
        });
    };
    
    const updatePassword: FormEventHandler = (e) => {
        e.preventDefault();
        
        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setTimeout(() => {
                    setShowChangePasswordModal(false);
                }, 1500);
            },
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                }
                if (errors.current_password) {
                    reset('current_password');
                }
            },
        });
    };
    
    const updateProfile: FormEventHandler = (e) => {
        e.preventDefault();
        
        patchProfile(route('profile.update'), {
            preserveScroll: true,
            onSuccess: () => {
                setTimeout(() => {
                    setIsEditingProfile(false);
                }, 1500);
            },
        });
    };
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
                    <form onSubmit={updateProfile} className="space-y-3">
                        <div>
                            <div className="mb-1 text-xs text-slate-300">
                                {translations.fullName}
                            </div>
                            <input
                                type="text"
                                disabled={!isEditingProfile}
                                value={isEditingProfile ? profileData.name : (user?.name || 'User')}
                                onChange={(e) => setProfileData('name', e.target.value)}
                                className={`w-full rounded px-3 py-2 text-sm ${
                                    isEditingProfile
                                        ? 'bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                                        : 'bg-slate-800/60 text-slate-300'
                                }`}
                            />
                            {profileErrors.name && (
                                <p className="mt-1 text-xs text-red-400">{profileErrors.name}</p>
                            )}
                            {profileRecentlySuccessful && isEditingProfile && (
                                <p className="mt-1 text-xs text-green-400">
                                    {translations.passwordChangedSuccessfully || 'บันทึกเรียบร้อยแล้ว'}
                                </p>
                            )}
                        </div>
                        <div>
                            <div className="mb-1 text-xs text-slate-300">
                                {translations.emailAddress}
                            </div>
                            <input
                                disabled
                                value={user?.email || 'user@example.com'}
                                className="w-full rounded bg-slate-800/60 px-3 py-2 text-sm text-slate-300"
                            />
                        </div>
                        {!isEditingProfile ? (
                            <button
                                type="button"
                                onClick={handleEditProfile}
                                className="rounded bg-slate-200 px-4 py-2 text-slate-900 hover:bg-slate-300"
                            >
                                {translations.editProfile}
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="flex-1 rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-700"
                                >
                                    {translations.cancel || 'ยกเลิก'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={profileProcessing}
                                    className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {profileProcessing
                                        ? translations.saving || 'กำลังบันทึก...'
                                        : translations.save || 'บันทึก'}
                                </button>
                            </div>
                        )}
                    </form>
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
                </div>

                {/* Account Security */}
                <div className="mt-4 rounded-lg bg-slate-600/30 p-4 text-white">
                    <div className="mb-2 font-semibold">{translations.accountSecurity}</div>
                    
                    {/* Email Verification Status */}
                    {user && (
                        <div className="mb-4 rounded-lg bg-slate-700/50 p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm text-slate-300">{translations.emailStatus || 'Email Status'}:</span>
                                <span className={`text-sm font-semibold ${
                                    user.email_verified_at 
                                        ? 'text-green-400' 
                                        : 'text-yellow-400'
                                }`}>
                                    {user.email_verified_at 
                                        ? `✓ ${translations.verified || 'Verified'}` 
                                        : `⚠ ${translations.unverified || 'Unverified'}`}
                                </span>
                            </div>
                            
                            {!user.email_verified_at && (
                                <div className="mt-3 space-y-2">
                                    <p className="text-xs text-slate-400">
                                        {translations.sendVerificationEmail || 'Please verify your email address to secure your account.'}
                                    </p>
                                    
                                    {verificationStatus === 'sent' && (
                                        <div className="rounded bg-green-900/30 p-2 text-xs text-green-300">
                                            {translations.verificationEmailSent || 'Verification email sent. Please check your email.'}
                                        </div>
                                    )}
                                    
                                    {verificationStatus === 'error' && (
                                        <div className="rounded bg-red-900/30 p-2 text-xs text-red-300">
                                            {translations.errorSendingEmail || 'Failed to send verification email. Please try again.'}
                                        </div>
                                    )}
                                    
                                    <button
                                        onClick={handleSendVerificationEmail}
                                        disabled={sendingVerification}
                                        className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {sendingVerification 
                                            ? `${translations.sending || 'Sending'}...` 
                                            : translations.sendVerificationEmail || 'Send Verification Email'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Security Actions */}
                    <div className="flex flex-col gap-3 md:flex-row md:flex-nowrap md:items-center">
                        <button
                            onClick={handleChangePassword}
                            className="flex-1 rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700"
                        >
                            {translations.changePassword}
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
            
            {/* Change Password Modal */}
            {showChangePasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="relative mx-4 w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-xl">
                        {/* Close Button */}
                        <button
                            onClick={() => {
                                setShowChangePasswordModal(false);
                                reset();
                            }}
                            className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
                        >
                            ✕
                        </button>
                        
                        {/* Modal Title */}
                        <h2 className="mb-4 text-xl font-semibold text-white">
                            {translations.changePassword}
                        </h2>
                        
                        {/* Form */}
                        <form onSubmit={updatePassword} className="space-y-4">
                            {/* Current Password */}
                            <div>
                                <label className="mb-1 block text-sm text-slate-300">
                                    {translations.currentPassword || 'รหัสผ่านปัจจุบัน'}
                                </label>
                                <input
                                    type="password"
                                    value={data.current_password}
                                    onChange={(e) => setData('current_password', e.target.value)}
                                    className="w-full rounded bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    placeholder={translations.currentPassword || 'รหัสผ่านปัจจุบัน'}
                                    autoComplete="current-password"
                                />
                                {errors.current_password && (
                                    <p className="mt-1 text-sm text-red-400">{errors.current_password}</p>
                                )}
                            </div>
                            
                            {/* New Password */}
                            <div>
                                <label className="mb-1 block text-sm text-slate-300">
                                    {translations.newPassword || 'รหัสผ่านใหม่'}
                                </label>
                                <input
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className="w-full rounded bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    placeholder={translations.newPassword || 'รหัสผ่านใหม่'}
                                    autoComplete="new-password"
                                />
                                {errors.password && (
                                    <p className="mt-1 text-sm text-red-400">{errors.password}</p>
                                )}
                            </div>
                            
                            {/* Confirm Password */}
                            <div>
                                <label className="mb-1 block text-sm text-slate-300">
                                    {translations.confirmPassword || 'ยืนยันรหัสผ่านใหม่'}
                                </label>
                                <input
                                    type="password"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    className="w-full rounded bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    placeholder={translations.confirmPassword || 'ยืนยันรหัสผ่านใหม่'}
                                    autoComplete="new-password"
                                />
                                {errors.password_confirmation && (
                                    <p className="mt-1 text-sm text-red-400">{errors.password_confirmation}</p>
                                )}
                            </div>
                            
                            {/* Success Message */}
                            {recentlySuccessful && (
                                <p className="text-sm text-green-400">
                                    {translations.passwordChangedSuccessfully || 'รหัสผ่านถูกเปลี่ยนเรียบร้อยแล้ว'}
                                </p>
                            )}
                            
                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowChangePasswordModal(false);
                                        reset();
                                    }}
                                    className="flex-1 rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-700"
                                >
                                    {translations.cancel || 'ยกเลิก'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="flex-1 rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700 disabled:opacity-50"
                                >
                                    {processing
                                        ? translations.saving || 'กำลังบันทึก...'
                                        : translations.save || 'บันทึก'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// 3. Export
export default AcCount;
