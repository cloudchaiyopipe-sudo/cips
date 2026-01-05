// FootNav Component - Bottom Navigation for Mobile, Side Drawer for Desktop
import { router } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import { SharedData } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { getTranslations } from '../utils/language';

function FootNav() {
    const { url } = usePage<SharedData>();
    const [translations, setTranslations] = useState(getTranslations());
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Listen for language changes
    useEffect(() => {
        const handleLanguageChange = () => setTranslations(getTranslations());
        window.addEventListener('storage', handleLanguageChange);
        window.addEventListener('languageChanged', handleLanguageChange);
        window.addEventListener('focus', handleLanguageChange);
        return () => {
            window.removeEventListener('storage', handleLanguageChange);
            window.removeEventListener('languageChanged', handleLanguageChange);
            window.removeEventListener('focus', handleLanguageChange);
        };
    }, []);

    // Navigation items
    const navItems = [
        {
            id: 'add-field',
            label: translations.navAddField,
            // Active Gradient for this specific item (Green)
            activeClass: 'from-green-500/20 to-emerald-500/20 text-green-400', 
            icon: (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            ),
            route: '/free-plan',
            isActive: url === '/free-plan' || url.startsWith('/free-plan/choose-crop'),
        },
        {
            id: 'news',
            label: translations.navNews,
            activeClass: 'from-blue-500/20 to-indigo-500/20 text-blue-400',
            icon: (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
            ),
            route: '/free-plan/news',
            isActive: url.startsWith('/free-plan/news'),
        },
        {
            id: 'products',
            label: translations.navProducts,
            activeClass: 'from-purple-500/20 to-pink-500/20 text-purple-400',
            icon: (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
            ),
            route: '/free-plan/products',
            isActive: url.startsWith('/free-plan/products'),
        },
        {
            id: 'account',
            label: translations.navAccount,
            activeClass: 'from-orange-500/20 to-red-500/20 text-orange-400',
            icon: (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            ),
            route: '/free-plan/account',
            isActive: url.startsWith('/free-plan/account'),
        },
    ];

    const handleNavClick = (item: typeof navItems[0]) => {
        if (item.id === 'add-field') {
            router.visit('/free-plan/choose-crop');
        } else {
            router.visit(item.route);
        }
        // Close drawer on mobile after navigation
        if (window.innerWidth < 768) {
            setIsDrawerOpen(false);
        }
    };

    const toggleDrawer = () => {
        setIsDrawerOpen(!isDrawerOpen);
    };

    // Render navigation item
    const renderNavItem = (item: typeof navItems[0], isDesktop: boolean = false) => {
                    const isAddField = item.id === 'add-field';
                    
                    return (
                        <button
                            key={item.id}
                            onClick={() => handleNavClick(item)}
                className={`group relative flex ${
                    isDesktop ? 'flex-row items-center gap-3 px-4 py-3 rounded-xl' : 'flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2'
                } outline-none transition-colors`}
                        >
                            {/* Active Background Pill (Sliding Effect) */}
                            {item.isActive && (
                                <motion.div
                        layoutId={isDesktop ? `nav-pill-desktop` : `nav-pill-mobile`}
                        className={`absolute ${
                            isDesktop 
                                ? 'inset-0 rounded-xl' 
                                : 'inset-0 mx-2 my-1 rounded-2xl'
                        } bg-gradient-to-t ${item.activeClass} backdrop-blur-sm`}
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                            
                {/* Active Left Glow Line - Only for desktop */}
                {isDesktop && item.isActive && (
                    <motion.div 
                        layoutId="nav-glow-desktop"
                        className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-current opacity-70 ${isAddField ? 'text-green-500' : item.id === 'news' ? 'text-blue-500' : item.id === 'products' ? 'text-purple-500' : 'text-orange-500'}`} 
                    />
                )}

                {/* Active Top Glow Line - Only for mobile */}
                {!isDesktop && item.isActive && (
                                <motion.div 
                        layoutId="nav-glow-mobile"
                                    className={`absolute -top-[1px] h-[2px] w-12 rounded-full bg-current opacity-70 ${isAddField ? 'text-green-500' : item.id === 'news' ? 'text-blue-500' : item.id === 'products' ? 'text-purple-500' : 'text-orange-500'}`} 
                                />
                            )}

                            {/* Icon Container */}
                            <motion.div
                                className={`relative z-10 transition-colors duration-300 ${
                                    item.isActive 
                                        ? isAddField ? 'text-green-400' : item.id === 'news' ? 'text-blue-400' : item.id === 'products' ? 'text-purple-400' : 'text-orange-400'
                                        : 'text-slate-500 group-hover:text-slate-300'
                                }`}
                                animate={{ 
                                    scale: item.isActive ? 1.1 : 1,
                        y: item.isActive ? (isDesktop ? 0 : -2) : 0
                                }}
                                whileTap={{ scale: 0.9 }}
                            >
                                {item.icon}
                            </motion.div>

                            {/* Label */}
                            <motion.span 
                    className={`relative z-10 ${
                        isDesktop ? 'text-sm font-medium' : 'text-[10px] font-medium'
                    } transition-colors duration-300 ${
                                    item.isActive 
                                        ? 'text-slate-100' 
                                        : 'text-slate-500 group-hover:text-slate-300'
                                }`}
                                animate={{ opacity: item.isActive ? 1 : 0.7 }}
                            >
                                {item.label}
                            </motion.span>
                        </button>
                    );
    };

    return (
        <>
            {/* Mobile Bottom Navigation */}
            <motion.nav 
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-slate-900/80 pb-safe backdrop-blur-xl md:hidden"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <div className="flex h-20 items-center justify-around px-2 pb-2">
                    {navItems.map((item) => renderNavItem(item, false))}
                </div>
            </motion.nav>

            {/* Desktop Toggle Button */}
            <motion.button
                initial={{ x: -20, opacity: 0 }}
                animate={{ 
                    x: isDrawerOpen ? 280 : 0,
                    opacity: 1
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleDrawer}
                className="fixed left-4 top-1/2 z-50 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-slate-900/80 p-3 shadow-lg backdrop-blur-xl transition-all hover:bg-slate-800/90 hover:border-white/20 hover:shadow-xl md:flex"
                aria-label="Toggle Navigation"
            >
                <motion.svg
                    className="h-6 w-6 text-slate-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    animate={{ rotate: isDrawerOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={isDrawerOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                    />
                </motion.svg>
            </motion.button>

            {/* Desktop Side Drawer */}
            <AnimatePresence>
                {isDrawerOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={toggleDrawer}
                            className="fixed inset-0 z-40 hidden bg-black/50 backdrop-blur-sm md:block"
                        />

                        {/* Drawer */}
                        <motion.nav
                            initial={{ x: -300 }}
                            animate={{ x: 0 }}
                            exit={{ x: -300 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="fixed left-0 top-0 z-50 hidden h-full w-72 border-r border-white/10 bg-gradient-to-b from-slate-900/98 to-slate-800/98 backdrop-blur-xl shadow-2xl md:flex md:flex-col"
                        >
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 p-4">
                                <h2 className="text-lg font-semibold text-white">Navigation</h2>
                                <button
                                    onClick={toggleDrawer}
                                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Navigation Items */}
                            <div className="flex-1 space-y-2 overflow-y-auto p-4 custom-scrollbar">
                                {navItems.map((item) => renderNavItem(item, true))}
            </div>
        </motion.nav>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

export default FootNav;
