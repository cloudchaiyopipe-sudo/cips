// FreeProductDetail Component - Product Detail Page
import { Head, router, usePage } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import FootNav from './components/footNav';
import { useState, useEffect } from 'react';
import { getTranslations } from './utils/language';
import { motion } from 'framer-motion';

// Types
interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    image_url: string | null;
    video_url?: string | null;
    category: 'new' | 'promotion' | 'recommended';
    discount?: number;
    created_at: string;
    updated_at: string;
}

interface PageProps {
    auth: {
        user: User | null;
    };
    product: Product;
    [key: string]: unknown;
}

interface User {
    id: number;
    name: string;
    email: string;
    is_admin?: boolean;
}

// Helper function to extract YouTube video ID
const getYouTubeVideoId = (url: string): string | null => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
        /youtube\.com\/.*[?&]v=([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
};

// Helper function to extract Vimeo video ID
const getVimeoVideoId = (url: string): string | null => {
    const patterns = [
        /vimeo\.com\/(\d+)/,
        /vimeo\.com\/.*\/(\d+)/,
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
};

// 2. State & Hooks Component
function FreeProductDetail() {
    const page = usePage<PageProps>();
    const { product } = page.props;
    const isAdmin = page.props.auth?.user?.is_admin || false;
    const [translations, setTranslations] = useState(getTranslations());
    const [deleting, setDeleting] = useState(false);

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

    // Format date
    const formatDate = (dateString: string | null) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Format price
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
        }).format(price);
    };

    // Handle back button
    const handleBack = () => {
        router.visit('/free-plan/products');
    };

    // Handle delete
    const handleDelete = () => {
        if (!confirm(translations.confirmDeleteProduct || 'คุณต้องการลบสินค้านี้หรือไม่?')) return;

        setDeleting(true);
        router.delete(`/admin/products/${product.id}`, {
            onSuccess: () => {
                router.visit('/free-plan/products');
            },
            onError: () => {
                setDeleting(false);
                alert(translations.errorDeletingProduct || 'เกิดข้อผิดพลาดในการลบสินค้า');
            },
        });
    };

    const youtubeId = product.video_url ? getYouTubeVideoId(product.video_url) : null;
    const vimeoId = product.video_url ? getVimeoVideoId(product.video_url) : null;
    const hasVideo = !!(youtubeId || vimeoId);

    // 5. Return TSX
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title={`${product.name} - Free Plan`} />

            {/* Custom Navbar */}
            <FreeNav />

            {/* Main Content */}
            <div className="mx-auto min-h-[calc(100vh-80px)] w-full max-w-4xl px-4 pb-24 pt-8 md:px-6 md:pb-8 md:pt-12">
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

                <article className="rounded-xl bg-slate-800/80 backdrop-blur-sm p-6 md:p-8">
                    {/* Admin Edit & Delete Buttons */}
                    {isAdmin && (
                        <div className="mb-6 flex justify-end gap-3">
                            <button
                                onClick={() => router.visit(`/admin/products/${product.id}/edit`)}
                                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                แก้ไข
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:opacity-50"
                            >
                                {deleting ? (
                                    <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                ) : (
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                )}
                                ลบ
                            </button>
                        </div>
                    )}

                    {/* Product Header */}
                    <div className="mb-6">
                        {/* Category Badge */}
                        <div className="mb-4 flex flex-wrap gap-2">
                            {product.category === 'new' && (
                                <span className="inline-flex items-center rounded-md bg-green-500/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                                    {translations.newBadge}
                                </span>
                            )}
                            {product.category === 'promotion' && (
                                <span className="inline-flex items-center rounded-md bg-rose-500/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                                    {translations.promotionBadge}
                                </span>
                            )}
                            {product.category === 'recommended' && (
                                <span className="inline-flex items-center rounded-md bg-blue-500/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                                    {translations.recommendedBadge}
                                </span>
                            )}
                            {product.category === 'promotion' && product.discount && product.discount > 0 && (
                                <span className="inline-flex items-center rounded-md bg-yellow-400/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-black">
                                    -{product.discount}%
                                </span>
                            )}
                        </div>

                        {/* Title */}
                        <h1 className="mb-4 text-2xl font-bold text-white md:text-3xl lg:text-4xl">
                            {product.name}
                        </h1>

                        {/* Price */}
                        <div className="mb-4 flex items-baseline gap-3">
                            <span className="text-3xl font-bold text-green-400 md:text-4xl">
                                {formatPrice(product.price)}
                            </span>
                            {product.category === 'promotion' && product.originalPrice && (
                                <span className="text-lg text-slate-500 line-through decoration-slate-500/50">
                                    {formatPrice(product.originalPrice)}
                                </span>
                            )}
                        </div>

                        {/* Meta Information */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                            <div className="flex items-center gap-2">
                                <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                </svg>
                                <span>{formatDate(product.created_at)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Featured Image */}
                    {product.image_url && (
                        <div className="mb-8 overflow-hidden rounded-lg">
                            <div className="relative aspect-[210/297] w-full overflow-hidden bg-slate-700/50">
                                <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="h-full w-full object-contain"
                                />
                            </div>
                        </div>
                    )}

                    {/* Video Section - Only for Recommended Products */}
                    {product.category === 'recommended' && hasVideo && (
                        <div className="mb-8">
                            <h2 className="mb-4 text-xl font-bold text-white md:text-2xl">
                                {translations.productVideo}
                            </h2>
                            
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-900/50"
                            >
                                {youtubeId ? (
                                    <iframe
                                        src={`https://www.youtube.com/embed/${youtubeId}`}
                                        className="h-full w-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title={product.name}
                                    />
                                ) : vimeoId ? (
                                    <iframe
                                        src={`https://player.vimeo.com/video/${vimeoId}`}
                                        className="h-full w-full"
                                        allow="autoplay; fullscreen; picture-in-picture"
                                        allowFullScreen
                                        title={product.name}
                                    />
                                ) : null}
                            </motion.div>
                        </div>
                    )}

                    {/* Product Description */}
                    <div className="article-content">
                        <h2 className="mb-4 text-xl font-bold text-white md:text-2xl">
                            {translations.productDescription}
                        </h2>
                        <div className="whitespace-pre-wrap break-words text-base leading-relaxed text-slate-300 md:text-lg">
                            {product.description}
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-8">
                        <a
                            href="https://shopee.co.th/kanokproduct"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4 text-lg font-bold text-white transition-all hover:from-orange-500 hover:to-orange-600 hover:shadow-lg hover:shadow-orange-900/30 active:scale-95"
                        >
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                            {translations.viewDetails}
                        </a>
                    </div>
                </article>
            </div>

            {/* Bottom Navigation for Mobile */}
            <FootNav />
        </div>
    );
}

// 6. Export
export default FreeProductDetail;

