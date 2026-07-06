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

    // State for contact modal
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactQrInstallError, setContactQrInstallError] = useState(false);

    // State for suggestion/feedback modal (คำแนะนำ)
    const [showSuggestionModal, setShowSuggestionModal] = useState(false);
    const [suggestionForm, setSuggestionForm] = useState({
        name: '',
        phone: '',
        email: '',
        suggestion: '',
    });
    const [suggestionSubmitting, setSuggestionSubmitting] = useState(false);
    const [suggestionSuccess, setSuggestionSuccess] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);

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

    // Submit suggestion/feedback to API (forwards to Google Sheet)
    const handleSuggestionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuggestionError(null);
        if (!suggestionForm.name.trim() || !suggestionForm.suggestion.trim()) {
            setSuggestionError(t('กรุณากรอกชื่อและคำแนะนำ'));
            return;
        }
        setSuggestionSubmitting(true);
        try {
            const { data } = await axios.post('/api/suggestions', {
                name: suggestionForm.name.trim(),
                phone: suggestionForm.phone.trim(),
                email: suggestionForm.email.trim(),
                suggestion: suggestionForm.suggestion.trim(),
            });
            if (data?.success) {
                setSuggestionSuccess(true);
                setSuggestionForm({ name: '', phone: '', email: '', suggestion: '' });
                setTimeout(() => {
                    setShowSuggestionModal(false);
                    setSuggestionSuccess(false);
                }, 2000);
            } else {
                setSuggestionError(data?.message || t('เกิดข้อผิดพลาด กรุณาลองใหม่'));
            }
        } catch (err: any) {
            const msg =
                err.response?.data?.message ||
                err.message ||
                t('ไม่สามารถส่งคำแนะนำได้ กรุณาตรวจสอบการตั้งค่า Google Sheet หรือลองใหม่');
            setSuggestionError(msg);
        } finally {
            setSuggestionSubmitting(false);
        }
    };

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-700 bg-gray-800 shadow-lg">
                <div className="mx-auto max-w-8xl px-2 sm:px-4 md:px-4 lg:px-10">
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

                                {/* Contact Button - Hide on landing page */}
                                {!isLandingPage && (
                                    <button
                                        onClick={() => setShowContactModal(true)}
                                        className="hidden items-center rounded-lg bg-teal-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-teal-700 sm:flex sm:px-3 sm:text-sm"
                                        title={t('ติดต่อ')}
                                    >
                                        <span className="text-sm sm:text-lg">📞</span>
                                        <span className="hidden sm:inline">{t('ติดต่อ')}</span>
                                    </button>
                                )}

                                {/* Suggestion/Feedback Button (คำแนะนำ) - Hide on landing page */}
                                {!isLandingPage && (
                                    <button
                                        onClick={() => {
                                            setShowSuggestionModal(true);
                                            setSuggestionSuccess(false);
                                            setSuggestionError(null);
                                            setSuggestionForm({
                                                name: auth?.user?.name ?? '',
                                                phone: '',
                                                email: auth?.user?.email ?? '',
                                                suggestion: '',
                                            });
                                        }}
                                        className="hidden items-center rounded-lg bg-amber-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 sm:flex sm:px-3 sm:text-sm"
                                        title={t('คำแนะนำ')}
                                    >
                                        <span className="text-sm sm:text-lg">✏️</span>
                                        <span className="hidden sm:inline">{t('คำแนะนำ')}</span>
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

            {/* Contact Modal - Water system installation team */}
            {showContactModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
                    <div className="relative z-[10000] max-h-[95vh] sm:max-h-[90vh] w-full max-w-[calc(100vw-1rem)] sm:max-w-lg overflow-y-auto rounded-2xl bg-gray-900 p-4 sm:p-6 md:p-8 mx-2 sm:mx-0">
                        {/* Header */}
                        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <h2 className="mb-1 sm:mb-2 text-xl sm:text-2xl md:text-3xl font-bold text-white">
                                    {t('ติดต่อ')}
                                </h2>
                                <p className="text-xs sm:text-sm text-gray-400">
                                    {t('ให้คำปรึกษาเกี่ยวกับการติดตั้งระบบน้ำ')}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowContactModal(false);
                                    setContactQrInstallError(false);
                                }}
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

                        <div>
                            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 sm:p-5 md:p-6">
                                <h3 className="mb-2 text-lg font-semibold text-white">
                                    {t('ทีมผู้เชี่ยวชาญติดตั้งระบบน้ำ')}
                                </h3>
                                <p className="mb-4 text-sm text-gray-400">
                                    {t('ให้คำปรึกษาเกี่ยวกับการติดตั้งระบบน้ำ')}
                                </p>
                                <div className="flex flex-col items-center gap-4">
                                    <div className="flex flex-col items-center">
                                        <span className="mb-2 text-xs text-gray-500">{t('สแกน QR Code เพื่อเพิ่ม Line')}</span>
                                        <div className="h-32 w-32 rounded-lg border-2 border-gray-600 bg-white p-1 flex items-center justify-center overflow-hidden">
                                            {!contactQrInstallError ? (
                                                <img
                                                    src="/images/water.jpg"
                                                    alt="Line QR - ติดตั้งระบบน้ำ"
                                                    className="h-full w-full object-contain"
                                                    onError={() => setContactQrInstallError(true)}
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-500 text-xs text-center p-2">
                                                    QR Code
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-full text-center">
                                        <p className="mb-1 text-xs text-gray-500">{t('Line ID')}</p>
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
                                            {t('เปิด Line')}
                                        </a>
                                    </div>
                                    <div className="w-full border-t border-gray-700 pt-4 text-center">
                                        <p className="mb-1 text-xs text-gray-500">{t('เบอร์โทร')}</p>
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

            {/* Suggestion/Feedback Modal (คำแนะนำ) */}
            {showSuggestionModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
                    <div className="relative z-[10000] max-h-[95vh] sm:max-h-[90vh] w-full max-w-[calc(100vw-1rem)] sm:max-w-lg overflow-y-auto rounded-2xl bg-gray-900 p-4 sm:p-6 md:p-8 mx-2 sm:mx-0">
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white">
                                    {t('คำแนะนำ')}
                                </h2>
                                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                                    {t('กรอกรายละเอียดด้านล่าง เราจะนำไปปรับปรุงบริการ')}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    if (!suggestionSubmitting) {
                                        setShowSuggestionModal(false);
                                        setSuggestionError(null);
                                    }
                                }}
                                className="text-gray-400 transition-colors hover:text-white flex-shrink-0 disabled:opacity-50"
                                disabled={suggestionSubmitting}
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {suggestionSuccess ? (
                            <div className="py-8 text-center">
                                <p className="text-4xl mb-4">✅</p>
                                <p className="text-lg font-medium text-green-400">{t('ส่งคำแนะนำเรียบร้อยแล้ว ขอบคุณครับ/ค่ะ')}</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSuggestionSubmit} className="space-y-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-300">{t('ชื่อ')} *</label>
                                    <input
                                        type="text"
                                        value={suggestionForm.name}
                                        onChange={(e) => setSuggestionForm((prev) => ({ ...prev, name: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                                        placeholder={t('ชื่อ-นามสกุล')}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-300">{t('เบอร์โทร')}</label>
                                    <input
                                        type="tel"
                                        value={suggestionForm.phone}
                                        onChange={(e) => setSuggestionForm((prev) => ({ ...prev, phone: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                                        placeholder="08X-XXX-XXXX"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-300">{t('อีเมล')}</label>
                                    <input
                                        type="email"
                                        value={suggestionForm.email}
                                        onChange={(e) => setSuggestionForm((prev) => ({ ...prev, email: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                                        placeholder="email@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-300">{t('คำแนะนำ')} *</label>
                                    <textarea
                                        value={suggestionForm.suggestion}
                                        onChange={(e) => setSuggestionForm((prev) => ({ ...prev, suggestion: e.target.value }))}
                                        rows={4}
                                        className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                                        placeholder={t('พิมพ์คำแนะนำหรือข้อเสนอแนะ')}
                                        required
                                    />
                                </div>
                                {suggestionError && (
                                    <p className="text-sm text-red-400">{suggestionError}</p>
                                )}
                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowSuggestionModal(false)}
                                        className="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-gray-300 hover:bg-gray-800"
                                        disabled={suggestionSubmitting}
                                    >
                                        {t('ยกเลิก')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={suggestionSubmitting}
                                        className="flex-1 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                                    >
                                        {suggestionSubmitting ? t('กำลังส่ง...') : t('ส่งคำแนะนำ')}
                                    </button>
                                </div>
                            </form>
                        )}
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
