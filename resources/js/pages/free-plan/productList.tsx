// ProductList Component - Product Listing Page
import { Head, router, usePage } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import FootNav from './components/footNav';
import { useState, useEffect, useMemo } from 'react';
import { getTranslations } from './utils/language';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    image_url: string;
    video_url?: string;
    category: 'new' | 'promotion' | 'recommended';
    discount?: number;
    isNew?: boolean;
    isPromotion?: boolean;
    isRecommended?: boolean;
    equipment_id?: number;
    product_code?: string;
}

interface Equipment {
    id: number;
    name: string;
    description?: string;
    price: number;
    image?: string;
    video_link?: string;
    product_code?: string;
    brand?: string;
    category_id?: number;
    category?: {
        id: number;
        name: string;
        display_name: string;
    };
}

interface EquipmentCategory {
    id: number;
    name: string;
    display_name: string;
    description?: string;
}

interface SprinklerEquipment {
    id: number;
    name: string;
    description?: string;
    price: number;
    originalPrice?: number | null;
    image?: string;
    video_link?: string;
    product_code?: string;
    brand?: string;
    category_id?: number;
    category?: {
        id: number;
        name: string;
        display_name: string;
    };
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

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error';
}

// 2. State & Hooks Component
function ProductList() {
    const page = usePage<PageProps>();
    const { products = [] } = page.props;
    const isAdmin = page.props.auth?.user?.is_admin || false;
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [translations, setTranslations] = useState(getTranslations());
    const [activeTab, setActiveTab] = useState<'new' | 'promotion' | 'recommended'>('new');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [sprinklers, setSprinklers] = useState<SprinklerEquipment[]>([]);
    const [loadingSprinklers, setLoadingSprinklers] = useState(false);
    
    // States for all users
    const [categories, setCategories] = useState<EquipmentCategory[]>([]);
    const [selectedRecommendedCategoryId, setSelectedRecommendedCategoryId] = useState<number | null>(null);
    const [recommendedSearchQuery, setRecommendedSearchQuery] = useState('');
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    // States for admin modal
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<number[]>([]);
    
    // States for promotion discount
    const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
    const [discountValue, setDiscountValue] = useState<number>(0);
    
    // State for video modal
    const [videoModal, setVideoModal] = useState<{
        isOpen: boolean;
        videoUrl: string | null;
    }>({
        isOpen: false,
        videoUrl: null,
    });
    
    // State for shop dropdown
    const [showShopDropdown, setShowShopDropdown] = useState(false);

    // Toast Helper
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

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetch('/api/equipment-categories');
                if (response.ok) {
                    const data = await response.json();
                    setCategories(Array.isArray(data) ? data : []);
                    
                    // Set default category to sprinkler for recommended tab
                    const sprinklerCategory = data.find((cat: EquipmentCategory) => 
                        cat.name === 'sprinkler' || cat.display_name?.toLowerCase().includes('สปริงเกอร์')
                    );
                    if (sprinklerCategory) {
                        setSelectedRecommendedCategoryId(sprinklerCategory.id);
                    }
                }
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        };
        fetchCategories();
    }, []);

    // Fetch equipments for admin modal
    useEffect(() => {
        const fetchEquipments = async () => {
            if (!showAddProductModal) return;
            
            setLoading(true);
            try {
                let url = '/api/equipments';
                const params = new URLSearchParams();
                
                if (selectedCategoryId) {
                    params.append('category_id', selectedCategoryId.toString());
                }
                
                if (searchQuery) {
                    params.append('search', searchQuery);
                }
                
                if (params.toString()) {
                    url += '?' + params.toString();
                }
                
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    setEquipments(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error('Error fetching equipments:', error);
                setEquipments([]);
            } finally {
                setLoading(false);
            }
        };
        
        if (showAddProductModal) {
            fetchEquipments();
        }
    }, [showAddProductModal, selectedCategoryId, searchQuery]);

    // Fetch recommended equipments (all users)
    useEffect(() => {
        if (activeTab === 'recommended') {
            const fetchRecommendedEquipments = async () => {
                setLoadingSprinklers(true);
                try {
                    let url = '/api/equipments';
                    const params = new URLSearchParams();
                    
                    if (selectedRecommendedCategoryId) {
                        params.append('category_id', selectedRecommendedCategoryId.toString());
                    }
                    
                    if (params.toString()) {
                        url += '?' + params.toString();
                    }
                    
                    // Fetch equipments และ promotions พร้อมกัน
                    const [equipmentsResponse, promotionsResponse] = await Promise.all([
                        fetch(url),
                        fetch('/api/promotions')
                    ]);
                    
                    if (equipmentsResponse.ok) {
                        const data = await equipmentsResponse.json();
                        
                        // Fetch promotions เพื่อหา original_price
                        let promotionsData: Array<{ equipment_id: number; originalPrice: number }> = [];
                        if (promotionsResponse.ok) {
                            try {
                                const promotionsJson = await promotionsResponse.json() as { promotions?: Array<{ equipment_id: number; originalPrice: number }> };
                                promotionsData = promotionsJson.promotions || [];
                            } catch (error) {
                                console.error('Error parsing promotions:', error);
                            }
                        }
                        
                        const transformed = (Array.isArray(data) ? data : []).map((eq: Equipment) => {
                            // หา promotion สำหรับ equipment นี้
                            const promotion = promotionsData.find((p) => 
                                p.equipment_id === eq.id
                            );
                            
                            const sprinklerEquipment: SprinklerEquipment & { image_url?: string; video_url?: string; isRecommended?: boolean } = {
                                id: eq.id,
                                name: eq.name || '',
                                description: eq.description || '',
                                price: eq.price || 0, // ราคาหลังลด (จาก equipment)
                                originalPrice: promotion?.originalPrice ?? undefined, // ราคาเดิม (จาก promotion)
                                image: eq.image || '',
                                video_link: eq.video_link || '',
                                image_url: eq.image || '', // สำหรับใช้ใน rendering
                                video_url: eq.video_link || '', // สำหรับใช้ใน rendering
                                product_code: eq.product_code,
                                brand: eq.brand,
                                category_id: eq.category_id,
                                category: eq.category,
                                isRecommended: true,
                            };
                            return sprinklerEquipment;
                        });
                        setSprinklers(transformed);
                    }
                } catch (error) {
                    console.error('Error fetching recommended equipments:', error);
                    setSprinklers([]);
                } finally {
                    setLoadingSprinklers(false);
                }
            };
            fetchRecommendedEquipments();
        }
    }, [activeTab, selectedRecommendedCategoryId]);

    // Smart search function - matches even if not 100% exact
    const smartSearch = (text: string | null | undefined, query: string): boolean => {
        if (!text || !query.trim()) return true;
        
        // Remove Thai tone marks (วรรณยุกต์) to handle variations like "ปั๊ม" vs "ปั้ม"
        const removeToneMarks = (str: string) => 
            str.replace(/[\u0E48-\u0E4E]/g, ''); // Remove Thai tone marks (ไม้เอก, ไม้โท, ไม้ตรี, ไม้จัตวา, ไม้ไต่คู้, ไม้ทัณฑฆาต, ไม้วิสรรชนีย์)
        
        // Normalize: lowercase, remove extra spaces, remove special characters but keep Thai characters
        const normalize = (str: string) => {
            let normalized = str.toLowerCase()
               .replace(/[^\wก-๙\s]/g, '') // Remove special chars but keep Thai, alphanumeric, and spaces
               .replace(/\s+/g, ' ')       // Replace multiple spaces with single space
               .trim();
            
            // Remove tone marks for fuzzy matching
            normalized = removeToneMarks(normalized);
            return normalized;
        };
        
        const normalizedText = normalize(text);
        const normalizedQuery = normalize(query);
        
        // If query is empty after normalization, match everything
        if (!normalizedQuery) return true;
        
        // Method 1: Check if full query appears as substring (exact or partial match)
        if (normalizedText.includes(normalizedQuery)) return true;
        
        // Method 2: Split query into words and check if words appear (flexible matching)
        const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 0);
        
        if (queryWords.length === 0) return true;
        
        // For single word queries, check if it appears anywhere
        if (queryWords.length === 1) {
            const word = queryWords[0];
            // If word is at least 2 characters, check if it appears in text
            if (word.length >= 2 && normalizedText.includes(word)) return true;
            // For single character, check if it appears
            if (word.length === 1 && normalizedText.includes(word)) return true;
        }
        
        // For multiple words, check if at least 70% of words match (fuzzy matching)
        if (queryWords.length > 1) {
            const matchingWords = queryWords.filter(word => 
                word.length >= 2 && normalizedText.includes(word)
            ).length;
            const matchRatio = matchingWords / queryWords.length;
            
            // If most words match, consider it a match
            if (matchRatio >= 0.7) return true;
            
            // Also check if any significant word (3+ chars) matches
            const hasSignificantMatch = queryWords.some(word => 
                word.length >= 3 && normalizedText.includes(word)
            );
            if (hasSignificantMatch) return true;
        }
        
        // Method 3: For short queries (like product codes), check character sequence
        // This allows finding "ABC123" when searching "A1" or "BC"
        if (normalizedQuery.length <= 6) {
            // Remove spaces for code matching
            const codeText = normalizedText.replace(/\s/g, '');
            const codeQuery = normalizedQuery.replace(/\s/g, '');
            
            // Check if query characters appear in order in the text
            let textIndex = 0;
            let matchedChars = 0;
            
            for (let i = 0; i < codeQuery.length; i++) {
                const char = codeQuery[i];
                const foundIndex = codeText.indexOf(char, textIndex);
                if (foundIndex !== -1) {
                    matchedChars++;
                    textIndex = foundIndex + 1;
                }
            }
            
            // If at least 70% of characters match in order, consider it a match
            if (matchedChars / codeQuery.length >= 0.7) return true;
        }
        
        return false;
    };

    // Check if search query matches product_code exactly (100%)
    const isExactCodeMatch = (productCode: string | null | undefined, query: string): boolean => {
        if (!productCode || !query.trim()) return false;
        
        // Normalize both: lowercase, remove spaces, remove special chars
        const normalize = (str: string) => 
            str.toLowerCase()
               .replace(/[^\wก-๙]/g, '') // Remove special chars but keep Thai and alphanumeric
               .trim();
        
        const normalizedCode = normalize(productCode);
        const normalizedQuery = normalize(query);
        
        // Check if they match exactly
        return normalizedCode === normalizedQuery;
    };

    // Filter products - use sprinklers for recommended, products for others
    const filteredProducts = activeTab === 'recommended' 
        ? sprinklers
            .filter((sprinkler) => {
                // Filter by search query (product_code or name) - smart search
                if (recommendedSearchQuery.trim()) {
                    const matchesCode = smartSearch(sprinkler.product_code, recommendedSearchQuery);
                    const matchesName = smartSearch(sprinkler.name, recommendedSearchQuery);
                    return matchesCode || matchesName;
                }
                return true;
            })
            .sort((a, b) => {
                // If there's a search query, prioritize exact product_code matches
                if (recommendedSearchQuery.trim()) {
                    const aExactMatch = isExactCodeMatch(a.product_code, recommendedSearchQuery);
                    const bExactMatch = isExactCodeMatch(b.product_code, recommendedSearchQuery);
                    
                    // Exact matches come first
                    if (aExactMatch && !bExactMatch) return -1;
                    if (!aExactMatch && bExactMatch) return 1;
                    
                    // If both are exact matches or both are not, maintain original order
                    return 0;
                }
                return 0;
            })
        : (products || []).filter((product) => product.category === activeTab);
    
    // Pagination calculations
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
    
    // Reset to page 1 when tab changes or search query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, selectedRecommendedCategoryId, recommendedSearchQuery]);

    // Filter equipments for admin modal
    const filteredEquipments = useMemo(() => {
        return equipments.filter((eq) => {
            const matchesSearch = !searchQuery || 
                eq.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                eq.product_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                eq.brand?.toLowerCase().includes(searchQuery.toLowerCase());
            
            return matchesSearch;
        });
    }, [equipments, searchQuery]);

    // Navigation
    const handleBack = () => router.visit('/free-plan');
    
    // Handle video modal
    const openVideoModal = (videoUrl: string | null | undefined) => {
        if (videoUrl) {
            setVideoModal({
                isOpen: true,
                videoUrl: videoUrl,
            });
        }
    };
    
    const closeVideoModal = () => {
        setVideoModal({
            isOpen: false,
            videoUrl: null,
        });
    };
    
    // Convert video URL to embed format
    const convertVideoLinkToEmbed = (url: string | null | undefined): string | null => {
        if (!url) return null;
        
        // YouTube
        const youtubeRegex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
        const youtubeMatch = url.match(youtubeRegex);
        if (youtubeMatch) {
            return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
        }
        
        // Vimeo
        const vimeoRegex = /(?:vimeo\.com\/)(?:.*\/)?(\d+)/;
        const vimeoMatch = url.match(vimeoRegex);
        if (vimeoMatch) {
            return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }
        
        // If already embed format, return as is
        if (url.includes('youtube.com/embed') || url.includes('player.vimeo.com')) {
            return url;
        }
        
        // Return original URL if can't convert
        return url;
    };

    // Format price
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const handleProductClick = (productId: number) => {
        router.visit(`/free-plan/products/${productId}`);
    };

    // Handle delete
    const handleDelete = (e: React.MouseEvent, productId: number) => {
        e.stopPropagation();
        
        if (activeTab === 'recommended') {
            if (!confirm('ยืนยันการลบอุปกรณ์นี้?')) return;
            
            setDeletingId(productId);
            router.delete(`/api/equipments/${productId}`, {
                onSuccess: () => {
                    setDeletingId(null);
                    setSprinklers((prev) => prev.filter((s) => s.id !== productId));
                    showToast('ลบอุปกรณ์เรียบร้อยแล้ว', 'success');
                },
                onError: () => {
                    setDeletingId(null);
                    showToast('เกิดข้อผิดพลาดในการลบอุปกรณ์', 'error');
                },
            });
        } else {
            if (!confirm(translations.confirmDeleteProduct)) return;

            setDeletingId(productId);
            router.delete(`/admin/products/${productId}`, {
                onSuccess: () => {
                    setDeletingId(null);
                    showToast('ลบสินค้าเรียบร้อยแล้ว', 'success');
                },
                onError: () => {
                    setDeletingId(null);
                    showToast(translations.errorDeletingProduct, 'error');
                },
            });
        }
    };

    // Handle select equipment for new/promotion
    const handleSelectEquipment = (equipmentId: number) => {
        setSelectedEquipmentIds((prev) => {
            if (prev.includes(equipmentId)) {
                return prev.filter((id) => id !== equipmentId);
            } else {
                return [...prev, equipmentId];
            }
        });
    };

    // Handle open add product modal
    const handleOpenAddProductModal = () => {
        setShowAddProductModal(true);
        setSelectedEquipmentIds([]);
        setSearchQuery('');
        setSelectedCategoryId(null);
        setDiscountType('percent');
        setDiscountValue(0);
    };

    // Handle close add product modal
    const handleCloseAddProductModal = () => {
        setShowAddProductModal(false);
        setSelectedEquipmentIds([]);
        setSearchQuery('');
        setSelectedCategoryId(null);
        setDiscountType('percent');
        setDiscountValue(0);
    };

    // Handle save selected equipments as new/promotion products
    const handleSaveSelectedEquipments = async () => {
        if (selectedEquipmentIds.length === 0) {
            showToast('กรุณาเลือกรายการสินค้า', 'error');
            return;
        }

        // activeTab ควรเป็น 'new' หรือ 'promotion' เท่านั้น (ไม่ใช่ 'recommended')
        if (activeTab === 'recommended') {
            showToast('ไม่สามารถบันทึกสินค้าแนะนำได้', 'error');
            return;
        }

        try {
            const payload: {
                equipment_ids: number[];
                category: 'new' | 'promotion';
                discount_type?: 'percent' | 'amount';
                discount?: number;
                discount_amount?: number;
            } = {
                equipment_ids: selectedEquipmentIds,
                category: activeTab as 'new' | 'promotion',
            };

            if (activeTab === 'promotion') {
                payload.discount_type = discountType;
                if (discountType === 'percent') {
                    payload.discount = discountValue;
                } else {
                    payload.discount_amount = discountValue;
                }
            }

            const response = await fetch('/admin/products/create-from-equipments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.success) {
                showToast(`บันทึกสินค้า ${activeTab === 'new' ? 'ใหม่' : 'โปรโมชัน'} เรียบร้อยแล้ว`, 'success');
                handleCloseAddProductModal();
                router.reload();
            } else {
                showToast(data.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error');
            }
        } catch (error) {
            console.error('Error saving products:', error);
            showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (showShopDropdown && !target.closest('.shop-dropdown-container')) {
                setShowShopDropdown(false);
            }
        };
        
        if (showShopDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showShopDropdown]);

    // 5. Return TSX
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-200">
            <Head title={translations.productListTitle} />

            {/* Sticky Navbar */}
            <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <FreeNav />
            </div>

            {/* Toast Notification */}
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
            <div className="mx-auto min-h-[calc(100vh-80px)] w-full max-w-6xl px-4 pb-24 pt-4 md:px-6 md:pb-8 md:pt-12">
                
                {/* Header & Controls */}
                <div className="mb-6">
                    <motion.button
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={handleBack}
                        className="flex items-center gap-2 text-slate-400 transition-colors hover:text-white"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        <span className="font-medium">{translations.back}</span>
                    </motion.button>

                    <div className="mb-2 flex items-center justify-between">
                        <motion.h1 
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-3xl font-bold md:text-4xl lg:text-5xl"
                        >
                            <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                {translations.productList}
                            </span>
                        </motion.h1>

                        <div className="flex items-center gap-3">
                            {/* Shop Dropdown Button */}
                            <div className="relative shop-dropdown-container">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowShopDropdown(!showShopDropdown)}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition-all hover:brightness-110"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                    <span className="hidden sm:inline">{translations.viewDetails}</span>
                                    <svg className={`h-4 w-4 transition-transform ${showShopDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </motion.button>
                                
                                {/* Dropdown Menu */}
                                {showShopDropdown && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-800 border border-white/10 shadow-2xl z-50 overflow-hidden"
                                    >
                                        <div className="py-2">
                                            {/* Kanok Shop */}
                                            <a
                                                href="https://shop.kanokproduct.com/th"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => setShowShopDropdown(false)}
                                                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors"
                                            >
                                                <img 
                                                    src="/images/kanok-chaiyo.png" 
                                                    alt="Kanok Shop" 
                                                    className="h-8 w-8 object-contain"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                    }}
                                                />
                                                <div className="flex-1">
                                                    <div className="text-sm font-semibold text-white">Kanok Shop</div>
                                                    <div className="text-xs text-slate-400">shop.kanokproduct.com</div>
                                                </div>
                                                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                            
                                            {/* Shopee */}
                                            <a
                                                href="https://shopee.co.th/kanokproduct"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => setShowShopDropdown(false)}
                                                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors border-t border-white/5"
                                            >
                                                <img 
                                                    src="/images/shopee.png" 
                                                    alt="Kanok Shop" 
                                                    className="h-8 w-8 object-contain"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                    }}
                                                />
                                                <div className="flex-1">
                                                    <div className="text-sm font-semibold text-white">Shopee</div>
                                                    <div className="text-xs text-slate-400">shopee.co.th</div>
                                                </div>
                                                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                            
                                            {/* Lazada */}
                                            <a
                                                href="https://www.lazada.co.th/shop/kanok-product/?path=index.htm"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => setShowShopDropdown(false)}
                                                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors border-t border-white/5"
                                            >
                                                <img 
                                                    src="/images/lazada.png" 
                                                    alt="Kanok Shop" 
                                                    className="h-8 w-8 object-contain"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                    }}
                                                />
                                                <div className="flex-1">
                                                    <div className="text-sm font-semibold text-white">Lazada</div>
                                                    <div className="text-xs text-slate-400">lazada.co.th</div>
                                                </div>
                                                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Admin Button - Add Product */}
                            {isAdmin && (activeTab === 'new' || activeTab === 'promotion') && (
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleOpenAddProductModal}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green-900/30 transition-all hover:brightness-110"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    <span className="hidden sm:inline">เพิ่มสินค้า</span>
                                </motion.button>
                            )}

                            {/* Admin Button - Go to Equipment CRUD */}
                            {isAdmin && activeTab === 'recommended' && (
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => router.visit('/equipment-crud')}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-900/30 transition-all hover:brightness-110"
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    <span className="hidden sm:inline">จัดการอุปกรณ์</span>
                                </motion.button>
                            )}
                        </div>
                    </div>
                        <p className="mb-2 text-xs text-red-400">**ราคาสินค้าในเว็บ เป็นราคากลาง ซึ่งราคาอาจจะเปลี่ยนแปลงไปจากแหล่งที่ซื้อ หรือช่วงโปรโมชั่น**</p>

                    {/* Modern Tabs */}
                    <div className="flex w-full">
                        <div className="flex gap-2 rounded-xl bg-slate-800/50 p-1 backdrop-blur-sm w-full border border-white/5">
                            {['new', 'promotion', 'recommended'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => {
                                        setActiveTab(tab as 'new' | 'promotion' | 'recommended');
                                        setSelectedEquipmentIds([]);
                                        setSearchQuery('');
                                    }}
                                    className="relative flex-1 rounded-lg px-6 py-2.5 text-sm font-semibold transition-colors focus:outline-none"
                                    style={{ minWidth: 0 }}
                                >
                                    {activeTab === tab && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute inset-0 rounded-lg bg-slate-700 shadow-sm"
                                            transition={{ type: "spring" as const, bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <span className={`relative z-10 flex justify-center ${activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                                        {tab === 'new' 
                                            ? translations.newProducts 
                                            : tab === 'promotion' 
                                            ? translations.promotionProducts 
                                            : translations.recommendedProducts}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Category Filter and Search for Recommended Tab (All Users) */}
                {activeTab === 'recommended' && (
                    <div className="mb-6 space-y-4">
                        <div className="rounded-xl bg-slate-800/40 p-4 backdrop-blur-sm border border-white/5">
                            <label className="mb-2 block text-sm font-medium text-slate-300">
                                หมวดหมู่สินค้า
                            </label>
                            <select
                                value={selectedRecommendedCategoryId || ''}
                                onChange={(e) => {
                                    setSelectedRecommendedCategoryId(e.target.value ? parseInt(e.target.value) : null);
                                    setRecommendedSearchQuery(''); // Reset search when category changes
                                }}
                                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                            >
                                <option value="">ทุกหมวดหมู่</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.display_name || category.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="rounded-xl bg-slate-800/40 p-4 backdrop-blur-sm border border-white/5">
                            <label className="mb-2 block text-sm font-medium text-slate-300">
                                ค้นหาสินค้า
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={recommendedSearchQuery}
                                    onChange={(e) => setRecommendedSearchQuery(e.target.value)}
                                    placeholder="พิมพ์รหัสสินค้าหรือชื่อสินค้า..."
                                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 pl-10 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                                />
                                <svg 
                                    className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                {recommendedSearchQuery && (
                                    <button
                                        onClick={() => setRecommendedSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-600 hover:text-white transition-colors"
                                        aria-label="ล้างการค้นหา"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {recommendedSearchQuery && (
                                <p className="mt-2 text-xs text-slate-400">
                                    พบ {filteredProducts.length} รายการ
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Products Grid */}
                <div
                    key={activeTab} 
                    className="min-h-[300px]"
                >
                    {loadingSprinklers && activeTab === 'recommended' ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-slate-800/40 py-20 backdrop-blur-sm">
                            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-green-400"></div>
                            <p className="text-lg font-medium text-slate-400">กำลังโหลดอุปกรณ์...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div 
                            className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-slate-800/40 py-20 backdrop-blur-sm"
                        >
                            <div className="mb-4 rounded-full bg-slate-800 p-4">
                                <svg className="h-10 w-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            </div>
                            <p className="text-lg font-medium text-slate-400">{translations.noProductsInCategory}</p>
                        </div>
                    ) : activeTab === 'recommended' ? (
                        // E-commerce Grid Layout for Recommended Products
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {paginatedProducts.map((product) => {
                                // Calculate discount percentage if originalPrice exists
                                const discountPercent = product.originalPrice && product.originalPrice > product.price
                                    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                                    : null;
                                
                                return (
                                    <motion.div
                                        key={product.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        onClick={() => handleProductClick(product.id)}
                                        className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-white/5 bg-slate-800/60 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-blue-500/50 hover:bg-slate-800/80 hover:shadow-2xl hover:shadow-blue-900/20"
                                    >
                                        {/* Discount Badge - Top Right */}
                                        {discountPercent && discountPercent > 0 && (
                                            <div className="absolute right-3 top-3 z-20">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400/90 font-bold text-black shadow-lg backdrop-blur-sm">
                                                    <div className="flex flex-col items-center leading-none">
                                                        <span className="text-xs font-bold">
                                                            -{discountPercent}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Product Image */}
                                        <div className="relative w-full overflow-hidden bg-slate-900/50">
                                            {product.image_url ? (
                                                <img
                                                    src={product.image_url}
                                                    alt={product.name}
                                                    className="w-full h-auto max-h-[300px] object-contain"
                                                />
                                            ) : (
                                                <div className="flex aspect-[210/297] w-full items-center justify-center bg-slate-800/50">
                                                    <svg className="h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Product Info */}
                                        <div className="flex flex-1 flex-col p-4">
                                            <h3 className="mb-2 line-clamp-3 text-sm font-medium text-slate-100 transition-colors group-hover:text-blue-400">
                                                {product.product_code ? `[${product.product_code}] ` : ''}{product.name}
                                            </h3>

                                            {/* Price & Action */}
                                            <div className="mt-auto">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-lg font-bold text-green-400">
                                                        {formatPrice(product.price)}
                                                    </span>
                                                    {/* แสดงราคาเดิมถ้ามี promotion */}
                                                    {product.originalPrice && product.originalPrice > product.price && (
                                                        <span className="text-xs text-slate-500 line-through decoration-slate-500/50">
                                                            {formatPrice(product.originalPrice)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* ปุ่มดูวิดีโอ */}
                                                {(product.video_url || (product as SprinklerEquipment).video_link) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const videoUrl = product.video_url || (product as SprinklerEquipment).video_link;
                                                            openVideoModal(videoUrl);
                                                        }}
                                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:from-purple-500 hover:to-pink-500 hover:shadow-lg hover:shadow-purple-900/30 active:scale-95"
                                                    >
                                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        ดูวิดีโอ
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ) : (
                        // Original Layout for New and Promotion Products (All Users)
                        <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {paginatedProducts.map((product) => {
                                // Calculate discount percentage if originalPrice exists
                                const discountPercent = product.originalPrice && product.originalPrice > product.price
                                    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                                    : null;
                                
                                return (
                                <div
                                    key={product.id}
                                    onClick={() => handleProductClick(product.id)}
                                    className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/5 bg-slate-800/40 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-white/10 hover:bg-slate-800/60 hover:shadow-xl hover:shadow-black/20"
                                >
                                    {/* Badges Container */}
                                    <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
                                        {product.isNew && (
                                            <span className="inline-flex items-center rounded-md bg-blue-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg backdrop-blur-sm">
                                                {translations.newBadge}!!
                                            </span>
                                        )}
                                        {product.isPromotion && (
                                            <span className="inline-flex items-center rounded-md bg-green-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg backdrop-blur-sm">
                                                {translations.promotionBadge}
                                            </span>
                                        )}
                                    </div>

                                    {/* Discount Badge - Top Right */}
                                    {/* Show for promotion tab with discount field, or for new/recommended tabs if originalPrice exists */}
                                    {(() => {
                                        // Check conditions separately to avoid TypeScript type narrowing issues
                                        let shouldShow = false;
                                        let discountText = '';
                                        
                                        if (activeTab === 'promotion' && product.discount && product.discount > 0) {
                                            shouldShow = true;
                                            discountText = `-${Math.round(product.discount)}%`;
                                        }
                                        
                                        if (activeTab !== 'promotion' && (activeTab === 'new' || activeTab === 'recommended') && discountPercent && discountPercent > 0) {
                                            shouldShow = true;
                                            discountText = `-${discountPercent}%`;
                                        }
                                        
                                        if (!shouldShow) return null;
                                        
                                        return (
                                            <div className="absolute right-3 top-3 z-20">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400/90 font-bold text-black shadow-lg backdrop-blur-sm">
                                                    <div className="flex flex-col items-center leading-none">
                                                        <span className="text-xs font-bold">
                                                            {discountText}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Product Image */}
                                    <div className="relative w-full overflow-hidden bg-white/5 p-2">
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                className="w-full h-auto max-h-[300px] object-contain"
                                            />
                                        ) : (
                                            <div className="flex aspect-square w-full items-center justify-center">
                                                <svg className="h-16 w-16 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex flex-1 flex-col p-2">
                                        <h4 className="mb-2 text-sm font-medium text-slate-100 transition-colors group-hover:text-green-400">
                                            {product.product_code ? `[${product.product_code}] ` : ''}{product.name}
                                        </h4>

                                        {/* Footer: Price & Action */}
                                        <div className="mt-auto">
                                            <div className="flex items-baseline gap-2 mb-3">
                                                <span className="text-xl font-bold text-green-400">
                                                    {formatPrice(product.price)}
                                                </span>
                                                {/* แสดงราคาเดิมถ้ามี promotion (ไม่ว่าจะเป็น category ไหน) */}
                                                {product.originalPrice && product.originalPrice > product.price && (
                                                    <span className="text-sm text-slate-500 line-through decoration-slate-500/50">
                                                        {formatPrice(product.originalPrice)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Admin Edit & Delete Buttons */}
                                            {isAdmin && (
                                                <div className="flex gap-2 mb-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.visit(`/admin/products/${product.id}/edit`);
                                                        }}
                                                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600/80 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-900/20 active:scale-95"
                                                        title="แก้ไข"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                        <span className="hidden sm:inline">แก้ไข</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(e, product.id)}
                                                        disabled={deletingId === product.id}
                                                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600/80 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-red-600 hover:shadow-lg hover:shadow-red-900/20 active:scale-95 disabled:opacity-50"
                                                        title="ลบ"
                                                    >
                                                        {deletingId === product.id ? (
                                                            <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                        ) : (
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        )}
                                                        <span className="hidden sm:inline">ลบ</span>
                                                    </button>
                                                </div>
                                            )}

                                            {/* ปุ่มดูวิดีโอ */}
                                            {product.video_url && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openVideoModal(product.video_url);
                                                    }}
                                                    className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:from-purple-500 hover:to-pink-500 hover:shadow-lg hover:shadow-purple-900/20 active:scale-95"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    ดูวิดีโอ
                                                </button>
                                            )}

                                            <a
                                                href="https://shopee.co.th/kanokproduct"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-900/20 active:scale-95 group-hover:bg-orange-500"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                                {translations.viewDetails}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5 px-2 sm:gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="rounded-lg bg-slate-700 px-2 py-1.5 text-sm font-semibold text-white transition-all hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed sm:px-3 sm:py-2"
                                aria-label="หน้าก่อนหน้า"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            
                            <div className="flex items-center gap-0.5 sm:gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                    // Show first page, last page, current page, and pages around current
                                    // On mobile, show fewer pages to avoid overflow
                                    const shouldShow = 
                                        page === 1 ||
                                        page === totalPages ||
                                        (page >= currentPage - 1 && page <= currentPage + 1) ||
                                        (totalPages <= 5); // Show all if 5 or fewer pages
                                    
                                    if (shouldShow) {
                                        return (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-all sm:px-3 sm:py-2 sm:text-sm ${
                                                    currentPage === page
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        );
                                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                                        return (
                                            <span key={page} className="px-1 text-xs text-slate-400 sm:px-2 sm:text-sm">
                                                ...
                                            </span>
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                            
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="rounded-lg bg-slate-700 px-2 py-1.5 text-sm font-semibold text-white transition-all hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed sm:px-3 sm:py-2"
                                aria-label="หน้าถัดไป"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                            
                            <span className="w-full basis-full text-center text-xs text-slate-400 sm:basis-auto sm:ml-3 sm:w-auto sm:text-sm">
                                <span className="hidden sm:inline">หน้า {currentPage} จาก {totalPages} ({filteredProducts.length} รายการ)</span>
                                <span className="sm:hidden">{currentPage}/{totalPages}</span>
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Product Modal */}
            {showAddProductModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-800 border border-white/10 shadow-2xl m-4"
                    >
                        {/* Modal Header */}
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-800/95 backdrop-blur-sm px-6 py-4">
                            <h2 className="text-2xl font-bold text-white">
                                เพิ่มสินค้า{activeTab === 'new' ? 'ใหม่' : 'โปรโมชัน'}
                            </h2>
                            <button
                                onClick={handleCloseAddProductModal}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        หมวดหมู่สินค้า
                                    </label>
                                    <select
                                        value={selectedCategoryId || ''}
                                        onChange={(e) => setSelectedCategoryId(e.target.value ? parseInt(e.target.value) : null)}
                                        className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                    >
                                        <option value="">ทุกหมวดหมู่</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.display_name || category.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        ค้นหาสินค้า
                                    </label>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="ค้นหาด้วยชื่อ, รหัสสินค้า, หรือแบรนด์..."
                                        className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Promotion Discount Settings */}
                            {activeTab === 'promotion' && (
                                <div className="rounded-xl bg-slate-700/50 p-4 border border-white/5">
                                    <label className="mb-3 block text-sm font-medium text-slate-300">
                                        ตั้งค่าส่วนลด
                                    </label>
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="discountType"
                                                    value="percent"
                                                    checked={discountType === 'percent'}
                                                    onChange={() => {
                                                        setDiscountType('percent');
                                                        setDiscountValue(0);
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
                                                        setDiscountValue(0);
                                                    }}
                                                    className="w-4 h-4 text-blue-600"
                                                />
                                                <span className="text-slate-300">ลดเป็นบาท</span>
                                            </label>
                                        </div>
                                        <div>
                                            <input
                                                type="number"
                                                value={discountValue}
                                                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                                                placeholder={discountType === 'percent' ? 'กรอก % (0-100)' : 'กรอกจำนวนเงิน (บาท)'}
                                                min={0}
                                                max={discountType === 'percent' ? 100 : undefined}
                                                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Equipment List */}
                            <div className="max-h-[400px] overflow-y-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center py-20">
                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-green-400"></div>
                                    </div>
                                ) : filteredEquipments.length === 0 ? (
                                    <div className="text-center py-20 text-slate-400">
                                        ไม่พบสินค้า
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        {filteredEquipments.map((equipment) => (
                                            <div
                                                key={equipment.id}
                                                onClick={() => handleSelectEquipment(equipment.id)}
                                                className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border transition-all duration-300 ${
                                                    selectedEquipmentIds.includes(equipment.id)
                                                        ? 'border-blue-500 bg-blue-900/20'
                                                        : 'border-white/5 bg-slate-800/60 hover:border-blue-500/50 hover:bg-slate-800/80'
                                                }`}
                                            >
                                                {/* Selection Checkbox */}
                                                <div className="absolute right-2 top-2 z-20">
                                                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                                                        selectedEquipmentIds.includes(equipment.id)
                                                            ? 'border-blue-500 bg-blue-500'
                                                            : 'border-slate-400 bg-slate-700/50'
                                                    }`}>
                                                        {selectedEquipmentIds.includes(equipment.id) && (
                                                            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Equipment Image */}
                                                <div className="relative w-full overflow-hidden bg-slate-900/50">
                                                    {equipment.image ? (
                                                        <img
                                                            src={equipment.image}
                                                            alt={equipment.name}
                                                            className="w-full h-auto max-h-[150px] object-contain"
                                                        />
                                                    ) : (
                                                        <div className="flex aspect-square w-full items-center justify-center bg-slate-800/50">
                                                            <svg className="h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Equipment Info */}
                                                <div className="flex flex-1 flex-col p-3">
                                                    <h3 className="mb-1 line-clamp-2 text-sm font-bold text-slate-100">
                                                        {equipment.name}
                                                    </h3>
                                                    {equipment.product_code && (
                                                        <p className="mb-2 text-xs text-slate-400">
                                                            รหัส: {equipment.product_code}
                                                        </p>
                                                    )}
                                                    <div className="mt-auto">
                                                        <span className="text-base font-bold text-green-400">
                                                            {formatPrice(equipment.price)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 flex items-center justify-end gap-4 border-t border-white/10 bg-slate-800/95 backdrop-blur-sm px-6 py-4">
                            <button
                                onClick={handleCloseAddProductModal}
                                className="rounded-lg bg-slate-700 px-6 py-2 font-semibold text-white transition-all hover:bg-slate-600"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSaveSelectedEquipments}
                                disabled={selectedEquipmentIds.length === 0 || (activeTab === 'promotion' && discountValue <= 0)}
                                className="rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-2 font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                บันทึก ({selectedEquipmentIds.length})
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Video Modal */}
            {videoModal.isOpen && videoModal.videoUrl && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={closeVideoModal}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-4xl mx-4"
                    >
                        {/* Close Button */}
                        <button
                            onClick={closeVideoModal}
                            className="absolute -top-12 right-0 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                        >
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        
                        {/* Video Container */}
                        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                            {convertVideoLinkToEmbed(videoModal.videoUrl) ? (
                                <iframe
                                    src={convertVideoLinkToEmbed(videoModal.videoUrl) || ''}
                                    className="absolute inset-0 w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    title="Video Player"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <a
                                        href={videoModal.videoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-white hover:text-purple-400 transition-colors"
                                    >
                                        เปิดวิดีโอในแท็บใหม่
                                    </a>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Bottom Navigation for Mobile */}
            <FootNav />
        </div>
    );
}

// 6. Export
export default ProductList;
