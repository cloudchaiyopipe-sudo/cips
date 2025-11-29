// ProductList Component - Product Listing Page
import { Head, router, usePage } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import FootNav from './components/footNav';
import { useState, useEffect } from 'react';
import { getTranslations } from './utils/language';

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

// 2. State & Hooks Component
function ProductList() {
    const page = usePage<PageProps>();
    const { products = [] } = page.props;
    const isAdmin = page.props.auth?.user?.is_admin || false;
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [translations, setTranslations] = useState(getTranslations());

    // Active tab state
    const [activeTab, setActiveTab] = useState<'new' | 'promotion'>('new');

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

    // Filter products based on active tab
    const filteredProducts = (products || []).filter(
        (product) => product.category === activeTab
    );

    // Handle back button
    const handleBack = () => {
        router.visit('/free-plan');
    };

    // Format price
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
        }).format(price);
    };

    // Handle product click
    const handleProductClick = (productId: number) => {
        // ในอนาคตสามารถ navigate ไปหน้าสินค้ารายละเอียดได้
        console.log('Product clicked:', productId);
    };

    // Handle delete product
    const handleDelete = (e: React.MouseEvent, productId: number) => {
        e.stopPropagation(); // ป้องกันการ trigger handleProductClick
        
        if (!confirm(translations.confirmDeleteProduct)) {
            return;
        }

        setDeletingId(productId);
        router.delete(`/admin/products/${productId}`, {
            onSuccess: () => {
                setDeletingId(null);
            },
            onError: () => {
                setDeletingId(null);
                alert(translations.errorDeletingProduct);
            },
        });
    };

    // 5. Return TSX
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title={translations.productListTitle} />

            {/* Custom Navbar */}
            <FreeNav />

            {/* Main Content */}
            <div className="mx-auto min-h-[calc(100vh-80px)] w-full max-w-6xl px-4 pb-24 pt-8 md:px-6 md:pb-8 md:pt-12">
                {/* Back Button */}
                <button
                    onClick={handleBack}
                    className="mb-6 flex items-center gap-2 text-slate-300 transition-colors hover:text-white"
                >
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 19l-7-7m0 0l7-7m-7 7h18"
                        />
                    </svg>
                    <span className="font-medium">{translations.back}</span>
                </button>

                {/* Page Title */}
                <div className="mb-8">
                    <div className="mb-3 flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-white md:text-4xl lg:text-5xl">
                            {translations.productList}
                        </h1>
                        {/* Admin Button - แสดงเฉพาะ Admin */}
                        {isAdmin && (
                            <button
                                onClick={() => router.visit('/admin/products/create')}
                                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                            >
                                <svg
                                    className="h-5 w-5"
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
                                <span>{translations.addProduct}</span>
                            </button>
                        )}
                    </div>
                    {/* Gradient Separator */}
                    <div className="h-1 w-full bg-gradient-to-r from-green-500 via-green-400 to-blue-500 rounded-full"></div>
                </div>

                {/* Tab Navigation */}
                <div className="mb-8 flex gap-4 border-b border-slate-600">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`px-6 py-3 font-semibold transition-colors ${
                            activeTab === 'new'
                                ? 'border-b-2 border-green-500 text-green-400'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        {translations.newProducts}
                    </button>
                    <button
                        onClick={() => setActiveTab('promotion')}
                        className={`px-6 py-3 font-semibold transition-colors ${
                            activeTab === 'promotion'
                                ? 'border-b-2 border-green-500 text-green-400'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        {translations.promotionProducts}
                    </button>
                </div>

                {/* Products Grid */}
                {filteredProducts.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <p className="text-slate-300">{translations.noProductsInCategory}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredProducts.map((product) => (
                            <div
                                key={product.id}
                                onClick={() => handleProductClick(product.id)}
                                className="group relative cursor-pointer overflow-hidden rounded-xl bg-slate-800/80 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                            >
                                {/* Delete Button - แสดงเฉพาะ Admin */}
                                {isAdmin && (
                                    <button
                                        onClick={(e) => handleDelete(e, product.id)}
                                        disabled={deletingId === product.id}
                                        className={`absolute top-2 z-30 rounded-full bg-red-600 p-2 text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed ${
                                            product.category === 'promotion' && product.discount && product.discount > 0
                                                ? 'right-20'
                                                : 'right-2'
                                        }`}
                                        title={translations.deleteProduct}
                                    >
                                        {deletingId === product.id ? (
                                            <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        ) : (
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        )}
                                    </button>
                                )}

                                {/* Badge */}
                                {product.isNew && (
                                    <div className="absolute left-4 top-4 z-20">
                                        <span className="inline-flex items-center rounded-md bg-green-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
                                            {translations.newBadge}
                                        </span>
                                    </div>
                                )}
                                {product.isPromotion && (
                                    <div className="absolute left-4 top-4 z-20">
                                        <span className="inline-flex items-center rounded-md bg-red-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
                                            {translations.promotionBadge}
                                        </span>
                                    </div>
                                )}

                                {/* Discount Badge - แสดงเฉพาะสินค้าโปรโมชั่น */}
                                {product.category === 'promotion' && product.discount && product.discount > 0 && (
                                    <div className="absolute right-4 top-2 z-20">
                                        <span className="inline-flex items-center rounded-full bg-yellow-400 px-3 py-2 text-base font-bold text-black shadow-lg">
                                            -{product.discount}%
                                        </span>
                                    </div>
                                )}

                                {/* Product Image */}
                                <div className="relative h-48 w-full overflow-hidden bg-slate-700/50">
                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <svg
                                                className="h-20 w-20 text-slate-500"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>
                                </div>

                                {/* Product Info */}
                                <div className="p-6">
                                    <h3 className="mb-2 text-lg font-bold text-white transition-colors group-hover:text-green-400">
                                        {product.name}
                                    </h3>
                                    <p className="mb-4 line-clamp-2 text-sm text-slate-400">
                                        {product.description}
                                    </p>

                                    {/* Price */}
                                    <div className="flex items-center gap-2">
                                        {/* แสดงราคาเดิมและส่วนลดเฉพาะสินค้าโปรโมชั่น */}
                                        {product.category === 'promotion' && product.originalPrice && (
                                            <span className="text-sm text-slate-500 line-through">
                                                {formatPrice(product.originalPrice)}
                                            </span>
                                        )}
                                        <span className="text-xl font-bold text-green-400">
                                            {formatPrice(product.price)}
                                        </span>
                                    </div>

                                    {/* View Details Button */}
                                    <a
                                        href="https://shopee.co.th/kanokproduct"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-4 block w-full rounded-lg bg-green-600 px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-green-700"
                                    >
                                        {translations.viewDetails}
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Navigation for Mobile */}
            <FootNav />
        </div>
    );
}

// 6. Export
export default ProductList;

