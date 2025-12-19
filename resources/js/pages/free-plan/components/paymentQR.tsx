// 1. Import
import { Head, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import FreeNav from './freeNav';
import { getTranslations } from '../utils/language';

// 2. Component
function PaymentQR() {
    const [translations, setTranslations] = useState(getTranslations());
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'successful' | 'failed' | null>(null);
    const [amount, setAmount] = useState<number>(599); // Default amount
    const [chargeId, setChargeId] = useState<string | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Polling function to check payment status
    const startPolling = (chargeId: string) => {
        // Clear any existing polling
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        // Poll every 3 seconds
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const response = await axios.get(`/payment/status/${chargeId}`);
                
                if (response.data.status === 'successful' || response.data.paid === true) {
                    setPaymentStatus('successful');
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                    }
                    // Show success message and redirect after a delay
                    setTimeout(() => {
                        alert(translations.paymentSuccessfulMessage);
                        router.visit('/free-plan/account');
                    }, 2000);
                } else if (response.data.status === 'failed') {
                    setPaymentStatus('failed');
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                    }
                } else {
                    setPaymentStatus('pending');
                }
            } catch (err) {
                console.error('Error checking payment status:', err);
                // Don't stop polling on error, just log it
            }
        }, 3000);
    };

    // Generate QR code when component mounts
    useEffect(() => {
        const generateQR = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const response = await axios.post('/payment/qr');
                
                if (response.data.status === 'success') {
                    setQrCodeUrl(response.data.qrCodeUrl);
                    // Set amount if provided
                    if (response.data.amountFormatted) {
                        setAmount(response.data.amountFormatted);
                    }
                    // Store charge ID and start polling for payment status
                    if (response.data.chargeId) {
                        setChargeId(response.data.chargeId);
                        startPolling(response.data.chargeId);
                    }
                } else {
                    setError(response.data.message || translations.failedToGenerateQRCode);
                }
            } catch (err: unknown) {
                console.error('Error generating QR code:', err);
                let errorMessage = translations.failedToGenerateQRCode;
                if (err && typeof err === 'object') {
                    if ('response' in err && err.response && typeof err.response === 'object' && 'data' in err.response) {
                        const responseData = err.response.data as { message?: string };
                        if (responseData?.message) {
                            errorMessage = responseData.message;
                        }
                    } else if ('message' in err && typeof err.message === 'string') {
                        errorMessage = err.message;
                    }
                }
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        generateQR();

        // Cleanup polling on unmount
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Listen for language changes
    useEffect(() => {
        const handleLanguageChange = () => {
            setTranslations(getTranslations());
        };

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
        router.visit('/free-plan/upgradePro');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
            <Head title={translations.paymentQRCode} />

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
                            {translations.proPlan}
                        </h1>
                        <p className="text-lg text-slate-300">{translations.paymentQRCode}</p>
                    </div>
                </div>

                {/* Payment QR Code Card */}
                <div className="mx-auto max-w-2xl">
                    <div className="relative overflow-hidden rounded-2xl border border-slate-600/30 bg-gradient-to-br from-slate-700/40 to-slate-600/40 p-8 shadow-2xl backdrop-blur-sm">
                        {/* Decorative elements */}
                        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-green-500/10 blur-xl"></div>
                        <div className="absolute -bottom-4 -left-4 h-32 w-32 rounded-full bg-blue-500/10 blur-xl"></div>

                        {/* Payment Instructions */}
                        <div className="mb-6 text-center">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-4 py-2 text-sm font-semibold text-blue-300">
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
                                        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                                    />
                                </svg>
                                {translations.scanQRCodeWithPromptPay}
                            </div>
                            <p className="text-sm text-slate-300">
                                {translations.useMobileBankingApp}
                            </p>
                        </div>

                        {/* QR Code Display */}
                        <div className="mb-6 flex justify-center">
                            {loading ? (
                                <div className="flex h-[300px] w-[300px] items-center justify-center rounded-lg bg-white p-6 shadow-lg">
                                    <div className="text-center">
                                        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                                        <p className="text-sm text-gray-600">{translations.generatingQRCode}</p>
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="flex h-[300px] w-[300px] items-center justify-center rounded-lg bg-red-50 p-6 shadow-lg">
                                    <div className="text-center">
                                        <p className="mb-2 text-sm font-semibold text-red-600">{translations.errorOccurred}</p>
                                        <p className="text-xs text-red-500">{error}</p>
                                        <button
                                            onClick={() => window.location.reload()}
                                            className="mt-4 rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                                        >
                                            {translations.retry}
                                        </button>
                                    </div>
                                </div>
                            ) : qrCodeUrl ? (
                                <div className="rounded-lg bg-white p-6 shadow-lg">
                                    <img
                                        src={qrCodeUrl}
                                        alt={translations.paymentQRCode}
                                        className="h-[300px] w-[300px] object-contain"
                                    />
                                    {paymentStatus === 'successful' && (
                                        <div className="mt-4 rounded bg-green-100 p-2 text-center text-sm font-semibold text-green-700">
                                            {translations.paymentSuccessful}
                                        </div>
                                    )}
                                    {paymentStatus === 'failed' && (
                                        <div className="mt-4 rounded bg-red-100 p-2 text-center text-sm font-semibold text-red-700">
                                            {translations.paymentFailed}
                                        </div>
                                    )}
                                    {paymentStatus === 'pending' && (
                                        <div className="mt-4 rounded bg-yellow-100 p-2 text-center text-sm font-semibold text-yellow-700">
                                            {translations.waitingForPayment}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex h-[300px] w-[300px] items-center justify-center rounded-lg bg-gray-100 p-6 shadow-lg">
                                    <p className="text-sm text-gray-600">{translations.noQRCodeAvailable}</p>
                                </div>
                            )}
                        </div>

                        {/* Payment Details */}
                        <div className="mb-6 rounded-lg bg-slate-800/50 p-6">
                            <h3 className="mb-4 text-lg font-semibold text-white">
                                {translations.paymentInformation}
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                                    <span className="text-slate-300">{translations.planLabel}</span>
                                    <span className="font-semibold text-white">
                                        {translations.proPlan}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                                    <span className="text-slate-300">{translations.amountLabel}</span>
                                    <span className="text-2xl font-bold text-green-400">
                                        ฿{amount.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                                    <span className="text-slate-300">{translations.paymentMethod}</span>
                                    <span className="font-semibold text-white">{translations.promptPayQR}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-300">{translations.statusLabel}</span>
                                    <span className={`font-semibold ${
                                        paymentStatus === 'successful' ? 'text-green-400' :
                                        paymentStatus === 'failed' ? 'text-red-400' :
                                        paymentStatus === 'pending' ? 'text-yellow-400' :
                                        'text-slate-400'
                                    }`}>
                                        {paymentStatus === 'successful' ? translations.paid :
                                         paymentStatus === 'failed' ? translations.failed :
                                         paymentStatus === 'pending' ? translations.waiting :
                                         translations.pending}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="mb-6 rounded-lg border border-blue-700/30 bg-blue-900/20 p-4">
                            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-300">
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
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                {translations.paymentInstructions}
                            </h4>
                            <ol className="list-inside list-decimal space-y-2 text-xs text-blue-200">
                                <li>{translations.openMobileBankingApp}</li>
                                <li>{translations.selectScanQRCodeOption}</li>
                                <li>{translations.scanQRCodeDisplayed}</li>
                                <li>{translations.verifyPaymentAmount} (฿{amount.toLocaleString()})</li>
                                <li>{translations.confirmPaymentInBankingApp}</li>
                                <li>{translations.paymentStatusWillUpdate}</li>
                                <li>{translations.willRedirectAfterConfirmation}</li>
                            </ol>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-4">
                            {paymentStatus === 'successful' ? (
                                <button
                                    onClick={() => router.visit('/free-plan/account')}
                                    className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-8 py-4 text-xl font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:from-green-500 hover:to-green-600 hover:shadow-xl active:scale-95"
                                >
                                    {translations.goToAccount}
                                </button>
                            ) : (
                                <div className="rounded-lg border border-yellow-700/30 bg-yellow-900/20 p-4 text-center">
                                    <p className="text-sm text-yellow-200">
                                        {translations.waitingForPaymentConfirmation}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={handleBack}
                                className="w-full rounded-xl bg-slate-700/50 px-6 py-3 text-lg font-medium text-white transition-all duration-200 hover:bg-slate-600/50"
                            >
                                {translations.backToUpgradePage}
                            </button>
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className="mt-6 rounded-lg bg-slate-700/30 p-4 text-center text-white">
                        <p className="text-sm text-slate-300">
                            {translations.paymentProcessedSecurely}
                        </p>
                        {chargeId && (
                            <p className="mt-2 text-xs text-slate-400">
                                {translations.transactionID} {chargeId}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// 3. Export
export default PaymentQR;
