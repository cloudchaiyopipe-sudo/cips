// 1. Import
import { Head, router, usePage } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import FreeFooter from './components/freeFooter';
import Manual from './components/manual';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getTranslations } from './utils/language';

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

// 2. State & Hooks Component
function FreeHome() {
    usePage<PageProps>();

    // State for advertisements
    const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
    const [currentAdIndex, setCurrentAdIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showAdModal, setShowAdModal] = useState(false);
    
    // State for manual/tutorial
    const [showManualModal, setShowManualModal] = useState(false);
    
    // Ref to track if ad has been shown (to prevent showing again)
    const adShownRef = useRef(false);
    
    // State for language
    const [translations, setTranslations] = useState(getTranslations());
    
    // State for saved projects
    const [savedProjects, setSavedProjects] = useState<Array<{
        id: number;
        projectName: string;
        savedAt: string;
    }>>([]);
    
    // State for edit project name
    const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
    const [editProjectName, setEditProjectName] = useState<string>('');

    // 3. Hooks
    useEffect(() => {
        loadAdvertisements();
        loadSavedProjects();
    }, []);
    
    // Load saved projects from localStorage
    const loadSavedProjects = () => {
        try {
            const saved = localStorage.getItem('freePlanProjects');
            if (saved) {
                const projects = JSON.parse(saved);
                // Sort by savedAt descending (newest first)
                const sortedProjects = projects.sort((a: { savedAt: string }, b: { savedAt: string }) => 
                    new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
                );
                setSavedProjects(sortedProjects);
            }
        } catch (error) {
            console.error('Error loading saved projects:', error);
        }
    };

    // Show manual first when page loads (if not disabled)
    useEffect(() => {
        if (!loading && !adShownRef.current) {
            const dontShowManual = localStorage.getItem('manualDontShowAgain');
            if (!dontShowManual) {
                // Show manual first
                const timer = setTimeout(() => {
                    setShowManualModal(true);
                }, 500);
                return () => clearTimeout(timer);
            } else {
                // If manual is disabled, show ad immediately (only once)
                if (advertisements.length > 0 && !adShownRef.current) {
                    adShownRef.current = true;
                    setShowAdModal(true);
                }
            }
        }
    }, [loading, advertisements.length]);

    // Show advertisement modal after manual is closed
    useEffect(() => {
        if (!showManualModal && !loading && advertisements.length > 0 && !showAdModal && !adShownRef.current) {
            // Show ad after manual is closed (only if ad hasn't been shown yet)
            adShownRef.current = true;
            const timer = setTimeout(() => {
                setShowAdModal(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [showManualModal, loading, advertisements.length, showAdModal]);

    // Listen for language changes from localStorage
    useEffect(() => {
        const handleLanguageChange = () => {
            setTranslations(getTranslations());
        };

        // Listen for storage changes (when language is changed in other components)
        window.addEventListener('storage', handleLanguageChange);
        
        // Listen for custom language change event
        window.addEventListener('languageChanged', handleLanguageChange);
        
        // Also check on focus (when user comes back to tab)
        window.addEventListener('focus', handleLanguageChange);

        return () => {
            window.removeEventListener('storage', handleLanguageChange);
            window.removeEventListener('languageChanged', handleLanguageChange);
            window.removeEventListener('focus', handleLanguageChange);
        };
    }, []);

    // Load advertisements
    const loadAdvertisements = async () => {
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
    };

    // 4. Logic Handlers
    const handleAddField = () => {
        // Clear all drawing-related data from localStorage
        // This ensures a fresh start when creating a new field
        const dataToClear = [
            'drawnShapes',
            'waterSources',
            'pumps',
            'zones',
            'plantPoints',
            'mainPipes',
            'subMainPipes',
            'lateralPipes',
            'mapStepProgress',
            'freeMapView',
            'projectMapImage',
            'freePlanSummary',
            'projectName'
        ];
        
        dataToClear.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Note: We keep selectedPlantData and flowRateConfig 
        // in case user wants to reuse them
        
        router.visit('/free-plan/choose-crop');
    };
    
    const handleLoadProject = (projectId: number) => {
        try {
            const saved = localStorage.getItem('freePlanProjects');
            if (saved) {
                const projects = JSON.parse(saved);
                const project = projects.find((p: { id: number }) => p.id === projectId);
                if (project) {
                    // Restore all data to localStorage
                    if (project.drawnShapes) localStorage.setItem('drawnShapes', JSON.stringify(project.drawnShapes));
                    if (project.waterSources) localStorage.setItem('waterSources', JSON.stringify(project.waterSources));
                    if (project.pumps) localStorage.setItem('pumps', JSON.stringify(project.pumps));
                    if (project.zones) localStorage.setItem('zones', JSON.stringify(project.zones));
                    if (project.plantPoints) localStorage.setItem('plantPoints', JSON.stringify(project.plantPoints));
                    if (project.mainPipes) localStorage.setItem('mainPipes', JSON.stringify(project.mainPipes));
                    if (project.subMainPipes) localStorage.setItem('subMainPipes', JSON.stringify(project.subMainPipes));
                    if (project.lateralPipes) localStorage.setItem('lateralPipes', JSON.stringify(project.lateralPipes));
                    if (project.selectedPlantData) localStorage.setItem('selectedPlantData', JSON.stringify(project.selectedPlantData));
                    if (project.flowRateConfig) localStorage.setItem('flowRateConfig', JSON.stringify(project.flowRateConfig));
                    if (project.mapStepProgress) localStorage.setItem('mapStepProgress', JSON.stringify(project.mapStepProgress));
                    if (project.freeMapView) localStorage.setItem('freeMapView', JSON.stringify(project.freeMapView));
                    if (project.projectMapImage) localStorage.setItem('projectMapImage', project.projectMapImage);
                    if (project.freePlanSummary) localStorage.setItem('freePlanSummary', JSON.stringify(project.freePlanSummary));
                    if (project.projectName) localStorage.setItem('projectName', project.projectName);
                    
                    // Navigate to map page
                    router.visit('/free-plan/map');
                }
            }
        } catch (error) {
            console.error('Error loading project:', error);
            alert('เกิดข้อผิดพลาดในการโหลดโปรเจค');
        }
    };
    
    const handleDeleteProject = (projectId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('คุณต้องการลบโปรเจคนี้หรือไม่?')) {
            try {
                const saved = localStorage.getItem('freePlanProjects');
                if (saved) {
                    const projects = JSON.parse(saved);
                    const filtered = projects.filter((p: { id: number }) => p.id !== projectId);
                    localStorage.setItem('freePlanProjects', JSON.stringify(filtered));
                    loadSavedProjects();
                }
            } catch (error) {
                console.error('Error deleting project:', error);
                alert('เกิดข้อผิดพลาดในการลบโปรเจค');
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
            alert('กรุณากรอกชื่อโปรเจค');
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
                }
            }
        } catch (error) {
            console.error('Error updating project name:', error);
            alert('เกิดข้อผิดพลาดในการแก้ไขชื่อโปรเจค');
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

    const handleNextAd = () => {
        setCurrentAdIndex((prev) => (prev + 1) % advertisements.length);
    };

    const handlePrevAd = () => {
        setCurrentAdIndex((prev) => (prev - 1 + advertisements.length) % advertisements.length);
    };

    // 5. Return TSX
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title="Welcome to Free Plan" />

            {/* Custom Navbar */}
            <FreeNav />

            {/* Main Content */}
            <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-between">
                
                {/* Welcome Section */}
                <div className="w-full max-w-md px-4 pt-8 pb-4 text-center md:px-6 md:pt-12 md:pb-6 min-h-[80vh] md:min-h-auto">
                    <h1 className="mb-8 text-3xl font-bold text-white md:mb-12 md:text-4xl lg:text-5xl">
                        {translations.welcomeTo}
                        <br />
                        {translations.freePlan}
                    </h1>

                    {/* Add Field Button */}
                    <button
                        onClick={handleAddField}
                        className="mb-6 inline-flex items-center gap-2 rounded-lg bg-green-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-green-700 hover:shadow-xl md:mb-8 md:px-10 md:py-4 md:text-lg"
                    >
                        <svg
                            className="h-5 w-5 md:h-6 md:w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        {translations.addField}
                    </button>


                    {/* Saved Files Section */}
                    <div className="mb-6 rounded-lg border-2 border-dashed border-slate-500 bg-slate-600/30 p-4 md:mb-8 md:p-6 min-h-[240px] md:min-h-[200px]">
                        <h3 className="mb-4 text-center text-sm font-semibold text-slate-300 md:text-base">
                            {translations.yourSavedFiles}
                        </h3>
                        {savedProjects.length > 0 ? (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {savedProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        onClick={() => {
                                            if (editingProjectId !== project.id) {
                                                handleLoadProject(project.id);
                                            }
                                        }}
                                        className={`group relative rounded-lg border border-slate-500 bg-slate-700/50 p-3 transition-all ${
                                            editingProjectId === project.id 
                                                ? 'cursor-default bg-slate-600/70' 
                                                : 'cursor-pointer hover:bg-slate-600/70 hover:border-slate-400'
                                        }`}
                                    >
                                        {editingProjectId === project.id ? (
                                            // Edit mode
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    value={editProjectName}
                                                    onChange={(e) => setEditProjectName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleSaveProjectName(project.id);
                                                        } else if (e.key === 'Escape') {
                                                            handleCancelEdit();
                                                        }
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full rounded bg-slate-600 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                                    autoFocus
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSaveProjectName(project.id);
                                                        }}
                                                        className="flex-1 rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                                                    >
                                                        บันทึก
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCancelEdit();
                                                        }}
                                                        className="flex-1 rounded bg-slate-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600"
                                                    >
                                                        ยกเลิก
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            // View mode
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-white">{project.projectName}</p>
                                                    <p className="text-xs text-slate-400">
                                                        {new Date(project.savedAt).toLocaleString('th-TH', {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                </div>
                                                <div className="ml-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <button
                                                        onClick={(e) => handleEditProjectName(project.id, project.projectName, e)}
                                                        className="rounded p-1 text-slate-400 hover:text-blue-400"
                                                        title="แก้ไขชื่อ"
                                                    >
                                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteProject(project.id, e)}
                                                        className="rounded p-1 text-slate-400 hover:text-red-400"
                                                        title="ลบโปรเจค"
                                                    >
                                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex h-full items-center justify-center">
                                <p className="text-sm text-slate-400 md:text-base">
                                    ไม่มีไฟล์ที่บันทึกไว้
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Upgrade to Pro Button */}
                    <button
                        onClick={handleUpgradeToPro}
                        className="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl md:mt-6 md:px-10 md:py-4 md:text-lg"
                    >
                        {translations.upgradeToPro}
                    </button>
                </div>

                {/* Footer Information */}
                <FreeFooter />
            </div>

            {/* Advertisement Modal */}
            {showAdModal && advertisements.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="relative mx-4 w-full max-w-2xl lg:max-w-3xl rounded-2xl bg-slate-800 p-6 md:p-8 shadow-2xl">
                        {/* Close Button */}
                        <button
                            onClick={handleCloseAdModal}
                            className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
                        >
                            ✕
                        </button>

                        {/* Advertisement Content */}
                        <div 
                            className="cursor-pointer rounded-lg p-4 transition-all"
                            onClick={() => handleAdClick(advertisements[currentAdIndex].link_url)}
                        >
                            <div className="mb-5 text-center">
                                <h3 className="text-base font-semibold text-slate-200">{translations.sponsoredContent}</h3>
                            </div>
                            
                            <div className="flex flex-col items-center gap-4">
                                <img
                                    src={advertisements[currentAdIndex].image_url}
                                    alt={advertisements[currentAdIndex].title}
                                    className="h-[24rem] md:h-[28rem] w-full rounded-lg object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = '/images/no-image.jpg';
                                    }}
                                />
                                <div className="text-center">
                                    <h4 className="font-semibold text-white text-2xl lg:text-3xl">
                                        {advertisements[currentAdIndex].title}
                                    </h4>
                                    <p className="text-base lg:text-lg text-slate-300 mt-2">
                                        {advertisements[currentAdIndex].description}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Controls */}
                        {advertisements.length > 1 && (
                            <div className="mt-6 flex items-center justify-between">
                                <button
                                    onClick={handlePrevAd}
                                    className="rounded bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-700 transition-colors"
                                >
                                    {translations.back}
                                </button>
                                
                                <div className="flex gap-2">
                                    {advertisements.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setCurrentAdIndex(index)}
                                            className={`h-3 w-3 rounded-full transition-colors ${
                                                index === currentAdIndex 
                                                    ? 'bg-blue-400' 
                                                    : 'bg-slate-500'
                                            }`}
                                        />
                                    ))}
                                </div>

                                <button
                                    onClick={handleNextAd}
                                    className="rounded bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-700 transition-colors"
                                >
                                    {translations.next}
                                </button>
                            </div>
                        )}

                        {/* Click to visit link hint */}
                        <div className="mt-4 text-center">
                            <p className="text-sm text-slate-400">{translations.clickAdToVisit}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual/Tutorial Modal */}
            {showManualModal && (
                <Manual onClose={() => setShowManualModal(false)} />
            )}
        </div>
    );
}

// 6. Export
export default FreeHome;
