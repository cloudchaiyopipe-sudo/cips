// FreeNav Component
import { router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';

function FreeNav() {
    // State for language switching with localStorage persistence
    const [language, setLanguage] = useState<'EN' | 'TH'>(() => {
        // Initialize from localStorage or default to 'EN'
        if (typeof window !== 'undefined') {
            const savedLanguage = localStorage.getItem('cips-language') as 'EN' | 'TH';
            return savedLanguage || 'EN';
        }
        return 'EN';
    });

    // Track if this is the initial mount to avoid dispatching event on mount
    const isInitialMount = useRef(true);

    // Dispatch language change event after state update (outside render cycle)
    useEffect(() => {
        // Skip the initial mount
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (typeof window !== 'undefined') {
            // Dispatch event after render cycle completes
            window.dispatchEvent(
                new CustomEvent('languageChanged', {
                    detail: { language },
                })
            );
        }
    }, [language]);

    // Handle language toggle with localStorage persistence
    const handleLanguageToggle = () => {
        setLanguage((prev) => {
            const newLanguage = prev === 'EN' ? 'TH' : 'EN';
            // Save to localStorage
            if (typeof window !== 'undefined') {
                localStorage.setItem('cips-language', newLanguage);
            }
            return newLanguage;
        });
    };
    // Return TSX
    return (
        <nav className="border-b border-slate-600 bg-slate-800/50 backdrop-blur-sm">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
                {/* Logo/Brand */}
                <button
                    onClick={() => router.visit('/free-plan')}
                    className="flex items-center gap-3 rounded-lg p-1 transition-all duration-200 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg">
                        <img
                            src="/images/chaiyo-logo.png"
                            alt="Chaiyo Logo"
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-white md:text-base">
                            <span className="block">Chaiyo Irrigation</span>
                            <span className="block">Planning System (CIPS)</span>
                        </h1>
                    </div>
                </button>

                {/* Language Toggle / Profile Shortcut */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleLanguageToggle}
                        className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-600 md:px-4 md:text-sm"
                    >
                        {language}
                    </button>
                    <button
                        onClick={() => router.visit('/free-plan/account')}
                        className="rounded-lg border border-blue-500 bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 md:px-4 md:text-sm"
                    >
                        NP
                    </button>
                </div>
            </div>
        </nav>
    );
}

// 5. Export
export default FreeNav;
