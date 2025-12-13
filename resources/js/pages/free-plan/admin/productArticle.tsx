import { Head, useForm, router } from '@inertiajs/react';
import { useState, useRef, useEffect } from 'react';
import FreeNav from '../components/freeNav';
import FootNav from '../components/footNav';
import { getTranslations } from '../utils/language';

export default function CreateProduct() {
    const [imagePreview, setImagePreview] = useState<string>('');
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

    // 1. เพิ่ม field ทั้งหมด รวมถึง 'image_url' แทน 'image'
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        description: '',
        price: 0,
        originalPrice: 0,
        category: 'new' as 'new' | 'promotion',
        discount: 0,
        image_url: '',
    });

    // Handle image upload (เหมือนกับข่าวสาร)
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

            // อัปโหลดรูปภาพ (ใช้ endpoint เดียวกับข่าวสาร)
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

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        // 2. Inertia ฉลาดพอที่จะ POST เป็น multipart/form-data ให้เอง!
        post('/admin/products', {
            onSuccess: () => {
                // Redirect to product list after success
                router.visit('/free-plan/products');
            },
            onError: (errors) => {
                console.error(translations.errorOccurred, errors);
            }
        });
    }

    return (
        <>
            <Head title={translations.createNewProduct} />
            <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
                {/* Custom Navbar */}
                <FreeNav />

                {/* Main Content */}
                <div className="mx-auto max-w-4xl px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
                    {/* Back Button */}
                    <button
                        onClick={() => router.visit('/free-plan/products')}
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
                        <span className="font-medium">{translations.backToProductList}</span>
                    </button>

                    <h1 className="mb-6 text-3xl font-bold text-white">{translations.createNewProduct}</h1>

                    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-slate-600/30 p-6 text-white">
                        {/* Name Field */}
                        <div>
                            <label htmlFor="name" className="mb-1 block font-medium text-white">
                                {translations.productName}
                            </label>
                            <input
                                id="name"
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                className="w-full rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                placeholder={translations.pleaseEnterProductName}
                                disabled={processing}
                            />
                            {errors.name && <div className="mt-1 text-sm text-red-400">{errors.name}</div>}
                        </div>

                        {/* Description Field */}
                        <div>
                            <label htmlFor="description" className="mb-1 block font-medium text-white">
                                {translations.productDescription}
                            </label>
                            <textarea
                                id="description"
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                rows={5}
                                className="w-full resize-y rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                placeholder={translations.pleaseEnterProductDescription}
                                disabled={processing}
                            />
                            {errors.description && (
                                <div className="mt-1 text-sm text-red-400">{errors.description}</div>
                            )}
                        </div>

                        {/* Price Field */}
                        <div>
                            <label htmlFor="price" className="mb-1 block font-medium text-white">
                                {translations.price}
                            </label>
                            <input
                                id="price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={data.price}
                                onChange={(e) => setData('price', parseFloat(e.target.value) || 0)}
                                className="w-full rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                placeholder="0.00"
                                disabled={processing}
                            />
                            {errors.price && <div className="mt-1 text-sm text-red-400">{errors.price}</div>}
                        </div>

                        {/* Original Price Field - แสดงเฉพาะสินค้าโปรโมชั่น */}
                        {data.category === 'promotion' && (
                            <div>
                                <label htmlFor="originalPrice" className="mb-1 block font-medium text-white">
                                    {translations.originalPrice}
                                </label>
                                <input
                                    id="originalPrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.originalPrice}
                                    onChange={(e) => setData('originalPrice', parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                    placeholder={`0.00 (${translations.optional})`}
                                    disabled={processing}
                                />
                                {errors.originalPrice && (
                                    <div className="mt-1 text-sm text-red-400">{errors.originalPrice}</div>
                                )}
                            </div>
                        )}

                        {/* Category Field */}
                        <div>
                            <label htmlFor="category" className="mb-1 block font-medium text-white">
                                {translations.category}
                            </label>
                            <select
                                id="category"
                                value={data.category}
                                onChange={(e) => setData('category', e.target.value as 'new' | 'promotion')}
                                className="w-full rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                disabled={processing}
                            >
                                <option value="new">{translations.newProducts}</option>
                                <option value="promotion">{translations.promotionProducts}</option>
                            </select>
                            {errors.category && (
                                <div className="mt-1 text-sm text-red-400">{errors.category}</div>
                            )}
                        </div>

                        {/* Discount Field (only show if category is promotion) */}
                        {data.category === 'promotion' && (
                            <div>
                                <label htmlFor="discount" className="mb-1 block font-medium text-white">
                                    {translations.discount}
                                </label>
                                <input
                                    id="discount"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={data.discount}
                                    onChange={(e) => setData('discount', parseInt(e.target.value) || 0)}
                                    className="w-full rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                    placeholder="0"
                                    disabled={processing}
                                />
                                {errors.discount && (
                                    <div className="mt-1 text-sm text-red-400">{errors.discount}</div>
                                )}
                            </div>
                        )}

                        {/* Image Field */}
                        <div>
                            <label htmlFor="image" className="mb-1 block font-medium text-white">
                                {translations.productImage}
                            </label>
                            <input
                                ref={fileInputRef}
                                id="image"
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="w-full rounded-md border border-slate-500 bg-slate-700/50 p-2 text-white file:mr-4 file:rounded-md file:border-0 file:bg-blue-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-600 disabled:opacity-50"
                                disabled={processing || uploadingImage}
                            />
                            {uploadingImage && (
                                <div className="mt-2 text-sm text-blue-400">{translations.uploading}</div>
                            )}
                            {errors.image_url && <div className="mt-1 text-sm text-red-400">{errors.image_url}</div>}

                            {/* Image Preview */}
                            {(imagePreview || data.image_url) && (
                                <div className="relative mt-3">
                                    <img
                                        src={imagePreview || data.image_url}
                                        alt={translations.preview}
                                        className="max-h-[300px] w-auto rounded border"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setImagePreview('');
                                            setData('image_url', '');
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = '';
                                            }
                                        }}
                                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                                        title={translations.removeImage}
                                    >
                                        ×
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full rounded-lg bg-green-600 py-3 font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                        >
                            {processing ? translations.savingProduct : translations.saveProduct}
                        </button>
                    </form>
                </div>

                {/* Bottom Navigation for Mobile */}
                <FootNav />
            </div>
        </>
    );
}
