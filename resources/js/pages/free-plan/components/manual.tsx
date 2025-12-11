// Manual/Tutorial Component
import { useState, useEffect } from 'react';
import { getTranslations, LanguageTranslations } from '../utils/language';

interface ManualProps {
    onClose: () => void;
}

// Function to create manual pages content
const createManualPages = (translations: LanguageTranslations) => [
    {
        title: translations.welcomeToFreePlan,
        description: translations.manualDescription,
        image: '/freePlanImg/freeManual/manual_1.png',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 w-full overflow-hidden rounded-lg bg-slate-700" style={{ aspectRatio: '210/297', maxHeight: '50vh' }}>
                        <img
                            src="/freePlanImg/freeManual/manual_1.png"
                            alt={translations.gettingStarted}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                    target.parentElement.innerHTML = `<div class="flex h-full w-full items-center justify-center text-slate-400">${translations.noImage}</div>`;
                                }
                            }}
                        />
                    </div>
                    <h3 className="text-xl font-bold text-white">{translations.gettingStarted}</h3>
                </div>
            </div>
        ),
    },
    {
        title: translations.step1SelectCrop,
        description: translations.selectCropDescription,
        image: '/freePlanImg/freeManual/manual_2.png',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 w-full overflow-hidden rounded-lg bg-slate-700" style={{ aspectRatio: '210/297', maxHeight: '50vh' }}>
                        <img
                            src="/freePlanImg/freeManual/manual_2.png"
                            alt={translations.selectCrop}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                    target.parentElement.innerHTML = `<div class="flex h-full w-full items-center justify-center text-slate-400">${translations.noImage}</div>`;
                                }
                            }}
                        />
                    </div>
                    <h3 className="text-xl font-bold text-white">{translations.selectCrop}</h3>
                </div>
            </div>
        ),
    },
    {
        title: translations.step2DrawMap,
        description: translations.drawMapDescription,
        image: '/freePlanImg/freeManual/manual_3.png',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 w-full overflow-hidden rounded-lg bg-slate-700" style={{ aspectRatio: '210/297', maxHeight: '50vh' }}>
                        <img
                            src="/freePlanImg/freeManual/manual_3.png"
                            alt={translations.drawMap}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                    target.parentElement.innerHTML = `<div class="flex h-full w-full items-center justify-center text-slate-400">${translations.noImage}</div>`;
                                }
                            }}
                        />
                    </div>
                    <h3 className="text-xl font-bold text-white">{translations.drawMap}</h3>
                </div>
            </div>
        ),
    },
    {
        title: translations.step3ViewSummary,
        description: translations.viewSummaryDescription,
        image: '/freePlanImg/freeManual/manual_4.png',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 w-full overflow-hidden rounded-lg bg-slate-700" style={{ aspectRatio: '210/297', maxHeight: '50vh' }}>
                        <img
                            src="/freePlanImg/freeManual/manual_4.png"
                            alt={translations.viewSummary}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                    target.parentElement.innerHTML = `<div class="flex h-full w-full items-center justify-center text-slate-400">${translations.noImage}</div>`;
                                }
                            }}
                        />
                    </div>
                    <h3 className="text-xl font-bold text-white">{translations.viewSummary}</h3>
                </div>
            </div>
        ),
    },
    {
        title: translations.step4ProductSpecs,
        description: translations.productSpecsDescription,
        image: '/freePlanImg/freeManual/manual_5.png',
        content: (
            <div className="space-y-4">
                <div className="text-center">
                    <div className="mx-auto mb-4 w-full overflow-hidden rounded-lg bg-slate-700" style={{ aspectRatio: '210/297', maxHeight: '50vh' }}>
                        <img
                            src="/freePlanImg/freeManual/manual_5.png"
                            alt={translations.productSpecs}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                    target.parentElement.innerHTML = `<div class="flex h-full w-full items-center justify-center text-slate-400">${translations.noImage}</div>`;
                                }
                            }}
                        />
                    </div>
                    <h3 className="text-xl font-bold text-white">{translations.productSpecs}</h3>
                </div>
            </div>
        ),
    },
];

function Manual({ onClose }: ManualProps) {
    const [currentPage, setCurrentPage] = useState(0);
    const [dontShowAgain, setDontShowAgain] = useState(false);
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

    const manualPages = createManualPages(translations);

    const handleNext = () => {
        if (currentPage < manualPages.length - 1) {
            setCurrentPage(currentPage + 1);
        } else {
            handleClose();
        }
    };

    const handlePrev = () => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleClose = () => {
        if (dontShowAgain) {
            // Save to localStorage to not show again
            localStorage.setItem('manualDontShowAgain', 'true');
        }
        onClose();
    };

    const handleSkip = () => {
        handleClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative mx-4 w-full max-w-md rounded-2xl bg-slate-800 p-6 shadow-2xl">
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
                >
                    ✕
                </button>

                {/* Header */}
                <div className="mb-4 text-center">
                    <h2 className="mb-2 text-2xl font-bold text-white">
                        {manualPages[currentPage].title}
                    </h2>
                </div>

                {/* Content */}
                <div className="mb-6 min-h-[280px]">
                    {manualPages[currentPage].content}
                </div>

                {/* Progress Indicators */}
                <div className="mb-4 flex items-center justify-center gap-2">
                    {manualPages.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentPage(index)}
                            className={`h-3 w-3 rounded-full transition-colors ${
                                index === currentPage
                                    ? 'w-8 bg-blue-400'
                                    : 'bg-slate-500 hover:bg-slate-400'
                            }`}
                        />
                    ))}
                </div>

                {/* Navigation Controls */}
                <div className="mb-4 flex items-center justify-between">
                    <button
                        onClick={handlePrev}
                        disabled={currentPage === 0}
                        className={`rounded px-4 py-2 text-sm text-white transition-colors ${
                            currentPage === 0
                                ? 'cursor-not-allowed bg-slate-600 opacity-50'
                                : 'bg-slate-600 hover:bg-slate-700'
                        }`}
                    >
                        {translations.back}
                    </button>

                    <button
                        onClick={handleSkip}
                        className="rounded px-4 py-2 text-sm text-slate-400 transition-colors hover:text-white"
                    >
                        {translations.skip}
                    </button>

                    <button
                        onClick={handleNext}
                        className="rounded bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                    >
                        {currentPage === manualPages.length - 1
                            ? translations.finish
                            : translations.next}
                    </button>
                </div>

                {/* Don't Show Again Checkbox */}
                <div className="flex items-center justify-center gap-2 border-t border-slate-700 pt-4">
                    <input
                        type="checkbox"
                        id="dontShowAgain"
                        checked={dontShowAgain}
                        onChange={(e) => setDontShowAgain(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <label
                        htmlFor="dontShowAgain"
                        className="cursor-pointer select-none text-sm text-slate-300"
                    >
                        {translations.dontShowAgainManual}
                    </label>
                </div>
            </div>
        </div>
    );
}

export default Manual;
