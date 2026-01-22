/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import UserAvatar from './UserAvatar';
import FloatingAiChat from './FloatingAiChat';
import TokenBuyModal from './TokenBuyModal';
import axios from 'axios';

const Navbar: React.FC = () => {
    const { t } = useLanguage();
    const page = usePage();
    const auth = (page.props as any).auth;
    const currentUrl = page.url;
    const isLandingPage = currentUrl === '/' || currentUrl === '/landing';
    const isNotLoggedIn = !auth?.user;
    const [showFloatingAiChat, setShowFloatingAiChat] = useState(false);

    const handleGetStarted = () => {
        router.visit('/new-home');
    };
    const [isAiChatMinimized, setIsAiChatMinimized] = useState(false);

    // State for token system
    const [tokenStatus, setTokenStatus] = useState<any>(null);
    const [loadingTokens, setLoadingTokens] = useState(false);
    const [showTokenPricingModal, setShowTokenPricingModal] = useState(false);
    const [showTokenBuyModal, setShowTokenBuyModal] = useState(false);

    // State for help programs modal
    const [showHelpProgramsModal, setShowHelpProgramsModal] = useState(false);

    // Set token status from user data for non-admin users
    useEffect(() => {
        if (!auth?.user || auth.user.is_super_user) {
            setTokenStatus(null);
            return; // Don't show tokens for super users
        }

        // Create token status from user data
        const userTokenStatus = {
            current_tokens: auth.user.tokens || 0,
            total_used: auth.user.total_tokens_used || 0,
            is_super_user: auth.user.is_super_user || false,
            tier: auth.user.tier || 'free',
            daily_tokens: auth.user.tier === 'pro' ? 100 : auth.user.tier === 'advanced' ? 200 : 50,
            monthly_allowance:
                auth.user.tier === 'pro' ? 500 : auth.user.tier === 'advanced' ? 1000 : 100,
        };

        setTokenStatus(userTokenStatus);

        // Listen for token update events from other parts of the app
        const handleTokenUpdate = (event: any) => {
            setTokenStatus((prev) =>
                prev
                    ? {
                          ...prev,
                          current_tokens: event.detail.remaining,
                      }
                    : null
            );
        };

        window.addEventListener('tokensUpdated', handleTokenUpdate);

        return () => {
            window.removeEventListener('tokensUpdated', handleTokenUpdate);
        };
    }, [auth?.user]);

    // Function to refresh CSRF token
    const refreshCsrfToken = async () => {
        try {
            const response = await axios.get('/csrf-token');
            if (response.data.token) {
                axios.defaults.headers.common['X-CSRF-TOKEN'] = response.data.token;
                const metaTag = document.querySelector('meta[name="csrf-token"]');
                if (metaTag) {
                    metaTag.setAttribute('content', response.data.token);
                }
                return response.data.token;
            }
        } catch (error) {
            console.error('Failed to refresh CSRF token:', error);
        }
        return null;
    };

    // Test authentication function
    const testAuth = async () => {
        try {
            const response = await axios.get('/api/test-auth');
            return response.data;
        } catch (error: any) {
            console.error('Auth test failed:', error);
            return null;
        }
    };

    // Help programs data
    const helpPrograms = [
        {
            name: 'CalTopo',
            description: 'แผนที่ภูมิประเทศแบบ Topographic สำหรับการวางแผนการเดินทางและการวิเคราะห์ภูมิประเทศ',
            url: 'https://caltopo.com/map.html#ll=35.86254,-105.6938&z=15&b=mbt',
            icon: '🗺️',
            owner: 'CalTopo.com',
        },
        {
            name: 'แผนที่เกษตรออนไลน์',
            description: 'แผนที่เกษตรออนไลน์ของกระทรวงเกษตรและสหกรณ์ สำหรับดูข้อมูลพื้นที่เกษตรกรรม',
            url: 'https://agri-map-online.moac.go.th/',
            icon: '🌾',
            owner: 'กระทรวงเกษตรและสหกรณ์',
        },
        {
            name: 'OpenStreetMap',
            description: 'แผนที่เปิดที่สร้างโดยชุมชน สำหรับดูข้อมูลแผนที่และเส้นทาง',
            url: 'https://www.openstreetmap.org/#map=15/17.71852/100.65524',
            icon: '🌍',
            owner: 'OpenStreetMap Foundation',
        },
        {
            name: 'กรมพัฒนาที่ดิน',
            description: 'เว็บไซต์กรมพัฒนาที่ดิน กระทรวงเกษตรและสหกรณ์ สำหรับข้อมูลการพัฒนาที่ดิน',
            url: 'https://www.ldd.go.th/home/',
            icon: '🏞️',
            owner: 'กรมพัฒนาที่ดิน กระทรวงเกษตรและสหกรณ์',
        },
        {
            name: 'Windy',
            description: 'ข้อมูลสภาพอากาศแบบเรียลไทม์ สำหรับตรวจสอบสภาพอากาศและลม',
            url: 'https://www.windy.com/?13.544,100.273,5',
            icon: '💨',
            owner: 'Windy.com',
        },
        {
            name: 'กรมส่งเสริมการเกษตร',
            description: 'เว็บไซต์กรมส่งเสริมการเกษตร กระทรวงเกษตรและสหกรณ์ สำหรับข้อมูลการส่งเสริมการเกษตร',
            url: 'https://www.doae.go.th/home-new-2024/',
            icon: '🌱',
            owner: 'กรมส่งเสริมการเกษตร กระทรวงเกษตรและสหกรณ์',
        },
    ];

    // Function to handle token purchase
    const handleTokenPurchase = async (purchaseData: {
        tokens: number;
        amount: number;
        payment_proof: File | null;
        notes: string;
    }) => {
        try {
            await refreshCsrfToken();

            const authTest = await testAuth();
            if (!authTest || !authTest.success) {
                alert('Authentication failed. Please refresh the page and try again.');
                return;
            }

            const formData = new FormData();
            formData.append('tokens', purchaseData.tokens.toString());
            formData.append('amount', purchaseData.amount.toString());
            formData.append('notes', purchaseData.notes);
            if (purchaseData.payment_proof) {
                formData.append('payment_proof', purchaseData.payment_proof);
            }

            const response = await axios.post('/api/payments/buy-tokens', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.success) {
                alert(
                    'Token purchase request submitted successfully! You will receive tokens once approved by admin.'
                );
                setShowTokenBuyModal(false);
            } else {
                alert(
                    response.data.message ||
                        'Error submitting token purchase request. Please try again.'
                );
            }
        } catch (error: any) {
            console.error('Error submitting token purchase:', error);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);

            if (error.response?.status === 419 || error.response?.data?.message?.includes('CSRF')) {
                try {
                    await refreshCsrfToken();

                    const retryFormData = new FormData();
                    retryFormData.append('tokens', purchaseData.tokens.toString());
                    retryFormData.append('amount', purchaseData.amount.toString());
                    retryFormData.append('notes', purchaseData.notes);
                    if (purchaseData.payment_proof) {
                        retryFormData.append('payment_proof', purchaseData.payment_proof);
                    }

                    const retryResponse = await axios.post(
                        '/api/payments/buy-tokens',
                        retryFormData,
                        {
                            headers: {
                                'Content-Type': 'multipart/form-data',
                            },
                        }
                    );

                    if (retryResponse.data.success) {
                        alert(
                            'Token purchase request submitted successfully! You will receive tokens once approved by admin.'
                        );
                        setShowTokenBuyModal(false);
                        return;
                    }
                } catch (retryError: any) {
                    console.error('Retry also failed:', retryError);
                }
            }

            const errorMessage =
                error.response?.data?.message ||
                'Error submitting token purchase request. Please try again.';
            alert(errorMessage);
        }
    };

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-700 bg-gray-800 shadow-lg">
                <div className="mx-auto max-w-7xl px-2 sm:px-4 md:px-6 lg:px-8">
                    <div className="flex h-14 sm:h-16 items-center justify-between">
                        {/* App Name and Logo */}
                        <div className="flex items-center">
                            <Link
                                href="/"
                                className="flex items-center space-x-2 text-white transition-colors hover:text-green-300 sm:space-x-3"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white sm:h-10 sm:w-10">
                                    <img
                                        src="/images/chaiyo-logo.png"
                                        alt="logo"
                                        className="rounded-lg"
                                    />
                                </div>
                                <div className="hidden sm:block">
                                    <h1 className="text-lg font-bold sm:text-xl">
                                        {t('Chaiyo Irrigation Planning System')}
                                    </h1>
                                    <p className="text-xs sm:text-sm">
                                        {t(
                                            'บจก.กนกโปรดักส์ & บจก.ไชโยไปป์แอนด์ฟิตติ้ง'
                                        )}
                                    </p>
                                </div>
                                <div className="block sm:hidden">
                                    <h1 className="text-xl font-bold">{t('CIPS')}</h1>
                                </div>
                            </Link>
                        </div>

                        {/* Right side - Language Switcher and User Avatar */}
                        <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-4">
                            {/* Super User Dashboard Link - Hide on landing page */}
                            {auth?.user?.is_super_user && !isLandingPage && (
                                <Link
                                    href="/super/dashboard"
                                    className="hidden items-center rounded-lg bg-yellow-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-yellow-700 sm:flex sm:px-3 sm:text-sm"
                                >
                                    <span className="text-sm sm:text-lg">👑</span>
                                    <span className="hidden sm:inline">{t('Super Dashboard')}</span>
                                </Link>
                            )}

                            <div className="flex items-center gap-0.5 sm:gap-1 md:gap-3">
                                {/* Get Started Button - Show on landing page only when NOT logged in */}
                                {(isLandingPage && isNotLoggedIn) && (
                                    <button
                                        onClick={handleGetStarted}
                                        className="group flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/50 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/60 sm:px-4 sm:py-2 sm:text-sm"
                                        title="เริ่มต้นใช้งาน"
                                    >
                                        <span className="hidden sm:inline">เริ่มต้นใช้งาน</span>
                                        <span className="sm:hidden">เริ่ม</span>
                                        <svg
                                            className="h-3 w-3 transition-transform group-hover:translate-x-1 sm:h-4 sm:w-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 5l7 7-7 7"
                                            />
                                        </svg>
                                    </button>
                                )}

                                {/* Help Programs Button - Hide on landing page */}
                                {!isLandingPage && (
                                    <button
                                        onClick={() => setShowHelpProgramsModal(true)}
                                        className="hidden items-center rounded-lg bg-purple-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-purple-700 sm:flex sm:px-3 sm:text-sm"
                                        title={t('โปรแกรมช่วยเหลือ')}
                                    >
                                        <span className="text-sm sm:text-lg">💡</span>
                                        <span className="hidden sm:inline">{t('โปรแกรมช่วยเหลือ')}</span>
                                    </button>
                                )}

                                {/* AI Chat Button */}
                                {/* <button
                                    onClick={() => setShowFloatingAiChat(true)}
                                    className="hidden items-center rounded-lg bg-green-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 sm:flex sm:px-3 sm:text-sm"
                                    title={t('เปิด ChaiyoAI Chat')}
                                >
                                    <span className="text-sm sm:text-lg">🤖</span>
                                    <span className="hidden sm:inline">{t('AI Chat')}</span>
                                </button>
                                
                                <FloatingAiChat
                                    isOpen={showFloatingAiChat}
                                    onClose={() => setShowFloatingAiChat(false)}
                                    onMinimize={() => setIsAiChatMinimized(!isAiChatMinimized)}
                                    isMinimized={isAiChatMinimized}
                                /> */}
                                {/* Equipment Management Button - Show always (even when not logged in) */}
                                <button
                                    onClick={() => (window.location.href = '/equipment-crud')}
                                    className="flex items-center rounded-lg bg-gray-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-gray-700 sm:px-4 sm:py-2 sm:text-sm"
                                    title={t('สินค้าของเรา')}
                                >
                                    <span className="sm:hidden">⚙️</span>
                                    <span className="hidden sm:inline">
                                        ⚙️ {t('สินค้าของเรา')}
                                    </span>
                                </button>
                            </div>

                            {/* Language Switcher - Hide on landing page */}
                            {!isLandingPage && <LanguageSwitcher />}

                            {/* User Avatar - Only show if authenticated and not on landing page */}
                            {auth?.user && !isLandingPage && (
                                <UserAvatar
                                    user={auth.user}
                                    size="sm"
                                    className="sm:size-md ml-1 sm:ml-2"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Token Pricing Modal */}
            {showTokenPricingModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
                    <div className="relative z-[10000] max-h-[95vh] sm:max-h-[90vh] w-full max-w-[calc(100vw-1rem)] sm:max-w-2xl overflow-y-auto rounded-2xl bg-gray-900 p-4 sm:p-6 md:p-8 mx-2 sm:mx-0">
                        {/* Header */}
                        <div className="mb-4 sm:mb-6 md:mb-8 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <h2 className="mb-1 sm:mb-2 text-xl sm:text-2xl md:text-3xl font-bold text-white">Token System</h2>
                                <p className="text-xs sm:text-sm text-gray-400">Manage your tokens and view pricing</p>
                            </div>
                            <button
                                onClick={() => setShowTokenPricingModal(false)}
                                className="text-gray-400 transition-colors hover:text-white flex-shrink-0"
                            >
                                <svg
                                    className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        {/* Token Packages */}
                        <div className="mb-4 sm:mb-6 md:mb-8">
                            <h3 className="mb-3 sm:mb-4 text-lg sm:text-xl font-semibold text-white">
                                Buy Token Packages
                            </h3>
                            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
                                {/* Starter Package */}
                                <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 sm:p-5 md:p-6 text-center transition-colors hover:border-blue-500">
                                    <div className="mb-4">
                                        <div className="text-3xl font-bold text-blue-400">XXX</div>
                                        <div className="text-sm text-gray-400">Tokens</div>
                                    </div>
                                    <div className="mb-4">
                                        <div className="text-2xl font-bold text-white">฿XXX</div>
                                        <div className="text-sm text-gray-400">฿XXX per token</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowTokenPricingModal(false);
                                            setShowTokenBuyModal(true);
                                        }}
                                        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                                    >
                                        Buy Now
                                    </button>
                                </div>

                                {/* Popular Package */}
                                <div className="relative rounded-lg border-2 border-green-500 bg-gray-800 p-4 sm:p-5 md:p-6 text-center">
                                    <div className="absolute -top-2 sm:-top-3 left-1/2 -translate-x-1/2 transform">
                                        <span className="whitespace-nowrap rounded-full bg-green-500 px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs font-medium text-white">
                                            Most Popular
                                        </span>
                                    </div>
                                    <div className="mb-4">
                                        <div className="text-3xl font-bold text-green-400">XXX</div>
                                        <div className="text-sm text-gray-400">Tokens</div>
                                    </div>
                                    <div className="mb-4">
                                        <div className="text-2xl font-bold text-white">฿XXX</div>
                                        <div className="text-sm text-gray-400">฿XXX per token</div>
                                        <div className="text-xs text-green-400">Save ฿XXX</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowTokenPricingModal(false);
                                            setShowTokenBuyModal(true);
                                        }}
                                        className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                                    >
                                        Buy Now
                                    </button>
                                </div>

                                {/* Premium Package */}
                                <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 sm:p-5 md:p-6 text-center transition-colors hover:border-purple-500">
                                    <div className="mb-4">
                                        <div className="text-3xl font-bold text-purple-400">
                                            XXX
                                        </div>
                                        <div className="text-sm text-gray-400">Tokens</div>
                                    </div>
                                    <div className="mb-4">
                                        <div className="text-2xl font-bold text-white">฿XXX</div>
                                        <div className="text-sm text-gray-400">฿XXX per token</div>
                                        <div className="text-xs text-purple-400">Save ฿XXX</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowTokenPricingModal(false);
                                            setShowTokenBuyModal(true);
                                        }}
                                        className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
                                    >
                                        Buy Now
                                    </button>
                                </div>
                            </div>

                            {/* Enterprise Package */}
                            <div className="mt-4 sm:mt-6 rounded-lg border border-yellow-500 bg-gray-800 p-4 sm:p-5 md:p-6 text-center">
                                <div className="mb-4">
                                    <div className="text-3xl font-bold text-yellow-400">XXX</div>
                                    <div className="text-sm text-gray-400">Tokens</div>
                                </div>
                                <div className="mb-4">
                                    <div className="text-2xl font-bold text-white">฿XXX</div>
                                    <div className="text-sm text-gray-400">฿XXX per token</div>
                                    <div className="text-xs text-yellow-400">
                                        Best Value - Save ฿XXX
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowTokenPricingModal(false);
                                        setShowTokenBuyModal(true);
                                    }}
                                    className="w-full rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-700"
                                >
                                    Buy Now
                                </button>
                            </div>
                        </div>

                        {/* Token System Info */}
                        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 sm:p-5 md:p-6">
                            <h3 className="mb-3 sm:mb-4 text-lg sm:text-xl font-semibold text-white">
                                How Token System Works
                            </h3>
                            <div className="space-y-2 sm:space-y-3 text-sm sm:text-base text-gray-300">
                                <div className="flex items-start gap-3">
                                    <span className="text-green-400">✅</span>
                                    <div>
                                        <strong>Starting Tokens:</strong> New users get 100 tokens
                                        to begin
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-purple-400">💳</span>
                                    <div>
                                        <strong>Buy More Tokens:</strong> Purchase additional tokens
                                        anytime with secure payment
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-yellow-400">👑</span>
                                    <div>
                                        <strong>Admin Users:</strong> Super users have unlimited
                                        access
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-orange-400">💡</span>
                                    <div>
                                        <strong>Smart Usage:</strong> Tokens are only consumed on
                                        successful operations
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Usage Statistics */}
                        {tokenStatus && (
                            <div className="mt-4 sm:mt-6 rounded-lg border border-gray-700 bg-gray-800 p-4 sm:p-5 md:p-6">
                                <h3 className="mb-3 sm:mb-4 text-lg sm:text-xl font-semibold text-white">
                                    Your Usage Statistics
                                </h3>
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <div className="text-2xl font-bold text-blue-400">
                                            {tokenStatus.total_used || 0}
                                        </div>
                                        <div className="text-sm text-gray-400">
                                            Total tokens used
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Help Programs Modal */}
            {showHelpProgramsModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
                    <div className="relative z-[10000] max-h-[95vh] sm:max-h-[90vh] w-full max-w-[calc(100vw-1rem)] sm:max-w-4xl overflow-y-auto rounded-2xl bg-gray-900 p-4 sm:p-6 md:p-8 mx-2 sm:mx-0">
                        {/* Header */}
                        <div className="mb-4 sm:mb-6 md:mb-8 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <h2 className="mb-1 sm:mb-2 text-xl sm:text-2xl md:text-3xl font-bold text-white">
                                    {t('โปรแกรมช่วยเหลือ')}
                                </h2>
                                <p className="text-xs sm:text-sm text-gray-400">
                                    {t('รายการโปรแกรมและเครื่องมือที่ช่วยในการวางแผนระบบชลประทาน')}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowHelpProgramsModal(false)}
                                className="text-gray-400 transition-colors hover:text-white flex-shrink-0"
                            >
                                <svg
                                    className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        {/* Programs List */}
                        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                            {helpPrograms.map((program, index) => (
                                <div
                                    key={index}
                                    className="group rounded-lg border border-gray-700 bg-gray-800 p-4 sm:p-5 md:p-6 transition-all hover:border-purple-500 hover:shadow-lg"
                                >
                                    <div className="mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
                                        <span className="text-2xl sm:text-3xl flex-shrink-0">{program.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg sm:text-xl font-semibold text-white truncate">
                                                {program.name}
                                            </h3>
                                            <p className="mt-1 text-xs sm:text-sm text-gray-400">
                                                <span className="font-medium text-gray-300">
                                                    {t('เจ้าของ')}:
                                                </span>{' '}
                                                <span className="break-words">{program.owner}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <p className="mb-3 sm:mb-4 text-sm sm:text-base text-gray-300">{program.description}</p>
                                    <a
                                        href={program.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-purple-700"
                                    >
                                        <span>{t('เปิดโปรแกรม')}</span>
                                        <svg
                                            className="h-3 w-3 sm:h-4 sm:w-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                            />
                                        </svg>
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Token Buy Modal */}
            <TokenBuyModal
                isOpen={showTokenBuyModal}
                onClose={() => setShowTokenBuyModal(false)}
                onSubmit={handleTokenPurchase}
            />
        </>
    );
};

export default Navbar;
