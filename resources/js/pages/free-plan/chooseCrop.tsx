// 1. Import
import React, { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import {
    gardenPlants,
    searchGardenPlants,
    getGardenPlantsByCategory,
    getGardenPlantByName,
    getTranslatedPlantName,
} from './utils/freeCrop';
import { getTranslations } from './utils/language';
import { motion, AnimatePresence } from 'framer-motion';

// 2. State & Hooks Component
function ChooseCrop() {
    // State
    const [searchValue, setSearchValue] = useState('');
    const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<
        'all' | 'fruits' | 'economic-trees'
    >('all');
    const [showCustomPlantModal, setShowCustomPlantModal] = useState(false);
    const [customPlantData, setCustomPlantData] = useState({
        name: '',
        plantSpacing: '',
        rowSpacing: '',
        waterNeed: '',
    });

    // State for translations
    const [translations, setTranslations] = useState(getTranslations());

    // 3. Hooks
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
    const handleClose = () => {
        router.visit('/free-plan');
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchValue(e.target.value);
    };

    const handleClearSearch = () => {
        setSearchValue('');
    };

    const handleCategoryChange = (category: string) => {
        setSelectedCategory(category as 'all' | 'fruits' | 'economic-trees');
    };

    const handleCropSelect = (cropName: string) => {
        // Allow single selection logic (as per original intent implied by next step logic)
        // If multi-select is needed, just toggle. Here we toggle but keep logic same.
        setSelectedCrops((prev) => (prev.includes(cropName) ? [] : [cropName]));
    };

    const getFilteredPlants = () => {
        let filtered = gardenPlants;
        if (selectedCategory !== 'all') {
            filtered = getGardenPlantsByCategory(selectedCategory);
        }
        if (searchValue.trim()) {
            filtered = searchGardenPlants(searchValue);
        }
        return filtered;
    };

    const handleBack = () => {
        router.visit('/free-plan');
    };

    const handleNext = () => {
        if (selectedCrops.length === 0) return;

        const selectedPlantData = getGardenPlantByName(selectedCrops[0]);
        if (selectedPlantData) {
            localStorage.setItem('selectedPlantData', JSON.stringify(selectedPlantData));
            // Remove isCustomPlant flag when selecting a plant from the list
            localStorage.removeItem('isCustomPlant');
        }

        router.visit('/free-plan/map', {
            data: {
                crops: selectedCrops,
                selectedPlant: selectedPlantData
                    ? {
                          name: selectedPlantData.name,
                          waterNeed: selectedPlantData.waterNeed,
                          plantSpacing: selectedPlantData.plantSpacing,
                          rowSpacing: selectedPlantData.rowSpacing,
                          icon: selectedPlantData.icon,
                      }
                    : null,
            },
            preserveScroll: true,
        });
    };

    const handleCustomPlantSubmit = () => {
        // Validate inputs
        if (!customPlantData.name.trim()) {
            alert('กรุณากรอกชื่อพืช');
            return;
        }
        if (!customPlantData.plantSpacing || parseFloat(customPlantData.plantSpacing) <= 0) {
            alert('กรุณากรอกระยะระหว่างต้นที่ถูกต้อง');
            return;
        }
        if (!customPlantData.rowSpacing || parseFloat(customPlantData.rowSpacing) <= 0) {
            alert('กรุณากรอกระยะระหว่างแถวที่ถูกต้อง');
            return;
        }
        if (!customPlantData.waterNeed || parseFloat(customPlantData.waterNeed) <= 0) {
            alert('กรุณากรอกความต้องการน้ำที่ถูกต้อง');
            return;
        }

        // Create custom plant data
        const customPlant = {
            name: customPlantData.name.trim(),
            plantSpacing: parseFloat(customPlantData.plantSpacing),
            rowSpacing: parseFloat(customPlantData.rowSpacing),
            waterNeed: parseFloat(customPlantData.waterNeed),
            icon: '/images/plants/default-plant.png', // Default icon
            isCustom: true, // Flag to indicate this is a custom plant
        };

        // Save to localStorage
        localStorage.setItem('selectedPlantData', JSON.stringify(customPlant));
        localStorage.setItem('isCustomPlant', 'true');

        // Navigate to map page
        router.visit('/free-plan/map', {
            data: {
                crops: [customPlant.name],
                selectedPlant: {
                    name: customPlant.name,
                    waterNeed: customPlant.waterNeed,
                    plantSpacing: customPlant.plantSpacing,
                    rowSpacing: customPlant.rowSpacing,
                    icon: customPlant.icon,
                },
            },
            preserveScroll: true,
        });
    };

    const handleCustomPlantInputChange = (field: string, value: string) => {
        setCustomPlantData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    // 5. Return TSX
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-200">
            <Head title="Select Crop Types" />

            {/* Sticky Header with FreeNav */}
            <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <FreeNav />
                
                {/* Page Title & Close */}
                <div className="flex items-center justify-between px-4 py-4 md:px-6">
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-400">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white md:text-xl">{translations.selectCropTypes}</h1>
                            <p className="text-xs text-slate-400">เลือกพืชที่คุณต้องการปลูก</p>
                        </div>
                    </motion.div>
                    
                    <div className="flex items-center gap-3">
                        {/* Add Custom Plant Button - แยกออกมาเป็นปุ่มใหญ่ */}
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowCustomPlantModal(true)}
                            className="flex items-center gap-2 rounded-xl border border-green-500/50 bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-green-500/30 transition-all hover:shadow-green-500/50 hover:border-green-400"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="hidden sm:inline">เพิ่มพืชเอง</span>
                        </motion.button>
                        
                        <motion.button
                            whileHover={{ scale: 1.1, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleClose}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </motion.button>
                    </div>
                </div>

                {/* Search and Filter Bar */}
                <div className="px-4 pb-4 md:px-6">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </span>
                            <input
                                type="text"
                                value={searchValue}
                                onChange={handleSearchChange}
                                placeholder={translations.searchPlants}
                                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3 pl-10 pr-10 text-white placeholder-slate-500 backdrop-blur-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 transition-all"
                            />
                            {searchValue && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <select
                                value={selectedCategory}
                                onChange={(e) => handleCategoryChange(e.target.value)}
                                className="h-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 pl-4 pr-10 text-white backdrop-blur-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 appearance-none transition-all cursor-pointer hover:bg-slate-700/50"
                            >
                                <option value="all">{translations.allCategories}</option>
                                <option value="fruits">{translations.fruits}</option>
                                <option value="economic-trees">{translations.economicTrees}</option>
                            </select>
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content: Crop Grid */}
            <div className="flex-1 px-4 py-6 pb-28 md:px-6 md:pb-28">
                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                >
                    <AnimatePresence mode="popLayout">
                        {getFilteredPlants().map((plant) => {
                            const isSelected = selectedCrops.includes(plant.name);

                            return (
                                <motion.button
                                    layout
                                    variants={itemVariants}
                                    key={plant.name}
                                    onClick={() => handleCropSelect(plant.name)}
                                    whileHover={{ scale: 1.03, y: -4 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`group relative flex flex-col items-center justify-center rounded-2xl border p-4 transition-all duration-300 ${
                                        isSelected
                                            ? 'border-green-500 bg-green-500/10 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                                            : 'border-white/5 bg-slate-800/40 hover:border-white/20 hover:bg-slate-800/60 hover:shadow-lg'
                                    }`}
                                >
                                    {/* Selection Checkmark */}
                                    <div className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full transition-all ${
                                        isSelected ? 'bg-green-500 scale-100' : 'bg-slate-700 scale-0 opacity-0'
                                    }`}>
                                        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                    </div>

                                    {/* Icon with Glow */}
                                    <div className="relative mb-3 flex h-20 w-20 items-center justify-center">
                                        <div className={`absolute inset-0 rounded-full blur-xl transition-all ${isSelected ? 'bg-green-500/30' : 'bg-white/5 group-hover:bg-white/10'}`} />
                                        <img
                                            src={plant.icon}
                                            alt={getTranslatedPlantName(plant.name, translations)}
                                            className="relative h-16 w-16 object-contain drop-shadow-lg transition-transform group-hover:scale-110"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                            }}
                                        />
                                    </div>

                                    <div className={`font-semibold transition-colors ${isSelected ? 'text-green-400' : 'text-slate-200 group-hover:text-white'}`}>
                                        {getTranslatedPlantName(plant.name, translations)}
                                    </div>
                                    
                                    <div className="mt-2 flex items-center gap-1 rounded-full bg-slate-900/50 px-2 py-1 text-[10px] text-slate-400">
                                        <svg className="h-3 w-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                        {plant.waterNeed} L/วัน
                                    </div>
                                </motion.button>
                            );
                        })}
                    </AnimatePresence>
                </motion.div>

                {/* No results message */}
                {getFilteredPlants().length === 0 && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-20 text-center"
                    >
                        <div className="mb-4 rounded-full bg-slate-800 p-4">
                            <svg className="h-10 w-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <p className="text-lg font-medium text-slate-400">{translations.noPlantsFound}</p>
                        <p className="text-sm text-slate-500">{translations.tryAdjustingSearch}</p>
                        <button 
                            onClick={handleClearSearch}
                            className="mt-4 text-sm text-blue-400 hover:text-blue-300 hover:underline"
                        >
                            ล้างคำค้นหา
                        </button>
                    </motion.div>
                )}
            </div>

            {/* Fixed Navigation Footer - Glassmorphism */}
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-slate-900/90 px-4 py-4 backdrop-blur-xl md:px-6 safe-area-bottom">
                <div className="mx-auto flex max-w-7xl gap-4">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleBack}
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-3.5 font-semibold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                    >
                        {translations.back}
                    </motion.button>
                    
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleNext}
                        disabled={selectedCrops.length === 0}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-white shadow-lg transition-all ${
                            selectedCrops.length === 0
                                ? 'cursor-not-allowed bg-slate-700 text-slate-500 shadow-none'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-900/30 hover:shadow-blue-900/50'
                        }`}
                    >
                        <span>{translations.next}</span>
                        {selectedCrops.length > 0 && (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        )}
                    </motion.button>
                </div>
            </div>

            {/* Custom Plant Modal */}
            <AnimatePresence>
                {showCustomPlantModal && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCustomPlantModal(false)}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        >
                            {/* Modal */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                                className="relative z-50 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:p-6"
                            >
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white">เพิ่มพืชเอง</h2>
                                <button
                                    onClick={() => setShowCustomPlantModal(false)}
                                    className="text-slate-400 hover:text-white"
                                >
                                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Plant Name */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        ชื่อพืช <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={customPlantData.name}
                                        onChange={(e) => handleCustomPlantInputChange('name', e.target.value)}
                                        placeholder="เช่น มะม่วง, กล้วย, ฯลฯ"
                                        className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-white placeholder-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                    />
                                </div>

                                {/* Plant Spacing */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        ระยะระหว่างต้น (เมตร) <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={customPlantData.plantSpacing}
                                        onChange={(e) => handleCustomPlantInputChange('plantSpacing', e.target.value)}
                                        placeholder="เช่น 3, 4, 5"
                                        min="0.1"
                                        step="0.1"
                                        className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-white placeholder-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                    />
                                </div>

                                {/* Row Spacing */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        ระยะระหว่างแถว (เมตร) <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={customPlantData.rowSpacing}
                                        onChange={(e) => handleCustomPlantInputChange('rowSpacing', e.target.value)}
                                        placeholder="เช่น 4, 5, 6"
                                        min="0.1"
                                        step="0.1"
                                        className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-white placeholder-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                    />
                                </div>

                                {/* Water Need */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-300">
                                        ความต้องการน้ำ (ลิตร/วัน) <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={customPlantData.waterNeed}
                                        onChange={(e) => handleCustomPlantInputChange('waterNeed', e.target.value)}
                                        placeholder="เช่น 10, 15, 20"
                                        min="0.1"
                                        step="0.1"
                                        className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-white placeholder-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                                    />
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="mt-6 flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowCustomPlantModal(false)}
                                    className="flex-1 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 font-medium text-slate-300 transition-colors hover:bg-slate-700"
                                >
                                    ยกเลิก
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleCustomPlantSubmit}
                                    className="flex-1 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2.5 font-bold text-white shadow-lg transition-all hover:shadow-green-500/30"
                                >
                                    ยืนยัน
                                </motion.button>
                            </div>
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

// 6. Export
export default ChooseCrop;
