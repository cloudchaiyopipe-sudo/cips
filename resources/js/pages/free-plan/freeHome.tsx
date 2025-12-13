// 1. Import
import { Head, router, usePage } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import FreeFooter from './components/freeFooter';
import FootNav from './components/footNav';
import Manual from './components/manual';
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { getTranslations } from './utils/language';
import { motion, AnimatePresence } from 'framer-motion'; // เพิ่ม Framer Motion

// Types
interface Advertisement {
    id: number;
    title: string;
    description: string;
    image_url: string;
    link_url: string;
    is_active: boolean;
}

interface PageProps {
    auth: {
        user: User | null;
    };
    [key: string]: unknown;
}

interface User {
    id: number;
    name: string;
    email: string;
}

// Toast Type
interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

// 2. Component
function FreeHome() {
    usePage<PageProps>();

    // State for advertisements
    const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
    const [currentAdIndex, setCurrentAdIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showAdModal, setShowAdModal] = useState(false);

    // State for manual/tutorial
    const [showManualModal, setShowManualModal] = useState(false);

    // Ref
    const adShownRef = useRef(false);
    const manualWasShownRef = useRef(false);

    // State for language
    const [translations, setTranslations] = useState(getTranslations());

    // State for saved projects
    const [savedProjects, setSavedProjects] = useState<
        Array<{
            id: number;
            projectName: string;
            savedAt: string;
        }>
    >([]);

    // State for edit project name
    const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
    const [editProjectName, setEditProjectName] = useState<string>('');

    // State for Toasts (แทน Alert)
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Toast Handler
    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    // 3. Hooks
    const loadAdvertisements = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/advertisements/public');
            setAdvertisements(response.data.advertisements || []);
        } catch (error) {
            console.error('Error loading advertisements:', error);
            setAdvertisements([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSavedProjects = useCallback(() => {
        try {
            const saved = localStorage.getItem('freePlanProjects');
            if (saved) {
                const projects = JSON.parse(saved);
                const sortedProjects = projects.sort(
                    (a: { savedAt: string }, b: { savedAt: string }) =>
                        new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
                );
                setSavedProjects(sortedProjects);
            }
        } catch (error) {
            console.error('Error loading saved projects:', error);
            showToast(translations.errorLoadingProjects, 'error');
        }
    }, [showToast]);

    useEffect(() => {
        loadAdvertisements();
        loadSavedProjects();
    }, [loadAdvertisements, loadSavedProjects]);

    // ... (Manual and Ad logic remains the same) ...
    useEffect(() => {
        if (!loading) {
            const dontShowManual = localStorage.getItem('manualDontShowAgain');
            if (!dontShowManual) {
                const timer = setTimeout(() => {
                    setShowManualModal(true);
                }, 500);
                return () => clearTimeout(timer);
            }
        }
    }, [loading]);

    useEffect(() => {
        if (!loading && advertisements.length > 0 && !showAdModal && !showManualModal) {
            const dontShowManual = localStorage.getItem('manualDontShowAgain');
            if (dontShowManual) {
                if (!adShownRef.current) {
                    adShownRef.current = true;
                    const timer = setTimeout(() => {
                        setShowAdModal(true);
                    }, 500);
                    return () => clearTimeout(timer);
                }
            }
        }
    }, [loading, advertisements.length, showAdModal, showManualModal]);

    useEffect(() => {
        if (showManualModal) {
            manualWasShownRef.current = true;
        } else if (manualWasShownRef.current && !showManualModal && !loading && advertisements.length > 0 && !showAdModal) {
            const dontShowManual = localStorage.getItem('manualDontShowAgain');
            if (!dontShowManual && !adShownRef.current) {
                adShownRef.current = true;
                const timer = setTimeout(() => {
                    setShowAdModal(true);
                }, 500);
                return () => clearTimeout(timer);
            }
        }
    }, [showManualModal, loading, advertisements.length, showAdModal]);

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

    // 4. Logic Handlers
    const handleAddField = () => {
        const dataToClear = [
            'drawnShapes', 'waterSources', 'pumps', 'zones', 'plantPoints',
            'mainPipes', 'subMainPipes', 'lateralPipes', 'mapStepProgress',
            'freeMapView', 'projectMapImage', 'freePlanSummary', 'projectName',
        ];
        dataToClear.forEach((key) => localStorage.removeItem(key));
        router.visit('/free-plan/choose-crop');
    };

    const handleLoadProject = (projectId: number) => {
        try {
            const saved = localStorage.getItem('freePlanProjects');
            if (saved) {
                const projects = JSON.parse(saved);
                const project = projects.find((p: { id: number }) => p.id === projectId);
                if (project) {
                    // Restore logic... (Same as original)
                    const keys = [
                        'drawnShapes', 'waterSources', 'pumps', 'zones', 'plantPoints',
                        'mainPipes', 'subMainPipes', 'lateralPipes', 'selectedPlantData',
                        'flowRateConfig', 'mapStepProgress', 'freeMapView', 'projectMapImage',
                        'freePlanSummary', 'projectName'
                    ];
                    keys.forEach(key => {
                        if (project[key]) {
                            if (typeof project[key] === 'object') {
                                localStorage.setItem(key, JSON.stringify(project[key]));
                            } else {
                                localStorage.setItem(key, project[key]);
                            }
                        }
                    });
                    router.visit('/free-plan/map');
                }
            }
        } catch (error) {
            console.error('Error loading project:', error);
            showToast(translations.errorLoadingProject, 'error');
        }
    };

    const handleDeleteProject = (projectId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        // Custom confirm using browser built-in for now, ideally replace with custom modal too
        if (confirm(translations.confirmDeleteProject)) {
            try {
                const saved = localStorage.getItem('freePlanProjects');
                if (saved) {
                    const projects = JSON.parse(saved);
                    const filtered = projects.filter((p: { id: number }) => p.id !== projectId);
                    localStorage.setItem('freePlanProjects', JSON.stringify(filtered));
                    loadSavedProjects();
                    showToast(translations.projectDeletedSuccessfully, 'success');
                }
            } catch (error) {
                console.error('Error deleting project:', error);
                showToast(translations.errorDeletingProject, 'error');
            }
        }
    };

    const handleEditProjectName = (projectId: number, currentName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingProjectId(projectId);
        setEditProjectName(currentName);
    };

    const handleSaveProjectName = (projectId: number) => {
        if (!editProjectName.trim()) {
            showToast(translations.pleaseEnterProjectName, 'info');
            return;
        }

        try {
            const saved = localStorage.getItem('freePlanProjects');
            if (saved) {
                const projects = JSON.parse(saved);
                const projectIndex = projects.findIndex((p: { id: number }) => p.id === projectId);
                if (projectIndex >= 0) {
                    projects[projectIndex].projectName = editProjectName.trim();
                    localStorage.setItem('freePlanProjects', JSON.stringify(projects));
                    loadSavedProjects();
                    setEditingProjectId(null);
                    setEditProjectName('');
                    showToast(translations.projectNameSavedSuccessfully, 'success');
                }
            }
        } catch (error) {
            console.error('Error updating project name:', error);
            showToast(translations.errorUpdatingProjectName, 'error');
        }
    };

    const handleCancelEdit = () => {
        setEditingProjectId(null);
        setEditProjectName('');
    };

    const handleUpgradeToPro = () => {
        router.visit('/free-plan/upgradePro');
    };

    const handleAdClick = (linkUrl: string) => {
        window.open(linkUrl, '_blank', 'noopener,noreferrer');
    };

    const handleCloseAdModal = () => {
        setShowAdModal(false);
    };

    const handleNextAd = () => setCurrentAdIndex((prev) => (prev + 1) % advertisements.length);
    const handlePrevAd = () => setCurrentAdIndex((prev) => (prev - 1 + advertisements.length) % advertisements.length);
    const handleOpenManual = () => setShowManualModal(true);

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
    };

    // 5. Return TSX
    return (
        // Changed to a richer gradient background
        <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-200 selection:bg-green-500/30">
            <Head title="Welcome to Free Plan" />

            {/* Custom Navbar */}
            <div className="sticky top-0 z-40 backdrop-blur-md bg-slate-900/50 border-b border-white/5">
                 <FreeNav />
            </div>

            {/* Toast Container */}
            <div className="fixed top-24 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 50, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20, scale: 0.9 }}
                            className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-md ${
                                toast.type === 'success' ? 'border-green-500/20 bg-green-900/80 text-green-100' :
                                toast.type === 'error' ? 'border-red-500/20 bg-red-900/80 text-red-100' :
                                'border-blue-500/20 bg-blue-900/80 text-blue-100'
                            }`}
                        >
                            <span className="text-sm font-medium">{toast.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Main Content */}
            <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-between pb-16 md:pb-0">
                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="w-full max-w-lg px-4 pt-8 pb-12 md:pt-16 md:pb-16"
                >
                    {/* Welcome Section */}
                    <motion.div variants={itemVariants} className="text-center mb-10">
                        <h1 className="mb-6 text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl drop-shadow-lg">
                            <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                                {translations.welcomeTo}
                            </span>
                            <br />
                            <span className="bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
                                {translations.freePlan}
                            </span>
                        </h1>

                        {/* Help/Manual Button - Glassmorphism */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleOpenManual}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-slate-300 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <span>{translations.userManual}</span>
                        </motion.button>
                    </motion.div>

                    {/* Add Field Button - Primary Action */}
                    <motion.div variants={itemVariants} className="flex justify-center mb-10">
                        <motion.button
                            whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgba(22, 163, 74, 0.4)" }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleAddField}
                            className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 to-green-700 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-green-900/20 transition-all"
                        >
                            <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
                            <div className="rounded-full bg-white/20 p-1">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                            {translations.addField}
                        </motion.button>
                    </motion.div>

                    {/* Saved Files Section - Glass Card */}
                    <motion.div 
                        variants={itemVariants}
                        className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-slate-800/40 backdrop-blur-md shadow-xl"
                    >
                        <div className="border-b border-white/5 bg-white/5 p-4">
                            <h3 className="text-center font-semibold text-slate-200">
                                {translations.yourSavedFiles}
                            </h3>
                        </div>
                        
                        <div className="max-h-[300px] min-h-[200px] overflow-y-auto p-4 custom-scrollbar">
                            {savedProjects.length > 0 ? (
                                <div className="space-y-3">
                                    <AnimatePresence>
                                        {savedProjects.map((project, idx) => (
                                            <motion.div
                                                key={project.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                transition={{ delay: idx * 0.05 }}
                                                onClick={() => {
                                                    if (editingProjectId !== project.id) {
                                                        handleLoadProject(project.id);
                                                    }
                                                }}
                                                className={`group relative rounded-xl border p-3 transition-all ${
                                                    editingProjectId === project.id
                                                        ? 'border-green-500/50 bg-slate-700/80 ring-2 ring-green-500/20'
                                                        : 'cursor-pointer border-white/5 bg-slate-700/30 hover:border-white/20 hover:bg-slate-700/60 hover:shadow-lg'
                                                }`}
                                            >
                                                {editingProjectId === project.id ? (
                                                    // Edit mode
                                                    <div className="space-y-3">
                                                        <input
                                                            type="text"
                                                            value={editProjectName}
                                                            onChange={(e) => setEditProjectName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveProjectName(project.id);
                                                                else if (e.key === 'Escape') handleCancelEdit();
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-full rounded-lg bg-slate-900/50 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                                            autoFocus
                                                            placeholder="ชื่อโปรเจค..."
                                                        />
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSaveProjectName(project.id);
                                                                }}
                                                                className="flex-1 rounded-md bg-green-600 py-1.5 text-xs font-medium text-white shadow hover:bg-green-500 transition-colors"
                                                            >
                                                                {translations.save}
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCancelEdit();
                                                                }}
                                                                className="flex-1 rounded-md bg-slate-600 py-1.5 text-xs font-medium text-white shadow hover:bg-slate-500 transition-colors"
                                                            >
                                                                {translations.cancel}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // View mode
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <p className="truncate text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                                                                {project.projectName}
                                                            </p>
                                                            <p className="flex items-center gap-1 text-xs text-slate-500">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                {new Date(project.savedAt).toLocaleString('th-TH', {
                                                                    year: 'numeric', month: 'short', day: 'numeric',
                                                                    hour: '2-digit', minute: '2-digit',
                                                                })}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                            <button
                                                                onClick={(e) => handleEditProjectName(project.id, project.projectName, e)}
                                                                className="rounded-lg p-2 text-slate-400 hover:bg-blue-500/20 hover:text-blue-400 transition-colors"
                                                                title={translations.editProjectName}
                                                            >
                                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleDeleteProject(project.id, e)}
                                                                className="rounded-lg p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                                                title={translations.deleteProject}
                                                            >
                                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center py-10 opacity-50">
                                    <svg className="h-12 w-12 text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                                    <p className="text-sm text-slate-400">
                                        {translations.noSavedFiles}
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Upgrade to Pro Button */}
                    <motion.div variants={itemVariants} className="text-center">
                        <motion.button
                            whileHover={{ scale: 1.02, boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.4)" }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleUpgradeToPro}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-blue-900/20 transition-all hover:brightness-110"
                        >
                             👑 {translations.upgradeToPro}
                        </motion.button>
                    </motion.div>
                </motion.div>

                {/* Footer Information */}
                <div className="w-full mt-auto">
                    <FreeFooter />
                </div>
            </div>

            {/* Advertisement Modal - Glassmorphism */}
            <AnimatePresence>
                {showAdModal && advertisements.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-800/80 backdrop-blur-xl shadow-2xl md:max-w-xl lg:max-w-2xl"
                        >
                            {/* Header Gradient */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

                            <button
                                onClick={handleCloseAdModal}
                                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition-all hover:bg-red-500 hover:rotate-90"
                            >
                                ✕
                            </button>

                            <div className="p-4">
                                <div
                                    className="group cursor-pointer"
                                    onClick={() => handleAdClick(advertisements[currentAdIndex].link_url)}
                                >
                                    <div className="mb-3 text-center">
                                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur-sm">
                                            {translations.sponsoredContent}
                                        </span>
                                    </div>

                                    <div className="relative mx-auto overflow-hidden rounded-xl shadow-lg transition-transform duration-300 group-hover:scale-[1.02]">
                                        <img
                                            src={advertisements[currentAdIndex].image_url}
                                            alt={advertisements[currentAdIndex].title}
                                            className="w-full object-contain"
                                            style={{ aspectRatio: '210/297', maxHeight: '60vh', maxWidth: '100%' }}
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.src = '/images/no-image.jpg';
                                            }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                            <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md">
                                                {translations.clickToViewDetails}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Controls */}
                                {advertisements.length > 1 && (
                                    <div className="mt-4 flex items-center justify-between">
                                        <button
                                            onClick={handlePrevAd}
                                            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                                        >
                                            ← {translations.back}
                                        </button>

                                        <div className="flex gap-2">
                                            {advertisements.map((_, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => setCurrentAdIndex(index)}
                                                    className={`h-2 rounded-full transition-all ${
                                                        index === currentAdIndex
                                                            ? 'w-6 bg-blue-500'
                                                            : 'w-2 bg-slate-600 hover:bg-slate-500'
                                                    }`}
                                                />
                                            ))}
                                        </div>

                                        <button
                                            onClick={handleNextAd}
                                            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                                        >
                                            {translations.next} →
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Manual/Tutorial Modal */}
            {showManualModal && <Manual onClose={() => setShowManualModal(false)} />}

            {/* Bottom Navigation for Mobile */}
            <FootNav />
        </div>
    );
}

// 6. Export
export default FreeHome;
