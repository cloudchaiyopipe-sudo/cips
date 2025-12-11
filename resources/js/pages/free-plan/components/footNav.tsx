// FootNav Component - Bottom Navigation for Mobile
import { router } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import { SharedData } from '@/types';
import { motion } from 'framer-motion';

function FootNav() {
    const { url } = usePage<SharedData>();

    // Navigation items
    const navItems = [
        {
            id: 'add-field',
            label: 'เพิ่มแปลง',
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
            label: 'ข่าวสาร',
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
            label: 'สินค้า',
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
            label: 'ฉัน',
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
    };

    return (
        <motion.nav 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-slate-900/80 pb-safe backdrop-blur-xl md:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} // Handle iPhone X+ safe area
        >
            <div className="flex h-20 items-center justify-around px-2 pb-2">
                {navItems.map((item) => {
                    const isAddField = item.id === 'add-field';
                    
                    return (
                        <button
                            key={item.id}
                            onClick={() => handleNavClick(item)}
                            className="group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 outline-none transition-colors"
                        >
                            {/* Active Background Pill (Sliding Effect) */}
                            {item.isActive && (
                                <motion.div
                                    layoutId="nav-pill"
                                    className={`absolute inset-0 mx-2 my-1 rounded-2xl bg-gradient-to-t ${item.activeClass} backdrop-blur-sm`}
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                            
                            {/* Active Top Glow Line */}
                            {item.isActive && (
                                <motion.div 
                                    layoutId="nav-glow"
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
                                    y: item.isActive ? -2 : 0
                                }}
                                whileTap={{ scale: 0.9 }}
                            >
                                {item.icon}
                            </motion.div>

                            {/* Label */}
                            <motion.span 
                                className={`relative z-10 text-[10px] font-medium transition-colors duration-300 ${
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
                })}
            </div>
        </motion.nav>
    );
}

export default FootNav;
