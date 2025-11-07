import { useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useLanguage } from '../contexts/LanguageContext';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import UpgradeTierModal from '../components/UpgradeTierModal';
import TokenPurchaseModal from '../components/TokenPurchaseModal';
import axios from 'axios';

interface User {
    id: number;
    name: string;
    email: string;
    is_super_user?: boolean;
    tier?: string;
    tier_expires_at?: string;
    monthly_tokens?: number;
    tokens?: number;
    total_tokens_used?: number;
}

interface NewHomeProps {
    auth: {
        user: User;
    };
    [key: string]: unknown;
}

export default function NewHome() {
    const { t } = useLanguage();

    // Always call usePage hook at the top level
    const page = usePage<NewHomeProps>();

    // Defensive auth access with error handling
    let auth;
    try {
        auth = page.props.auth;
    } catch {
        console.warn('Inertia context not available in NewHome, using fallback values');
        auth = { user: null };
    }

    const user = auth.user;
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [showTokenPurchaseModal, setShowTokenPurchaseModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<{
        type: 'pro' | 'advanced';
        months: number;
    } | null>(null);

    // Helper function to get tier display information
    const getTierDisplayInfo = (tier: string) => {
        switch (tier) {
            case 'free':
                return {
                    name: 'Free',
                    color: 'text-gray-400',
                    bgColor: 'bg-gray-900/30',
                    borderColor: 'border-gray-600',
                    icon: '🆓',
                    description: 'Basic features with limited tokens',
                    price: 'Free',
                    monthlyTokens: 100,
                    dailyTokens: 50,
                };
            case 'pro':
                return {
                    name: 'Pro',
                    color: 'text-blue-400',
                    bgColor: 'bg-blue-900/30',
                    borderColor: 'border-blue-500',
                    icon: '⭐',
                    description: 'Advanced features with more tokens',
                    price: 'XXX tokens/month',
                    monthlyTokens: 500,
                    dailyTokens: 100,
                };
            case 'advanced':
                return {
                    name: 'Advanced',
                    color: 'text-purple-400',
                    bgColor: 'bg-purple-900/30',
                    borderColor: 'border-purple-500',
                    icon: '💎',
                    description: 'Premium features with maximum tokens',
                    price: 'XXX tokens/month',
                    monthlyTokens: 1000,
                    dailyTokens: 200,
                };
            default:
                return {
                    name: 'Free',
                    color: 'text-gray-400',
                    bgColor: 'bg-gray-900/30',
                    borderColor: 'border-gray-600',
                    icon: '🆓',
                    description: 'Basic features with limited tokens',
                    price: 'Free',
                    monthlyTokens: 100,
                    dailyTokens: 50,
                };
        }
    };

    const currentTierInfo = getTierDisplayInfo(user?.tier || 'free');

    const handleUpgradeTier = async (tier: string, months: number) => {
        try {
            console.log(`Upgrading to ${tier} for ${months} months`);
            // TODO: Implement actual payment processing
            alert(
                `Upgrade to ${tier} plan for ${months} months - Payment processing would be implemented here`
            );
            setShowUpgradeModal(false);
        } catch (error) {
            console.error('Error upgrading tier:', error);
            alert('Error processing upgrade. Please try again.');
        }
    };

    const handleTokenPurchase = async (purchaseData: { plan_type: string; months: number }) => {
        try {
            const response = await axios.post('/api/payments/purchase-plan', purchaseData);
            if (response.data.success) {
                alert(
                    `Successfully upgraded to ${purchaseData.plan_type} plan! You consumed ${response.data.tokens_consumed} tokens.`
                );
                setShowTokenPurchaseModal(false);
                setSelectedPlan(null);
                // Refresh the page to update user data
                window.location.reload();
            } else {
                alert(response.data.message || 'Error purchasing plan. Please try again.');
            }
        } catch (error: unknown) {
            console.error('Error purchasing plan:', error);
            const errorMessage =
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message || 'Error purchasing plan. Please try again.';
            alert(errorMessage);
        }
    };

    const handleBuyTokensWithMoney = async (paymentData: {
        plan_type: string;
        months: number;
        payment_proof: string;
        notes: string;
    }) => {
        try {
            const response = await axios.post('/api/payments/create', paymentData);
            if (response.data.success) {
                alert(
                    'Payment request submitted successfully! You will receive tokens once approved by admin.'
                );
                setShowTokenPurchaseModal(false);
                setSelectedPlan(null);
            } else {
                alert('Error submitting payment request. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting payment request:', error);
            alert('Error submitting payment request. Please try again.');
        }
    };

    const handlePlanSelection = (planType: 'pro' | 'advanced', months: number) => {
        setSelectedPlan({ type: planType, months });
        setShowTokenPurchaseModal(true);
    };

    // Suppress unused variable warning for t (translation function)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _unused = t;

    // Suppress unused function warning for handlePlanSelection
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _unusedHandler = handlePlanSelection;

    const handleContinueToApp = () => {
        // Navigate to the current home page (field management)
        router.visit('/fields');
    };

    const handleTryFreePlan = () => {
        // Navigate to free plan page
        router.visit('/free-plan');
    };

    const handleGoToAccount = () => {
        // Navigate to account page
        router.visit('/free-plan/account');
    };

    const handleCloseUpgradeModal = () => {
        setShowUpgradeModal(false);
    };

    // If user is super user, redirect to fields page
    if (user?.is_super_user) {
        handleContinueToApp();
        return null;
    }

    // If user is Pro or Advanced, show a different layout
    if (user?.tier === 'pro' || user?.tier === 'advanced') {
        return (
            <div className="min-h-screen bg-gray-900">
                <Head title="Welcome - Water Management System" />
                <Navbar />

                {/* Pro/Advanced User Hero Section */}
                <section className="relative bg-gradient-to-br from-gray-800 to-gray-900 py-20">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="text-center">
                            <div className="mb-6">
                                <span
                                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${currentTierInfo.bgColor} ${currentTierInfo.color} border ${currentTierInfo.borderColor}`}
                                >
                                    {currentTierInfo.icon} {currentTierInfo.name} Plan
                                </span>
                            </div>
                            <h1 className="mb-6 text-4xl font-bold text-white lg:text-5xl">
                                Welcome back, {user.name}!
                            </h1>
                            <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-300">
                                You're using our {currentTierInfo.name} plan with{' '}
                                {currentTierInfo.monthlyTokens} tokens per month. Ready to continue
                                optimizing your irrigation systems?
                            </p>
                            <div className="flex flex-col justify-center gap-4 sm:flex-row">
                                <button
                                    onClick={handleContinueToApp}
                                    className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-700"
                                >
                                    Continue to App
                                </button>
                                <button
                                    onClick={handleGoToAccount}
                                    className="rounded-lg border-2 border-green-400 px-8 py-3 text-lg font-semibold text-green-400 transition-colors hover:bg-green-400/10"
                                >
                                    My Account
                                </button>
                                <button
                                    onClick={() => setShowUpgradeModal(true)}
                                    className="rounded-lg border-2 border-blue-400 px-8 py-3 text-lg font-semibold text-blue-400 transition-colors hover:bg-blue-400/10"
                                >
                                    Manage Subscription
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Quick Stats Section */}
                <section className="bg-gray-800 py-16">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                            <div className="rounded-lg bg-gray-700 p-6 text-center">
                                <div className="mb-2 text-3xl font-bold text-blue-400">
                                    {user.tokens || 0}
                                </div>
                                <div className="text-gray-300">Current Tokens</div>
                            </div>
                            <div className="rounded-lg bg-gray-700 p-6 text-center">
                                <div className="mb-2 text-3xl font-bold text-green-400">
                                    {currentTierInfo.monthlyTokens}
                                </div>
                                <div className="text-gray-300">Monthly Allowance</div>
                            </div>
                            <div className="rounded-lg bg-gray-700 p-6 text-center">
                                <div className="mb-2 text-3xl font-bold text-purple-400">
                                    {currentTierInfo.dailyTokens}
                                </div>
                                <div className="text-gray-300">Daily Tokens</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* App Screenshot Section */}
                <section className="bg-gray-900 py-20">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="mb-12 text-center">
                            <h2 className="mb-4 text-3xl font-bold text-white lg:text-4xl">
                                Your Irrigation Management Hub
                            </h2>
                            <p className="mx-auto max-w-3xl text-lg text-gray-300">
                                Access all your irrigation planning tools and manage your projects
                                efficiently.
                            </p>
                        </div>

                        <div className="relative mx-auto max-w-4xl">
                            <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-2xl">
                                <div className="aspect-video overflow-hidden rounded-lg">
                                    <img
                                        src="/images/app-screenshot.png"
                                        alt="Smart Irrigation Management System Interface"
                                        className="h-full w-full object-cover"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const fallback =
                                                target.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                    <div
                                        className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800"
                                        style={{ display: 'none' }}
                                    >
                                        <div className="text-center">
                                            <div className="mb-4 text-6xl">🌱</div>
                                            <p className="font-medium text-gray-300">
                                                App Screenshot Placeholder
                                            </p>
                                            <p className="text-sm text-gray-400">
                                                Your irrigation planning interface
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <Footer />

                {/* Upgrade Tier Modal */}
                <UpgradeTierModal
                    isOpen={showUpgradeModal}
                    onClose={handleCloseUpgradeModal}
                    currentTier={user?.tier || 'free'}
                    onUpgrade={handleUpgradeTier}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            <Head title="Welcome - Water Management System" />
            <Navbar />

            {/* Hero Section with App Screenshot */}
            <section className="relative bg-gradient-to-br from-gray-800 to-gray-900 py-20">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
                        {/* Left Content */}
                        <div className="flex flex-col justify-center">
                            <h1 className="mb-6 text-4xl font-bold text-white lg:text-5xl">
                                Chaiyo Irrigation
                                <span className="block text-blue-400">Planning System</span>
                            </h1>
                            <p className="mb-8 text-lg text-gray-300">
                                Transform your agricultural operations with our advanced irrigation
                                planning and management platform. Optimize water usage, increase
                                crop yields, and reduce costs with precision technology.
                            </p>
                            <div className="flex flex-col gap-4 sm:flex-row">
                                <button
                                    onClick={handleTryFreePlan}
                                    className="rounded-lg bg-orange-600 px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-orange-700"
                                >
                                    Mobile Mode
                                </button>
                                <button
                                    onClick={handleGoToAccount}
                                    className="rounded-lg border-2 border-green-400 px-8 py-3 text-lg font-semibold text-green-400 transition-colors hover:bg-green-400/10"
                                >
                                    My Account
                                </button>
                                <button
                                    onClick={() => setShowUpgradeModal(true)}
                                    className="rounded-lg border-2 border-blue-400 px-8 py-3 text-lg font-semibold text-blue-400 transition-colors hover:bg-blue-400/10"
                                >
                                    View Plans
                                </button>
                            </div>
                        </div>

                        {/* Right Content - App Screenshot */}
                        <div className="relative">
                            <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-2xl">
                                <div className="aspect-video overflow-hidden rounded-lg">
                                    <img
                                        src="/images/app-screenshot.png"
                                        alt="Smart Irrigation Management System Interface"
                                        className="h-full w-full object-cover"
                                        onError={(e) => {
                                            // Fallback to placeholder if image fails to load
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const fallback =
                                                target.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                    <div
                                        className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800"
                                        style={{ display: 'none' }}
                                    >
                                        <div className="text-center">
                                            <div className="mb-4 text-6xl">🌱</div>
                                            <p className="font-medium text-gray-300">
                                                App Screenshot Placeholder
                                            </p>
                                            <p className="text-sm text-gray-400">
                                                Your irrigation planning interface
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Floating elements */}
                            <div className="absolute -right-4 -top-4 rounded-full bg-green-500 p-3 shadow-lg">
                                <span className="text-2xl">💧</span>
                            </div>
                            <div className="absolute -bottom-4 -left-4 rounded-full bg-blue-500 p-3 shadow-lg">
                                <span className="text-2xl">📊</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="bg-gray-800 py-20">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-16 text-center">
                        <h2 className="mb-4 text-3xl font-bold text-white lg:text-4xl">
                            Why Choose Our Platform?
                        </h2>
                        <p className="mx-auto max-w-3xl text-lg text-gray-300">
                            Our comprehensive irrigation management system provides everything you
                            need to optimize your agricultural operations.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {/* Feature 1 */}
                        <div className="p-6 text-center">
                            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-900/30">
                                <span className="text-3xl">🎯</span>
                            </div>
                            <h3 className="mb-3 text-xl font-semibold text-white">
                                Precision Planning
                            </h3>
                            <p className="text-gray-300">
                                Create detailed irrigation plans with precise water distribution and
                                timing optimization.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="p-6 text-center">
                            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30">
                                <span className="text-3xl">📈</span>
                            </div>
                            <h3 className="mb-3 text-xl font-semibold text-white">
                                Smart Analytics
                            </h3>
                            <p className="text-gray-300">
                                Monitor water usage, crop health, and efficiency with advanced
                                analytics and reporting.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="p-6 text-center">
                            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-purple-900/30">
                                <span className="text-3xl">🌍</span>
                            </div>
                            <h3 className="mb-3 text-xl font-semibold text-white">
                                Sustainable Farming
                            </h3>
                            <p className="text-gray-300">
                                Reduce water waste and environmental impact while maximizing crop
                                yields and quality.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section className="bg-gray-900 py-20">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-16 text-center">
                        <h2 className="mb-4 text-3xl font-bold text-white lg:text-4xl">
                            Choose Your Plan
                        </h2>
                        <p className="text-lg text-gray-300">
                            Try our Free plan now! Pro and Advanced plans coming in 2026.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:items-stretch">
                        {/* Free Plan */}
                        <div className="relative flex flex-col rounded-lg border-2 border-gray-600 bg-gray-800 p-8 text-center shadow-lg">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
                                <span className="whitespace-nowrap rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
                                    Available Now
                                </span>
                            </div>

                            <div className="mb-6">
                                <div className="mb-2 text-4xl">🆓</div>
                                <div className="text-2xl font-bold text-white">Free</div>
                                <div className="text-sm text-gray-400">
                                    Perfect for getting started
                                </div>
                            </div>

                            <div className="mb-6">
                                <div className="text-3xl font-bold text-white">Free</div>
                                <div className="text-sm text-gray-400">Forever</div>
                            </div>

                            <div className="mb-8 flex-grow space-y-3 text-left">
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    100 tokens per month
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    50 tokens daily
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    Basic irrigation planning
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    Standard support
                                </div>
                            </div>

                            <button
                                onClick={handleTryFreePlan}
                                className="mt-auto w-full rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
                            >
                                Mobile Mode
                            </button>
                        </div>

                        {/* Pro Plan */}
                        <div className="relative flex flex-col rounded-lg border-2 border-blue-500 bg-gray-800 p-8 text-center shadow-lg">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
                                <span className="whitespace-nowrap rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white">
                                    Coming Q2 2026
                                </span>
                            </div>

                            <div className="mb-6">
                                <div className="mb-2 text-4xl">⭐</div>
                                <div className="text-2xl font-bold text-white">Pro</div>
                                <div className="text-sm text-gray-400">For serious users</div>
                            </div>

                            <div className="mb-6">
                                <div className="text-3xl font-bold text-white">XXX</div>
                                <div className="text-sm text-gray-400">tokens per month</div>
                            </div>

                            <div className="mb-8 flex-grow space-y-3 text-left">
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    XXX tokens per month
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    100 tokens daily
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    Advanced irrigation planning
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    Priority support
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    Export capabilities
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    Advanced analytics
                                </div>
                            </div>

                            <button
                                disabled
                                className="mt-auto w-full cursor-not-allowed rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white opacity-50"
                            >
                                Coming Q2 2026
                            </button>
                        </div>

                        {/* Advanced Plan */}
                        <div className="flex flex-col rounded-lg border-2 border-purple-500 bg-gray-800 p-8 text-center shadow-lg transition-shadow hover:shadow-xl">
                            <div className="mb-6">
                                <div className="mb-2 text-4xl">💎</div>
                                <div className="text-2xl font-bold text-white">Advanced</div>
                                <div className="text-sm text-gray-400">For professionals</div>
                            </div>

                            <div className="mb-6">
                                <div className="text-3xl font-bold text-white">XXX</div>
                                <div className="text-sm text-gray-400">tokens per month</div>
                            </div>

                            <div className="mb-8 flex-grow space-y-3 text-left">
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    1000 tokens per month
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    200 tokens daily
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    Premium irrigation planning
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    24/7 priority support
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    Unlimited exports
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    Advanced analytics
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    Custom integrations
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                    <svg
                                        className="h-4 w-4 text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    API access
                                </div>
                            </div>

                            <button
                                onClick={handleContinueToApp}
                                className="mt-auto w-full rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700"
                            >
                                Try Advanced For Free
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Video Section */}
            <section className="bg-gray-800 py-20">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="mb-16 text-center">
                        <h2 className="mb-4 text-3xl font-bold text-white lg:text-4xl">
                            See Our Platform in Action
                        </h2>
                        <p className="mx-auto max-w-3xl text-lg text-gray-300">
                            Watch how our smart irrigation management system transforms agricultural
                            operations and maximizes efficiency.
                        </p>
                    </div>

                    <div className="relative">
                        <div className="aspect-video overflow-hidden rounded-2xl shadow-2xl">
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                                <div className="text-center">
                                    <div className="mb-4 text-6xl">🎥</div>
                                    <p className="font-medium text-gray-300">Platform Demo Video</p>
                                    <p className="text-sm text-gray-400">Video coming soon</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Video features */}
                    <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
                        <div className="text-center">
                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-900/30">
                                <span className="text-xl">⚡</span>
                            </div>
                            <h3 className="mb-2 text-lg font-semibold text-white">Quick Setup</h3>
                            <p className="text-sm text-gray-300">
                                Get started in minutes with our intuitive interface and guided setup
                                process.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-900/30">
                                <span className="text-xl">🎯</span>
                            </div>
                            <h3 className="mb-2 text-lg font-semibold text-white">
                                Precision Control
                            </h3>
                            <p className="text-sm text-gray-300">
                                Fine-tune every aspect of your irrigation system with millimeter
                                precision.
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-900/30">
                                <span className="text-xl">📊</span>
                            </div>
                            <h3 className="mb-2 text-lg font-semibold text-white">
                                Real-time Analytics
                            </h3>
                            <p className="text-sm text-gray-300">
                                Monitor performance and optimize efficiency with live data and
                                insights.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />

            {/* Upgrade Tier Modal */}
            <UpgradeTierModal
                isOpen={showUpgradeModal}
                onClose={handleCloseUpgradeModal}
                currentTier={user?.tier || 'free'}
                onUpgrade={handleUpgradeTier}
            />

            {/* Token Purchase Modal */}
            {selectedPlan && (
                <TokenPurchaseModal
                    isOpen={showTokenPurchaseModal}
                    onClose={() => {
                        setShowTokenPurchaseModal(false);
                        setSelectedPlan(null);
                    }}
                    planType={selectedPlan.type}
                    months={selectedPlan.months}
                    tokenCost={
                        selectedPlan.type === 'pro'
                            ? 0 * selectedPlan.months
                            : 0 * selectedPlan.months
                    }
                    userTokens={user?.tokens || 0}
                    onSubmit={handleTokenPurchase}
                    onBuyTokens={handleBuyTokensWithMoney}
                />
            )}
        </div>
    );
}
