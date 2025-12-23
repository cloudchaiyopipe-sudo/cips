// FreeArticles Component - Article Detail Page
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import FreeNav from './components/freeNav';
import FootNav from './components/footNav';
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
    article: Article;
    [key: string]: unknown;
}

interface User {
    id: number;
    name: string;
    email: string;
    is_admin?: boolean;
}

// 2. State & Hooks Component
function FreeArticles() {
    const page = usePage<PageProps>();
    const { article } = page.props;
    const isAdmin = page.props.auth?.user?.is_admin || false;
    const [deleting, setDeleting] = useState(false);

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

    const [translations] = useState(getTranslations());

    // Handle back button
    const handleBack = () => {
        router.visit('/free-plan/news');
    };

    // Handle delete
    const handleDelete = () => {
        if (!confirm(translations.confirmDeleteArticle || 'คุณต้องการลบบทความนี้หรือไม่?')) return;

        setDeleting(true);
        router.delete(`/admin/articles/${article.id}`, {
            onSuccess: () => {
                router.visit('/free-plan/news');
            },
            onError: () => {
                setDeleting(false);
                alert(translations.errorDeletingArticle || 'เกิดข้อผิดพลาดในการลบบทความ');
            },
        });
    };

    // 5. Return TSX
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title="อ่านบทความ - Free Plan" />

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
                    <span className="font-medium">กลับไปหน้าข่าวสาร</span>
                </button>

                <article className="rounded-xl bg-slate-800/80 backdrop-blur-sm p-6 md:p-8">
                    {/* Admin Edit & Delete Buttons */}
                    {isAdmin && (
                        <div className="mb-6 flex justify-end gap-3">
                            <button
                                onClick={() => router.visit(`/admin/articles/${article.id}/edit`)}
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

                    {/* Article Header */}
                    <div className="mb-6">
                        {/* Category Tag */}
                        {article.category && (
                            <div className="mb-4">
                                <span className="inline-flex items-center rounded-md bg-yellow-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-black">
                                    {article.category}
                                </span>
                            </div>
                        )}

                        {/* Title */}
                        <h1 className="mb-4 text-2xl font-bold text-white md:text-3xl lg:text-4xl">
                            {article.title}
                        </h1>

                        {/* Meta Information */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                            {article.published_at && (
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
                                    <span>{formatDate(article.published_at)}</span>
                                </div>
                            )}
                            {article.author && (
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
                                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                        />
                                    </svg>
                                    <span>{article.author}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Featured Image */}
                    {article.image_url && (
                        <div className="mb-8 overflow-hidden rounded-lg">
                            <div className="relative h-64 w-full overflow-hidden bg-slate-700/50 md:h-96">
                                <img
                                    src={article.image_url}
                                    alt={article.title}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        </div>
                    )}

                    {/* Article Content */}
                    <div className="article-content">
                        <div className="whitespace-pre-wrap break-words text-base leading-relaxed text-slate-300 md:text-lg">
                            {article.content}
                        </div>
                    </div>
                </article>
            </div>

            {/* Bottom Navigation for Mobile */}
            <FootNav />
        </div>
    );
}

// 6. Export
export default FreeArticles;

