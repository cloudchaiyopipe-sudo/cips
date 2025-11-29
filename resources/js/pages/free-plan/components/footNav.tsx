// FootNav Component - Bottom Navigation for Mobile
import { router } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import { SharedData } from '@/types';

function FootNav() {
    const { url } = usePage<SharedData>();

    // Navigation items
    const navItems = [
        {
            id: 'add-field',
            label: 'เพิ่มแปลง',
            icon: (
                <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                </svg>
            ),
            route: '/free-plan',
            isActive: url === '/free-plan' || url.startsWith('/free-plan/choose-crop'),
        },
        {
            id: 'news',
            label: 'ข่าวสาร',
            icon: (
                <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                </svg>
            ),
            route: '/free-plan/news',
            isActive: url.startsWith('/free-plan/news'),
        },
        {
            id: 'products',
            label: 'สินค้า',
            icon: (
                <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                </svg>
            ),
            route: '/free-plan/products',
            isActive: url.startsWith('/free-plan/products'),
        },
        {
            id: 'account',
            label: 'ข้อมูลของฉัน',
            icon: (
                <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                </svg>
            ),
            route: '/free-plan/account',
            isActive: url.startsWith('/free-plan/account'),
        },
    ];

    const handleNavClick = (item: (typeof navItems)[0]) => {
        if (item.id === 'add-field') {
            // Navigate directly to choose-crop page (same as add field action)
            router.visit('/free-plan/choose-crop');
        } else {
            router.visit(item.route);
        }
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-600 bg-slate-800/95 shadow-lg backdrop-blur-sm md:hidden">
            <div className="flex h-16 items-center justify-around">
                {navItems.map((item) => {
                    const isAddField = item.id === 'add-field';
                    return (
                        <button
                            key={item.id}
                            onClick={() => handleNavClick(item)}
                            className={`flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                                item.isActive
                                    ? isAddField
                                        ? 'bg-slate-700/50 text-green-500'
                                        : 'bg-slate-700/50 text-blue-500'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <div
                                className={`transition-transform ${
                                    item.isActive ? 'scale-110' : 'scale-100'
                                }`}
                            >
                                {item.icon}
                            </div>
                            <span className="text-xs font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}

export default FootNav;
