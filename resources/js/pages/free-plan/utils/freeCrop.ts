import { LanguageTranslations } from './language';

// Garden Plant Data Structure
export interface GardenPlant {
    name: string;
    waterNeed: number; // in liters per plant per day
    plantSpacing: number; // in centimeters
    rowSpacing: number; // in centimeters
    icon: string; // emoji icon for the plant
}

// Plant name mapping for translations
export const plantNameMap: Record<string, string> = {
    Durian: 'durian',
    Mangosteen: 'mangosteen',
    Longan: 'longan',
    Lychee: 'lychee',
    Rambutan: 'rambutan',
    'Rose Apple': 'roseApple',
    Papaya: 'papaya',
    Coconut: 'coconut',
    Pomelo: 'pomelo',
    Lime: 'lime',
    Banana: 'banana',
    Pineapple: 'pineapple',
    Guava: 'guava',
    'Crown Flower': 'crownFlower',
    Tamarind: 'tamarind',
    'Water Spinach': 'waterSpinach',
    'Water Mimosa': 'waterMimosa',
    'Chinese Kale': 'chineseKale',
    'Chinese Cabbage': 'chineseCabbage',
    Lettuce: 'lettuce',
    Cabbage: 'cabbage',
    Cauliflower: 'cauliflower',
    'Brussels Sprouts': 'brusselsSprouts',
    Kohlrabi: 'kohlrabi',
    Turnip: 'turnip',
    Cassava: 'cassava',
    'Sweet Potato': 'sweetPotato',
    Potato: 'potato',
    Radish: 'radish',
    Carrot: 'carrot',
    Cucumber: 'cucumber',
    Watermelon: 'watermelon',
    Pumpkin: 'pumpkin',
    'Winter Melon': 'winterMelon',
};

// Thai Garden Plants Database
export const gardenPlants: GardenPlant[] = [
    // Thai Tropical Fruits
    {
        name: 'Durian',
        waterNeed: 8.0,
        plantSpacing: 800,
        rowSpacing: 1000,
        icon: '🌰',
    },
    {
        name: 'Mangosteen',
        waterNeed: 6.0,
        plantSpacing: 600,
        rowSpacing: 800,
        icon: '🍇',
    },
    {
        name: 'Longan',
        waterNeed: 5.5,
        plantSpacing: 500,
        rowSpacing: 700,
        icon: '🍒',
    },
    {
        name: 'Lychee',
        waterNeed: 5.0,
        plantSpacing: 500,
        rowSpacing: 600,
        icon: '🍒',
    },
    {
        name: 'Rambutan',
        waterNeed: 4.5,
        plantSpacing: 400,
        rowSpacing: 600,
        icon: '🍒',
    },
    {
        name: 'Rose Apple',
        waterNeed: 4.0,
        plantSpacing: 400,
        rowSpacing: 500,
        icon: '🍎',
    },
    {
        name: 'Papaya',
        waterNeed: 3.5,
        plantSpacing: 300,
        rowSpacing: 400,
        icon: '🥭',
    },
    {
        name: 'Coconut',
        waterNeed: 10.0,
        plantSpacing: 800,
        rowSpacing: 1000,
        icon: '🥥',
    },
    {
        name: 'Pomelo',
        waterNeed: 6.5,
        plantSpacing: 500,
        rowSpacing: 700,
        icon: '🍊',
    },
    {
        name: 'Lime',
        waterNeed: 3.0,
        plantSpacing: 300,
        rowSpacing: 400,
        icon: '🍋',
    },
    {
        name: 'Banana',
        waterNeed: 4.0,
        plantSpacing: 200,
        rowSpacing: 300,
        icon: '🍌',
    },
    {
        name: 'Pineapple',
        waterNeed: 2.5,
        plantSpacing: 300,
        rowSpacing: 400,
        icon: '🍍',
    },
    {
        name: 'Guava',
        waterNeed: 4.5,
        plantSpacing: 400,
        rowSpacing: 500,
        icon: '🍈',
    },
    {
        name: 'Crown Flower',
        waterNeed: 3.5,
        plantSpacing: 300,
        rowSpacing: 400,
        icon: '🌸',
    },
    {
        name: 'Tamarind',
        waterNeed: 5.0,
        plantSpacing: 600,
        rowSpacing: 800,
        icon: '🌿',
    },

    // Thai Vegetables
    {
        name: 'Water Spinach',
        waterNeed: 1.5,
        plantSpacing: 20,
        rowSpacing: 30,
        icon: '🥬',
    },
    {
        name: 'Water Mimosa',
        waterNeed: 1.2,
        plantSpacing: 15,
        rowSpacing: 25,
        icon: '🌿',
    },
    {
        name: 'Chinese Kale',
        waterNeed: 1.8,
        plantSpacing: 25,
        rowSpacing: 35,
        icon: '🥬',
    },
    {
        name: 'Chinese Cabbage',
        waterNeed: 1.5,
        plantSpacing: 20,
        rowSpacing: 30,
        icon: '🥬',
    },
    {
        name: 'Lettuce',
        waterNeed: 1.0,
        plantSpacing: 15,
        rowSpacing: 25,
        icon: '🥬',
    },
    {
        name: 'Cabbage',
        waterNeed: 2.0,
        plantSpacing: 30,
        rowSpacing: 40,
        icon: '🥬',
    },
    {
        name: 'Cauliflower',
        waterNeed: 2.2,
        plantSpacing: 30,
        rowSpacing: 40,
        icon: '🥦',
    },
    {
        name: 'Brussels Sprouts',
        waterNeed: 2.0,
        plantSpacing: 30,
        rowSpacing: 40,
        icon: '🥬',
    },
    {
        name: 'Kohlrabi',
        waterNeed: 1.8,
        plantSpacing: 25,
        rowSpacing: 35,
        icon: '🥬',
    },
    {
        name: 'Turnip',
        waterNeed: 1.5,
        plantSpacing: 20,
        rowSpacing: 30,
        icon: '🥬',
    },

    // Thai Root Crops
    {
        name: 'Cassava',
        waterNeed: 2.5,
        plantSpacing: 80,
        rowSpacing: 100,
        icon: '🥔',
    },
    {
        name: 'Sweet Potato',
        waterNeed: 2.0,
        plantSpacing: 30,
        rowSpacing: 50,
        icon: '🍠',
    },
    {
        name: 'Potato',
        waterNeed: 2.2,
        plantSpacing: 25,
        rowSpacing: 40,
        icon: '🥔',
    },
    {
        name: 'Radish',
        waterNeed: 1.0,
        plantSpacing: 8,
        rowSpacing: 20,
        icon: '🥕',
    },
    {
        name: 'Carrot',
        waterNeed: 1.2,
        plantSpacing: 10,
        rowSpacing: 25,
        icon: '🥕',
    },

    // Thai Gourds and Melons
    {
        name: 'Cucumber',
        waterNeed: 2.5,
        plantSpacing: 40,
        rowSpacing: 80,
        icon: '🥒',
    },
    {
        name: 'Watermelon',
        waterNeed: 3.0,
        plantSpacing: 100,
        rowSpacing: 150,
        icon: '🍉',
    },
    {
        name: 'Pumpkin',
        waterNeed: 2.8,
        plantSpacing: 80,
        rowSpacing: 120,
        icon: '🎃',
    },
    {
        name: 'Winter Melon',
        waterNeed: 2.2,
        plantSpacing: 60,
        rowSpacing: 100,
        icon: '🍈',
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

export const searchGardenPlants = (query: string): GardenPlant[] => {
    const lowercaseQuery = query.toLowerCase();
    return gardenPlants.filter((plant) => plant.name.toLowerCase().includes(lowercaseQuery));
};

export const getGardenPlantsByCategory = (
    category: 'fruits' | 'vegetables' | 'root-crops' | 'gourds'
): GardenPlant[] => {
    const categoryMap = {
        fruits: [
            'Durian',
            'Mangosteen',
            'Longan',
            'Lychee',
            'Rambutan',
            'Rose Apple',
            'Papaya',
            'Coconut',
            'Pomelo',
            'Lime',
            'Banana',
            'Pineapple',
            'Guava',
            'Crown Flower',
            'Tamarind',
        ],
        vegetables: [
            'Water Spinach',
            'Water Mimosa',
            'Chinese Kale',
            'Chinese Cabbage',
            'Lettuce',
            'Cabbage',
            'Cauliflower',
            'Brussels Sprouts',
            'Kohlrabi',
            'Turnip',
        ],
        'root-crops': ['Cassava', 'Sweet Potato', 'Potato', 'Radish', 'Carrot'],
        gourds: ['Cucumber', 'Watermelon', 'Pumpkin', 'Winter Melon'],
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
