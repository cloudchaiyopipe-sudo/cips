// ProductList Component - Product Listing Page
import { Head, router, usePage } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import FootNav from './components/footNav';
import { useState, useEffect } from 'react';
import { getTranslations } from './utils/language';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    image_url: string;
    category: 'new' | 'promotion';
    discount?: number;
    isNew?: boolean;
    isPromotion?: boolean;
}

interface PageProps {
    auth: {
        user: User | null;
    };
    products: Product[];
    [key: string]: unknown;
}

interface User {
    id: number;
    name: string;
    email: string;
    is_admin?: boolean;
}

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error';
}

// 2. State & Hooks Component
function ProductList() {
    const page = usePage<PageProps>();
    const { products = [] } = page.props;
    const isAdmin = page.props.auth?.user?.is_admin || false;
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [translations, setTranslations] = useState(getTranslations());
    const [activeTab, setActiveTab] = useState<'new' | 'promotion'>('new');
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Toast Helper
    const showToast = (message: string, type: 'success' | 'error') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };

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

    // Filter products
    const filteredProducts = (products || []).filter(
        (product) => product.category === activeTab
    );

    // Navigation
    const handleBack = () => router.visit('/free-plan');

    // Format price
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const handleProductClick = (productId: number) => {
        // In future: navigate to details
        console.log('Product clicked:', productId);
    };

    // Handle delete
    const handleDelete = (e: React.MouseEvent, productId: number) => {
        e.stopPropagation();
        
        if (!confirm(translations.confirmDeleteProduct)) return;

        setDeletingId(productId);
        router.delete(`/admin/products/${productId}`, {
            onSuccess: () => {
                setDeletingId(null);
                showToast('ลบสินค้าเรียบร้อยแล้ว', 'success');
            },
            onError: () => {
                setDeletingId(null);
                showToast(translations.errorDeletingProduct, 'error');
            },
        });
    };

    // 5. Return TSX
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-200">
            <Head title={translations.productListTitle} />

            {/* Sticky Navbar */}
            <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <FreeNav />
            </div>

            {/* Toast Notification */}
            <div className="fixed top-24 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-lg backdrop-blur-md ${
                                toast.type === 'success' 
                                    ? 'border-green-500/20 bg-green-900/80 text-green-100' 
                                    : 'border-red-500/20 bg-red-900/80 text-red-100'
                            }`}
                        >
                            {toast.message}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Main Content */}
            <div className="mx-auto min-h-[calc(100vh-80px)] w-full max-w-6xl px-4 pb-24 pt-8 md:px-6 md:pb-8 md:pt-12">
                
                {/* Header & Controls */}
                <div className="mb-8">
                    <motion.button
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={handleBack}
                        className="mb-6 flex items-center gap-2 text-slate-400 transition-colors hover:text-white"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        <span className="font-medium">{translations.back}</span>
                    </motion.button>

                    <div className="mb-6 flex items-center justify-between">
                        <motion.h1 
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-3xl font-bold md:text-4xl lg:text-5xl"
                        >
                            <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                {translations.productList}
                            </span>
                        </motion.h1>

                        {/* Admin Add Button */}
                        {isAdmin && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => router.visit('/admin/products/create')}
                                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition-all hover:brightness-110"
                            >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                <span className="hidden sm:inline">{translations.addProduct}</span>
                            </motion.button>
                        )}
                    </div>

                    {/* Modern Tabs */}
                    <div className="flex gap-2 rounded-xl bg-slate-800/50 p-1 backdrop-blur-sm w-fit border border-white/5">
                        {['new', 'promotion'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as 'new' | 'promotion')}
                                className="relative rounded-lg px-6 py-2.5 text-sm font-semibold transition-colors focus:outline-none"
                            >
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 rounded-lg bg-slate-700 shadow-sm"
                                        transition={{ type: "spring" as const, bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className={`relative z-10 ${activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                                    {tab === 'new' ? translations.newProducts : translations.promotionProducts}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Products Grid */}
                <div
                    key={activeTab} 
                    className="min-h-[300px]"
                >
                    {filteredProducts.length === 0 ? (
                        <div 
                            className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-slate-800/40 py-20 backdrop-blur-sm"
                        >
                            <div className="mb-4 rounded-full bg-slate-800 p-4">
                                <svg className="h-10 w-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            </div>
                            <p className="text-lg font-medium text-slate-400">{translations.noProductsInCategory}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredProducts.map((product) => (
                                <div
                                    key={product.id}
                                    onClick={() => handleProductClick(product.id)}
                                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-slate-800/40 backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:bg-slate-800/60 hover:shadow-xl hover:shadow-black/20"
                                >
                                    {/* Badges Container */}
                                    <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
                                        {product.isNew && (
                                            <span className="inline-flex items-center rounded-md bg-green-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg backdrop-blur-sm">
                                                {translations.newBadge}
                                            </span>
                                        )}
                                        {product.isPromotion && (
                                            <span className="inline-flex items-center rounded-md bg-rose-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg backdrop-blur-sm">
                                                {translations.promotionBadge}
                                            </span>
                                        )}
                                    </div>

                                    {/* Discount Bubble */}
                                    {product.category === 'promotion' && product.discount && product.discount > 0 && (
                                        <div className="absolute right-3 top-3 z-20">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400/90 font-bold text-black shadow-lg backdrop-blur-sm">
                                                <div className="flex flex-col items-center leading-none">
                                                    <span className="text-xs font-bold">-{product.discount}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Admin Delete Button */}
                                    {isAdmin && (
                                        <button
                                            onClick={(e) => handleDelete(e, product.id)}
                                            disabled={deletingId === product.id}
                                            className="absolute right-3 top-16 z-20 rounded-full bg-red-600/80 p-2 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-red-600 hover:scale-110 disabled:opacity-50"
                                        >
                                            {deletingId === product.id ? (
                                                <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            ) : (
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            )}
                                        </button>
                                    )}

                                    {/* Product Image */}
                                    <div className="relative aspect-square w-full overflow-hidden bg-white/5 p-4">
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                className="h-full w-full object-contain"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center">
                                                <svg className="h-16 w-16 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex flex-1 flex-col p-5">
                                        <h3 className="mb-2 text-lg font-bold text-slate-100 transition-colors group-hover:text-green-400 line-clamp-1">
                                            {product.name}
                                        </h3>
                                        <p className="mb-4 line-clamp-2 text-sm text-slate-400 flex-1">
                                            {product.description}
                                        </p>

                                        {/* Footer: Price & Action */}
                                        <div className="mt-auto">
                                            <div className="flex items-baseline gap-2 mb-3">
                                                <span className="text-xl font-bold text-green-400">
                                                    {formatPrice(product.price)}
                                                </span>
                                                {product.category === 'promotion' && product.originalPrice && (
                                                    <span className="text-sm text-slate-500 line-through decoration-slate-500/50">
                                                        {formatPrice(product.originalPrice)}
                                                    </span>
                                                )}
                                            </div>

                                            <a
                                                href="https://shopee.co.th/kanokproduct"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-900/20 active:scale-95 group-hover:bg-orange-500"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                                {translations.viewDetails}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Navigation for Mobile */}
            <FootNav />
        </div>
    );
}

// 6. Export
export default ProductList;
