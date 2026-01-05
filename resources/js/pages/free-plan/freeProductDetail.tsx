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
    created_at?: string;
    updated_at?: string;
    product_code?: string;
    brand?: string;
    waterVolumeLitersPerMinute?: number | [number, number];
    radiusMeters?: number | [number, number];
    pressureBar?: number | [number, number];
    attributes_raw?: Record<string, unknown>;
    stock?: number;
}

interface Attribute {
    attribute_name: string;
    display_name: string;
    value: unknown;
    formatted_value: string;
    unit?: string;
    data_type: string;
    sort_order: number;
}


interface PageProps {
    auth: {
        user: User | null;
    };
    product?: Product;
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

// Utility function to convert video link to embed format
const convertVideoLinkToEmbed = (url: string | null | undefined): string | null => {
    if (!url || !url.trim()) {
        return null;
    }

    const trimmedUrl = url.trim();

    // YouTube: https://youtu.be/VIDEO_ID or https://www.youtube.com/watch?v=VIDEO_ID
    const youtubeShortRegex = /(?:youtu\.be\/)([a-zA-Z0-9_-]+)/;
    const youtubeWatchRegex = /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/;
    
    const youtubeShortMatch = trimmedUrl.match(youtubeShortRegex);
    const youtubeWatchMatch = trimmedUrl.match(youtubeWatchRegex);
    
    if (youtubeShortMatch) {
        return `https://www.youtube.com/embed/${youtubeShortMatch[1]}`;
    }
    
    if (youtubeWatchMatch) {
        return `https://www.youtube.com/embed/${youtubeWatchMatch[1]}`;
    }

    // Google Drive: https://drive.google.com/file/d/FILE_ID/view...
    const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const driveMatch = trimmedUrl.match(driveRegex);
    
    if (driveMatch) {
        return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }

    // If already an embed URL, return as is
    if (trimmedUrl.includes('/embed/') || trimmedUrl.includes('/preview')) {
        return trimmedUrl;
    }

    return null;
};

// 2. State & Hooks Component
function FreeProductDetail() {
    const page = usePage<PageProps>();
    const { product: initialProduct } = page.props;
    const isAdmin = page.props.auth?.user?.is_admin || false;
    const [translations, setTranslations] = useState(getTranslations());
    const [deleting, setDeleting] = useState(false);
    const [product, setProduct] = useState<Product | null>(initialProduct || null);
    const [loading, setLoading] = useState(!initialProduct);
    const [isEquipment, setIsEquipment] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [modalImage, setModalImage] = useState({ src: '', alt: '' });

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

    // Initialize product data from props
    useEffect(() => {
        if (initialProduct) {
            // Normalize product data - handle both 'image' and 'image_url' fields
            const productWithImage = initialProduct as Product & { image?: string };
            const normalizedProduct: Product = {
                ...initialProduct,
                // Use image_url if available, otherwise try image (for equipment)
                image_url: initialProduct.image_url || productWithImage.image || null,
                // Ensure description is present
                description: initialProduct.description || '',
            };
            
            // Check if it's equipment (has equipment-specific fields)
            const hasEquipmentFields = 
                normalizedProduct.product_code !== undefined ||
                normalizedProduct.brand !== undefined ||
                normalizedProduct.waterVolumeLitersPerMinute !== undefined ||
                normalizedProduct.radiusMeters !== undefined ||
                normalizedProduct.pressureBar !== undefined;
            
            setProduct(normalizedProduct);
            setIsEquipment(hasEquipmentFields && normalizedProduct.category === 'recommended');
            setLoading(false);
        } else {
            // No product provided - this shouldn't happen with proper backend setup
            setLoading(false);
        }
    }, [initialProduct]);

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
        if (!product) return;
        if (!confirm(translations.confirmDeleteProduct || 'คุณต้องการลบสินค้านี้หรือไม่?')) return;

        setDeleting(true);
        if (isEquipment) {
            // Delete equipment via API
            fetch(`/api/equipments/${product.id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                    'Content-Type': 'application/json',
                },
            })
                .then((response) => {
                    if (response.ok) {
                        router.visit('/free-plan/products');
                    } else {
                        setDeleting(false);
                        alert('เกิดข้อผิดพลาดในการลบสปริงเกอร์');
                    }
                })
                .catch(() => {
                    setDeleting(false);
                    alert('เกิดข้อผิดพลาดในการลบสปริงเกอร์');
                });
        } else {
            router.delete(`/admin/products/${product.id}`, {
                onSuccess: () => {
                    router.visit('/free-plan/products');
                },
                onError: () => {
                    setDeleting(false);
                    alert(translations.errorDeletingProduct || 'เกิดข้อผิดพลาดในการลบสินค้า');
                },
            });
        }
    };

    // Format attribute value for display
    const formatAttributeValue = (value: unknown): string => {
        if (value === null || value === undefined || value === '') {
            return '-';
        }

        if (Array.isArray(value)) {
            if (value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
                return `${value[0].toLocaleString()} - ${value[1].toLocaleString()}`;
            }
            return value.join(', ');
        }

        if (typeof value === 'number') {
            return value.toLocaleString();
        }

        if (typeof value === 'boolean') {
            return value ? 'ใช่' : 'ไม่ใช่';
        }

        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }

        return String(value);
    };

    // Get Thai display name for attribute
    const getThaiDisplayName = (attributeName: string): string => {
        const thaiDisplayMap: { [key: string]: string } = {
            flow_rate: 'อัตราการไหล',
            pressure: 'ความดัน',
            radius: 'รัศมีการพ่น',
            waterVolumeLitersPerMinute: 'อัตราการไหล',
            pressureBar: 'ความดัน',
            radiusMeters: 'รัศมีการพ่น',
            power_hp: 'กำลัง',
            powerHP: 'กำลัง',
            powerKW: 'กำลัง',
            phase: 'เฟส',
            inlet_size_inch: 'ขนาดท่อดูด',
            outlet_size_inch: 'ขนาดท่อส่ง',
            flow_rate_lpm: 'อัตราการไหล',
            head_m: 'หัวดัน',
            max_head_m: 'หัวดันสูงสุด',
            max_flow_rate_lpm: 'อัตราการไหลสูงสุด',
            suction_depth_m: 'ความลึกดูด',
            weight_kg: 'น้ำหนัก',
            size_mm: 'ขนาด',
            size_inch: 'ขนาด',
            sizeMM: 'ขนาด',
            sizeInch: 'ขนาด',
            lengthM: 'ความยาว',
            dimensions_cm: 'ขนาด',
            material: 'วัสดุ',
            voltage: 'แรงดันไฟฟ้า',
            current: 'กระแสไฟฟ้า',
            frequency: 'ความถี่',
            brand: 'แบรนด์',
            model: 'รุ่น',
            color: 'สี',
            weight: 'น้ำหนัก',
            height: 'ความสูง',
            width: 'ความกว้าง',
            length: 'ความยาว',
            diameter: 'เส้นผ่านศูนย์กลาง',
            thickness: 'ความหนา',
            capacity: 'ความจุ',
            efficiency: 'ประสิทธิภาพ',
            temperature_range: 'ช่วงอุณหภูมิ',
            operating_pressure: 'ความดันใช้งาน',
            max_pressure: 'ความดันสูงสุด',
            connection_type: 'ประเภทการต่อ',
            thread_size: 'ขนาดเกลียว',
        };

        if (thaiDisplayMap[attributeName]) {
            return thaiDisplayMap[attributeName];
        }

        const readable = attributeName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str) => str.toUpperCase())
            .trim();

        return readable || attributeName;
    };

    // Get unit for attribute
    const getUnitForAttribute = (attributeName: string): string => {
        const unitMap: { [key: string]: string } = {
            powerHP: 'HP',
            powerKW: 'kW',
            phase: 'เฟส',
            inlet_size_inch: 'นิ้ว',
            outlet_size_inch: 'นิ้ว',
            flow_rate_lpm: 'LPM',
            head_m: 'เมตร',
            max_head_m: 'เมตร',
            max_flow_rate_lpm: 'LPM',
            suction_depth_m: 'เมตร',
            weight_kg: 'กก.',
            waterVolumeLitersPerMinute: 'L/min',
            radiusMeters: 'เมตร',
            pressureBar: 'บาร์',
            size_mm: 'มม.',
            size_inch: 'นิ้ว',
            sizeMM: 'มม.',
            sizeInch: 'นิ้ว',
            lengthM: 'เมตร',
            dimensions_cm: 'ซม.',
        };
        return unitMap[attributeName] || '';
    };

    // Get all attributes for equipment
    const getAllAttributes = (): Attribute[] => {
        if (!isEquipment || !product) return [];

        const attributes: Attribute[] = [];

        // Try attributes_raw first
        if (product.attributes_raw && typeof product.attributes_raw === 'object') {
            Object.entries(product.attributes_raw).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    attributes.push({
                        attribute_name: key,
                        display_name: getThaiDisplayName(key),
                        value: value,
                        formatted_value: formatAttributeValue(value),
                        unit: getUnitForAttribute(key),
                        data_type: Array.isArray(value) ? 'array' : typeof value,
                        sort_order: 0,
                    });
                }
            });
        } else {
            // Extract from product object (skip basic fields)
            const skipFields = [
                'id',
                'category_id',
                'categoryId',
                'product_code',
                'productCode',
                'name',
                'brand',
                'image',
                'image_url',
                'video_link',
                'video_url',
                'price',
                'stock',
                'description',
                'is_active',
                'category',
                'attributes',
                'formatted_attributes',
                'attributes_raw',
                'pumpAccessories',
                'pumpAccessory',
                'created_at',
                'updated_at',
                'waterVolumeLitersPerMinute',
                'radiusMeters',
                'pressureBar',
            ];

            Object.entries(product).forEach(([key, value]) => {
                if (!skipFields.includes(key) && value !== null && value !== undefined && value !== '') {
                    attributes.push({
                        attribute_name: key,
                        display_name: getThaiDisplayName(key),
                        value: value,
                        formatted_value: formatAttributeValue(value),
                        unit: getUnitForAttribute(key),
                        data_type: Array.isArray(value) ? 'array' : typeof value,
                        sort_order: 0,
                    });
                }
            });
        }

        return attributes;
    };

    // Handle image modal
    const openImageModal = (imageSrc: string, imageAlt: string) => {
        setModalImage({ src: imageSrc, alt: imageAlt });
        setShowImageModal(true);
    };

    const closeImageModal = () => {
        setShowImageModal(false);
        setModalImage({ src: '', alt: '' });
    };

    if (loading || !product) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
                <FreeNav />
                <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
                    <div className="text-center">
                        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-600 border-t-green-400 mx-auto"></div>
                        <p className="text-slate-300">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
                <FootNav />
            </div>
        );
    }

    const productWithVideoLink = product as Product & { video_link?: string };
    const videoUrl = product.video_url || (isEquipment && productWithVideoLink.video_link);
    const youtubeId = videoUrl ? getYouTubeVideoId(videoUrl) : null;
    const vimeoId = videoUrl ? getVimeoVideoId(videoUrl) : null;
    const embedUrl = videoUrl ? convertVideoLinkToEmbed(videoUrl) : null;
    const hasVideo = !!(youtubeId || vimeoId || embedUrl);

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
                                onClick={() => {
                                    if (isEquipment) {
                                        router.visit(`/equipments/${product.id}/edit`);
                                    } else {
                                        router.visit(`/admin/products/${product.id}/edit`);
                                    }
                                }}
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
                            {product.product_code && (
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">รหัสสินค้า:</span>
                                    <span>{product.product_code}</span>
                                </div>
                            )}
                            {product.brand && (
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">แบรนด์:</span>
                                    <span>{product.brand}</span>
                                </div>
                            )}
                            {product.created_at && (
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
                            )}
                        </div>
                    </div>

                    {/* Featured Image */}
                    <div className="mb-8 overflow-hidden rounded-lg">
                        <div className="relative flex items-center justify-center w-full overflow-hidden bg-slate-700/50 rounded-lg min-h-[300px]">
                            {product.image_url ? (
                                <>
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="h-auto max-h-[500px] w-full cursor-pointer object-contain transition-transform hover:scale-105"
                                        style={{ maxHeight: 500, minHeight: 300 }}
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            const fallback = target.nextElementSibling as HTMLElement;
                                            if (fallback) {
                                                fallback.style.display = 'flex';
                                            }
                                        }}
                                        onClick={() => openImageModal(product.image_url!, product.name)}
                                        title="คลิกเพื่อดูรูปขนาดใหญ่"
                                    />
                                    <button
                                        onClick={() => openImageModal(product.image_url!, product.name)}
                                        className="absolute bottom-4 right-4 rounded-full bg-blue-600 px-4 py-2 text-sm text-white shadow-lg transition-colors hover:bg-blue-700 flex items-center gap-2"
                                        title="ดูรูปขนาดใหญ่"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                        ขยาย
                                    </button>
                                </>
                            ) : null}
                            {/* Fallback when image fails or doesn't exist */}
                            <div
                                className="flex h-[300px] w-full items-center justify-center text-gray-400"
                                style={{ display: product.image_url ? 'none' : 'flex' }}
                            >
                                <div className="text-center">
                                    <svg
                                        className="mx-auto h-16 w-16 text-gray-500"
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
                                    <p className="mt-2 text-sm">ไม่มีรูปภาพ</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Video Section - Only for Recommended Products */}
                    {product.category === 'recommended' && hasVideo && (
                        <div className="mb-8">
                            <h2 className="mb-4 text-xl font-bold text-white md:text-2xl">
                                🎥 {translations.productVideo || 'วิดีโอสินค้า'}
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
                                ) : embedUrl ? (
                                    <iframe
                                        src={embedUrl}
                                        className="h-full w-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title={product.name}
                                    />
                                ) : null}
                            </motion.div>
                        </div>
                    )}

                    {/* Basic Information Summary - For Sprinklers */}
                    {isEquipment && (
                        <div className="mb-8 rounded-lg bg-slate-700/50 p-6">
                            <h2 className="mb-4 text-xl font-bold text-white md:text-2xl">
                                ข้อมูลพื้นฐาน
                            </h2>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                {product.product_code && (
                                    <div>
                                        <label className="text-sm text-slate-400">รหัสสินค้า</label>
                                        <p className="font-medium text-white">{product.product_code}</p>
                                    </div>
                                )}
                                <div className="md:col-span-2">
                                    <label className="text-sm text-slate-400">ชื่อสินค้า</label>
                                    <p className="font-medium text-white">{product.name}</p>
                                </div>
                                {product.brand && (
                                    <div>
                                        <label className="text-sm text-slate-400">แบรนด์</label>
                                        <p className="font-medium text-white">{product.brand}</p>
                                    </div>
                                )}
                                <div className="md:col-span-2">
                                    <label className="text-sm text-slate-400">ราคา</label>
                                    <p className="font-medium text-green-400">
                                        {formatPrice(product.price)} บาท
                                    </p>
                                </div>
                                {product.stock !== undefined && product.stock !== null && (
                                    <div>
                                        <label className="text-sm text-slate-400">Stock</label>
                                        <p className="font-medium text-blue-400">
                                            {product.stock.toLocaleString()} ชิ้น
                                        </p>
                                    </div>
                                )}
                                {product.created_at && (
                                    <div>
                                        <label className="text-sm text-slate-400">วันที่เพิ่ม</label>
                                        <p className="font-medium text-white">{formatDate(product.created_at)}</p>
                                    </div>
                                )}
                                {product.updated_at && (
                                    <div>
                                        <label className="text-sm text-slate-400">แก้ไขล่าสุด</label>
                                        <p className="font-medium text-white">{formatDate(product.updated_at)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Specific Attributes - For Sprinklers */}
                    {isEquipment && (() => {
                        const attributes = getAllAttributes();
                        return attributes.length > 0 ? (
                            <div className="mb-8 rounded-lg bg-slate-700/50 p-6">
                                <h2 className="mb-4 text-xl font-bold text-white md:text-2xl">
                                    คุณสมบัติเฉพาะ ({attributes.length} รายการ)
                                </h2>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {attributes.map((attr, index) => {
                                        // Skip if value is 0 or empty
                                        if (attr.formatted_value === '0' || attr.formatted_value === '-' || attr.formatted_value === '') {
                                            return null;
                                        }
                                        return (
                                            <div key={attr.attribute_name || index} className="rounded-lg bg-slate-600/50 p-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <label className="text-sm font-medium text-slate-300">
                                                            {attr.display_name}
                                                        </label>
                                                    </div>
                                                    <p className="ml-2 font-medium text-white">
                                                        {attr.formatted_value}
                                                        {attr.unit && (
                                                            <span className="ml-1 text-slate-200"> {attr.unit}</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null;
                    })()}

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

            {/* Image Modal */}
            {showImageModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
                    onClick={closeImageModal}
                >
                    <div
                        className="relative max-h-[90vh] max-w-[90vw] p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={closeImageModal}
                            className="absolute -right-2 -top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
                            title="ปิด"
                        >
                            ✕
                        </button>
                        <img
                            src={modalImage.src}
                            alt={modalImage.alt}
                            className="max-h-full max-w-full rounded-lg shadow-2xl"
                        />
                        <div className="mt-2 text-center">
                            <p className="inline-block rounded bg-black bg-opacity-50 px-3 py-1 text-sm text-white">
                                {modalImage.alt}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 6. Export
export default FreeProductDetail;

