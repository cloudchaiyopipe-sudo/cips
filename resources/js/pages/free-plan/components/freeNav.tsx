// FreeNav Component
import { router, usePage } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import { SharedData } from '@/types';

function FreeNav() {
    // Get user data from Inertia page props
    const page = usePage<SharedData>();
    const isAdmin = page.props.auth?.user?.is_admin || false;

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
                    {/* Profile Button with Admin Crown Icon on top */}
                    <div className="relative">
                        {/* Admin Crown Icon - positioned on top */}
                        {isAdmin && (
                            <div className="absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 border-2 border-slate-800 shadow-lg" title="Admin">
                                <svg
                                    className="h-4 w-4 text-yellow-100"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                                </svg>
                            </div>
                        )}
                        <button
                            onClick={() => router.visit('/free-plan/account')}
                            className="rounded-lg border border-blue-500 bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 md:px-4 md:text-sm"
                        >
                            NP
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}

// 5. Export
export default FreeNav;
