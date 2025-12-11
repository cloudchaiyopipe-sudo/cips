// FreeNav Component
import { router, usePage } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import { SharedData } from '@/types';
import { motion } from 'framer-motion';

function FreeNav() {
    // Get user data from Inertia page props
    const page = usePage<SharedData>();
    const user = page.props.auth?.user;
    const isAdmin = user?.is_admin || false;
    
    // Generate user initials from name
    const getUserInitials = (name: string | undefined | null): string => {
        if (!name || name.trim().length === 0) {
            return 'U';
        }
        
        const nameParts = name.trim().split(/\s+/);
        
        if (nameParts.length === 1) {
            // Single word: use first 2 characters
            const firstTwo = nameParts[0].substring(0, 2).toUpperCase();
            return firstTwo.length === 1 ? firstTwo + firstTwo : firstTwo;
        } else {
            // Multiple words: use first letter of first and last word
            const firstInitial = nameParts[0].charAt(0).toUpperCase();
            const lastInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
            return firstInitial + lastInitial;
        }
    };
    
    const userInitials = getUserInitials(user?.name); 

    // State for language switching
    const [language, setLanguage] = useState<'EN' | 'TH'>(() => {
        if (typeof window !== 'undefined') {
            const savedLanguage = localStorage.getItem('cips-language') as 'EN' | 'TH';
            return savedLanguage || 'EN';
        }
        return 'EN';
    });

    const isInitialMount = useRef(true);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('languageChanged', {
                    detail: { language },
                })
            );
        }
    }, [language]);

    const handleLanguageToggle = () => {
        setLanguage((prev) => {
            const newLanguage = prev === 'EN' ? 'TH' : 'EN';
            if (typeof window !== 'undefined') {
                localStorage.setItem('cips-language', newLanguage);
            }
            return newLanguage;
        });
    };

    return (
        <motion.nav 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full border-b border-white/5 bg-slate-900/60 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-900/60"
        >
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
                {/* Logo/Brand */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.visit('/free-plan')}
                    className="group flex items-center gap-3 rounded-xl p-1 transition-all focus:outline-none"
                >
                    <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/5 shadow-inner ring-1 ring-white/10 transition-all group-hover:bg-white/10 group-hover:shadow-green-500/20">
                        <img
                            src="/images/chaiyo-logo.png"
                            alt="Chaiyo Logo"
                            className="h-full w-full object-contain p-1"
                        />
                    </div>
                    <div className="text-left">
                        <h1 className="text-sm font-bold leading-tight text-slate-100 group-hover:text-white md:text-base">
                            <span className="block">Chaiyo Irrigation</span>
                            <span className="block bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                                Planning System
                            </span>
                        </h1>
                    </div>
                </motion.button>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3 md:gap-4">
                    {/* Language Toggle */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleLanguageToggle}
                        className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white md:px-4 md:text-sm"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            <span className={language === 'EN' ? 'text-white font-bold' : 'text-slate-500'}>EN</span>
                            <span className="h-3 w-[1px] bg-slate-600"></span>
                            <span className={language === 'TH' ? 'text-white font-bold' : 'text-slate-500'}>TH</span>
                        </span>
                    </motion.button>

                    {/* Profile Button */}
                    <div className="relative">
                        {/* Admin Crown Icon */}
                        {isAdmin && (
                            <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 400, delay: 0.2 }}
                                className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-lg shadow-yellow-500/30 ring-2 ring-slate-900" 
                                title="Admin"
                            >
                                <svg className="h-3 w-3 text-yellow-900" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                                </svg>
                            </motion.div>
                        )}
                        
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => router.visit('/free-plan/account')}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-bold text-white shadow-lg shadow-blue-500/20 ring-2 ring-white/10 transition-all hover:ring-blue-400/50 md:h-10 md:w-10 md:text-sm"
                        >
                            {userInitials}
                        </motion.button>
                    </div>
                </div>
            </div>
        </motion.nav>
    );
}

// Export
export default FreeNav;
