import { Head, useForm, router, usePage } from '@inertiajs/react';
import { useState, useRef, useEffect } from 'react';
import FreeNav from '../components/freeNav';
import FootNav from '../components/footNav';
import { getTranslations } from '../utils/language';

interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    category: 'new' | 'promotion' | 'recommended';
    discount?: number;
    image_url: string;
    video_url: string;
}

interface PageProps {
    product?: Product;
    [key: string]: unknown;
}

export default function CreateProduct() {
    const page = usePage<PageProps>();
    const product = page.props.product;
    const isEditMode = !!product;
    
    const [imagePreview, setImagePreview] = useState<string>(product?.image_url || '');
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [translations, setTranslations] = useState(getTranslations());
    const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
    const [discountAmount, setDiscountAmount] = useState<number>(0);

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

    // Set image preview when product is loaded
    useEffect(() => {
        if (product?.image_url) {
            setImagePreview(product.image_url);
        }
        
        // Set discount type and amount if product exists and is promotion
        if (product && product.category === 'promotion' && product.originalPrice && product.discount) {
            // Try to determine discount type from discount value
            // If discount is > 100, it's likely amount, otherwise percent
            // But we'll default to percent and let user change if needed
            setDiscountType('percent');
            if (product.originalPrice > 0) {
                const calculatedAmount = (product.originalPrice * product.discount) / 100;
                setDiscountAmount(calculatedAmount);
            }
        }
    }, [product]);
    
    // 1. เพิ่ม field ทั้งหมด รวมถึง 'image_url' แทน 'image'
    const { data, setData, processing, errors } = useForm({
        name: product?.name || '',
        description: product?.description || '',
        price: product?.price ? Number(product.price) : 0,
        originalPrice: product?.originalPrice ? Number(product.originalPrice) : 0,
        category: product?.category || ('new' as 'new' | 'promotion' | 'recommended'),
        discount: product?.discount ? Number(product.discount) : 0,
        image_url: product?.image_url || '',
        video_url: product?.video_url || '',
        discount_type: 'percent' as 'percent' | 'amount',
        discount_amount: 0,
    });

    // Calculate price when discount changes for promotion
    useEffect(() => {
        if (data.category === 'promotion' && data.originalPrice > 0) {
            let finalPrice = data.originalPrice;
            const discountValue = Number(data.discount) || 0;
            
            if (discountType === 'percent' && discountValue > 0) {
                finalPrice = data.originalPrice * (1 - discountValue / 100);
            } else if (discountType === 'amount' && discountAmount > 0) {
                finalPrice = Math.max(0, data.originalPrice - discountAmount);
            }
            
            setData('price', finalPrice);
        } else if (data.category !== 'promotion') {
            // ถ้าไม่ใช่โปรโมชัน ให้ราคาเป็นราคาปกติ (ไม่ต้องคำนวณส่วนลด)
            if (data.originalPrice > 0 && data.price !== data.originalPrice) {
                setData('price', data.originalPrice);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.category, data.originalPrice, data.discount, discountType, discountAmount]);

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

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        
        // Prepare data with discount_type and discount_amount for promotion
        const submitData = { ...data };
        if (data.category === 'promotion') {
            submitData.discount_type = discountType;
            if (discountType === 'amount') {
                submitData.discount_amount = discountAmount;
            }
        }
        
        if (isEditMode && product) {
            // Update existing product
            router.put(`/admin/products/${product.id}`, submitData, {
                onSuccess: () => {
                    router.visit('/free-plan/products');
                },
                onError: (errors) => {
                    console.error(translations.errorOccurred, errors);
                }
            });
        } else {
            // Create new product
            router.post('/admin/products', submitData, {
                onSuccess: () => {
                    router.visit('/free-plan/products');
                },
                onError: (errors) => {
                    console.error(translations.errorOccurred, errors);
                }
            });
        }
    }

    return (
        <>
            <Head title={isEditMode ? (translations.editProduct || 'แก้ไขสินค้า') : translations.createNewProduct} />
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

                    <h1 className="mb-6 text-3xl font-bold text-white">
                        {isEditMode ? (translations.editProduct || 'แก้ไขสินค้า') : translations.createNewProduct}
                    </h1>

                    {/* Notice for recommended products (sprinklers) */}
                    {data.category === 'recommended' && (
                        <div className="mb-6 rounded-lg border border-yellow-500/50 bg-yellow-900/20 p-4">
                            <div className="flex items-start gap-3">
                                <svg className="h-5 w-5 flex-shrink-0 text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-yellow-300 mb-1">
                                        หมายเหตุ: สินค้าแนะนำ (Recommended) จะแสดงข้อมูลสปริงเกอร์จากฐานข้อมูล
                                    </p>
                                    <p className="text-xs text-yellow-400/80">
                                        หากต้องการสร้างหรือแก้ไขสปริงเกอร์ กรุณาไปที่หน้า{' '}
                                        <button
                                            type="button"
                                            onClick={() => router.visit('/equipments')}
                                            className="underline hover:text-yellow-300"
                                        >
                                            จัดการอุปกรณ์
                                        </button>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

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
                                onChange={(e) => setData('category', e.target.value as 'new' | 'promotion' | 'recommended')}
                                className="w-full rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                disabled={processing}
                            >
                                <option value="new">{translations.newProducts}</option>
                                <option value="promotion">{translations.promotionProducts}</option>
                                <option value="recommended">{translations.recommendedProducts}</option>
                            </select>
                            {errors.category && (
                                <div className="mt-1 text-sm text-red-400">{errors.category}</div>
                            )}
                        </div>

                        {/* Discount Field (only show if category is promotion) */}
                        {data.category === 'promotion' && (
                            <div className="space-y-4 rounded-lg bg-slate-700/50 p-4 border border-white/5">
                                <label className="mb-2 block font-medium text-white">
                                    ตั้งค่าส่วนลด
                                </label>
                                
                                {/* Discount Type Selection */}
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="discountType"
                                            value="percent"
                                            checked={discountType === 'percent'}
                                            onChange={() => {
                                                setDiscountType('percent');
                                                setDiscountAmount(0);
                                                setData('discount', 0);
                                            }}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-slate-300">ลดเป็น %</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="discountType"
                                            value="amount"
                                            checked={discountType === 'amount'}
                                            onChange={() => {
                                                setDiscountType('amount');
                                                setDiscountAmount(0);
                                                setData('discount', 0);
                                            }}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-slate-300">ลดเป็นบาท</span>
                                    </label>
                                </div>

                                {/* Discount Value Input */}
                                {discountType === 'percent' ? (
                                    <div>
                                        <label htmlFor="discount" className="mb-1 block text-sm font-medium text-slate-300">
                                            ส่วนลด (%)
                                        </label>
                                        <input
                                            id="discount"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={data.discount}
                                            onChange={(e) => setData('discount', parseFloat(e.target.value) || 0)}
                                            className="w-full rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                            placeholder="0"
                                            disabled={processing}
                                        />
                                        {errors.discount && (
                                            <div className="mt-1 text-sm text-red-400">{errors.discount}</div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <label htmlFor="discountAmount" className="mb-1 block text-sm font-medium text-slate-300">
                                            ส่วนลด (บาท)
                                        </label>
                                        <input
                                            id="discountAmount"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={discountAmount}
                                            onChange={(e) => {
                                                const amount = parseFloat(e.target.value) || 0;
                                                setDiscountAmount(amount);
                                                // Calculate discount percentage
                                                if (data.originalPrice > 0) {
                                                    const percent = (amount / data.originalPrice) * 100;
                                                    setData('discount', percent);
                                                }
                                            }}
                                            className="w-full rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                            placeholder="0.00"
                                            disabled={processing}
                                        />
                                    </div>
                                )}

                                {/* Price Preview */}
                                {data.originalPrice > 0 && (
                                    <div className="rounded-lg bg-slate-800/50 p-3 border border-white/5">
                                        <div className="text-sm text-slate-400 mb-1">ราคาเดิม: {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(data.originalPrice)}</div>
                                        <div className="text-lg font-bold text-green-400">ราคาหลังลด: {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(data.price)}</div>
                                        {data.discount && Number(data.discount) > 0 && (
                                            <div className="text-sm text-slate-400 mt-1">ส่วนลด: {Number(data.discount).toFixed(2)}%</div>
                                        )}
                                    </div>
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

                        {/* Video Field - Only for Recommended Products */}
                        {data.category === 'recommended' && (
                            <div>
                                <label htmlFor="video_url" className="mb-1 block font-medium text-white">
                                    {translations.productVideo}
                                </label>
                                <input
                                    id="video_url"
                                    type="url"
                                    value={data.video_url}
                                    onChange={(e) => setData('video_url', e.target.value)}
                                    className="w-full rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                    placeholder={translations.videoUrlPlaceholder}
                                    disabled={processing}
                                />
                                <p className="mt-1 text-xs text-slate-400">
                                    {translations.videoUrlPlaceholder}
                                </p>
                                {errors.video_url && (
                                    <div className="mt-1 text-sm text-red-400">{errors.video_url}</div>
                                )}

                                {/* Video Preview */}
                                {data.video_url && (() => {
                                    const youtubeId = getYouTubeVideoId(data.video_url);
                                    const vimeoId = getVimeoVideoId(data.video_url);
                                    
                                    return (
                                        <div className="relative mt-3">
                                            <div className="rounded-lg border border-slate-500 bg-slate-800/50 p-4">
                                                {/* YouTube Embed */}
                                                {youtubeId ? (
                                                    <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                                                        <iframe
                                                            src={`https://www.youtube.com/embed/${youtubeId}`}
                                                            className="h-full w-full"
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                            allowFullScreen
                                                            title="Video preview"
                                                        />
                                                    </div>
                                                ) : vimeoId ? (
                                                    <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                                                        <iframe
                                                            src={`https://player.vimeo.com/video/${vimeoId}`}
                                                            className="h-full w-full"
                                                            allow="autoplay; fullscreen; picture-in-picture"
                                                            allowFullScreen
                                                            title="Video preview"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center rounded-lg bg-slate-700/50 p-8">
                                                        <div className="text-center">
                                                            <svg className="mx-auto h-12 w-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                            </svg>
                                                            <p className="mt-2 text-sm text-slate-400">
                                                                {translations.preview}
                                                            </p>
                                                            <a
                                                                href={data.video_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="mt-2 block break-all text-sm text-blue-400 hover:text-blue-300"
                                                            >
                                                                {data.video_url}
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setData('video_url', '')}
                                                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                                                title={translations.removeVideo}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

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
