// FreeNews Component - News Page
import { Head, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import FreeNav from './components/freeNav';
import FootNav from './components/footNav';
import { SharedData } from '@/types';
import { getTranslations } from './utils/language';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Article {
    id: number;
    title: string;
    content: string;
    image_url: string | null;
    category: string;
    author: string;
    published_at: string | null;
    created_at: string;
    updated_at: string;
}

interface PageProps {
    auth: {
        user: User | null;
    };
    articles?: Article[];
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
function FreeNews() {
    const page = usePage<PageProps & SharedData>();
    const { articles = [] } = page.props;
    const isAdmin = page.props.auth?.user?.is_admin || false;
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [translations, setTranslations] = useState(getTranslations());

    // Toast State
    const [toasts, setToasts] = useState<Toast[]>([]);

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

    // Handle article click
    const handleArticleClick = (articleId: number) => {
        router.visit(`/free-plan/articles/${articleId}`);
    };

    // Handle back button
    const handleBack = () => {
        router.visit('/free-plan');
    };

    // Handle delete article
    const handleDelete = (e: React.MouseEvent, articleId: number) => {
        e.stopPropagation(); 
        
        // Native confirm is still safest for destructive actions
        if (!confirm(translations.confirmDeleteArticle)) {
            return;
        }

        setDeletingId(articleId);
        router.delete(`/admin/articles/${articleId}`, {
            onSuccess: () => {
                setDeletingId(null);
                showToast('ลบบทความเรียบร้อยแล้ว', 'success');
            },
            onError: () => {
                setDeletingId(null);
                showToast(translations.errorDeletingArticle, 'error');
            },
        });
    };

    // 5. Return TSX
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-200">
            <Head title={translations.newsTitle} />

            {/* Sticky Navbar */}
            <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <FreeNav />
            </div>

            {/* Toast Notification Container */}
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
            <div className="mx-auto min-h-[calc(100vh-80px)] w-full max-w-5xl px-4 pb-24 pt-8 md:px-6 md:pb-8 md:pt-12">
                
                {/* Header Section */}
                <div className="mb-8">
                    <button
                        onClick={handleBack}
                        className="mb-6 flex items-center gap-2 text-slate-400 transition-colors hover:text-white"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="font-medium">{translations.back}</span>
                    </button>

                    <div className="mb-6 flex items-center justify-between">
                        <h1 
                            className="text-3xl font-bold md:text-4xl lg:text-5xl"
                        >
                            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                                {translations.news}
                            </span>
                        </h1>

                        {/* Admin Add Button */}
                        {isAdmin && (
                            <button
                                onClick={() => router.visit('/admin/articles/create')}
                                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-900/30 transition-all hover:brightness-110"
                            >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="hidden sm:inline">{translations.addArticle}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* News Articles Grid/List */}
                <div 
                    className="space-y-6"
                >
                    {articles.length > 0 ? (
                        articles.map((article) => {
                            const publishedDate = article.published_at
                                ? new Date(article.published_at).toLocaleDateString('th-TH', {
                                      year: 'numeric', month: 'long', day: 'numeric',
                                  })
                                : '';

                            const contentPreview = article.content 
                                ? (article.content.length > 180 
                                    ? article.content.substring(0, 180).trim() + '...' 
                                    : article.content)
                                : '';

                            return (
                                <article
                                    key={article.id}
                                    onClick={() => handleArticleClick(article.id)}
                                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/5 bg-slate-800/40 backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:bg-slate-800/60 hover:shadow-xl hover:shadow-black/20"
                                >
                                    {/* Admin Edit & Delete Buttons */}
                                    {isAdmin && (
                                        <div className="absolute right-3 top-3 z-20 flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.visit(`/admin/articles/${article.id}/edit`);
                                                }}
                                                className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/80 text-white backdrop-blur-md transition-all hover:bg-blue-600 hover:scale-110"
                                                title="แก้ไข"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(e, article.id)}
                                                disabled={deletingId === article.id}
                                                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/80 text-white backdrop-blur-md transition-all hover:bg-red-600 hover:scale-110 disabled:opacity-50"
                                                title={translations.deleteArticle}
                                            >
                                                {deletingId === article.id ? (
                                                    <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                ) : (
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex flex-col md:flex-row">
                                        {/* Image Section */}
                                        <div className="relative h-56 w-full overflow-hidden bg-slate-900/50 md:h-auto md:w-80 md:min-w-[320px]">
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60 md:hidden"></div>
                                            {article.image_url ? (
                                                <img
                                                    src={article.image_url}
                                                    alt={article.title}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center">
                                                    <svg className="h-16 w-16 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Content Section */}
                                        <div className="flex flex-1 flex-col p-6 relative">
                                            {/* Date & Category */}
                                            <div className="mb-3 flex flex-wrap items-center gap-3">
                                                <span className="inline-flex items-center rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-400">
                                                    NEWS
                                                </span>
                                                {publishedDate && (
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        <span>{publishedDate}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Title */}
                                            <h2 className="mb-3 text-xl font-bold text-white transition-colors group-hover:text-blue-400 md:text-2xl line-clamp-2">
                                                {article.title}
                                            </h2>

                                            {/* Content Preview */}
                                            {contentPreview && (
                                                <p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-400 md:text-base">
                                                    {contentPreview}
                                                </p>
                                            )}

                                            {/* Footer Actions */}
                                            <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-4">
                                                <div className="flex items-center gap-2 text-sm font-semibold text-blue-400 group-hover:text-blue-300">
                                                    <span>{translations.readMore}</span>
                                                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                                </div>
                                                
                                                {/* Optional: Add share or view count here later */}
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })
                    ) : (
                        <div 
                            className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-slate-800/40 py-16 text-center backdrop-blur-sm"
                        >
                            <div className="mb-4 rounded-full bg-slate-800 p-4">
                                <svg className="h-10 w-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                            </div>
                            <p className="text-lg font-medium text-slate-400">{translations.noNewsAvailable}</p>
                            <p className="text-sm text-slate-500">ติดตามข่าวสารใหม่ๆ ได้เร็วๆ นี้</p>
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
export default FreeNews;
