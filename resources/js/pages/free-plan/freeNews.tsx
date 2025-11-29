// FreeNews Component - News Page
import { Head, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import FreeNav from './components/freeNav';
import FootNav from './components/footNav';
import { SharedData } from '@/types';
import { getTranslations } from './utils/language';

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

// 2. State & Hooks Component
function FreeNews() {
    const page = usePage<PageProps & SharedData>();
    const { articles = [] } = page.props;
    const isAdmin = page.props.auth?.user?.is_admin || false;
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [translations, setTranslations] = useState(getTranslations());

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
        e.stopPropagation(); // ป้องกันการ trigger handleArticleClick

        if (!confirm(translations.confirmDeleteArticle)) {
            return;
        }

        setDeletingId(articleId);
        router.delete(`/admin/articles/${articleId}`, {
            onSuccess: () => {
                setDeletingId(null);
            },
            onError: () => {
                setDeletingId(null);
                alert(translations.errorDeletingArticle);
            },
        });
    };

    // 5. Return TSX
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title={translations.newsTitle} />

            {/* Custom Navbar */}
            <FreeNav />

            {/* Main Content */}
            <div className="mx-auto min-h-[calc(100vh-80px)] w-full max-w-4xl px-4 pb-24 pt-8 md:px-6 md:pb-8 md:pt-12">
                {/* Back Button */}
                <button
                    onClick={handleBack}
                    className="mb-6 flex items-center gap-2 text-slate-300 transition-colors hover:text-white"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            {translations.news}
                        </h1>
                        {/* Admin Button - แสดงเฉพาะ Admin */}
                        {isAdmin && (
                            <button
                                onClick={() => router.visit('/admin/articles/create')}
                                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
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
                                <span>{translations.addArticle}</span>
                            </button>
                        )}
                    </div>
                    {/* Gradient Separator */}
                    <div className="h-1 w-full rounded-full bg-gradient-to-r from-green-500 via-green-400 to-blue-500"></div>
                </div>

                {/* News Articles */}
                <div className="space-y-6">
                    {articles.length > 0 ? (
                        articles.map((article) => {
                            // Format date
                            const publishedDate = article.published_at
                                ? new Date(article.published_at).toLocaleDateString('th-TH', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                  })
                                : '';

                            // สร้าง preview ของเนื้อหา (ตัดให้เหลือ 150 ตัวอักษร)
                            const contentPreview = article.content
                                ? article.content.length > 150
                                    ? article.content.substring(0, 150).trim() + '...'
                                    : article.content
                                : '';

                            return (
                                <article
                                    key={article.id}
                                    onClick={() => handleArticleClick(article.id)}
                                    className="group relative cursor-pointer overflow-hidden rounded-xl bg-slate-800/80 backdrop-blur-sm transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl"
                                >
                                    {/* Delete Button - แสดงเฉพาะ Admin */}
                                    {isAdmin && (
                                        <button
                                            onClick={(e) => handleDelete(e, article.id)}
                                            disabled={deletingId === article.id}
                                            className="absolute right-2 top-2 z-10 rounded-full bg-red-600 p-2 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            title={translations.deleteArticle}
                                        >
                                            {deletingId === article.id ? (
                                                <svg
                                                    className="h-4 w-4 animate-spin"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                    />
                                                </svg>
                                            ) : (
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
                                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                    />
                                                </svg>
                                            )}
                                        </button>
                                    )}

                                    <div className="flex flex-col md:flex-row">
                                        {/* Image Section */}
                                        <div className="relative h-48 w-full overflow-hidden bg-slate-700/50 md:h-auto md:w-80 md:flex-shrink-0">
                                            {article.image_url ? (
                                                <img
                                                    src={article.image_url}
                                                    alt={article.title}
                                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center">
                                                    <svg
                                                        className="h-16 w-16 text-slate-500"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                        />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Content Section */}
                                        <div className="flex flex-1 flex-col p-6">
                                            {/* Header with Tag and Date */}
                                            <div className="mb-3 flex flex-wrap items-center gap-3">
                                                <span className="inline-flex items-center rounded-md bg-yellow-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                                                    NEWS
                                                </span>
                                                {publishedDate && (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <svg
                                                            className="h-3.5 w-3.5"
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
                                                        <span>{publishedDate}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Title */}
                                            <h2 className="mb-3 text-xl font-bold text-white transition-colors group-hover:text-blue-400 md:text-2xl">
                                                {article.title}
                                            </h2>

                                            {/* Content Preview */}
                                            {contentPreview && (
                                                <p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-300 md:text-base">
                                                    {contentPreview}
                                                </p>
                                            )}

                                            {/* Read More Indicator */}
                                            <div className="mt-auto flex items-center gap-2 text-sm font-medium text-blue-400">
                                                <span>{translations.readMore}</span>
                                                <svg
                                                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M9 5l7 7-7 7"
                                                    />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })
                    ) : (
                        <div className="rounded-xl bg-slate-800/80 p-8 text-center">
                            <p className="text-slate-400">{translations.noNewsAvailable}</p>
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
