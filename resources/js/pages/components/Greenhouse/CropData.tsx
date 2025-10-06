// CropData.tsx
export interface Crop {
    value: string;
    name: string;
    nameEn: string;
    nameTh: string;
    description: string;
    descriptionEn: string;
    descriptionTh: string;
    icon: string;
    category: string;
}

export interface Category {
    name: string;
    nameEn: string;
    nameTh: string;
    icon: string;
}

// Greenhouse crop data
export const greenhouseCrops: Crop[] = [
    // Vegetables
    {
        value: 'tomato',
        name: 'Tomato', // Default fallback
        nameEn: 'Tomato',
        nameTh: 'มะเขือเทศ',
        description: 'Versatile fruit-vegetable suitable for greenhouse cultivation', // Default fallback
        descriptionEn: 'Versatile fruit-vegetable suitable for greenhouse cultivation',
        descriptionTh: 'ผักผลไม้อเนกประสงค์ที่เหมาะสำหรับการปลูกในโรงเรือน',
        icon: '🍅',
        category: 'vegetables',
    },
    {
        value: 'bell-pepper',
        name: 'Bell Pepper',
        nameEn: 'Bell Pepper',
        nameTh: 'พริกหวาน',
        description: 'Colorful sweet pepper rich in vitamins',
        descriptionEn: 'Colorful sweet pepper rich in vitamins',
        descriptionTh: 'พริกหวานหลากสีที่อุดมไปด้วยวิตามิน',
        icon: '🫑',
        category: 'vegetables',
    },
    {
        value: 'cucumber',
        name: 'Cucumber',
        nameEn: 'Cucumber',
        nameTh: 'แตงกวา',
        description: 'Fresh, crisp vegetable suitable for greenhouse growing',
        descriptionEn: 'Fresh, crisp vegetable suitable for greenhouse growing',
        descriptionTh: 'ผักสดกรอบที่เหมาะสำหรับการปลูกในโรงเรือน',
        icon: '🥒',
        category: 'vegetables',
    },
    {
        value: 'melon',
        name: 'Melon',
        nameEn: 'Melon',
        nameTh: 'แตงไทย',
        description: 'Sweet fruit with tender flesh, grows well in greenhouses',
        descriptionEn: 'Sweet fruit with tender flesh, grows well in greenhouses',
        descriptionTh: 'ผลไม้หวานเนื้อนุ่ม เจริญเติบโตได้ดีในโรงเรือน',
        icon: '🍈',
        category: 'vegetables',
    },
    {
        value: 'lettuce',
        name: 'Lettuce',
        nameEn: 'Lettuce',
        nameTh: 'ผักสลัด',
        description: 'Various salad greens such as red oak and green oak varieties',
        descriptionEn: 'Various salad greens such as red oak and green oak varieties',
        descriptionTh: 'ผักใบเขียวสำหรับสลัดหลายพันธุ์ เช่น เรดโอ๊ค และกรีนโอ๊ค',
        icon: '🥬',
        category: 'vegetables',
    },
    {
        value: 'kale',
        name: 'Kale',
        nameEn: 'Kale',
        nameTh: 'เคล',
        description: 'Dark green leafy vegetable rich in nutrients',
        descriptionEn: 'Dark green leafy vegetable rich in nutrients',
        descriptionTh: 'ผักใบเขียวเข้มที่อุดมไปด้วยสารอาหาร',
        icon: '🥬',
        category: 'vegetables',
    },
    {
        value: 'pak-choi',
        name: 'Pak Choi',
        nameEn: 'Pak Choi',
        nameTh: 'ผักกวางตุ้ง',
        description: 'Chinese green leafy vegetable with fast growth',
        descriptionEn: 'Chinese green leafy vegetable with fast growth',
        descriptionTh: 'ผักใบเขียวจีนที่เจริญเติบโตเร็ว',
        icon: '🥬',
        category: 'vegetables',
    },
    {
        value: 'chinese-kale',
        name: 'Chinese Kale',
        nameEn: 'Chinese Kale',
        nameTh: 'คะน้า',
        description: 'Thai green leafy vegetable with fast growth',
        descriptionEn: 'Thai green leafy vegetable with fast growth',
        descriptionTh: 'ผักใบเขียวไทยที่เจริญเติบโตเร็ว',
        icon: '🥬',
        category: 'vegetables',
    },
    {
        value: 'cabbage',
        name: 'Cabbage',
        nameEn: 'Cabbage',
        nameTh: 'กะหล่ำปลี',
        description: 'Compact head vegetable suitable for greenhouse cultivation',
        descriptionEn: 'Compact head vegetable suitable for greenhouse cultivation',
        descriptionTh: 'ผักหัวกะทัดรัดที่เหมาะสำหรับการปลูกในโรงเรือน',
        icon: '🥬',
        category: 'vegetables',
    },
    {
        value: 'cauliflower',
        name: 'Cauliflower',
        nameEn: 'Cauliflower',
        nameTh: 'กะหล่ำดอก',
        description: 'White flowering vegetable rich in vitamins',
        descriptionEn: 'White flowering vegetable rich in vitamins',
        descriptionTh: 'ผักดอกสีขาวที่อุดมไปด้วยวิตามิน',
        icon: '🥦',
        category: 'vegetables',
    },
    {
        value: 'broccoli',
        name: 'Broccoli',
        nameEn: 'Broccoli',
        nameTh: 'บร็อกโคลี',
        description: 'Green flowering vegetable rich in nutrients',
        descriptionEn: 'Green flowering vegetable rich in nutrients',
        descriptionTh: 'ผักดอกสีเขียวที่อุดมไปด้วยสารอาหาร',
        icon: '🥦',
        category: 'vegetables',
    },
    // Fruits
    {
        value: 'strawberry',
        name: 'Strawberry',
        nameEn: 'Strawberry',
        nameTh: 'สตรอเบอร์รี่',
        description: 'Sweet, juicy fruit suitable for greenhouse cultivation',
        descriptionEn: 'Sweet, juicy fruit suitable for greenhouse cultivation',
        descriptionTh: 'ผลไม้หวานฉ่ำน้ำที่เหมาะสำหรับการปลูกในโรงเรือน',
        icon: '🍓',
        category: 'fruits',
    },
    {
        value: 'seedless-grape',
        name: 'Seedless Grape',
        nameEn: 'Seedless Grape',
        nameTh: 'องุ่นไร้เมล็ด',
        description: 'Sweet seedless grapes of premium quality',
        descriptionEn: 'Sweet seedless grapes of premium quality',
        descriptionTh: 'องุ่นไร้เมล็ดหวานคุณภาพพรีเมียม',
        icon: '🍇',
        category: 'fruits',
    },
    {
        value: 'cantaloupe',
        name: 'Cantaloupe',
        nameEn: 'Cantaloupe',
        nameTh: 'แคนตาลูป',
        description: 'Orange-fleshed melon, sweet and aromatic',
        descriptionEn: 'Orange-fleshed melon, sweet and aromatic',
        descriptionTh: 'เมลอนเนื้อสีส้ม หวานและหอม',
        icon: '🍈',
        category: 'fruits',
    },
    {
        value: 'japanese-melon',
        name: 'Japanese Melon',
        nameEn: 'Japanese Melon',
        nameTh: 'เมลอนญี่ปุ่น',
        description: 'Premium melon with tender flesh and intense sweetness',
        descriptionEn: 'Premium melon with tender flesh and intense sweetness',
        descriptionTh: 'เมลอนพรีเมียมเนื้อนุ่มและหวานเข้มข้น',
        icon: '🍈',
        category: 'fruits',
    },
    // Orchids
    {
        value: 'dendrobium',
        name: 'Dendrobium Orchid',
        nameEn: 'Dendrobium Orchid',
        nameTh: 'กล้วยไม้สกุลหวาย',
        description: 'Popular orchid variety with long-lasting flowers',
        descriptionEn: 'Popular orchid variety with long-lasting flowers',
        descriptionTh: 'กล้วยไม้พันธุ์ยอดนิยมที่มีดอกบานนาน',
        icon: '🌺',
        category: 'orchids',
    },
    {
        value: 'phalaenopsis',
        name: 'Phalaenopsis Orchid',
        nameEn: 'Phalaenopsis Orchid',
        nameTh: 'กล้วยไม้สกุลฟาแลนนอปซิส',
        description: 'Elegant moth orchid with large, colorful blooms',
        descriptionEn: 'Elegant moth orchid with large, colorful blooms',
        descriptionTh: 'กล้วยไม้สกุลผีเสื้อที่สง่างาม มีดอกขนาดใหญ่สีสันสดใส',
        icon: '🦋',
        category: 'orchids',
    },
    {
        value: 'cattleya',
        name: 'Cattleya Orchid',
        nameEn: 'Cattleya Orchid',
        nameTh: 'กล้วยไม้สกุลแคทลียา',
        description: 'Fragrant orchid with showy, colorful flowers',
        descriptionEn: 'Fragrant orchid with showy, colorful flowers',
        descriptionTh: 'กล้วยไม้หอมที่มีดอกสีสันสดใสและสวยงาม',
        icon: '🌺',
        category: 'orchids',
    },
    {
        value: 'vanda',
        name: 'Vanda Orchid',
        nameEn: 'Vanda Orchid',
        nameTh: 'กล้วยไม้สกุลแวนด้า',
        description: 'Epiphytic orchid with vibrant, long-lasting flowers',
        descriptionEn: 'Epiphytic orchid with vibrant, long-lasting flowers',
        descriptionTh: 'กล้วยไม้อิงอาศัยที่มีดอกสีสดใสและบานนาน',
        icon: '🌺',
        category: 'orchids',
    },
    {
        value: 'oncidium',
        name: 'Oncidium Orchid',
        nameEn: 'Oncidium Orchid',
        nameTh: 'กล้วยไม้สกุลออนซิเดียม',
        description: 'Dancing lady orchid with cascading flower sprays',
        descriptionEn: 'Dancing lady orchid with cascading flower sprays',
        descriptionTh: 'กล้วยไม้เต้นรำที่มีช่อดอกห้อยลงมาสวยงาม',
        icon: '🌺',
        category: 'orchids',
    },
    {
        value: 'cymbidium',
        name: 'Cymbidium Orchid',
        nameEn: 'Cymbidium Orchid',
        nameTh: 'กล้วยไม้สกุลซิมบิเดียม',
        description: 'Hardy orchid with long flower spikes and waxy blooms',
        descriptionEn: 'Hardy orchid with long flower spikes and waxy blooms',
        descriptionTh: 'กล้วยไม้ทนทานที่มีช่อดอกยาวและดอกแว็กซ์',
        icon: '🌺',
        category: 'orchids',
    },
];

// Categories definition (greenhouse only)
export const categories: Record<string, Category> = {
    vegetables: {
        name: 'Vegetables', // Default fallback
        nameEn: 'Vegetables',
        nameTh: 'ผัก',
        icon: '🥬',
    },
    fruits: {
        name: 'Fruits', // Default fallback
        nameEn: 'Fruits',
        nameTh: 'ผลไม้',
        icon: '🍓',
    },
    orchids: {
        name: 'Orchids', // Default fallback
        nameEn: 'Orchids',
        nameTh: 'กล้วยไม้',
        icon: '🌺',
    },
};

// Helper functions
export const getCropByValue = (value: string): Crop | undefined => {
    return greenhouseCrops.find((crop) => crop.value === value);
};

export const searchCrops = (searchTerm: string, language: 'en' | 'th' = 'th'): Crop[] => {
    const term = searchTerm.toLowerCase();
    return greenhouseCrops.filter((crop) => {
        if (language === 'th') {
            return (
                crop.nameTh.toLowerCase().includes(term) ||
                crop.nameEn.toLowerCase().includes(term) ||
                crop.descriptionTh.toLowerCase().includes(term) ||
                crop.descriptionEn.toLowerCase().includes(term)
            );
        } else {
            return (
                crop.nameEn.toLowerCase().includes(term) ||
                crop.nameTh.toLowerCase().includes(term) ||
                crop.descriptionEn.toLowerCase().includes(term) ||
                crop.descriptionTh.toLowerCase().includes(term)
            );
        }
    });
};

export const getCropsByCategory = (category: string): Crop[] => {
    return greenhouseCrops.filter((crop) => crop.category === category);
};

// Helper function to get localized crop name
export const getCropName = (crop: Crop, language: 'en' | 'th' = 'th'): string => {
    return language === 'th' ? crop.nameTh : crop.nameEn;
};

// Helper function to get localized crop description
export const getCropDescription = (crop: Crop, language: 'en' | 'th' = 'th'): string => {
    return language === 'th' ? crop.descriptionTh : crop.descriptionEn;
};

// Helper function to get localized category name
export const getCategoryName = (categoryKey: string, language: 'en' | 'th' = 'th'): string => {
    const category = categories[categoryKey];
    if (!category) return categoryKey;
    return language === 'th' ? category.nameTh : category.nameEn;
};
