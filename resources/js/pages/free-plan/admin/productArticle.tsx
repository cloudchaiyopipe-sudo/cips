import { Head, useForm, router } from '@inertiajs/react';
import { useState, useRef } from 'react';
import FreeNav from '../components/freeNav';
import FootNav from '../components/footNav';

export default function CreateProduct() {
    const [imagePreview, setImagePreview] = useState<string>('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            alert('กรุณาเลือกไฟล์รูปภาพ');
            return;
        }

        // ตรวจสอบขนาดไฟล์ (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('ขนาดไฟล์ต้องไม่เกิน 5MB');
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
                alert('ไม่สามารถอัปโหลดรูปภาพได้: ' + (result.message || 'เกิดข้อผิดพลาด'));
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
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
                console.error('เกิดข้อผิดพลาด:', errors);
            }
        });
    }

    return (
        <>
            <Head title="เพิ่มสินค้าใหม่" />
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
                        <span className="font-medium">กลับไปรายการสินค้า</span>
                    </button>

                    <h1 className="mb-6 text-3xl font-bold text-white">เพิ่มสินค้าใหม่</h1>

                    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-slate-600/30 p-6 text-white">
                        {/* Name Field */}
                        <div>
                            <label htmlFor="name" className="mb-1 block font-medium text-white">
                                ชื่อสินค้า:
                            </label>
                            <input
                                id="name"
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                className="w-full rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                placeholder="กรุณากรอกชื่อสินค้า"
                                disabled={processing}
                            />
                            {errors.name && <div className="mt-1 text-sm text-red-400">{errors.name}</div>}
                        </div>

                        {/* Description Field */}
                        <div>
                            <label htmlFor="description" className="mb-1 block font-medium text-white">
                                รายละเอียดสินค้า:
                            </label>
                            <textarea
                                id="description"
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                rows={5}
                                className="w-full resize-y rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                placeholder="กรุณากรอกรายละเอียดสินค้า"
                                disabled={processing}
                            />
                            {errors.description && (
                                <div className="mt-1 text-sm text-red-400">{errors.description}</div>
                            )}
                        </div>

                        {/* Price Field */}
                        <div>
                            <label htmlFor="price" className="mb-1 block font-medium text-white">
                                ราคา:
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
                                    ราคาเดิม (ถ้ามี):
                                </label>
                                <input
                                    id="originalPrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.originalPrice}
                                    onChange={(e) => setData('originalPrice', parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                    placeholder="0.00 (ไม่บังคับ)"
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
                                หมวดหมู่:
                            </label>
                            <select
                                id="category"
                                value={data.category}
                                onChange={(e) => setData('category', e.target.value as 'new' | 'promotion')}
                                className="w-full rounded-md border border-slate-500 bg-white p-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                                disabled={processing}
                            >
                                <option value="new">สินค้าใหม่</option>
                                <option value="promotion">สินค้าโปรโมชั่น</option>
                            </select>
                            {errors.category && (
                                <div className="mt-1 text-sm text-red-400">{errors.category}</div>
                            )}
                        </div>

                        {/* Discount Field (only show if category is promotion) */}
                        {data.category === 'promotion' && (
                            <div>
                                <label htmlFor="discount" className="mb-1 block font-medium text-white">
                                    ส่วนลด (%):
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
                                รูปภาพสินค้า:
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
                                <div className="mt-2 text-sm text-blue-400">กำลังอัปโหลดรูปภาพ...</div>
                            )}
                            {errors.image_url && <div className="mt-1 text-sm text-red-400">{errors.image_url}</div>}

                            {/* Image Preview */}
                            {(imagePreview || data.image_url) && (
                                <div className="relative mt-3">
                                    <img
                                        src={imagePreview || data.image_url}
                                        alt="Preview"
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
                                        title="ลบรูปภาพ"
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
                            {processing ? 'กำลังบันทึก...' : 'บันทึกสินค้า'}
                        </button>
                    </form>
                </div>

                {/* Bottom Navigation for Mobile */}
                <FootNav />
            </div>
        </>
    );
}
