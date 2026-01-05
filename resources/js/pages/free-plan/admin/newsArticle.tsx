import { Head, useForm, usePage, router } from '@inertiajs/react';
import { useState, useRef, useEffect } from 'react';
import FreeNav from '../components/freeNav';
import { getTranslations } from '../utils/language'; 

interface User {
    id: number;
    name: string;
    email: string;
    is_admin?: boolean;
}

interface Article {
    id: number;
    title: string;
    content: string;
    image_url: string;
}

interface PageProps {
    auth: {
        user: User | null;
    };
    article?: Article;
    [key: string]: unknown;
}

export default function CreateArticle() {
    const page = usePage<PageProps>();
    const isAdmin = page.props.auth?.user?.is_admin || false;
    const article = page.props.article;
    const isEditMode = !!article;

    const [imagePreview, setImagePreview] = useState<string>(article?.image_url || '');
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
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

    // Check if user is admin on component mount
    useEffect(() => {
        if (!isAdmin) {
            // Redirect to account page if not admin
            router.visit('/free-plan/account');
        }
    }, [isAdmin]);

    // Set image preview when article is loaded
    useEffect(() => {
        if (article?.image_url) {
            setImagePreview(article.image_url);
        }
    }, [article]);

    // 1. ใช้ useForm เพื่อจัดการ state ของฟอร์ม
    // มันจะช่วยจัดการ errors, processing state ให้อัตโนมัติ
    const { data, setData, post, put, processing, errors } = useForm({
        title: article?.title || '',
        content: article?.content || '',
        image_url: article?.image_url || '',
    });

    // ฟังก์ชันสำหรับอัปโหลดรูปภาพ
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // ตรวจสอบประเภทไฟล์
        if (!file.type.startsWith('image/')) {
            alert(translations.pleaseSelectImageFile);
            return;
        }

        // ตรวจสอบขนาดไฟล์ (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert(translations.fileSizeMustNotExceed5MB);
            return;
        }

        try {
            setUploadingImage(true);
            
            // สร้าง FormData สำหรับอัปโหลด
            const formData = new FormData();
            formData.append('image', file);

            // อัปโหลดรูปภาพ (ใช้ endpoint ที่มีอยู่)
            const response = await fetch('/api/equipments/upload-image', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                },
            });

            const result = await response.json();

            if (result.success && result.url) {
                setData('image_url', result.url);
                
                // แสดง preview
                const reader = new FileReader();
                reader.onload = (event) => {
                    setImagePreview(event.target?.result as string);
                };
                reader.readAsDataURL(file);
            } else {
                alert(translations.cannotUploadImage + ' ' + (result.message || translations.errorOccurred));
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            alert(translations.errorUploadingImage);
        } finally {
            setUploadingImage(false);
        }
    };

    // ฟังก์ชันลบรูปภาพ
    const handleRemoveImage = () => {
        setImagePreview('');
        setData('image_url', '');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // 2. ฟังก์ชันเมื่อ Submit
    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (isEditMode && article) {
            // Update existing article
            put(`/admin/articles/${article.id}`, {
                onSuccess: () => {
                    router.visit('/free-plan/news');
                },
                onError: (errors) => {
                    console.error(translations.errorOccurred, errors);
                }
            });
        } else {
            // Create new article
            post('/admin/articles', {
                onSuccess: () => {
                    // เมื่อบันทึกสำเร็จ จะ redirect ไปหน้า account ตามที่กำหนดใน controller
                    console.log(translations.articleCreatedSuccessfully);
                },
                onError: (errors) => {
                    console.error(translations.errorOccurred, errors);
                }
            });
        }
    }

    // If not admin, show access denied message
    if (!isAdmin) {
        return (
            <>
                <Head title={translations.accessDenied} />
                <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
                    <FreeNav />
                    <div className="mx-auto max-w-4xl px-4 py-4 md:px-6 md:py-6">
                        <div className="rounded-lg bg-slate-600/30 p-6 text-center text-white">
                            <h2 className="mb-4 text-2xl font-bold">{translations.accessDenied}</h2>
                            <p className="mb-4 text-slate-300">
                                {translations.youDoNotHavePermission}
                            </p>
                            <button
                                onClick={() => router.visit('/free-plan/account')}
                                className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
                            >
                                {translations.back}
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title={isEditMode ? (translations.editArticle || 'แก้ไขบทความ') : translations.createNewArticle} />
            <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
                {/* Custom Navbar */}
                <FreeNav />
                
                <div className="mx-auto max-w-4xl px-4 py-4 md:px-6 md:py-6">
                    {/* Header */}
                    <div className="mb-6 flex items-center gap-2 text-white">
                        <button 
                            onClick={() => {
                                // กลับไปหน้าก่อนหน้า
                                window.history.back();
                            }} 
                            className="flex items-center gap-2 text-slate-300 transition-colors hover:text-white"
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
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-6">
                        {isEditMode ? (translations.editArticle || 'แก้ไขบทความ') : translations.createNewArticle}
                    </h1>

                <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-slate-600/30 p-6 text-white">
                    <div>
                        <label htmlFor="title" className="block mb-1 text-white font-medium">{translations.articleTitle}</label>
                        <input
                            id="title"
                            type="text"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            className="w-full border border-slate-500 rounded-md p-2.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder={translations.pleaseEnterArticleTitle}
                            disabled={processing}
                        />
                        {/* 4. แสดง Error ถ้ามี (Inertia ส่งมาให้) */}
                        {errors.title && <div className="text-red-400 text-sm mt-1">{errors.title}</div>}
                    </div>

                    {/* อัปโหลดรูปภาพ */}
                    <div>
                        <label htmlFor="image" className="block mb-1 text-white font-medium">{translations.articleImage}</label>
                        <input
                            ref={fileInputRef}
                            id="image"
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                            className="w-full border border-slate-500 rounded-md p-2 text-white bg-slate-700/50 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600 disabled:opacity-50"
                        />
                        {uploadingImage && (
                            <div className="text-blue-400 text-sm mt-1">{translations.uploading}</div>
                        )}
                        {errors.image_url && (
                            <div className="text-red-400 text-sm mt-1">{errors.image_url}</div>
                        )}
                        
                        {/* แสดง preview รูปภาพ */}
                        {imagePreview && (
                            <div className="mt-3 relative">
                                <img
                                    src={imagePreview}
                                    alt={translations.preview}
                                    className="max-w-full h-auto rounded border"
                                    style={{ maxHeight: '300px' }}
                                />
                                <button
                                    type="button"
                                    onClick={handleRemoveImage}
                                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
                                    title={translations.removeImage}
                                >
                                    ×
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="content" className="block mb-1 text-white font-medium">{translations.articleContent}</label>
                        <textarea
                            id="content"
                            value={data.content}
                            onChange={(e) => setData('content', e.target.value)}
                            rows={10}
                            className="w-full border border-slate-500 rounded-md p-2.5 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder={translations.pleaseEnterArticleContent}
                            disabled={processing}
                        />
                        {errors.content && <div className="text-red-400 text-sm mt-1">{errors.content}</div>}
                    </div>

                    <button
                        type="submit"
                        disabled={processing}
                        className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {processing ? translations.savingArticle : translations.saveArticle}
                    </button>
                </form>
                </div>
            </div>
        </>
    );
}