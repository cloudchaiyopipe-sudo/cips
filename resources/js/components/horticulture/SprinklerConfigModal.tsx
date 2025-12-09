import React, { useState, useEffect } from 'react';
import {
    SprinklerFormData,
    validateSprinklerConfig,
    saveSprinklerConfig,
    loadSprinklerConfig,
    DEFAULT_SPRINKLER_CONFIG,
} from '../../utils/sprinklerUtils';

interface PlantData {
    id: number;
    name: string;
    plantSpacing: number;
    rowSpacing: number;
    waterNeed: number;
    flowLitersPerMinute?: number;
}

interface SprinklerEquipment {
    id: number;
    name: string;
    image?: string;
    waterVolumeLitersPerMinute?: number | [number, number];
    pressureBar?: number | [number, number];
    radiusMeters?: number | [number, number];
    brand?: string;
    productCode?: string;
}

interface SprinklerConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: SprinklerFormData) => void;
    plantCount: number;
    selectedPlantType?: PlantData | null;
    t: (key: string) => string;
}

const SprinklerConfigModal: React.FC<SprinklerConfigModalProps> = ({
    isOpen,
    onClose,
    onSave,
    plantCount,
    selectedPlantType,
}) => {
    const [inputMode, setInputMode] = useState<'manual' | 'database'>('manual');
    const [formData, setFormData] = useState<SprinklerFormData>({
        flowRatePerMinute: '',
        pressureBar: '',
        sprinklersPerTree: '1',
    });

    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [isLoading, setIsLoading] = useState(false);
    const [sprinklers, setSprinklers] = useState<SprinklerEquipment[]>([]);
    const [loadingSprinklers, setLoadingSprinklers] = useState(false);
    const [selectedSprinkler, setSelectedSprinkler] = useState<SprinklerEquipment | null>(null);
    const [showAllSprinklers, setShowAllSprinklers] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Helper function to check if flow matches waterVolumeLitersPerMinute
    const matchesFlowRate = (equipment: SprinklerEquipment, targetFlow: number): boolean => {
        if (!equipment.waterVolumeLitersPerMinute) return false;
        
        const waterVolume = equipment.waterVolumeLitersPerMinute;
        if (Array.isArray(waterVolume)) {
            const [min, max] = waterVolume;
            return targetFlow >= min && targetFlow <= max;
        } else {
            return Math.abs(waterVolume - targetFlow) < 0.1; // Allow small tolerance
        }
    };

    // Fetch sprinklers from database
    const fetchSprinklers = async () => {
        setLoadingSprinklers(true);
        try {
            const savedState = loadSavedState();
            let sprinklersData: SprinklerEquipment[] = [];
            
            const response = await fetch('/api/equipments/by-category/sprinkler');
            if (response.ok) {
                const data = await response.json();
                sprinklersData = Array.isArray(data) ? data : [];
            } else {
                // Fallback: try category_id = 1
                const fallbackResponse = await fetch('/api/equipments/by-category-id/1');
                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    sprinklersData = Array.isArray(fallbackData) ? fallbackData : [];
                }
            }
            
            setSprinklers(sprinklersData);
            
            // After setting sprinklers, restore selected sprinkler if exists
            if (savedState?.selectedSprinklerId && sprinklersData.length > 0) {
                const savedSprinkler = sprinklersData.find(s => s.id === savedState.selectedSprinklerId);
                if (savedSprinkler) {
                    setSelectedSprinkler(savedSprinkler);
                    // Update form data with saved sprinkler values
                    let flowRate = 0;
                    if (savedSprinkler.waterVolumeLitersPerMinute) {
                        if (Array.isArray(savedSprinkler.waterVolumeLitersPerMinute)) {
                            flowRate = (savedSprinkler.waterVolumeLitersPerMinute[0] + savedSprinkler.waterVolumeLitersPerMinute[1]) / 2;
                        } else {
                            flowRate = savedSprinkler.waterVolumeLitersPerMinute;
                        }
                    }
                    let pressure = 0;
                    if (savedSprinkler.pressureBar) {
                        if (Array.isArray(savedSprinkler.pressureBar)) {
                            pressure = (savedSprinkler.pressureBar[0] + savedSprinkler.pressureBar[1]) / 2;
                        } else {
                            pressure = savedSprinkler.pressureBar;
                        }
                    }
                    setFormData(prev => ({
                        ...prev,
                        flowRatePerMinute: flowRate > 0 ? flowRate.toString() : prev.flowRatePerMinute,
                        pressureBar: pressure > 0 ? pressure.toString() : prev.pressureBar,
                    }));
                }
            }
        } catch (error) {
            console.error('Error fetching sprinklers:', error);
            setSprinklers([]);
        } finally {
            setLoadingSprinklers(false);
        }
    };

    // Helper function to format value for search
    const formatValueForSearch = (value: number | [number, number] | undefined): string => {
        if (!value) return '';
        if (Array.isArray(value)) {
            return `${value[0]} ${value[1]}`;
        }
        return value.toString();
    };

    // Filter sprinklers based on flow rate and search term
    const getFilteredSprinklers = (): SprinklerEquipment[] => {
        let filtered = sprinklers;

        // Filter by flow rate if not showing all
        if (!showAllSprinklers && selectedPlantType?.flowLitersPerMinute) {
            const targetFlow = selectedPlantType.flowLitersPerMinute;
            filtered = filtered.filter(sprinkler => matchesFlowRate(sprinkler, targetFlow));
        }

        // Filter by search term
        if (searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(sprinkler => {
                // Search in name
                const nameMatch = sprinkler.name?.toLowerCase().includes(searchLower);
                
                // Search in product code
                const productCodeMatch = sprinkler.productCode?.toLowerCase().includes(searchLower);
                
                // Search in flow rate
                const flowRateStr = formatValueForSearch(sprinkler.waterVolumeLitersPerMinute);
                const flowRateMatch = flowRateStr.includes(searchLower);
                
                // Search in pressure
                const pressureStr = formatValueForSearch(sprinkler.pressureBar);
                const pressureMatch = pressureStr.includes(searchLower);
                
                // Search in radius
                const radiusStr = formatValueForSearch(sprinkler.radiusMeters);
                const radiusMatch = radiusStr.includes(searchLower);
                
                return nameMatch || productCodeMatch || flowRateMatch || pressureMatch || radiusMatch;
            });
        }

        // Sort: selected sprinkler first
        if (selectedSprinkler) {
            filtered = filtered.sort((a, b) => {
                if (a.id === selectedSprinkler.id) return -1;
                if (b.id === selectedSprinkler.id) return 1;
                return 0;
            });
        }

        return filtered;
    };

    // Load saved state from localStorage
    const loadSavedState = () => {
        try {
            const savedState = localStorage.getItem('sprinklerConfigModalState');
            if (savedState) {
                return JSON.parse(savedState);
            }
        } catch (error) {
            console.error('Error loading saved state:', error);
        }
        return null;
    };

    // Save state to localStorage
    const saveState = (mode: 'manual' | 'database', sprinklerId: number | null) => {
        try {
            localStorage.setItem('sprinklerConfigModalState', JSON.stringify({
                inputMode: mode,
                selectedSprinklerId: sprinklerId,
            }));
        } catch (error) {
            console.error('Error saving state:', error);
        }
    };

    useEffect(() => {
        if (isOpen) {
            const savedState = loadSavedState();
            const existingConfig = loadSprinklerConfig();
            
            // Restore input mode
            if (savedState?.inputMode) {
                setInputMode(savedState.inputMode);
            }
            
            // ใช้ flowLitersPerMinute จากพืชที่เลือกถ้ามี หรือใช้ค่าจาก config ที่บันทึกไว้ หรือค่า default
            const flowRateFromPlant = selectedPlantType?.flowLitersPerMinute;
            const flowRateToUse = flowRateFromPlant 
                ? flowRateFromPlant.toString()
                : (existingConfig 
                    ? existingConfig.flowRatePerMinute.toString()
                    : DEFAULT_SPRINKLER_CONFIG.flowRatePerMinute.toString());
            
            if (existingConfig) {
                setFormData({
                    flowRatePerMinute: flowRateToUse,
                    pressureBar: existingConfig.pressureBar.toString(),
                    sprinklersPerTree: (existingConfig.sprinklersPerTree || 1).toString(),
                });
            } else {
                setFormData({
                    flowRatePerMinute: flowRateToUse,
                    pressureBar: DEFAULT_SPRINKLER_CONFIG.pressureBar.toString(),
                    sprinklersPerTree: DEFAULT_SPRINKLER_CONFIG.sprinklersPerTree.toString(),
                });
            }
            setErrors({});
            
            // Reset database mode states (will be restored after fetching)
            setSelectedSprinkler(null);
            setShowAllSprinklers(false);
            setSearchTerm('');
        }
    }, [isOpen, selectedPlantType]);

    useEffect(() => {
        if (isOpen && inputMode === 'database') {
            fetchSprinklers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, inputMode]);

    // Save state when inputMode or selectedSprinkler changes
    useEffect(() => {
        if (isOpen) {
            saveState(inputMode, selectedSprinkler?.id || null);
        }
    }, [isOpen, inputMode, selectedSprinkler]);

    const handleInputChange = (field: keyof SprinklerFormData, value: string) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));

        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleSprinklerSelect = (sprinkler: SprinklerEquipment) => {
        // ถ้าเลือกรายการเดิมอีกครั้ง ให้ยกเลิกการเลือก
        if (selectedSprinkler?.id === sprinkler.id) {
            setSelectedSprinkler(null);
            return;
        }
        
        setSelectedSprinkler(sprinkler);
        
        // Extract flow rate
        let flowRate = 0;
        if (sprinkler.waterVolumeLitersPerMinute) {
            if (Array.isArray(sprinkler.waterVolumeLitersPerMinute)) {
                flowRate = (sprinkler.waterVolumeLitersPerMinute[0] + sprinkler.waterVolumeLitersPerMinute[1]) / 2;
            } else {
                flowRate = sprinkler.waterVolumeLitersPerMinute;
            }
        }
        
        // Extract pressure
        let pressure = 0;
        if (sprinkler.pressureBar) {
            if (Array.isArray(sprinkler.pressureBar)) {
                pressure = (sprinkler.pressureBar[0] + sprinkler.pressureBar[1]) / 2;
            } else {
                pressure = sprinkler.pressureBar;
            }
        }
        
        setFormData({
            flowRatePerMinute: flowRate > 0 ? flowRate.toString() : formData.flowRatePerMinute,
            pressureBar: pressure > 0 ? pressure.toString() : formData.pressureBar,
            sprinklersPerTree: formData.sprinklersPerTree,
        });
    };

    const handleSave = async () => {
        // If in database mode and no sprinkler selected, validate form data
        if (inputMode === 'database' && !selectedSprinkler) {
            setErrors({ general: 'กรุณาเลือกสปริงเกอร์จากรายการ' });
            return;
        }

        const validation = validateSprinklerConfig(formData);

        if (!validation.isValid) {
            setErrors(validation.errors);
            return;
        }

        setIsLoading(true);

        try {
            const config = {
                flowRatePerMinute: parseFloat(formData.flowRatePerMinute),
                pressureBar: parseFloat(formData.pressureBar),
                sprinklersPerTree: parseFloat(formData.sprinklersPerTree || '1'),
            };

            const saved = saveSprinklerConfig(config);

            if (saved) {
                // If in database mode and has selected sprinkler, save it for SprinklerSelector
                if (inputMode === 'database' && selectedSprinkler) {
                    try {
                        localStorage.setItem('horticulture_defaultSprinkler', JSON.stringify(selectedSprinkler));
                    } catch (error) {
                        console.error('Error saving default sprinkler:', error);
                    }
                }
                
                onSave(formData);
                onClose();
            } else {
                setErrors({ general: 'ไม่สามารถบันทึกข้อมูลได้' });
            }
        } catch (error) {
            console.error('Error saving sprinkler config:', error);
            setErrors({ general: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-gray-800 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white p-6 pb-4 mb-0">
                    <div>
                        <h2 className="text-2xl font-bold text-white">🚿 ตั้งค่าหัวฉีดน้ำ</h2>
                        {/* Input Mode Selection */}
                    <div className="space-y-3 mt-2">
                        <div className="flex gap-4">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="inputMode"
                                    value="manual"
                                    checked={inputMode === 'manual'}
                                    onChange={(e) => setInputMode(e.target.value as 'manual' | 'database')}
                                    className="mr-2 h-4 w-4 text-blue-600"
                                />
                                <span className="text-white">ตัวเลือกที่ 1: กรอกข้อมูลเอง</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="inputMode"
                                    value="database"
                                    checked={inputMode === 'database'}
                                    onChange={(e) => setInputMode(e.target.value as 'manual' | 'database')}
                                    className="mr-2 h-4 w-4 text-blue-600"
                                />
                                <span className="text-white">ตัวเลือกที่ 2: เลือกจากฐานข้อมูล</span>
                            </label>
                        </div>
                    </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="rounded-full p-2 text-white transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                    >
                        <svg
                            className="h-6 w-6 text-white"
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

                <div className="space-y-3 p-6 pt-3">
                    {errors.general && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-white">
                            <div className="flex">
                                <svg
                                    className="h-5 w-5 text-red-400"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <div className="ml-3">
                                    <p className="text-sm text-red-800">{errors.general}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    

                    {/* Manual Input Mode */}
                    {inputMode === 'manual' && (
                        <>
                            {/* Form Fields */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {/* อัตราการไหลต่อนาที */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-white">
                                💧 อัตราการไหลต่อนาที
                                <span className="ml-1 text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]*\\.?[0-9]*"
                                    value={formData.flowRatePerMinute ?? ''}
                                    onChange={(e) =>
                                        handleInputChange('flowRatePerMinute', e.target.value)
                                    }
                                    className={`w-full rounded-lg border px-4 py-3 pr-16 text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                                        errors.flowRatePerMinute ? 'border-red-300' : 'border-white'
                                    }`}
                                    placeholder="2.5"
                                    autoComplete="off"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <span className="text-sm text-black">ลิตร/นาที</span>
                                </div>
                            </div>
                            {errors.flowRatePerMinute && (
                                <p className="text-sm text-red-600">{errors.flowRatePerMinute}</p>
                            )}
                            <p className="text-xs text-white">
                                ปริมาณน้ำที่หัวฉีดหนึ่งตัวให้ได้ต่อนาที
                            </p>
                        </div>

                        {/* แรงดัน */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-white">
                                ⚡ แรงดันน้ำ
                                <span className="ml-1 text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]*\\.?[0-9]*"
                                    value={formData.pressureBar ?? ''}
                                    onChange={(e) =>
                                        handleInputChange('pressureBar', e.target.value)
                                    }
                                    className={`w-full rounded-lg border px-4 py-3 pr-12 text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                                        errors.pressureBar ? 'border-red-300' : 'border-white'
                                    }`}
                                    placeholder="2.5"
                                    autoComplete="off"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <span className="text-sm text-black">บาร์</span>
                                </div>
                            </div>
                            {errors.pressureBar && (
                                <p className="text-sm text-red-600">{errors.pressureBar}</p>
                            )}
                            <p className="text-xs text-white">แรงดันน้ำที่ใช้ในการฉีด</p>
                        </div>

                        {/* จำนวนสปริงเกอร์ต่อต้นไม้ */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-white">
                                🚿 จำนวนสปริงเกอร์ต่อต้นไม้
                                <span className="ml-1 text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={formData.sprinklersPerTree ?? '1'}
                                    onChange={(e) =>
                                        handleInputChange('sprinklersPerTree', e.target.value)
                                    }
                                    className={`w-full rounded-lg border px-4 py-3 pr-12 text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                                        errors.sprinklersPerTree ? 'border-red-300' : 'border-white'
                                    }`}
                                    placeholder="1"
                                    autoComplete="off"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <span className="text-sm text-black">หัว/ต้น</span>
                                </div>
                            </div>
                            {errors.sprinklersPerTree && (
                                <p className="text-sm text-red-600">{errors.sprinklersPerTree}</p>
                            )}
                            <p className="text-xs text-white">จำนวนหัวฉีดที่ใช้ต่อต้นไม้ 1 ต้น</p>
                        </div>
                    </div>
                        </>
                    )}

                    {/* Database Selection Mode */}
                    {inputMode === 'database' && (
                        <div className="space-y-4">
                            

                            {/* Search Box + Sprinklers Per Tree Input in one row */}
                            <div className="flex flex-col md:flex-row md:items-end md:space-x-4 space-y-4 md:space-y-0">
                                {/* Search Box */}
                                <div className="space-y-2 flex-1 md:max-w-[70%]">
                                    <label className="block text-sm font-medium text-white">
                                        🔍 ค้นหาสปริงเกอร์
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full rounded-lg border border-white px-4 py-3 pl-10 pr-4 text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                            placeholder="ค้นหาจากชื่อ, รหัสสินค้า, อัตราการไหล, รัศมี, แรงดัน..."
                                            autoComplete="off"
                                        />
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                            >
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Sprinklers Per Tree Input */}
                                <div className="space-y-2 w-full md:w-[30%]">
                                    <label className="block text-sm font-medium text-white">
                                        🚿 สปริงเกอร์/ 1 ต้น
                                        <span className="ml-1 text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={formData.sprinklersPerTree ?? '1'}
                                            onChange={(e) =>
                                                handleInputChange('sprinklersPerTree', e.target.value)
                                            }
                                            className={`w-full rounded-lg border px-4 py-3 pr-12 text-black focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                                                errors.sprinklersPerTree ? 'border-red-300' : 'border-white'
                                            }`}
                                            placeholder="1"
                                            autoComplete="off"
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            <span className="text-sm text-black">หัว/ต้น</span>
                                        </div>
                                    </div>
                                    {errors.sprinklersPerTree && (
                                        <p className="text-sm text-red-600">{errors.sprinklersPerTree}</p>
                                    )}
                                </div>
                            </div>

                            {/* Sprinklers List */}
                            {loadingSprinklers ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                    <span className="ml-3 text-white">กำลังโหลดข้อมูลสปริงเกอร์...</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                    <div className="text-sm text-white">
                                        {showAllSprinklers 
                                            ? `แสดงสปริงเกอร์ทั้งหมด (${sprinklers.length} รายการ)`
                                            : selectedPlantType?.flowLitersPerMinute
                                                ? `แสดงสปริงเกอร์ที่ตรงกับอัตราการไหล ${selectedPlantType.flowLitersPerMinute} ลิตร/นาที (${getFilteredSprinklers().length} รายการ)`
                                                : `แสดงสปริงเกอร์ทั้งหมด (${sprinklers.length} รายการ)`
                                        }
                                    </div>
                                    {/* Show All Checkbox */}
                            {selectedPlantType?.flowLitersPerMinute && (
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="showAllSprinklers"
                                        checked={showAllSprinklers}
                                        onChange={(e) => setShowAllSprinklers(e.target.checked)}
                                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor="showAllSprinklers" className="ml-2 text-sm text-white">
                                        แสดงสปริงเกอร์ทั้งหมด
                                    </label>
                                </div>
                            )}
                                    </div>
                                    
                                    {getFilteredSprinklers().length === 0 ? (
                                        <div className="text-center py-8 text-white">
                                            <p>ไม่พบสปริงเกอร์ที่ตรงตามเงื่อนไข</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-[150px] overflow-y-auto border border-gray-600 rounded-lg p-2">
                                            {getFilteredSprinklers().map((sprinkler) => {
                                                const isSelected = selectedSprinkler?.id === sprinkler.id;
                                                const flowRate = Array.isArray(sprinkler.waterVolumeLitersPerMinute)
                                                    ? `${sprinkler.waterVolumeLitersPerMinute[0]} - ${sprinkler.waterVolumeLitersPerMinute[1]} ลิตร/นาที`
                                                    : sprinkler.waterVolumeLitersPerMinute 
                                                        ? `${sprinkler.waterVolumeLitersPerMinute} ลิตร/นาที`
                                                        : '-';
                                                const pressure = Array.isArray(sprinkler.pressureBar)
                                                    ? `${sprinkler.pressureBar[0]} - ${sprinkler.pressureBar[1]} บาร์`
                                                    : sprinkler.pressureBar 
                                                        ? `${sprinkler.pressureBar} บาร์`
                                                        : '-';
                                                const radius = Array.isArray(sprinkler.radiusMeters)
                                                    ? `${sprinkler.radiusMeters[0]} - ${sprinkler.radiusMeters[1]} เมตร`
                                                    : sprinkler.radiusMeters 
                                                        ? `${sprinkler.radiusMeters} เมตร`
                                                        : '-';

                                                return (
                                                    <div
                                                        key={sprinkler.id}
                                                        onClick={() => handleSprinklerSelect(sprinkler)}
                                                        className={`cursor-pointer rounded-lg border-2 p-2 transition-all ${
                                                            isSelected
                                                                ? 'border-blue-500 bg-blue-900 bg-opacity-30'
                                                                : 'border-gray-600 bg-gray-800 hover:border-gray-400'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            {/* Image */}
                                                            <div className="flex-shrink-0">
                                                                {sprinkler.image ? (
                                                                    <img
                                                                        src={sprinkler.image}
                                                                        alt={sprinkler.name}
                                                                        className="h-12 w-12 rounded-lg object-cover border border-gray-600"
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div className="h-12 w-12 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center">
                                                                        <svg className="h-6 w-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                        </svg>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Content */}
                                                            <div className="flex-1 min-w-0">
                                                                {/* Name */}
                                                                <h3 className="mb-1 text-xs font-semibold text-white line-clamp-2">
                                                                   [{sprinkler.productCode}] - {sprinkler.name}
                                                                </h3>

                                                                {/* Details */}
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-gray-400 text-xs mb-1">อัตราการไหล</span>
                                                                        <span className="font-medium text-white">
                                                                            {flowRate}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-gray-400 text-xs mb-1">แรงดัน</span>
                                                                        <span className="font-medium text-white">
                                                                            {pressure}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-gray-400 text-xs mb-1">รัศมี</span>
                                                                        <span className="font-medium text-white">
                                                                            {radius}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Selected Indicator */}
                                                                {isSelected && (
                                                                    <div className="mt-3 flex items-center text-blue-400">
                                                                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                        </svg>
                                                                        <span className="ml-2 text-sm font-medium">เลือกแล้ว</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Real-time Statistics */}
                    <div className="rounded-xl border border-blue-300 bg-gradient-to-br from-blue-900 to-indigo-900 p-3 text-white shadow-lg">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {/* จำนวนต้นไม้ */}
                            <div className="rounded-lg bg-white bg-opacity-10 p-4 text-center backdrop-blur-sm">
                                <div className="text-2xl font-bold text-green-400">
                                    {plantCount.toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-300">ต้นไม้ทั้งหมด</div>
                            </div>

                            {/* จำนวนหัวฉีดทั้งหมด */}
                            <div className="rounded-lg bg-white bg-opacity-10 p-4 text-center backdrop-blur-sm">
                                <div className="text-2xl font-bold text-yellow-400">
                                    {(
                                        plantCount * (parseFloat(formData.sprinklersPerTree) || 1)
                                    ).toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-300">หัวฉีดทั้งหมด</div>
                            </div>

                            {/* Q หัวฉีด */}
                            <div className="rounded-lg bg-white bg-opacity-10 p-4 text-center backdrop-blur-sm">
                                <div className="text-2xl font-bold text-blue-400">
                                    {formData.flowRatePerMinute || '0'}
                                </div>
                                <div className="text-xs text-gray-300">ลิตร/นาที/หัว</div>
                            </div>

                            {/* ความต้องการน้ำรวม */}
                            <div className="rounded-lg bg-white bg-opacity-10 p-4 text-center backdrop-blur-sm">
                                <div className="text-2xl font-bold text-cyan-400">
                                    {(
                                        (parseFloat(formData.flowRatePerMinute) || 0) *
                                        plantCount *
                                        (parseFloat(formData.sprinklersPerTree) || 1)
                                    ).toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-300">ลิตร/นาที</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-gray-200 bg-gray-900 p-6 text-white">
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                    >
                        {isLoading ? (
                            <div className="flex items-center">
                                <svg
                                    className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                กำลังบันทึก...
                            </div>
                        ) : (
                            <>💾 บันทึกการตั้งค่า</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SprinklerConfigModal;
