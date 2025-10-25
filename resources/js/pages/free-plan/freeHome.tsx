// 1. Import
import { Head, router, usePage } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import FreeFooter from './components/freeFooter';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { getTranslations } from './utils/language';

// Types
interface Advertisement {
    id: number;
    title: string;
    description: string;
    image_url: string;
    link_url: string;
    is_active: boolean;
}

interface PageProps {
    auth: {
        user: User | null;
    };
    [key: string]: unknown;
}

interface User {
    id: number;
    name: string;
    email: string;
}

// 2. State & Hooks Component
function FreeHome() {
    usePage<PageProps>();

    // State for advertisements
    const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
    const [currentAdIndex, setCurrentAdIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showAdModal, setShowAdModal] = useState(false);
    
    // State for language
    const [translations, setTranslations] = useState(getTranslations());

    // 3. Hooks
    useEffect(() => {
        loadAdvertisements();
    }, []);

    // Show advertisement modal when advertisements are loaded
    useEffect(() => {
        if (advertisements.length > 0 && !loading) {
            setShowAdModal(true);
        }
    }, [advertisements.length, loading]);

    // Listen for language changes from localStorage
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

    // Load advertisements
    const loadAdvertisements = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/advertisements/public');
            setAdvertisements(response.data.advertisements || []);
        } catch (error) {
            console.error('Error loading advertisements:', error);
            setAdvertisements([]);
        } finally {
            setLoading(false);
        }
    };

    // 4. Logic Handlers
    const handleAddField = () => {
        router.visit('/free-plan/choose-crop');
    };

    const handleUpgradeToPro = () => {
        router.visit('/free-plan/upgradePro');
    };

    const handleAdClick = (linkUrl: string) => {
        window.open(linkUrl, '_blank', 'noopener,noreferrer');
    };

    const handleCloseAdModal = () => {
        setShowAdModal(false);
    };

    const handleNextAd = () => {
        setCurrentAdIndex((prev) => (prev + 1) % advertisements.length);
    };

    const handlePrevAd = () => {
        setCurrentAdIndex((prev) => (prev - 1 + advertisements.length) % advertisements.length);
    };

    // 5. Return TSX
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title="Welcome to Free Plan" />

            {/* Custom Navbar */}
            <FreeNav />

            {/* Main Content */}
            <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-between">
                
                {/* Welcome Section */}
                <div className="w-full max-w-md px-4 pt-8 pb-4 text-center md:px-6 md:pt-12 md:pb-6 min-h-[80vh] md:min-h-auto">
                    <h1 className="mb-8 text-3xl font-bold text-white md:mb-12 md:text-4xl lg:text-5xl">
                        {translations.welcomeTo}
                        <br />
                        {translations.freePlan}
                    </h1>

                    {/* Add Field Button */}
                    <button
                        onClick={handleAddField}
                        className="mb-6 inline-flex items-center gap-2 rounded-lg bg-green-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-green-700 hover:shadow-xl md:mb-8 md:px-10 md:py-4 md:text-lg"
                    >
                        <svg
                            className="h-5 w-5 md:h-6 md:w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        {translations.addField}
                    </button>


                    {/* Saved Files Section */}
                    <div className="mb-6 rounded-lg border-2 border-dashed border-slate-500 bg-slate-600/30 p-8 md:mb-8 md:p-12 min-h-[240px] md:min-h-[150px] flex items-center justify-center">
                        <p className="text-sm text-slate-300 md:text-base">
                            {translations.yourSavedFiles}
                        </p>
                    </div>

                    {/* Upgrade to Pro Button */}
                    <button
                        onClick={handleUpgradeToPro}
                        className="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl md:mt-6 md:px-10 md:py-4 md:text-lg"
                    >
                        {translations.upgradeToPro}
                    </button>
                </div>

                {/* Footer Information */}
                <FreeFooter />
            </div>

            {/* Advertisement Modal */}
            {showAdModal && advertisements.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="relative mx-4 w-full max-w-2xl lg:max-w-3xl rounded-2xl bg-slate-800 p-6 md:p-8 shadow-2xl">
                        {/* Close Button */}
                        <button
                            onClick={handleCloseAdModal}
                            className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
                        >
                            ✕
                        </button>

                        {/* Advertisement Content */}
                        <div 
                            className="cursor-pointer rounded-lg p-4 transition-all"
                            onClick={() => handleAdClick(advertisements[currentAdIndex].link_url)}
                        >
                            <div className="mb-5 text-center">
                                <h3 className="text-base font-semibold text-slate-200">{translations.sponsoredContent}</h3>
                            </div>
                            
                            <div className="flex flex-col items-center gap-4">
                                <img
                                    src={advertisements[currentAdIndex].image_url}
                                    alt={advertisements[currentAdIndex].title}
                                    className="h-[24rem] md:h-[28rem] w-full rounded-lg object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = '/images/no-image.jpg';
                                    }}
                                />
                                <div className="text-center">
                                    <h4 className="font-semibold text-white text-2xl lg:text-3xl">
                                        {advertisements[currentAdIndex].title}
                                    </h4>
                                    <p className="text-base lg:text-lg text-slate-300 mt-2">
                                        {advertisements[currentAdIndex].description}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Controls */}
                        {advertisements.length > 1 && (
                            <div className="mt-6 flex items-center justify-between">
                                <button
                                    onClick={handlePrevAd}
                                    className="rounded bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-700 transition-colors"
                                >
                                    {translations.previous}
                                </button>
                                
                                <div className="flex gap-2">
                                    {advertisements.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setCurrentAdIndex(index)}
                                            className={`h-3 w-3 rounded-full transition-colors ${
                                                index === currentAdIndex 
                                                    ? 'bg-blue-400' 
                                                    : 'bg-slate-500'
                                            }`}
                                        />
                                    ))}
                                </div>

                                <button
                                    onClick={handleNextAd}
                                    className="rounded bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-700 transition-colors"
                                >
                                    {translations.next}
                                </button>
                            </div>
                        )}

                        {/* Click to visit link hint */}
                        <div className="mt-4 text-center">
                            <p className="text-sm text-slate-400">{translations.clickAdToVisit}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 6. Export
export default FreeHome;
