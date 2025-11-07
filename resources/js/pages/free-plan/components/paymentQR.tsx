// 1. Import
import { Head, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import QRCodeSVG from 'react-qr-code';
import FreeNav from './freeNav';
import { getTranslations } from '../utils/language';

// 2. Component
function PaymentQR() {
    const [translations, setTranslations] = useState(getTranslations());
    
    // Bank account information
    const BANK_NAME = 'Kasikorn Bank';
    const ACCOUNT_NUMBER = '123-4-56789-0';
    const ACCOUNT_NAME = 'Chaiyo Irrigation Co., Ltd.';
    const AMOUNT = 599; // Pro Plan price
    
    // Generate QR code data for Thai QR Payment
    // Format: 00020101021153037645802TH29370016A0000006770101120113006612345678905802TH6304
    // This is a simplified version - in production, you would generate proper QR code data
    const QR_CODE_DATA = `00020101021153037645802TH29370016A00000067701011201130066${ACCOUNT_NUMBER.replace(/-/g, '')}5802TH6304`;
    
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
            <Head title="Payment QR Code" />

            {/* Navbar */}
            <FreeNav />

            <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
                {/* Header */}
                <div className="mb-8 flex items-center gap-4 text-white">
                    <button 
                        onClick={handleBack} 
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700/50 text-white transition-all duration-200 hover:bg-slate-600/50 hover:scale-105"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white md:text-4xl">{translations.proPlan}</h1>
                        <p className="text-lg text-slate-300">Payment QR Code</p>
                    </div>
                </div>

                {/* Payment QR Code Card */}
                <div className="mx-auto max-w-2xl">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700/40 to-slate-600/40 p-8 shadow-2xl backdrop-blur-sm border border-slate-600/30">
                        {/* Decorative elements */}
                        <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-green-500/10 blur-xl"></div>
                        <div className="absolute -bottom-4 -left-4 h-32 w-32 rounded-full bg-blue-500/10 blur-xl"></div>
                        
                        {/* Payment Instructions */}
                        <div className="mb-6 text-center">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-4 py-2 text-sm font-semibold text-blue-300">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Scan QR Code with Mobile Banking App
                            </div>
                            <p className="text-sm text-slate-300">
                                Use your mobile banking app to scan the QR code below to complete the payment
                            </p>
                        </div>

                        {/* QR Code Display */}
                        <div className="mb-6 flex justify-center">
                            <div className="rounded-lg bg-white p-6 shadow-lg">
                                <QRCodeSVG
                                    value={QR_CODE_DATA}
                                    size={300}
                                    level="M"
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox="0 0 300 300"
                                />
                            </div>
                        </div>

                        {/* Payment Details */}
                        <div className="mb-6 rounded-lg bg-slate-800/50 p-6">
                            <h3 className="mb-4 text-lg font-semibold text-white">Payment Information</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                                    <span className="text-slate-300">Plan:</span>
                                    <span className="font-semibold text-white">{translations.proPlan}</span>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                                    <span className="text-slate-300">Amount:</span>
                                    <span className="text-2xl font-bold text-green-400">฿{AMOUNT.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                                    <span className="text-slate-300">Bank:</span>
                                    <span className="font-semibold text-white">{BANK_NAME}</span>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                                    <span className="text-slate-300">Account Number:</span>
                                    <span className="font-semibold text-white">{ACCOUNT_NUMBER}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-300">Account Name:</span>
                                    <span className="font-semibold text-white">{ACCOUNT_NAME}</span>
                                </div>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="mb-6 rounded-lg bg-blue-900/20 border border-blue-700/30 p-4">
                            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-300">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Payment Instructions
                            </h4>
                            <ol className="space-y-2 text-xs text-blue-200 list-decimal list-inside">
                                <li>Open your mobile banking app</li>
                                <li>Select "Scan QR Code" or "QR Payment"</li>
                                <li>Scan the QR code displayed above</li>
                                <li>Verify the payment amount (฿{AMOUNT.toLocaleString()})</li>
                                <li>Confirm the payment</li>
                                <li>Take a screenshot of the payment confirmation</li>
                                <li>Upload the payment proof using the button below</li>
                            </ol>
                        </div>

                        {/* Upload Payment Proof Button */}
                        <div className="space-y-4">
                            <button 
                                onClick={() => alert('Payment proof upload feature will be implemented')}
                                className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-700 py-4 px-8 text-xl font-bold text-white shadow-lg transition-all duration-300 hover:from-green-500 hover:to-green-600 hover:shadow-xl hover:scale-105 active:scale-95"
                            >
                                Upload Payment Proof
                            </button>
                            
                            <button 
                                onClick={handleBack}
                                className="w-full rounded-xl bg-slate-700/50 py-3 px-6 text-lg font-medium text-white transition-all duration-200 hover:bg-slate-600/50"
                            >
                                Back to Upgrade Page
                            </button>
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className="mt-6 rounded-lg bg-slate-700/30 p-4 text-center text-white">
                        <p className="text-sm text-slate-300">
                            After payment confirmation, your Pro Plan subscription will be activated within 24 hours.
                            If you have any questions, please contact our support team.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 3. Export
export default PaymentQR;

