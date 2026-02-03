// FreeArticles Component - Article Detail Page
import { Head, router, usePage } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import FootNav from './components/footNav';

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

    // Handle back button
    const handleBack = () => {
        router.visit('/free-plan/news');
    };

    // 5. Return TSX
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title="อ่านบทความ" />

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
                    <span className="font-medium">กลับไปหน้าข่าวสาร</span>
                </button>

                <article className="rounded-xl bg-slate-800/80 backdrop-blur-sm p-6 md:p-8">
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
