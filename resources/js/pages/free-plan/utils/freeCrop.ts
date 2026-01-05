import { LanguageTranslations } from './language';

// Garden Plant Data Structure
export interface GardenPlant {
    name: string;
    waterNeed: number; // in liters per plant per day
    plantSpacing: number; // in centimeters
    rowSpacing: number; // in centimeters
    icon: string; // image path for the plant
}

// Function to get plant image path from plant name
export const getPlantImagePath = (plantName: string | undefined | null): string => {
    // Return fallback if plantName is invalid
    if (!plantName || typeof plantName !== 'string') {
        return '/freePlanImg/fruits/coconut.png';
    }

    // Mapping plant names to image file names
    const imageNameMap: Record<string, string> = {
        Durian: 'durian.png',
        Mangosteen: 'mangosteen.png',
        Longan: 'longan.png',
        Lychee: 'lychee.png',
        Rambutan: 'rambutan.png',
        Mango: 'mango.png',
        Jackfruit: 'jackfruit.png',
        Pomelo: 'pomelo.png',
        Longkong: 'longkong.png',
        'Mayong Chit': 'mayong chit.png',
        Avocado: 'avocado.png',
        Tamarind: 'tamarind.png',
        'Bitter Bean': 'bitter bean.png',
        Coconut: 'coconut.png',
        'Coconut Cooking': 'coconut.png',
        'Coconut Fragrant': 'coconut.png',
        'Oil Palm': 'oil palm.png',
        Rubber: 'rubber.png',
        Bamboo: 'bamboo.png',
        Teak: 'teak.png',
        'Yang Na': 'yang na.png',
        Payung: 'payung.png',
    };

    const imageName = imageNameMap[plantName] || 'coconut.png'; // fallback
    return `/freePlanImg/fruits/${imageName}`;
};

// Plant name mapping for translations
export const plantNameMap: Record<string, string> = {
    Durian: 'durian',
    Mangosteen: 'mangosteen',
    Longan: 'longan',
    Lychee: 'lychee',
    Rambutan: 'rambutan',
    Coconut: 'coconut',
    Pomelo: 'pomelo',
    Tamarind: 'tamarind',
    Mango: 'mango',
    Jackfruit: 'jackfruit',
    Longkong: 'longkong',
    'Mayong Chit': 'mayongChit',
    Avocado: 'avocado',
    'Bitter Bean': 'bitterBean',
    'Oil Palm': 'oilPalm',
    'Coconut Cooking': 'coconutCooking',
    'Coconut Fragrant': 'coconutFragrant',
    Rubber: 'rubber',
    Bamboo: 'bamboo',
    Teak: 'teak',
    'Yang Na': 'yangNa',
    Payung: 'payung',
};

// Thai Garden Plants Database
// Only plants with spacing >= 25 sqm/plant (25,000 sqcm/plant)
export const gardenPlants: GardenPlant[] = [
    // Thai Tropical Fruits (>= 25 sqm/plant)
    {
        name: 'Durian',
        waterNeed: 8.0,
        plantSpacing: 900, // 8-10m average = 9m = 900cm
        rowSpacing: 900, // 8-10m average = 9m = 900cm
        icon: getPlantImagePath('Durian'),
    },
    {
        name: 'Mangosteen',
        waterNeed: 6.0,
        plantSpacing: 900, // 8-10m average = 9m = 900cm
        rowSpacing: 900, // 8-10m average = 9m = 900cm
        icon: getPlantImagePath('Mangosteen'),
    },
    {
        name: 'Longan',
        waterNeed: 5.5,
        plantSpacing: 900, // 8-10m average = 9m = 900cm
        rowSpacing: 900, // 8-10m average = 9m = 900cm
        icon: getPlantImagePath('Longan'),
    },
    {
        name: 'Lychee',
        waterNeed: 5.0,
        plantSpacing: 900, // 8-10m average = 9m = 900cm
        rowSpacing: 900, // 8-10m average = 9m = 900cm
        icon: getPlantImagePath('Lychee'),
    },
    {
        name: 'Rambutan',
        waterNeed: 4.5,
        plantSpacing: 700, // 6-8m average = 7m = 700cm
        rowSpacing: 700, // 6-8m average = 7m = 700cm
        icon: getPlantImagePath('Rambutan'),
    },
    {
        name: 'Mango',
        waterNeed: 5.0,
        plantSpacing: 700, // 6-8m average = 7m = 700cm
        rowSpacing: 700, // 6-8m average = 7m = 700cm
        icon: getPlantImagePath('Mango'),
    },
    {
        name: 'Jackfruit',
        waterNeed: 6.0,
        plantSpacing: 700, // 6-8m average = 7m = 700cm
        rowSpacing: 700, // 6-8m average = 7m = 700cm
        icon: getPlantImagePath('Jackfruit'),
    },
    {
        name: 'Pomelo',
        waterNeed: 6.5,
        plantSpacing: 700, // 6-8m average = 7m = 700cm
        rowSpacing: 700, // 6-8m average = 7m = 700cm
        icon: getPlantImagePath('Pomelo'),
    },
    {
        name: 'Longkong',
        waterNeed: 4.5,
        plantSpacing: 700, // 6-8m average = 7m = 700cm
        rowSpacing: 700, // 6-8m average = 7m = 700cm
        icon: getPlantImagePath('Longkong'),
    },
    {
        name: 'Mayong Chit',
        waterNeed: 4.0,
        plantSpacing: 700, // 6-8m average = 7m = 700cm
        rowSpacing: 700, // 6-8m average = 7m = 700cm
        icon: getPlantImagePath('Mayong Chit'),
    },
    {
        name: 'Avocado',
        waterNeed: 5.5,
        plantSpacing: 700, // 6-8m average = 7m = 700cm
        rowSpacing: 700, // 6-8m average = 7m = 700cm
        icon: getPlantImagePath('Avocado'),
    },
    {
        name: 'Tamarind',
        waterNeed: 5.0,
        plantSpacing: 900, // 8-10m average = 9m = 900cm
        rowSpacing: 900, // 8-10m average = 9m = 900cm
        icon: getPlantImagePath('Tamarind'),
    },
    {
        name: 'Bitter Bean',
        waterNeed: 4.5,
        plantSpacing: 900, // 8-10m average = 9m = 900cm
        rowSpacing: 900, // 8-10m average = 9m = 900cm
        icon: getPlantImagePath('Bitter Bean'),
    },
    {
        name: 'Coconut',
        waterNeed: 10.0,
        plantSpacing: 850, // 8-9m average = 8.5m = 850cm (for cooking coconut)
        rowSpacing: 850,
        icon: getPlantImagePath('Coconut'),
    },
    {
        name: 'Coconut Cooking',
        waterNeed: 10.0,
        plantSpacing: 850, // 8-9m average = 8.5m = 850cm
        rowSpacing: 850,
        icon: getPlantImagePath('Coconut Cooking'),
    },
    {
        name: 'Coconut Fragrant',
        waterNeed: 8.0,
        plantSpacing: 550, // 5-6m average = 5.5m = 550cm
        rowSpacing: 550,
        icon: getPlantImagePath('Coconut Fragrant'),
    },
    {
        name: 'Oil Palm',
        waterNeed: 12.0,
        plantSpacing: 900, // 9m triangular spacing
        rowSpacing: 900,
        icon: getPlantImagePath('Oil Palm'),
    },
    {
        name: 'Rubber',
        waterNeed: 6.0,
        plantSpacing: 300, // 3m between plants
        rowSpacing: 750, // 7-8m average = 7.5m = 750cm between rows
        icon: getPlantImagePath('Rubber'),
    },
    {
        name: 'Bamboo',
        waterNeed: 3.0,
        plantSpacing: 500, // 4-6m average = 5m = 500cm
        rowSpacing: 500, // 4-6m average = 5m = 500cm
        icon: getPlantImagePath('Bamboo'),
    },
    {
        name: 'Teak',
        waterNeed: 4.0,
        plantSpacing: 600, // 4-8m average = 6m = 600cm
        rowSpacing: 600,
        icon: getPlantImagePath('Teak'),
    },
    {
        name: 'Yang Na',
        waterNeed: 5.0,
        plantSpacing: 800, // 8m minimum
        rowSpacing: 800,
        icon: getPlantImagePath('Yang Na'),
    },
    {
        name: 'Payung',
        waterNeed: 4.5,
        plantSpacing: 500, // 4-6m average = 5m = 500cm
        rowSpacing: 500,
        icon: getPlantImagePath('Payung'),
    },
];

// Utility functions for garden plants
export const getGardenPlantByName = (name: string): GardenPlant | undefined => {
    return gardenPlants.find((plant) => plant.name.toLowerCase() === name.toLowerCase());
};

// Get translated plant name
export const getTranslatedPlantName = (
    plantName: string,
    translations: LanguageTranslations
): string => {
    const translationKey = plantNameMap[plantName];
    if (translationKey && translations[translationKey as keyof LanguageTranslations]) {
        return translations[translationKey as keyof LanguageTranslations];
    }
    return plantName; // Fallback to original name
};

export const searchGardenPlants = (
    query: string,
    translations?: LanguageTranslations
): GardenPlant[] => {
    const lowercaseQuery = query.toLowerCase().trim();
    if (!lowercaseQuery) return gardenPlants;

    return gardenPlants.filter((plant) => {
        // Search in English name
        const englishMatch = plant.name.toLowerCase().includes(lowercaseQuery);
        
        // Search in translated name if translations provided
        if (translations) {
            const translationKey = plantNameMap[plant.name];
            if (translationKey) {
                const translatedName = translations[translationKey as keyof LanguageTranslations];
                if (translatedName && typeof translatedName === 'string') {
                    const thaiMatch = translatedName.toLowerCase().includes(lowercaseQuery);
                    return englishMatch || thaiMatch;
                }
            }
        }
        
        return englishMatch;
    });
};

export const getGardenPlantsByCategory = (category: 'fruits' | 'economic-trees'): GardenPlant[] => {
    const categoryMap: Record<string, string[]> = {
        fruits: [
            'Durian',
            'Mangosteen',
            'Longan',
            'Lychee',
            'Rambutan',
            'Mango',
            'Jackfruit',
            'Pomelo',
            'Longkong',
            'Mayong Chit',
            'Avocado',
            'Tamarind',
            'Bitter Bean',
            'Coconut',
            'Coconut Cooking',
            'Coconut Fragrant',
        ],
        'economic-trees': ['Oil Palm', 'Rubber', 'Bamboo', 'Teak', 'Yang Na', 'Payung'],
    };

    const plantNames = categoryMap[category] || [];
    return gardenPlants.filter((plant) => plantNames.includes(plant.name));
};

// Calculate water requirements for a garden area
export const calculateGardenWaterNeed = (
    plant: GardenPlant,
    areaInSquareMeters: number
): {
    totalPlants: number;
    dailyWaterNeed: number;
    weeklyWaterNeed: number;
    monthlyWaterNeed: number;
} => {
    // Convert spacing from cm to meters
    const plantSpacingM = plant.plantSpacing / 100;
    const rowSpacingM = plant.rowSpacing / 100;

    // Calculate plants per square meter
    const plantsPerSquareMeter = 1 / (plantSpacingM * rowSpacingM);

    // Calculate total plants for the area
    const totalPlants = Math.floor(areaInSquareMeters * plantsPerSquareMeter);

    // Calculate water needs
    const dailyWaterNeed = totalPlants * plant.waterNeed;
    const weeklyWaterNeed = dailyWaterNeed * 7;
    const monthlyWaterNeed = dailyWaterNeed * 30;

    return {
        totalPlants,
        dailyWaterNeed: Math.round(dailyWaterNeed * 100) / 100,
        weeklyWaterNeed: Math.round(weeklyWaterNeed * 100) / 100,
        monthlyWaterNeed: Math.round(monthlyWaterNeed * 100) / 100,
    };
};
