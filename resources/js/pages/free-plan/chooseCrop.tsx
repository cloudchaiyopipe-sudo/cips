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

// 2. State & Hooks Component
function ChooseCrop() {
    // State
    const [searchValue, setSearchValue] = useState('');
    const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<'all' | 'fruits' | 'economic-trees'>(
        'all'
    );

    // State for translations
    const [translations, setTranslations] = useState(getTranslations());

    // 3. Hooks (currently none)
    // Listen for language changes
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
        setSelectedCrops((prev) => (prev.includes(cropName) ? [] : [cropName]));

        // Console.log all plant data when selected
        const plantData = getGardenPlantByName(cropName);
        if (plantData) {
            console.log('Selected Plant Data:', plantData);
        }
    };

    // Filter plants based on search and category
    const getFilteredPlants = () => {
        let filtered = gardenPlants;

        // Filter by category
        if (selectedCategory !== 'all') {
            filtered = getGardenPlantsByCategory(selectedCategory);
        }

        // Filter by search
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

        // Get the complete plant data for the selected crop
        const selectedPlantData = getGardenPlantByName(selectedCrops[0]);

        // Store in localStorage for persistence across page reloads
        if (selectedPlantData) {
            localStorage.setItem('selectedPlantData', JSON.stringify(selectedPlantData));
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

    // 5. Return TSX
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title="Select Crop Types" />

            {/* Custom Navbar */}
            <FreeNav />

            {/* Main Content */}
            <div className="flex min-h-[calc(100vh-80px)] flex-col">
                {/* Header Section */}
                <div className="sticky top-0 z-10 flex items-center justify-between bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700 px-4 py-6 md:px-6">
                    <h1 className="text-xl font-bold text-white md:text-2xl">
                        {translations.selectCropTypes}
                    </h1>
                    <button
                        onClick={handleClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 text-white transition-colors hover:bg-slate-500"
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
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Search and Filter Section */}
                <div className="sticky top-[73px] z-10 bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700 px-4 pb-6 md:px-6">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchValue}
                                onChange={handleSearchChange}
                                placeholder={translations.searchPlants}
                                className="w-full rounded-lg border border-slate-500 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            {searchValue && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
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
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            className="rounded-lg border border-slate-500 bg-white px-4 py-3 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="all">{translations.allCategories}</option>
                            <option value="fruits">{translations.fruits}</option>
                            <option value="economic-trees">{translations.economicTrees}</option>
                        </select>
                    </div>
                </div>

                {/* Crop Selection Grid */}
                <div className="flex-1 px-4 pb-6 md:px-6">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                        {getFilteredPlants().map((plant) => {
                            const isSelected = selectedCrops.includes(plant.name);

                            return (
                                <button
                                    key={plant.name}
                                    onClick={() => handleCropSelect(plant.name)}
                                    className={`rounded-lg px-4 py-6 text-center font-medium transition-all ${
                                        isSelected
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'bg-slate-600 text-white hover:bg-slate-500'
                                    }`}
                                >
                                    <div className="mb-2 flex items-center justify-center">
                                        <img
                                            src={plant.icon}
                                            alt={getTranslatedPlantName(plant.name, translations)}
                                            className="h-12 w-12 object-contain md:h-16 md:w-16"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <div className="text-sm md:text-base">
                                        {getTranslatedPlantName(plant.name, translations)}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-300">
                                        {plant.waterNeed}L/day
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* No results message */}
                    {getFilteredPlants().length === 0 && (
                        <div className="py-12 text-center">
                            <p className="text-lg text-slate-400">{translations.noPlantsFound}</p>
                            <p className="mt-2 text-sm text-slate-500">
                                {translations.tryAdjustingSearch}
                            </p>
                        </div>
                    )}
                </div>

                {/* Navigation Footer */}
                <div className="border-t border-slate-600 bg-slate-800/50 px-4 py-6 md:px-6">
                    <div className="flex gap-3">
                        <button
                            onClick={handleBack}
                            className="flex-1 rounded-lg bg-slate-600 px-6 py-3 font-medium text-white transition-colors hover:bg-slate-500"
                        >
                            {translations.back}
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={selectedCrops.length === 0}
                            className={`flex-1 rounded-lg px-6 py-3 font-medium text-white transition-colors ${
                                selectedCrops.length === 0
                                    ? 'cursor-not-allowed bg-blue-600/50'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {translations.next}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 6. Export
export default ChooseCrop;
