import React, { useState, useEffect } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import FreeNav from './freeNav';
import axios from 'axios';

// Types
interface User {
    id: number;
    name: string;
    email: string;
    is_admin?: boolean;
}

interface Advertisement {
    id: number;
    user_id: number;
    title: string;
    description: string;
    image_url: string;
    link_url: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface PageProps {
    auth: {
        user: User | null;
    };
    [key: string]: unknown;
}

function Ads() {
    const page = usePage<PageProps>();
    const isAdmin = page.props.auth?.user?.is_admin || false;

    const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        link_url: '',
        image: null as File | null,
    });

    // Check if user is admin on component mount
    useEffect(() => {
        if (!isAdmin) {
            // Redirect to account page if not admin
            router.visit('/free-plan/account');
        }
    }, [isAdmin]);

    // Load advertisements only if admin
    useEffect(() => {
        if (isAdmin) {
            loadAdvertisements();
        }
    }, [isAdmin]);

    const loadAdvertisements = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/advertisements');
            setAdvertisements(response.data.advertisements || []);
        } catch (error) {
            console.error('Error loading advertisements:', error);
            // For demo purposes, show empty array if API fails
            setAdvertisements([]);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => window.history.back();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate A4 aspect ratio (210:297 = 0.707:1)
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            
            img.onload = () => {
                const aspectRatio = img.width / img.height;
                const a4Ratio = 210 / 297; // A4 aspect ratio
                const tolerance = 0.05; // 5% tolerance
                
                if (Math.abs(aspectRatio - a4Ratio) > tolerance) {
                    alert(`ภาพควรมีอัตราส่วน A4 (210:297 หรือ 0.707:1)\nอัตราส่วนปัจจุบัน: ${aspectRatio.toFixed(3)}\nอัตราส่วน A4: ${a4Ratio.toFixed(3)}\n\nกรุณาเลือกภาพที่มีอัตราส่วนใกล้เคียง A4`);
                    e.target.value = ''; // Clear the input
                    URL.revokeObjectURL(objectUrl);
                    return;
                }
                
            setFormData((prev) => ({
                ...prev,
                image: file,
            }));
                URL.revokeObjectURL(objectUrl);
            };
            
            img.onerror = () => {
                alert('ไม่สามารถโหลดภาพได้ กรุณาลองอีกครั้ง');
                e.target.value = '';
                URL.revokeObjectURL(objectUrl);
            };
            
            img.src = objectUrl;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.image) {
            alert('Please select an image');
            return;
        }

        try {
            setUploading(true);
            const formDataToSend = new FormData();
            formDataToSend.append('title', formData.title);
            formDataToSend.append('description', formData.description);
            formDataToSend.append('link_url', formData.link_url);
            formDataToSend.append('image', formData.image);

            const response = await axios.post('/api/advertisements', formDataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.success) {
                alert('Advertisement uploaded successfully!');
                setFormData({
                    title: '',
                    description: '',
                    link_url: '',
                    image: null,
                });
                setShowUploadForm(false);
                loadAdvertisements();
            } else {
                alert('Error uploading advertisement: ' + response.data.message);
            }
        } catch (error) {
            console.error('Error uploading advertisement:', error);
            alert('Error uploading advertisement. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleToggleActive = async (adId: number, isActive: boolean) => {
        try {
            const response = await axios.put(`/api/advertisements/${adId}`, {
                is_active: !isActive,
            });

            if (response.data.success) {
                loadAdvertisements();
            } else {
                alert('Error updating advertisement');
            }
        } catch (error) {
            console.error('Error updating advertisement:', error);
            alert('Error updating advertisement');
        }
    };

    const handleDelete = async (adId: number) => {
        if (!confirm('Are you sure you want to delete this advertisement?')) {
            return;
        }

        try {
            const response = await axios.delete(`/api/advertisements/${adId}`);

            if (response.data.success) {
                alert('Advertisement deleted successfully!');
                loadAdvertisements();
            } else {
                alert('Error deleting advertisement');
            }
        } catch (error) {
            console.error('Error deleting advertisement:', error);
            alert('Error deleting advertisement');
        }
    };

    // If not admin, show access denied message
    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
                <Head title="Access Denied" />
                <FreeNav />
                <div className="mx-auto max-w-4xl px-4 py-4 md:px-6 md:py-6">
                    <div className="rounded-lg bg-slate-600/30 p-6 text-center text-white">
                        <h2 className="mb-4 text-2xl font-bold">Access Denied</h2>
                        <p className="mb-4 text-slate-300">
                            คุณไม่มีสิทธิ์เข้าถึงหน้านี้
                        </p>
                        <button
                            onClick={() => router.visit('/free-plan/account')}
                            className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700"
                        >
                            กลับไปหน้าบัญชี
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title="Advertisement Management" />

            {/* Navbar */}
            <FreeNav />

            <div className="mx-auto max-w-4xl px-4 py-4 md:px-6 md:py-6">
                {/* Header */}
                <div className="mb-6 flex items-center gap-2 text-white">
                    <button onClick={handleBack} className="rounded bg-slate-700 px-2 py-1">
                        ◀
                    </button>
                    <div>
                        <div className="text-lg font-bold">Advertisement Management</div>
                        <div className="text-xs text-slate-300">
                            Upload and manage your advertisements
                        </div>
                    </div>
                </div>

                {/* Upload Button */}
                <div className="mb-6">
                    <button
                        onClick={() => setShowUploadForm(!showUploadForm)}
                        className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-700"
                    >
                        {showUploadForm ? 'Cancel Upload' : 'Upload New Advertisement'}
                    </button>
                </div>

                {/* Upload Form */}
                {showUploadForm && (
                    <div className="mb-6 rounded-lg bg-slate-600/30 p-6 text-white">
                        <h3 className="mb-4 text-lg font-semibold">Upload Advertisement</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm text-slate-300">Title</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full rounded bg-slate-800/60 px-3 py-2 text-sm"
                                    placeholder="Enter advertisement title"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm text-slate-300">
                                    Description
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    required
                                    rows={3}
                                    className="w-full rounded bg-slate-800/60 px-3 py-2 text-sm"
                                    placeholder="Enter advertisement description"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm text-slate-300">
                                    Link URL
                                </label>
                                <input
                                    type="url"
                                    name="link_url"
                                    value={formData.link_url}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full rounded bg-slate-800/60 px-3 py-2 text-sm"
                                    placeholder="https://example.com"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm text-slate-300">
                                    Advertisement Image
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    required
                                    className="w-full rounded bg-slate-800/60 px-3 py-2 text-sm"
                                />
                                <p className="mt-1 text-xs text-slate-400">
                                    รูปแบบที่รองรับ: JPG, PNG, GIF. ขนาดสูงสุด: 5MB
                                </p>
                                <p className="mt-1 text-xs text-amber-400">
                                    ⚠️ ภาพต้องมีอัตราส่วน A4 (210:297 หรือ 0.707:1) เช่น 595x842px, 1240x1754px, 2480x3508px
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {uploading ? 'Uploading...' : 'Upload Advertisement'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowUploadForm(false)}
                                    className="rounded-lg bg-slate-600 px-6 py-2 font-semibold text-white hover:bg-slate-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Advertisements List */}
                <div className="rounded-lg bg-slate-600/30 p-6 text-white">
                    <h3 className="mb-4 text-lg font-semibold">Your Advertisements</h3>

                    {loading ? (
                        <div className="text-center text-slate-300">Loading advertisements...</div>
                    ) : advertisements.length === 0 ? (
                        <div className="text-center text-slate-300">
                            <p>No advertisements uploaded yet.</p>
                            <p className="text-sm">
                                Click "Upload New Advertisement" to get started.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {advertisements.map((ad) => (
                                <div key={ad.id} className="rounded-lg bg-slate-700/50 p-4">
                                    <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-start">
                                        {/* Image - A4 Aspect Ratio Preview */}
                                        <div className="flex-shrink-0">
                                            <img
                                                src={ad.image_url}
                                                alt={ad.title}
                                                className="h-24 rounded object-contain md:h-40 lg:h-48"
                                                style={{ aspectRatio: '210/297', width: 'auto' }}
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.src = '/images/no-image.jpg';
                                                }}
                                            />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1">
                                            <h4 className="text-base font-semibold text-white md:text-lg">
                                                {ad.title}
                                            </h4>
                                            <p className="text-sm text-slate-300">
                                                {ad.description}
                                            </p>
                                            <p className="break-all text-xs text-slate-400">
                                                Link:{' '}
                                                <a
                                                    href={ad.link_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-400 hover:underline"
                                                >
                                                    {ad.link_url}
                                                </a>
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                Status:{' '}
                                                <span
                                                    className={
                                                        ad.is_active
                                                            ? 'text-green-400'
                                                            : 'text-red-400'
                                                    }
                                                >
                                                    {ad.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 md:flex-col">
                                            <button
                                                onClick={() =>
                                                    handleToggleActive(ad.id, ad.is_active)
                                                }
                                                className={`w-full rounded px-3 py-2 text-xs font-semibold md:w-auto ${
                                                    ad.is_active
                                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                                        : 'bg-green-600 text-white hover:bg-green-700'
                                                }`}
                                            >
                                                {ad.is_active ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(ad.id)}
                                                className="w-full rounded bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 md:w-auto"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Ads;
