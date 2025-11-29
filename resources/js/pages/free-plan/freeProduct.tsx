// 1. Import
import { useState, useEffect, useRef, useCallback } from 'react';
import { Head, router } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import {
    calculatePipeRecommendations,
    calculatePipeRecommendationsWithTypes,
    PipeRecommendations,
    PipeTypeRecommendations,
} from './utils/pipeSelection';
import { calculatePumpRequirements, PumpRecommendation } from './utils/pumpSelection';
import { getTranslations } from './utils/language';
import { getPlantImagePath } from './utils/freeCrop';

// 2. Component
function FreeProduct() {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<unknown>(null);
    const [zones, setZones] = useState<
        Array<{
            id: number;
            name: string;
            color: string;
            area?: number;
            plants?: number;
            mainMeters?: number;
            subMainMeters?: number;
            lateralMeters?: number;
            mainOutlets?: number;
            subMainOutlets?: number;
            lateralOutlets?: number;
            lpm?: number;
        }>
    >([]);
    const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
    const [showZoneDropdown, setShowZoneDropdown] = useState(false);
    const [selectedPipeZoneId, setSelectedPipeZoneId] = useState<number | null>(null);
    const [showPipeZoneDropdown, setShowPipeZoneDropdown] = useState(false);
    const [selectedPumpZoneId, setSelectedPumpZoneId] = useState<'all' | 'single' | null>(null);
    const [showPumpZoneDropdown, setShowPumpZoneDropdown] = useState(false);
    const [showPumpCalculationDetails, setShowPumpCalculationDetails] = useState(false);
    const [sprinklerSpecs, setSprinklerSpecs] = useState<{
        flowRatePerMin: number;
        waterPressure: number;
        radius: number;
        totalLPM: number;
    } | null>(null);
    const [sprinklerMode, setSprinklerMode] = useState<'preset' | 'calculated'>('preset');
    const [calculatedSprinklerSpecs, setCalculatedSprinklerSpecs] = useState<{
        flowRatePerMin: number;
        waterPressure: number;
        radius: number;
        totalLPM: number;
        calculationDetails?: {
            step1: {
                irrigationTimeMinutes: number;
                totalWaterVolumeLiters: number;
                areaSquareMeters: number;
                waterDepthMm: number;
            };
            step2: {
                irrigationRateMmPerHour: number;
            };
            step3: {
                plantDensity: number;
                optimalRadius: number;
                sprinklerSpacing: number;
                totalSprinklers: number;
            };
            step4: {
                sprinklerCoverageArea: number;
                sprinklerFlowRateLPH: number;
                sprinklerFlowRateLPM: number;
            };
            step5: {
                requiredPressure: number;
                pressureCategory: string;
            };
            zoneInfo: {
                zoneName: string;
                zoneArea: number;
                zonePlants: number;
                zoneLPM: number;
            };
        };
    } | null>(null);
    const [pipeRecommendations, setPipeRecommendations] = useState<PipeRecommendations | null>(
        null
    );
    const [pipeTypeRecommendations, setPipeTypeRecommendations] =
        useState<PipeTypeRecommendations | null>(null);
    const [pumpRecommendations, setPumpRecommendations] = useState<PumpRecommendation | null>(null);
    const [summaryData, setSummaryData] = useState<{
        area?: { totalRai?: number; byZone?: Array<{ zoneId: number; areaRai: number }> };
        plants?: { total?: number; byZone?: Array<{ zoneId: number; plants: number }> };
        pipes?: {
            byZone?: Array<{
                zoneId: number;
                mainMeters: number;
                subMainMeters: number;
                lateralMeters: number;
                mainOutlets?: number;
                subMainOutlets?: number;
                lateralOutlets?: number;
            }>;
        };
        flowRate?: {
            totalLPM?: number;
            flowRatePerMin?: number;
            waterPressure?: number;
            radius?: number;
            byZone?: Array<{ zoneId: number; lpm: number }>;
        };
        selectedPlant?: {
            name: string;
            waterNeed: number;
            plantSpacing: number;
            rowSpacing: number;
            icon: string;
        };
    } | null>(null);
    const [translations, setTranslations] = useState(getTranslations());
    const [longestPipes, setLongestPipes] = useState<{
        [zoneId: number]: {
            longestMain: number;
            longestSubMain: number;
            longestLateral: number;
        };
    }>({});

    // Function to calculate distance between two points
    const calculateDistance = (
        point1: { lat: number; lng: number },
        point2: { lat: number; lng: number }
    ) => {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = (point1.lat * Math.PI) / 180;
        const φ2 = (point2.lat * Math.PI) / 180;
        const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
        const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    };

    // Function to calculate longest pipe lengths and flow rates for each zone
    const calculateLongestPipes = useCallback(() => {
        const longestPipesData: {
            [zoneId: number]: {
                longestMain: number;
                longestSubMain: number;
                longestLateral: number;
                // Flow rates for longest pipes
                lateralLongestFlowRate?: number; // Flow rate ที่ lateral ที่ยาวที่สุดรับ
                subMainLongestFlowRate?: number; // Flow rate รวมที่ subMain ที่ยาวที่สุดรับ
                mainLongestFlowRate?: number; // Flow rate รวมที่ main ที่ยาวที่สุดรับ
            };
        } = {};

        // Get pipe data from localStorage
        const mainPipes = localStorage.getItem('mainPipes');
        const subMainPipes = localStorage.getItem('subMainPipes');
        const lateralPipes = localStorage.getItem('lateralPipes');

        if (mainPipes) {
            try {
                const mainPipesData = JSON.parse(mainPipes);
                mainPipesData.forEach(
                    (pipe: {
                        zoneId?: number;
                        fromPump: { lat: number; lng: number };
                        toZoneCenter: { lat: number; lng: number };
                    }) => {
                        if (pipe.zoneId !== undefined) {
                            if (!longestPipesData[pipe.zoneId]) {
                                longestPipesData[pipe.zoneId] = {
                                    longestMain: 0,
                                    longestSubMain: 0,
                                    longestLateral: 0,
                                };
                            }
                            const length = calculateDistance(pipe.fromPump, pipe.toZoneCenter);
                            if (length > longestPipesData[pipe.zoneId].longestMain) {
                                longestPipesData[pipe.zoneId].longestMain = length;
                            }
                        }
                    }
                );
            } catch (error) {
                console.error('Error parsing main pipes:', error);
            }
        }

        if (subMainPipes) {
            try {
                const subMainPipesData = JSON.parse(subMainPipes);
                subMainPipesData.forEach(
                    (pipe: { zoneId?: number; path: Array<{ lat: number; lng: number }> }) => {
                        if (pipe.zoneId !== undefined) {
                            if (!longestPipesData[pipe.zoneId]) {
                                longestPipesData[pipe.zoneId] = {
                                    longestMain: 0,
                                    longestSubMain: 0,
                                    longestLateral: 0,
                                };
                            }
                            let totalLength = 0;
                            for (let i = 0; i < pipe.path.length - 1; i++) {
                                totalLength += calculateDistance(pipe.path[i], pipe.path[i + 1]);
                            }
                            if (totalLength > longestPipesData[pipe.zoneId].longestSubMain) {
                                longestPipesData[pipe.zoneId].longestSubMain = totalLength;
                            }
                        }
                    }
                );
            } catch (error) {
                console.error('Error parsing sub-main pipes:', error);
            }
        }

        if (lateralPipes) {
            try {
                const lateralPipesData = JSON.parse(lateralPipes);
                lateralPipesData.forEach(
                    (pipe: { zoneId?: number; path: Array<{ lat: number; lng: number }> }) => {
                        if (pipe.zoneId !== undefined) {
                            if (!longestPipesData[pipe.zoneId]) {
                                longestPipesData[pipe.zoneId] = {
                                    longestMain: 0,
                                    longestSubMain: 0,
                                    longestLateral: 0,
                                };
                            }
                            let totalLength = 0;
                            for (let i = 0; i < pipe.path.length - 1; i++) {
                                totalLength += calculateDistance(pipe.path[i], pipe.path[i + 1]);
                            }
                            if (totalLength > longestPipesData[pipe.zoneId].longestLateral) {
                                longestPipesData[pipe.zoneId].longestLateral = totalLength;
                            }
                        }
                    }
                );
            } catch (error) {
                console.error('Error parsing lateral pipes:', error);
            }
        }

        return longestPipesData;
    }, []);

    // Function to calculate flow rates for longest pipes
    const calculateLongestPipeFlowRates = useCallback(
        (
            zoneId: number,
            lateralFlowRatePerSprinkler: number,
            zoneData: {
                lateralOutlets?: number; // จำนวน sprinklers ใน lateral ที่ยาวที่สุด
                subMainOutlets?: number; // จำนวน lateral ที่เชื่อมกับ subMain ที่ยาวที่สุด
                mainOutlets?: number; // จำนวน subMain ที่เชื่อมกับ main ที่ยาวที่สุด
            }
        ) => {
            // 1. Lateral ที่ยาวที่สุด: รับ flow rate จาก sprinklers ใน lateral line นั้น
            const lateralLongestFlowRate =
                lateralFlowRatePerSprinkler * (zoneData.lateralOutlets || 1);

            // 2. SubMain ที่ยาวที่สุด: รับ flow rate รวมจาก lateral ทั้งหมดที่เชื่อมกับมัน
            const subMainLongestFlowRate = lateralLongestFlowRate * (zoneData.subMainOutlets || 1);

            // 3. Main ที่ยาวที่สุด: รับ flow rate รวมจาก subMain ทั้งหมดที่เชื่อมกับมัน
            const mainLongestFlowRate = subMainLongestFlowRate * (zoneData.mainOutlets || 1);

            return {
                lateralLongestFlowRate,
                subMainLongestFlowRate,
                mainLongestFlowRate,
            };
        },
        []
    );

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

    const handleBack = () => router.visit('/free-plan/summary');
    const handleCheckout = () => {
        // Save current recommendations to localStorage for checkout page
        if (pipeRecommendations) {
            localStorage.setItem('pipeRecommendations', JSON.stringify(pipeRecommendations));
        }
        if (pipeTypeRecommendations) {
            localStorage.setItem(
                'pipeTypeRecommendations',
                JSON.stringify(pipeTypeRecommendations)
            );
        }
        if (pumpRecommendations) {
            localStorage.setItem('pumpRecommendations', JSON.stringify(pumpRecommendations));
        }
        if (calculatedSprinklerSpecs) {
            localStorage.setItem(
                'calculatedSprinklerSpecs',
                JSON.stringify(calculatedSprinklerSpecs)
            );
        }
        localStorage.setItem('sprinklerMode', sprinklerMode);

        router.visit('/free-plan/checkout');
    };

    // Function to find zone with highest flow rate
    const findHighestFlowRateZone = (
        zones: Array<{
            id: number;
            name: string;
            lpm?: number;
            area?: number;
            plants?: number;
        }>
    ) => {
        if (zones.length === 0) return null;

        return zones.reduce((highest, current) => {
            const currentLpm = current.lpm || 0;
            const highestLpm = highest.lpm || 0;
            return currentLpm > highestLpm ? current : highest;
        });
    };

    // Function to calculate sprinkler specifications using 5-step calculation method
    const calculateSprinklerSpecsFromWaterVolume = (
        zones: Array<{ area?: number; plants?: number; lpm?: number; name?: string }>
    ) => {
        if (zones.length === 0) return null;

        // Find zone with highest water consumption (LPM)
        const highestFlowZone = zones.reduce((highest, current) => {
            const currentLpm = current.lpm || 0;
            const highestLpm = highest.lpm || 0;
            return currentLpm > highestLpm ? current : highest;
        });

        if (!highestFlowZone || !highestFlowZone.area || highestFlowZone.area <= 0) {
            return null;
        }

        // Step 1: Convert water volume to depth (mm)
        // Assume irrigation time of 30 minutes per session
        const irrigationTimeMinutes = 30;
        const totalWaterVolumeLiters = (highestFlowZone.lpm || 0) * irrigationTimeMinutes;
        const areaSquareMeters = highestFlowZone.area * 1600; // Convert rai to sqm
        const waterDepthMm = (totalWaterVolumeLiters / areaSquareMeters) * 1000; // Convert to mm

        // Step 2: Calculate required irrigation rate (mm/hour)
        const irrigationRateMmPerHour = waterDepthMm / (irrigationTimeMinutes / 60);

        // Step 3: Design sprinkler layout
        // Calculate optimal radius based on plant density and zone shape
        const plantDensity = (highestFlowZone.plants || 0) / highestFlowZone.area; // plants per rai
        let optimalRadius = 4.0; // Default radius in meters

        if (plantDensity > 100) {
            optimalRadius = 3.0; // High density - smaller radius for precise watering
        } else if (plantDensity > 50) {
            optimalRadius = 4.0; // Medium density - standard radius
        } else {
            optimalRadius = 5.0; // Low density - larger radius for coverage
        }

        // Calculate sprinkler spacing (typically equal to radius for optimal coverage)
        const sprinklerSpacing = optimalRadius;

        // Step 4: Calculate flow rate per sprinkler
        const sprinklerCoverageArea = Math.PI * Math.pow(optimalRadius, 2); // m²
        const sprinklerFlowRateLPH = (irrigationRateMmPerHour * sprinklerCoverageArea) / 1000; // LPH
        const sprinklerFlowRateLPM = sprinklerFlowRateLPH / 60; // LPM

        // Step 5: Determine pressure from catalog specifications
        // Based on radius and flow rate, determine required pressure
        let requiredPressure = 2.0; // Default pressure in Bar

        if (optimalRadius >= 5.0 && sprinklerFlowRateLPM >= 2.0) {
            requiredPressure = 2.5; // High pressure for large radius and high flow
        } else if (optimalRadius >= 4.0 && sprinklerFlowRateLPM >= 1.5) {
            requiredPressure = 2.2; // Medium-high pressure
        } else if (optimalRadius >= 3.0 && sprinklerFlowRateLPM >= 1.0) {
            requiredPressure = 1.8; // Medium pressure
        } else {
            requiredPressure = 1.5; // Low pressure for small radius and low flow
        }

        // Calculate total system flow rate
        const totalSprinklers = Math.ceil(areaSquareMeters / sprinklerCoverageArea);
        const totalLPM = totalSprinklers * sprinklerFlowRateLPM;

        return {
            // Basic specs
            flowRatePerMin: sprinklerFlowRateLPM,
            waterPressure: requiredPressure,
            radius: optimalRadius,
            totalLPM: totalLPM,

            // Detailed calculation results
            calculationDetails: {
                // Step 1: Water depth calculation
                step1: {
                    irrigationTimeMinutes,
                    totalWaterVolumeLiters,
                    areaSquareMeters,
                    waterDepthMm: Math.round(waterDepthMm * 10) / 10,
                },

                // Step 2: Irrigation rate
                step2: {
                    irrigationRateMmPerHour: Math.round(irrigationRateMmPerHour * 10) / 10,
                },

                // Step 3: Sprinkler layout
                step3: {
                    plantDensity: Math.round(plantDensity * 10) / 10,
                    optimalRadius,
                    sprinklerSpacing,
                    totalSprinklers,
                },

                // Step 4: Flow rate per sprinkler
                step4: {
                    sprinklerCoverageArea: Math.round(sprinklerCoverageArea * 10) / 10,
                    sprinklerFlowRateLPH: Math.round(sprinklerFlowRateLPH * 10) / 10,
                    sprinklerFlowRateLPM: Math.round(sprinklerFlowRateLPM * 100) / 100,
                },

                // Step 5: Pressure requirements
                step5: {
                    requiredPressure,
                    pressureCategory:
                        requiredPressure >= 2.5
                            ? 'High'
                            : requiredPressure >= 2.0
                              ? 'Medium-High'
                              : requiredPressure >= 1.5
                                ? 'Medium'
                                : 'Low',
                },

                // Zone information
                zoneInfo: {
                    zoneName: highestFlowZone.name || 'Highest Flow Zone',
                    zoneArea: highestFlowZone.area,
                    zonePlants: highestFlowZone.plants || 0,
                    zoneLPM: highestFlowZone.lpm || 0,
                },
            },
        };
    };

    // Legacy function for backward compatibility
    const calculateOptimalSprinklerSpecs = useCallback(
        (zones: Array<{ area?: number; plants?: number; lpm?: number; name?: string }>) => {
            return calculateSprinklerSpecsFromWaterVolume(zones);
        },
        []
    );

    // Load zone data from localStorage
    useEffect(() => {
        const savedZones = localStorage.getItem('zones');
        const savedSummary = localStorage.getItem('freePlanSummary');

        if (savedZones) {
            try {
                const zonesData = JSON.parse(savedZones) as Array<{
                    id: number;
                    name: string;
                    color: string;
                }>;

                // Get additional data from summary
                let summaryData: {
                    area?: {
                        totalRai?: number;
                        byZone?: Array<{ zoneId: number; areaRai: number }>;
                    };
                    plants?: { total?: number; byZone?: Array<{ zoneId: number; plants: number }> };
                    pipes?: {
                        byZone?: Array<{
                            zoneId: number;
                            mainMeters: number;
                            subMainMeters: number;
                            lateralMeters: number;
                            mainOutlets?: number;
                            subMainOutlets?: number;
                            lateralOutlets?: number;
                        }>;
                    };
                    flowRate?: {
                        totalLPM?: number;
                        flowRatePerMin?: number;
                        waterPressure?: number;
                        radius?: number;
                        byZone?: Array<{ zoneId: number; lpm: number }>;
                    };
                } | null = null;
                if (savedSummary) {
                    try {
                        summaryData = JSON.parse(savedSummary);
                        setSummaryData(summaryData);
                    } catch {
                        // ignore parse error
                    }
                }

                // Get flow rate config for calculation
                const savedFlowRateConfig = localStorage.getItem('flowRateConfig');
                let flowRateConfig = {
                    flowRatePerMin: 2.5,
                    waterPressure: 2.0,
                    radius: 4.0,
                };
                if (savedFlowRateConfig) {
                    try {
                        const config = JSON.parse(savedFlowRateConfig);
                        flowRateConfig = {
                            flowRatePerMin: config.flowRatePerMin || 2.5,
                            waterPressure: config.waterPressure || 2.0,
                            radius: config.radius || 4.0,
                        };
                    } catch {
                        // use default
                    }
                }

                const zonesWithData = zonesData.map((zone) => {
                    const areaData = summaryData?.area?.byZone?.find((z) => z.zoneId === zone.id);
                    const plantData = summaryData?.plants?.byZone?.find(
                        (z) => z.zoneId === zone.id
                    );
                    const pipeData = summaryData?.pipes?.byZone?.find((z) => z.zoneId === zone.id);
                    const flowData = summaryData?.flowRate?.byZone?.find(
                        (z) => z.zoneId === zone.id
                    );

                    // Calculate LPM if not available in flowData
                    const calculatedLpm =
                        flowData?.lpm || (plantData?.plants || 0) * flowRateConfig.flowRatePerMin;

                    return {
                        ...zone,
                        area: areaData?.areaRai || 0,
                        plants: plantData?.plants || 0,
                        mainMeters: pipeData?.mainMeters || 0,
                        subMainMeters: pipeData?.subMainMeters || 0,
                        lateralMeters: pipeData?.lateralMeters || 0,
                        mainOutlets: pipeData?.mainOutlets || 0,
                        subMainOutlets: pipeData?.subMainOutlets || 0,
                        lateralOutlets: pipeData?.lateralOutlets || 0,
                        lpm: calculatedLpm,
                    };
                });

                console.log('Zones with data:', zonesWithData);
                console.log('Flow rate config:', flowRateConfig);
                console.log('Summary data:', summaryData);

                // Display sprinkler specifications
                console.log('=== SPRINKLER SPECIFICATIONS ===');
                console.log('Flow Rate per Plant:', flowRateConfig.flowRatePerMin, 'LPM');
                console.log('Water Pressure:', flowRateConfig.waterPressure, 'Bar');
                console.log('Sprinkler Radius:', flowRateConfig.radius, 'm');
                console.log('Total Plants:', summaryData?.plants?.total || 0);
                console.log(
                    'Total Flow Rate:',
                    (summaryData?.plants?.total || 0) * flowRateConfig.flowRatePerMin,
                    'LPM'
                );
                console.log('===============================');

                setZones(zonesWithData);
                if (zonesWithData.length > 0) {
                    setSelectedZoneId(zonesWithData[0].id);
                    setSelectedPipeZoneId(zonesWithData[0].id);
                    setSelectedPumpZoneId('all'); // Default to show all zones
                }

                // Set sprinkler specifications - prioritize flowRateConfig over summary data
                setSprinklerSpecs({
                    flowRatePerMin: flowRateConfig.flowRatePerMin,
                    waterPressure: flowRateConfig.waterPressure,
                    radius: flowRateConfig.radius,
                    totalLPM: (summaryData?.plants?.total || 0) * flowRateConfig.flowRatePerMin,
                });

                // Calculate optimal sprinkler specifications
                const calculatedSpecs = calculateOptimalSprinklerSpecs(zonesWithData);
                setCalculatedSprinklerSpecs(calculatedSpecs);

                // Calculate pipe and pump recommendations
                const totalFlowRate =
                    (summaryData?.plants?.total || 0) * flowRateConfig.flowRatePerMin;

                // ใช้ flow rate ของ zone แรก (หรือ zone ที่เลือกไว้) สำหรับการคำนวณท่อ
                const selectedZoneForInit = zonesWithData[0] || null;
                const zoneFlowRateForPipes = selectedZoneForInit?.lpm || 0;
                const lateralFlowRate = flowRateConfig.flowRatePerMin;

                // Calculate average lengths and outlets from all zones
                const avgMainLength =
                    zonesWithData.length > 0
                        ? zonesWithData.reduce((sum, zone) => sum + (zone.mainMeters || 0), 0) /
                          zonesWithData.length
                        : 50;
                const avgSubMainLength =
                    zonesWithData.length > 0
                        ? zonesWithData.reduce((sum, zone) => sum + (zone.subMainMeters || 0), 0) /
                          zonesWithData.length
                        : 30;
                const avgLateralLength =
                    zonesWithData.length > 0
                        ? zonesWithData.reduce((sum, zone) => sum + (zone.lateralMeters || 0), 0) /
                          zonesWithData.length
                        : 20;
                const avgMainOutlets =
                    zonesWithData.length > 0
                        ? zonesWithData.reduce((sum, zone) => sum + (zone.mainOutlets || 1), 0) /
                          zonesWithData.length
                        : 1;
                const avgSubMainOutlets =
                    zonesWithData.length > 0
                        ? zonesWithData.reduce((sum, zone) => sum + (zone.subMainOutlets || 1), 0) /
                          zonesWithData.length
                        : 1;
                const avgLateralOutlets =
                    zonesWithData.length > 0
                        ? zonesWithData.reduce((sum, zone) => sum + (zone.lateralOutlets || 1), 0) /
                          zonesWithData.length
                        : 1;

                // ใช้ longest pipes ที่คำนวณไว้แล้ว
                const longestPipesData = calculateLongestPipes();
                const firstZoneId = zonesWithData[0]?.id;
                const mainLongestLength =
                    longestPipesData[firstZoneId]?.longestMain || avgMainLength;
                const subMainLongestLength =
                    longestPipesData[firstZoneId]?.longestSubMain || avgSubMainLength;
                const lateralLongestLength =
                    longestPipesData[firstZoneId]?.longestLateral || avgLateralLength;

                const pipeRecs = calculatePipeRecommendations(
                    zoneFlowRateForPipes,
                    lateralFlowRate,
                    flowRateConfig.waterPressure, // แรงดันน้ำในหน่วย Bar
                    {
                        mainLongestLength: mainLongestLength,
                        subMainLongestLength: subMainLongestLength,
                        lateralLongestLength: lateralLongestLength,
                        mainOutlets: Math.round(avgMainOutlets),
                        subMainOutlets: Math.round(avgSubMainOutlets),
                        lateralOutlets: Math.round(avgLateralOutlets),
                    }
                );
                setPipeRecommendations(pipeRecs);

                // คำนวณ flow rates สำหรับท่อที่ยาวที่สุดแต่ละประเภท
                const flowRates = calculateLongestPipeFlowRates(firstZoneId, lateralFlowRate, {
                    lateralOutlets: Math.round(avgLateralOutlets),
                    subMainOutlets: Math.round(avgSubMainOutlets),
                    mainOutlets: Math.round(avgMainOutlets),
                });

                // คำนวณทั้ง PE และ PVC
                const pipeTypeRecs = calculatePipeRecommendationsWithTypes(
                    zoneFlowRateForPipes,
                    lateralFlowRate,
                    flowRateConfig.waterPressure, // แรงดันน้ำในหน่วย Bar
                    {
                        mainLongestLength: mainLongestLength,
                        subMainLongestLength: subMainLongestLength,
                        lateralLongestLength: lateralLongestLength,
                        mainOutlets: Math.round(avgMainOutlets),
                        subMainOutlets: Math.round(avgSubMainOutlets),
                        lateralOutlets: Math.round(avgLateralOutlets),
                        // Flow rates สำหรับท่อที่ยาวที่สุด
                        lateralLongestFlowRate: flowRates.lateralLongestFlowRate,
                        subMainLongestFlowRate: flowRates.subMainLongestFlowRate,
                        mainLongestFlowRate: flowRates.mainLongestFlowRate,
                    }
                );
                setPipeTypeRecommendations(pipeTypeRecs);

                // คำนวณ pressure loss จากท่อแยกตาม PE และ PVC
                const pumpRecs = calculatePumpRequirements(
                    totalFlowRate,
                    flowRateConfig.waterPressure,
                    {
                        pe: {
                            mainLoss: pipeTypeRecs.main.pe?.pressureLoss ?? 0,
                            subMainLoss: pipeTypeRecs.subMain.pe?.pressureLoss ?? 0,
                            lateralLoss: pipeTypeRecs.lateral.pe?.pressureLoss ?? 0,
                        },
                        pvc: {
                            mainLoss: pipeTypeRecs.main.pvc?.pressureLoss ?? 0,
                            subMainLoss: pipeTypeRecs.subMain.pvc?.pressureLoss ?? 0,
                            lateralLoss: pipeTypeRecs.lateral.pvc?.pressureLoss ?? 0,
                        },
                    },
                    0, // staticHead (สามารถเพิ่มในอนาคต)
                    0.05 // minorLossFactor = 5%
                );
                setPumpRecommendations(pumpRecs);

                // Calculate longest pipes for each zone
                const longestPipesDataFinal = calculateLongestPipes();
                console.log('📏 Calculated longest pipes:', longestPipesDataFinal);
                setLongestPipes(longestPipesDataFinal);
            } catch (error) {
                console.error('Error loading zones:', error);
            }
        }
    }, [calculateOptimalSprinklerSpecs, calculateLongestPipes, calculateLongestPipeFlowRates]);

    // Update recommendations when sprinkler mode changes or zone selection changes
    useEffect(() => {
        const currentSpecs = sprinklerMode === 'preset' ? sprinklerSpecs : calculatedSprinklerSpecs;
        if (!currentSpecs || zones.length === 0) return;

        const totalFlowRate = currentSpecs.totalLPM;

        // Get selected zone data for pipe calculation - ใช้ flow rate ของ zone ที่เลือก
        const selectedZoneForPipes = selectedPipeZoneId
            ? zones.find((z) => z.id === selectedPipeZoneId)
            : zones[0];
        const zoneId = selectedPipeZoneId || zones[0]?.id;

        // ใช้ flow rate ของ zone ที่เลือกสำหรับ main และ subMain pipe
        const zoneFlowRate = selectedZoneForPipes?.lpm || 0;
        // ใช้ flow rate ต่อ sprinkler สำหรับ lateral pipe
        const lateralFlowRate = currentSpecs.flowRatePerMin;

        // ใช้ความยาวท่อที่ยาวที่สุด (ต้องใช้ longest pipes)
        const mainLongestLength =
            longestPipes[zoneId]?.longestMain ||
            selectedZoneForPipes?.mainMeters ||
            zones.reduce((sum, zone) => sum + (zone.mainMeters || 0), 0) / zones.length ||
            50;
        const subMainLongestLength =
            longestPipes[zoneId]?.longestSubMain ||
            selectedZoneForPipes?.subMainMeters ||
            zones.reduce((sum, zone) => sum + (zone.subMainMeters || 0), 0) / zones.length ||
            30;
        const lateralLongestLength =
            longestPipes[zoneId]?.longestLateral ||
            selectedZoneForPipes?.lateralMeters ||
            zones.reduce((sum, zone) => sum + (zone.lateralMeters || 0), 0) / zones.length ||
            20;
        const mainOutlets =
            selectedZoneForPipes?.mainOutlets ||
            Math.round(
                zones.reduce((sum, zone) => sum + (zone.mainOutlets || 1), 0) / zones.length
            ) ||
            1;
        const subMainOutlets =
            selectedZoneForPipes?.subMainOutlets ||
            Math.round(
                zones.reduce((sum, zone) => sum + (zone.subMainOutlets || 1), 0) / zones.length
            ) ||
            1;
        const lateralOutlets =
            selectedZoneForPipes?.lateralOutlets ||
            Math.round(
                zones.reduce((sum, zone) => sum + (zone.lateralOutlets || 1), 0) / zones.length
            ) ||
            1;

        // ใช้ water pressure จาก current specs
        const waterPressure = currentSpecs.waterPressure;

        // คำนวณ flow rates สำหรับท่อที่ยาวที่สุดแต่ละประเภท
        const flowRates = calculateLongestPipeFlowRates(zoneId, lateralFlowRate, {
            lateralOutlets: lateralOutlets,
            subMainOutlets: subMainOutlets,
            mainOutlets: mainOutlets,
        });

        const pipeRecs = calculatePipeRecommendations(
            zoneFlowRate,
            lateralFlowRate,
            waterPressure, // แรงดันน้ำในหน่วย Bar
            {
                mainLongestLength: mainLongestLength,
                subMainLongestLength: subMainLongestLength,
                lateralLongestLength: lateralLongestLength,
                mainOutlets: mainOutlets,
                subMainOutlets: subMainOutlets,
                lateralOutlets: lateralOutlets,
            }
        );
        setPipeRecommendations(pipeRecs);

        // คำนวณทั้ง PE และ PVC
        const pipeTypeRecs = calculatePipeRecommendationsWithTypes(
            zoneFlowRate,
            lateralFlowRate,
            waterPressure, // แรงดันน้ำในหน่วย Bar
            {
                mainLongestLength: mainLongestLength,
                subMainLongestLength: subMainLongestLength,
                lateralLongestLength: lateralLongestLength,
                mainOutlets: mainOutlets,
                subMainOutlets: subMainOutlets,
                lateralOutlets: lateralOutlets,
                // Flow rates สำหรับท่อที่ยาวที่สุด
                lateralLongestFlowRate: flowRates.lateralLongestFlowRate,
                subMainLongestFlowRate: flowRates.subMainLongestFlowRate,
                mainLongestFlowRate: flowRates.mainLongestFlowRate,
            }
        );
        setPipeTypeRecommendations(pipeTypeRecs);

        // Calculate pump requirements based on selected mode
        let pumpFlowRate = totalFlowRate;
        if (selectedPumpZoneId === 'single') {
            const highestFlowZone = findHighestFlowRateZone(zones);
            pumpFlowRate = highestFlowZone ? highestFlowZone.lpm || 0 : totalFlowRate;
        }

        // คำนวณ pressure loss จากท่อแยกตาม PE และ PVC
        // Use pipeTypeRecs directly instead of pipeTypeRecommendations state to avoid infinite loop
        const pumpRecs = calculatePumpRequirements(
            pumpFlowRate,
            currentSpecs.waterPressure,
            {
                pe: {
                    mainLoss: pipeTypeRecs?.main?.pe?.pressureLoss ?? 0,
                    subMainLoss: pipeTypeRecs?.subMain?.pe?.pressureLoss ?? 0,
                    lateralLoss: pipeTypeRecs?.lateral?.pe?.pressureLoss ?? 0,
                },
                pvc: {
                    mainLoss: pipeTypeRecs?.main?.pvc?.pressureLoss ?? 0,
                    subMainLoss: pipeTypeRecs?.subMain?.pvc?.pressureLoss ?? 0,
                    lateralLoss: pipeTypeRecs?.lateral?.pvc?.pressureLoss ?? 0,
                },
            },
            0, // staticHead (สามารถเพิ่มในอนาคต)
            0.05 // minorLossFactor = 5%
        );
        setPumpRecommendations(pumpRecs);
    }, [
        sprinklerMode,
        sprinklerSpecs,
        calculatedSprinklerSpecs,
        zones,
        selectedPumpZoneId,
        selectedPipeZoneId,
        longestPipes,
        calculateLongestPipeFlowRates,
        // Removed pipeTypeRecommendations from dependencies to prevent infinite loop
        // It's set in this effect, so using the computed value (pipeTypeRecs) directly instead
    ]);

    // Load Google Maps and render an interactive, read-only map like freeMap
    useEffect(() => {
        let isMounted = true;

        const initializeMap = () => {
            if (!isMounted || !mapRef.current || !window.google) return;

            const defaultLocation = { lat: 13.7563, lng: 100.5018 };
            const map = new window.google.maps.Map(mapRef.current, {
                zoom: 15,
                center: defaultLocation,
                mapTypeId: window.google.maps.MapTypeId.SATELLITE,
                mapTypeControl: false,
                gestureHandling: 'greedy',
                scrollwheel: true,
            });
            mapInstanceRef.current = map;

            // Recreate overlays from saved data (read-only)
            try {
                const bounds = new window.google.maps.LatLngBounds();

                // Zones
                const savedZones = localStorage.getItem('zones');
                if (savedZones) {
                    try {
                        const zones = JSON.parse(savedZones) as Array<{
                            id: number;
                            name: string;
                            color: string;
                            bounds?: { north: number; south: number; east: number; west: number };
                            coordinates?: Array<{ lat: number; lng: number }>;
                            center?: { lat: number; lng: number };
                        }>;
                        zones.forEach((zone) => {
                            let overlay: google.maps.Polygon | google.maps.Rectangle | undefined;
                            if (zone.coordinates && zone.coordinates.length > 0) {
                                overlay = new window.google.maps.Polygon({
                                    paths: zone.coordinates,
                                    fillColor: zone.color,
                                    fillOpacity: 0.4,
                                    strokeColor: zone.color,
                                    strokeOpacity: 0.9,
                                    strokeWeight: 3,
                                    clickable: false,
                                    zIndex: 1000,
                                });
                                zone.coordinates.forEach((p) =>
                                    bounds.extend(new window.google.maps.LatLng(p.lat, p.lng))
                                );
                            } else if (zone.bounds) {
                                overlay = new window.google.maps.Rectangle({
                                    bounds: new window.google.maps.LatLngBounds(
                                        { lat: zone.bounds.south, lng: zone.bounds.west },
                                        { lat: zone.bounds.north, lng: zone.bounds.east }
                                    ),
                                    fillColor: zone.color,
                                    fillOpacity: 0.4,
                                    strokeColor: zone.color,
                                    strokeOpacity: 0.9,
                                    strokeWeight: 3,
                                    clickable: false,
                                    zIndex: 1000,
                                });
                                bounds.extend(
                                    new window.google.maps.LatLng(
                                        zone.bounds.north,
                                        zone.bounds.east
                                    )
                                );
                                bounds.extend(
                                    new window.google.maps.LatLng(
                                        zone.bounds.south,
                                        zone.bounds.west
                                    )
                                );
                            }
                            if (overlay) overlay.setMap(map);

                            if (zone.center) {
                                new window.google.maps.Marker({
                                    position: zone.center,
                                    map,
                                    title: zone.name,
                                    icon: {
                                        path: window.google.maps.SymbolPath.CIRCLE,
                                        scale: 8,
                                        fillColor: zone.color,
                                        fillOpacity: 1,
                                        strokeColor: '#ffffff',
                                        strokeWeight: 2,
                                    },
                                    zIndex: 1500,
                                });
                                bounds.extend(
                                    new window.google.maps.LatLng(zone.center.lat, zone.center.lng)
                                );
                            }
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                // Plant points with custom icon
                const savedPlantPoints = localStorage.getItem('plantPoints');
                const savedPlantData = localStorage.getItem('selectedPlantData');
                let plantData: { name: string; icon: string } | null = null;
                if (savedPlantData) {
                    try {
                        plantData = JSON.parse(savedPlantData) as { name: string; icon: string };
                    } catch {
                        plantData = null;
                    }
                }
                if (savedPlantPoints) {
                    try {
                        const plantPoints = JSON.parse(savedPlantPoints) as Array<{
                            position: { lat: number; lng: number };
                        }>;
                        plantPoints.forEach((point) => {
                            const plantImagePath =
                                plantData && plantData.name
                                    ? getPlantImagePath(plantData.name)
                                    : '/freePlanImg/fruits/coconut.png';
                            new window.google.maps.Marker({
                                position: point.position,
                                map,
                                title: plantData
                                    ? `${plantData.name} ${translations.plant}`
                                    : translations.plant,
                                icon: {
                                    url: plantImagePath,
                                    scaledSize: new window.google.maps.Size(24, 24),
                                    anchor: new window.google.maps.Point(12, 12),
                                },
                                clickable: false,
                            });
                            bounds.extend(
                                new window.google.maps.LatLng(
                                    point.position.lat,
                                    point.position.lng
                                )
                            );
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                // Water sources
                const savedWaterSources = localStorage.getItem('waterSources');
                if (savedWaterSources) {
                    try {
                        const waterSources = JSON.parse(savedWaterSources) as Array<{
                            position: { lat: number; lng: number };
                        }>;
                        waterSources.forEach((ws) => {
                            new window.google.maps.Marker({
                                position: ws.position,
                                map,
                                title: translations.waterSource,
                                icon: {
                                    url:
                                        'data:image/svg+xml;charset=UTF-8,' +
                                        encodeURIComponent(`
                                            <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                                <!-- Outer circle background -->
                                                <circle cx="24" cy="24" r="22" fill="#3B82F6" stroke="#1E40AF" stroke-width="2"/>
                                                <!-- Water drop shape -->
                                                <path d="M24 8 Q20 8 18 12 Q16 16 16 20 Q16 24 18 28 Q20 32 24 36 Q28 32 30 28 Q32 24 32 20 Q32 16 30 12 Q28 8 24 8 Z" fill="#60A5FA" stroke="#2563EB" stroke-width="1.5"/>
                                                <!-- Highlight -->
                                                <ellipse cx="22" cy="16" rx="3" ry="4" fill="#FFFFFF" opacity="0.6"/>
                                            </svg>
                                        `),
                                    scaledSize: new window.google.maps.Size(48, 48),
                                    anchor: new window.google.maps.Point(24, 24),
                                },
                            });
                            bounds.extend(
                                new window.google.maps.LatLng(ws.position.lat, ws.position.lng)
                            );
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                // Pumps
                const savedPumps = localStorage.getItem('pumps');
                if (savedPumps) {
                    try {
                        const pumps = JSON.parse(savedPumps) as Array<{
                            position: { lat: number; lng: number };
                        }>;
                        pumps.forEach((pump) => {
                            new window.google.maps.Marker({
                                position: pump.position,
                                map,
                                title: translations.waterPump,
                                icon: {
                                    url: '/images/water-pump.png',
                                    scaledSize: new window.google.maps.Size(32, 32),
                                    anchor: new window.google.maps.Point(16, 16),
                                },
                            });
                            bounds.extend(
                                new window.google.maps.LatLng(pump.position.lat, pump.position.lng)
                            );
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                // Pipes
                const savedMainPipes = localStorage.getItem('mainPipes');
                if (savedMainPipes) {
                    try {
                        const mainPipes = JSON.parse(savedMainPipes) as Array<{
                            fromPump: { lat: number; lng: number };
                            toZoneCenter: { lat: number; lng: number };
                        }>;
                        mainPipes.forEach((pipe) => {
                            const poly = new window.google.maps.Polyline({
                                path: [pipe.fromPump, pipe.toZoneCenter],
                                geodesic: true,
                                strokeColor: '#DC2626',
                                strokeOpacity: 0.8,
                                strokeWeight: 4,
                                zIndex: 1200,
                            });
                            poly.setMap(map);
                            [pipe.fromPump, pipe.toZoneCenter].forEach((p) =>
                                bounds.extend(new window.google.maps.LatLng(p.lat, p.lng))
                            );
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                const savedSubMainPipes = localStorage.getItem('subMainPipes');
                if (savedSubMainPipes) {
                    try {
                        const subMainPipes = JSON.parse(savedSubMainPipes) as Array<{
                            path: Array<{ lat: number; lng: number }>;
                        }>;
                        subMainPipes.forEach((pipe) => {
                            const poly = new window.google.maps.Polyline({
                                path: pipe.path,
                                geodesic: true,
                                strokeColor: '#8B5CF6',
                                strokeOpacity: 0.7,
                                strokeWeight: 3,
                                zIndex: 1100,
                            });
                            poly.setMap(map);
                            pipe.path.forEach((p) =>
                                bounds.extend(new window.google.maps.LatLng(p.lat, p.lng))
                            );
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                const savedLateralPipes = localStorage.getItem('lateralPipes');
                if (savedLateralPipes) {
                    try {
                        const lateralPipes = JSON.parse(savedLateralPipes) as Array<{
                            path: Array<{ lat: number; lng: number }>;
                        }>;
                        lateralPipes.forEach((pipe) => {
                            const poly = new window.google.maps.Polyline({
                                path: pipe.path,
                                geodesic: true,
                                strokeColor: '#FCD34D',
                                strokeOpacity: 0.8,
                                strokeWeight: 2,
                                zIndex: 1000,
                            });
                            poly.setMap(map);
                            pipe.path.forEach((p) =>
                                bounds.extend(new window.google.maps.LatLng(p.lat, p.lng))
                            );
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                // Drawn shapes (area) - พื้นที่หลักที่วาดด้วยสีเขียว
                const savedDrawnShapes = localStorage.getItem('drawnShapes');
                if (savedDrawnShapes) {
                    try {
                        const drawnShapes = JSON.parse(savedDrawnShapes) as Array<{
                            type: string;
                            data: {
                                path?: Array<{ lat: number; lng: number }>;
                                bounds?: {
                                    north: number;
                                    south: number;
                                    east: number;
                                    west: number;
                                };
                                center?: { lat: number; lng: number };
                                radius?: number;
                            };
                        }>;
                        drawnShapes.forEach((shape) => {
                            console.log(
                                '🔍 Reading shape from localStorage in product page:',
                                shape.type,
                                'typeof:',
                                typeof shape.type
                            );
                            if (shape.data) {
                                let overlay:
                                    | google.maps.Polygon
                                    | google.maps.Rectangle
                                    | google.maps.Circle
                                    | undefined;

                                if (shape.type === 'polygon' && shape.data.path) {
                                    overlay = new window.google.maps.Polygon({
                                        paths: shape.data.path,
                                        fillColor: '#10b981',
                                        fillOpacity: 0.2,
                                        strokeColor: '#10b981',
                                        strokeOpacity: 0.6,
                                        strokeWeight: 2,
                                        clickable: false,
                                        zIndex: 100,
                                    });
                                    shape.data.path.forEach((p) =>
                                        bounds.extend(new window.google.maps.LatLng(p.lat, p.lng))
                                    );
                                } else if (shape.type === 'rectangle' && shape.data.bounds) {
                                    overlay = new window.google.maps.Rectangle({
                                        bounds: new window.google.maps.LatLngBounds(
                                            {
                                                lat: shape.data.bounds.south,
                                                lng: shape.data.bounds.west,
                                            },
                                            {
                                                lat: shape.data.bounds.north,
                                                lng: shape.data.bounds.east,
                                            }
                                        ),
                                        fillColor: '#10b981',
                                        fillOpacity: 0.2,
                                        strokeColor: '#10b981',
                                        strokeOpacity: 0.6,
                                        strokeWeight: 2,
                                        clickable: false,
                                        zIndex: 100,
                                    });
                                    bounds.extend(
                                        new window.google.maps.LatLng(
                                            shape.data.bounds.north,
                                            shape.data.bounds.east
                                        )
                                    );
                                    bounds.extend(
                                        new window.google.maps.LatLng(
                                            shape.data.bounds.south,
                                            shape.data.bounds.west
                                        )
                                    );
                                } else if (
                                    shape.type === 'circle' &&
                                    shape.data.center &&
                                    shape.data.radius
                                ) {
                                    overlay = new window.google.maps.Circle({
                                        center: {
                                            lat: shape.data.center.lat,
                                            lng: shape.data.center.lng,
                                        },
                                        radius: shape.data.radius,
                                        fillColor: '#10b981',
                                        fillOpacity: 0.2,
                                        strokeColor: '#10b981',
                                        strokeOpacity: 0.6,
                                        strokeWeight: 2,
                                        clickable: false,
                                        zIndex: 100,
                                    });
                                    bounds.extend(
                                        new window.google.maps.LatLng(
                                            shape.data.center.lat,
                                            shape.data.center.lng
                                        )
                                    );
                                }

                                if (overlay) {
                                    overlay.setMap(map);
                                }
                            }
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                // Fit to content if we have bounds
                try {
                    if (!bounds.isEmpty()) {
                        map.fitBounds(bounds);
                    }
                } catch {
                    // ignore fit error
                }
            } catch (error) {
                console.error('Failed to render product map overlays:', error);
            }
        };

        // Fallback: keep image for when Google Maps not ready
        const img = localStorage.getItem('projectMapImage');
        setImageUrl(img && img.length > 100 ? img : null);

        if (window.google && window.google.maps) {
            initializeMap();
        } else {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY'}&libraries=places,drawing`;
            script.async = true;
            script.defer = true;
            script.onload = initializeMap;
            script.onerror = () => console.error('Failed to load Google Maps API');
            document.head.appendChild(script);
        }

        return () => {
            isMounted = false;
        };
    }, [
        translations.plant,
        translations.waterSource,
        translations.waterPump,
        translations.mapSnapshot,
    ]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title={translations.irrigationProducts} />

            {/* Navbar */}
            <FreeNav />

            {/* Main */}
            <div className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
                {/* Top layout */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                    {/* Map preview */}
                    <div className="rounded-lg border border-slate-600 bg-slate-600/30 p-4 md:col-span-3">
                        <div className="h-[380px] overflow-hidden rounded bg-slate-700/40">
                            <div ref={mapRef} className="h-full w-full" />
                            {!window.google && imageUrl && (
                                <img
                                    src={imageUrl}
                                    alt={translations.mapSnapshot}
                                    className="h-full w-full object-cover"
                                />
                            )}
                        </div>
                    </div>

                    {/* Right summary panel */}
                    <div className="rounded-lg border border-slate-600 bg-slate-600/30 p-4 text-white md:col-span-2">
                        <div className="mb-2 flex items-center justify-between">
                            <h2 className="text-lg font-bold">
                                {selectedZoneId
                                    ? zones.find((z) => z.id === selectedZoneId)?.name ||
                                      translations.selectZone
                                    : translations.selectZone}
                            </h2>
                            <div className="relative">
                                <button
                                    onClick={() => setShowZoneDropdown(!showZoneDropdown)}
                                    className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                                >
                                    <span className="text-xs">
                                        {selectedZoneId
                                            ? zones.find((z) => z.id === selectedZoneId)?.name ||
                                              translations.selectZone
                                            : translations.selectZone}
                                    </span>
                                    <span>{showZoneDropdown ? '▴' : '▾'}</span>
                                </button>
                                {showZoneDropdown && (
                                    <div className="absolute right-0 top-8 z-10 w-48 rounded-lg border border-slate-600 bg-slate-700 shadow-lg">
                                        {zones.map((zone) => (
                                            <button
                                                key={zone.id}
                                                onClick={() => {
                                                    setSelectedZoneId(zone.id);
                                                    setShowZoneDropdown(false);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-600 ${
                                                    selectedZoneId === zone.id ? 'bg-slate-600' : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-3 w-3 rounded-full"
                                                        style={{ backgroundColor: zone.color }}
                                                    ></div>
                                                    {zone.name}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {selectedZoneId &&
                            (() => {
                                const selectedZone = zones.find((z) => z.id === selectedZoneId);
                                if (!selectedZone) return null;

                                return (
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>{translations.area}</span>
                                            <span className="font-semibold text-green-400">
                                                {selectedZone.area?.toFixed(2) || '0.00'} Rai
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>{translations.plants}</span>
                                            <span className="font-semibold text-emerald-400">
                                                {selectedZone.plants || 0}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>{translations.flowRateLabel}</span>
                                            <span className="font-semibold text-blue-400">
                                                {Math.round(selectedZone.lpm || 0)} LPM
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>{translations.waterNeedPerSessionLabel}:</span>
                                            <span className="font-semibold text-cyan-400">
                                                {summaryData?.selectedPlant
                                                    ? Math.round(
                                                          (selectedZone.plants || 0) *
                                                              summaryData.selectedPlant.waterNeed
                                                      )
                                                    : Math.round((selectedZone.lpm || 0) * 30)}{' '}
                                                L/session
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>{translations.mainPipe}</span>
                                            <div className="text-right">
                                                <div className="font-semibold text-red-400">
                                                    {selectedZone.mainMeters?.toFixed(1) || '0.0'} m
                                                </div>
                                                {longestPipes[selectedZoneId]?.longestMain > 0 && (
                                                    <div className="text-xs text-red-300">
                                                        {translations.longestPipe}:{' '}
                                                        {longestPipes[
                                                            selectedZoneId
                                                        ].longestMain.toFixed(1)}{' '}
                                                        m
                                                    </div>
                                                )}
                                                {selectedZone.mainOutlets !== undefined &&
                                                    selectedZone.mainOutlets > 0 && (
                                                        <div className="text-xs text-red-300">
                                                            {selectedZone.mainOutlets}{' '}
                                                            {translations.outlets?.toLowerCase() ||
                                                                'outlets'}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>{translations.subMainPipe}</span>
                                            <div className="text-right">
                                                <div className="font-semibold text-purple-400">
                                                    {selectedZone.subMainMeters?.toFixed(1) ||
                                                        '0.0'}{' '}
                                                    m
                                                </div>
                                                {longestPipes[selectedZoneId]?.longestSubMain >
                                                    0 && (
                                                    <div className="text-xs text-purple-300">
                                                        {translations.longestPipe}:{' '}
                                                        {longestPipes[
                                                            selectedZoneId
                                                        ].longestSubMain.toFixed(1)}{' '}
                                                        m
                                                    </div>
                                                )}
                                                {selectedZone.subMainOutlets !== undefined &&
                                                    selectedZone.subMainOutlets > 0 && (
                                                        <div className="text-xs text-purple-300">
                                                            {selectedZone.subMainOutlets}{' '}
                                                            {translations.outlets?.toLowerCase() ||
                                                                'outlets'}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>{translations.lateralPipe}</span>
                                            <div className="text-right">
                                                <div className="font-semibold text-yellow-400">
                                                    {selectedZone.lateralMeters?.toFixed(1) ||
                                                        '0.0'}{' '}
                                                    m
                                                </div>
                                                {longestPipes[selectedZoneId]?.longestLateral >
                                                    0 && (
                                                    <div className="text-xs text-yellow-300">
                                                        {translations.longestPipe}:{' '}
                                                        {longestPipes[
                                                            selectedZoneId
                                                        ].longestLateral.toFixed(1)}{' '}
                                                        m
                                                    </div>
                                                )}
                                                {selectedZone.lateralOutlets !== undefined &&
                                                    selectedZone.lateralOutlets > 0 && (
                                                        <div className="text-xs text-yellow-300">
                                                            {selectedZone.lateralOutlets}{' '}
                                                            {translations.outlets?.toLowerCase() ||
                                                                'outlets'}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                    </div>
                </div>

                {/* Selectors */}
                <div className="mt-4 space-y-3">
                    <div className="rounded-lg bg-emerald-900/30 p-3">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="font-semibold text-white">
                                {translations.sprinklerSelector}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSprinklerMode('preset')}
                                    className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                                        sprinklerMode === 'preset'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-emerald-800/50 text-emerald-300 hover:bg-emerald-700/50'
                                    }`}
                                >
                                    {translations.preset}
                                </button>
                                <button
                                    onClick={() => setSprinklerMode('calculated')}
                                    className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                                        sprinklerMode === 'calculated'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-emerald-800/50 text-emerald-300 hover:bg-emerald-700/50'
                                    }`}
                                >
                                    {translations.calculated}
                                </button>
                            </div>
                        </div>
                        {sprinklerMode === 'preset' ? (
                            sprinklerSpecs ? (
                                <div className="rounded bg-emerald-900/40 p-3 text-sm text-slate-200">
                                    {/* Basic Specifications */}
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-emerald-300">
                                                {translations.flowRateProduct}:
                                            </span>
                                            <span className="font-semibold text-emerald-400">
                                                {sprinklerSpecs.flowRatePerMin} LPM
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-emerald-300">
                                                {translations.pressureProduct}:
                                            </span>
                                            <span className="font-semibold text-emerald-400">
                                                {sprinklerSpecs.waterPressure} Bar
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-emerald-300">
                                                {translations.radiusProduct}:
                                            </span>
                                            <span className="font-semibold text-emerald-400">
                                                {sprinklerSpecs.radius} m
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded bg-emerald-900/40 p-3 text-sm text-slate-200">
                                    {translations.loadingSprinklerSpecs}
                                </div>
                            )
                        ) : calculatedSprinklerSpecs ? (
                            <div className="rounded bg-emerald-900/40 p-3 text-sm text-slate-200">
                                {/* Final Specifications */}
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-emerald-300">
                                            {translations.flowRateProduct}:
                                        </span>
                                        <span className="font-semibold text-emerald-400">
                                            {calculatedSprinklerSpecs.flowRatePerMin.toFixed(2)} LPM
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-emerald-300">
                                            {translations.pressureProduct}:
                                        </span>
                                        <span className="font-semibold text-emerald-400">
                                            {calculatedSprinklerSpecs.waterPressure} Bar
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-emerald-300">
                                            {translations.radiusProduct}:
                                        </span>
                                        <span className="font-semibold text-emerald-400">
                                            {calculatedSprinklerSpecs.radius} m
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded bg-emerald-900/40 p-3 text-sm text-slate-200">
                                {translations.loadingSprinklerSpecs}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg bg-rose-900/30 p-3">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="font-semibold text-white">
                                {translations.mainPipeSelection}
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setShowPipeZoneDropdown(!showPipeZoneDropdown)}
                                    className="flex items-center gap-1 rounded bg-rose-800 px-2 py-1 hover:bg-rose-700"
                                >
                                    <span className="text-xs">
                                        {selectedPipeZoneId
                                            ? zones.find((z) => z.id === selectedPipeZoneId)
                                                  ?.name || translations.selectZone
                                            : translations.selectZone}
                                    </span>
                                    <span>{showPipeZoneDropdown ? '▴' : '▾'}</span>
                                </button>
                                {showPipeZoneDropdown && (
                                    <div className="absolute right-0 top-8 z-10 w-48 rounded-lg border border-rose-600 bg-rose-800 shadow-lg">
                                        {zones.map((zone) => (
                                            <button
                                                key={zone.id}
                                                onClick={() => {
                                                    setSelectedPipeZoneId(zone.id);
                                                    setShowPipeZoneDropdown(false);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-rose-700 ${
                                                    selectedPipeZoneId === zone.id
                                                        ? 'bg-rose-700'
                                                        : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-3 w-3 rounded-full"
                                                        style={{ backgroundColor: zone.color }}
                                                    ></div>
                                                    {zone.name}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {selectedPipeZoneId &&
                            (() => {
                                const selectedZone = zones.find((z) => z.id === selectedPipeZoneId);
                                if (!selectedZone) return null;

                                return (
                                    <div className="space-y-2 rounded bg-rose-900/40 p-3 text-sm text-slate-200">
                                        <div className="flex items-center justify-between">
                                            <span className="text-rose-300">
                                                {translations.recommendedSize}:
                                            </span>
                                            <span className="font-semibold text-rose-400">
                                                {pipeRecommendations?.main.sizeMM?.toFixed(2)}mm (
                                                {pipeRecommendations?.main.sizeInch})
                                            </span>
                                        </div>
                                        <div className="text-xs text-rose-300">
                                            {pipeRecommendations?.main.reason}
                                        </div>

                                        {/* Pipe Type Recommendations - PE and PVC */}
                                        {pipeTypeRecommendations?.main && (
                                            <div className="border-t border-rose-800/50 pt-2">
                                                <div className="mb-2 text-xs font-medium text-rose-300">
                                                    {translations.pipeTypeRecommendations}:
                                                </div>
                                                <div className="space-y-3">
                                                    {/* PE Recommendation */}
                                                    {pipeTypeRecommendations.main.pe && (
                                                        <div className="rounded border border-blue-700/30 bg-blue-900/30 p-2">
                                                            <div className="mb-1 text-xs font-medium text-blue-300">
                                                                {translations.pePolyethylene}
                                                            </div>
                                                            <div className="space-y-1 text-xs text-slate-300">
                                                                <div className="flex justify-between">
                                                                    <span>
                                                                        {translations.sizeLabel}
                                                                    </span>
                                                                    <span className="font-semibold text-blue-400">
                                                                        {pipeTypeRecommendations.main.pe.sizeMM?.toFixed(
                                                                            2
                                                                        )}
                                                                        mm (
                                                                        {
                                                                            pipeTypeRecommendations
                                                                                .main.pe.sizeInch
                                                                        }
                                                                        )
                                                                    </span>
                                                                </div>
                                                                {pipeTypeRecommendations.main.pe
                                                                    .calculationDetails && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {translations.typeLabel}
                                                                        </span>
                                                                        <span className="font-semibold text-blue-400">
                                                                            {
                                                                                pipeTypeRecommendations
                                                                                    .main.pe
                                                                                    .calculationDetails
                                                                                    .selectedPipeType
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pipeTypeRecommendations.main.pe
                                                                    .pressureLoss !== undefined && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {
                                                                                translations.pressureLoss
                                                                            }
                                                                        </span>
                                                                        <span className="font-semibold text-blue-400">
                                                                            {pipeTypeRecommendations.main.pe.pressureLoss.toFixed(
                                                                                2
                                                                            )}{' '}
                                                                            m
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pipeTypeRecommendations.main.pe
                                                                    .hf !== undefined && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {translations.hfLabel}
                                                                        </span>
                                                                        <span className="font-semibold text-blue-400">
                                                                            {pipeTypeRecommendations.main.pe.hf.toFixed(
                                                                                3
                                                                            )}{' '}
                                                                            m/100m
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* PVC Recommendation */}
                                                    {pipeTypeRecommendations.main.pvc && (
                                                        <div className="rounded border border-green-700/30 bg-green-900/30 p-2">
                                                            <div className="mb-1 text-xs font-medium text-green-300">
                                                                {translations.pvcPolyvinylChloride}
                                                            </div>
                                                            <div className="space-y-1 text-xs text-slate-300">
                                                                <div className="flex justify-between">
                                                                    <span>
                                                                        {translations.sizeLabel}
                                                                    </span>
                                                                    <span className="font-semibold text-green-400">
                                                                        {
                                                                            pipeTypeRecommendations
                                                                                .main.pvc.sizeInch
                                                                        }
                                                                    </span>
                                                                </div>
                                                                {pipeTypeRecommendations.main.pvc
                                                                    .calculationDetails && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {translations.typeLabel}
                                                                        </span>
                                                                        <span className="font-semibold text-green-400">
                                                                            {
                                                                                pipeTypeRecommendations
                                                                                    .main.pvc
                                                                                    .calculationDetails
                                                                                    .selectedPipeType
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pipeTypeRecommendations.main.pvc
                                                                    .pressureLoss !== undefined && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {
                                                                                translations.pressureLoss
                                                                            }
                                                                        </span>
                                                                        <span className="font-semibold text-green-400">
                                                                            {pipeTypeRecommendations.main.pvc.pressureLoss.toFixed(
                                                                                2
                                                                            )}{' '}
                                                                            m
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pipeTypeRecommendations.main.pvc
                                                                    .hf !== undefined && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {translations.hfLabel}
                                                                        </span>
                                                                        <span className="font-semibold text-green-400">
                                                                            {pipeTypeRecommendations.main.pvc.hf.toFixed(
                                                                                3
                                                                            )}{' '}
                                                                            m/100m
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="border-t border-rose-800/50 pt-2">
                                            <div className="mb-2 text-xs text-rose-300">
                                                {translations.zoneDetails}:
                                            </div>
                                            <div className="space-y-1 text-xs text-slate-300">
                                                <div className="flex justify-between">
                                                    <span>{translations.zoneFlowRate}:</span>
                                                    <span className="font-semibold text-rose-400">
                                                        {Math.round(selectedZone.lpm || 0)} LPM
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>{translations.pipeLength}:</span>
                                                    <span className="font-semibold text-rose-400">
                                                        {selectedZone.mainMeters?.toFixed(1) ||
                                                            '0.0'}{' '}
                                                        m
                                                    </span>
                                                </div>
                                                {longestPipes[selectedPipeZoneId]?.longestMain >
                                                    0 && (
                                                    <div className="flex justify-between">
                                                        <span>{translations.longestPipe}:</span>
                                                        <span className="font-semibold text-rose-400">
                                                            {longestPipes[
                                                                selectedPipeZoneId
                                                            ].longestMain.toFixed(1)}{' '}
                                                            m
                                                        </span>
                                                    </div>
                                                )}
                                                {selectedZone.mainOutlets !== undefined &&
                                                    selectedZone.mainOutlets > 0 && (
                                                        <div className="flex justify-between">
                                                            <span>
                                                                {translations.outletsLabel}:
                                                            </span>
                                                            <span className="font-semibold text-rose-400">
                                                                {selectedZone.mainOutlets}
                                                            </span>
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        {!selectedPipeZoneId && (
                            <div className="rounded bg-rose-900/40 p-3 text-sm text-slate-200">
                                {translations.loadingPipeRecommendations}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg bg-violet-900/30 p-3">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="font-semibold text-white">
                                {translations.subMainPipeSelection}
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setShowPipeZoneDropdown(!showPipeZoneDropdown)}
                                    className="flex items-center gap-1 rounded bg-violet-800 px-2 py-1 hover:bg-violet-700"
                                >
                                    <span className="text-xs">
                                        {selectedPipeZoneId
                                            ? zones.find((z) => z.id === selectedPipeZoneId)
                                                  ?.name || translations.selectZone
                                            : translations.selectZone}
                                    </span>
                                    <span>{showPipeZoneDropdown ? '▴' : '▾'}</span>
                                </button>
                                {showPipeZoneDropdown && (
                                    <div className="absolute right-0 top-8 z-10 w-48 rounded-lg border border-violet-600 bg-violet-800 shadow-lg">
                                        {zones.map((zone) => (
                                            <button
                                                key={zone.id}
                                                onClick={() => {
                                                    setSelectedPipeZoneId(zone.id);
                                                    setShowPipeZoneDropdown(false);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-violet-700 ${
                                                    selectedPipeZoneId === zone.id
                                                        ? 'bg-violet-700'
                                                        : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-3 w-3 rounded-full"
                                                        style={{ backgroundColor: zone.color }}
                                                    ></div>
                                                    {zone.name}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {selectedPipeZoneId &&
                            (() => {
                                const selectedZone = zones.find((z) => z.id === selectedPipeZoneId);
                                if (!selectedZone) return null;

                                return (
                                    <div className="space-y-2 rounded bg-violet-900/40 p-3 text-sm text-slate-200">
                                        <div className="flex items-center justify-between">
                                            <span className="text-violet-300">
                                                {translations.recommendedSize}:
                                            </span>
                                            <span className="font-semibold text-violet-400">
                                                {pipeRecommendations?.subMain.sizeMM?.toFixed(2)}mm
                                                ({pipeRecommendations?.subMain.sizeInch})
                                            </span>
                                        </div>
                                        <div className="text-xs text-violet-300">
                                            {pipeRecommendations?.subMain.reason}
                                        </div>

                                        {/* Pipe Type Recommendations - PE and PVC */}
                                        {pipeTypeRecommendations?.subMain && (
                                            <div className="border-t border-violet-800/50 pt-2">
                                                <div className="mb-2 text-xs font-medium text-violet-300">
                                                    Pipe Type Recommendations:
                                                </div>
                                                <div className="space-y-3">
                                                    {/* PE Recommendation */}
                                                    {pipeTypeRecommendations.subMain.pe && (
                                                        <div className="rounded border border-blue-700/30 bg-blue-900/30 p-2">
                                                            <div className="mb-1 text-xs font-medium text-blue-300">
                                                                {translations.pePolyethylene}
                                                            </div>
                                                            <div className="space-y-1 text-xs text-slate-300">
                                                                <div className="flex justify-between">
                                                                    <span>
                                                                        {translations.sizeLabel}
                                                                    </span>
                                                                    <span className="font-semibold text-blue-400">
                                                                        {pipeTypeRecommendations.subMain.pe.sizeMM?.toFixed(
                                                                            2
                                                                        )}
                                                                        mm (
                                                                        {
                                                                            pipeTypeRecommendations
                                                                                .subMain.pe.sizeInch
                                                                        }
                                                                        )
                                                                    </span>
                                                                </div>
                                                                {pipeTypeRecommendations.subMain.pe
                                                                    .calculationDetails && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {translations.typeLabel}
                                                                        </span>
                                                                        <span className="font-semibold text-blue-400">
                                                                            {
                                                                                pipeTypeRecommendations
                                                                                    .subMain.pe
                                                                                    .calculationDetails
                                                                                    .selectedPipeType
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pipeTypeRecommendations.subMain.pe
                                                                    .pressureLoss !== undefined && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {
                                                                                translations.pressureLoss
                                                                            }
                                                                        </span>
                                                                        <span className="font-semibold text-blue-400">
                                                                            {pipeTypeRecommendations.subMain.pe.pressureLoss.toFixed(
                                                                                2
                                                                            )}{' '}
                                                                            m
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pipeTypeRecommendations.subMain.pe
                                                                    .hf !== undefined && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {translations.hfLabel}
                                                                        </span>
                                                                        <span className="font-semibold text-blue-400">
                                                                            {pipeTypeRecommendations.subMain.pe.hf.toFixed(
                                                                                3
                                                                            )}{' '}
                                                                            m/100m
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* PVC Recommendation */}
                                                    {pipeTypeRecommendations.subMain.pvc && (
                                                        <div className="rounded border border-green-700/30 bg-green-900/30 p-2">
                                                            <div className="mb-1 text-xs font-medium text-green-300">
                                                                {translations.pvcPolyvinylChloride}
                                                            </div>
                                                            <div className="space-y-1 text-xs text-slate-300">
                                                                <div className="flex justify-between">
                                                                    <span>
                                                                        {translations.sizeLabel}
                                                                    </span>
                                                                    <span className="font-semibold text-green-400">
                                                                        {
                                                                            pipeTypeRecommendations
                                                                                .subMain.pvc
                                                                                .sizeInch
                                                                        }
                                                                    </span>
                                                                </div>
                                                                {pipeTypeRecommendations.subMain.pvc
                                                                    .calculationDetails && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {translations.typeLabel}
                                                                        </span>
                                                                        <span className="font-semibold text-green-400">
                                                                            {
                                                                                pipeTypeRecommendations
                                                                                    .subMain.pvc
                                                                                    .calculationDetails
                                                                                    .selectedPipeType
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pipeTypeRecommendations.subMain.pvc
                                                                    .pressureLoss !== undefined && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {
                                                                                translations.pressureLoss
                                                                            }
                                                                        </span>
                                                                        <span className="font-semibold text-green-400">
                                                                            {pipeTypeRecommendations.subMain.pvc.pressureLoss.toFixed(
                                                                                2
                                                                            )}{' '}
                                                                            m
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pipeTypeRecommendations.subMain.pvc
                                                                    .hf !== undefined && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {translations.hfLabel}
                                                                        </span>
                                                                        <span className="font-semibold text-green-400">
                                                                            {pipeTypeRecommendations.subMain.pvc.hf.toFixed(
                                                                                3
                                                                            )}{' '}
                                                                            m/100m
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="border-t border-violet-800/50 pt-2">
                                            <div className="mb-2 text-xs text-violet-300">
                                                Zone Details:
                                            </div>
                                            <div className="space-y-1 text-xs text-slate-300">
                                                <div className="flex justify-between">
                                                    <span>{translations.zoneFlowRate}:</span>
                                                    <span className="font-semibold text-violet-400">
                                                        {Math.round(selectedZone.lpm || 0)} LPM
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>{translations.pipeLength}:</span>
                                                    <span className="font-semibold text-violet-400">
                                                        {selectedZone.subMainMeters?.toFixed(1) ||
                                                            '0.0'}{' '}
                                                        m
                                                    </span>
                                                </div>
                                                {longestPipes[selectedPipeZoneId]?.longestSubMain >
                                                    0 && (
                                                    <div className="flex justify-between">
                                                        <span>{translations.longestPipe}:</span>
                                                        <span className="font-semibold text-violet-400">
                                                            {longestPipes[
                                                                selectedPipeZoneId
                                                            ].longestSubMain.toFixed(1)}{' '}
                                                            m
                                                        </span>
                                                    </div>
                                                )}
                                                {selectedZone.subMainOutlets !== undefined &&
                                                    selectedZone.subMainOutlets > 0 && (
                                                        <div className="flex justify-between">
                                                            <span>
                                                                {translations.outletsLabel}:
                                                            </span>
                                                            <span className="font-semibold text-violet-400">
                                                                {selectedZone.subMainOutlets}
                                                            </span>
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        {!selectedPipeZoneId && (
                            <div className="rounded bg-violet-900/40 p-3 text-sm text-slate-200">
                                {translations.loadingPipeRecommendations}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg bg-amber-900/30 p-3">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="font-semibold text-white">
                                {translations.lateralPipeSelection}
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setShowPipeZoneDropdown(!showPipeZoneDropdown)}
                                    className="flex items-center gap-1 rounded bg-amber-800 px-2 py-1 hover:bg-amber-700"
                                >
                                    <span className="text-xs">
                                        {selectedPipeZoneId
                                            ? zones.find((z) => z.id === selectedPipeZoneId)
                                                  ?.name || translations.selectZone
                                            : translations.selectZone}
                                    </span>
                                    <span>{showPipeZoneDropdown ? '▴' : '▾'}</span>
                                </button>
                                {showPipeZoneDropdown && (
                                    <div className="absolute right-0 top-8 z-10 w-48 rounded-lg border border-amber-600 bg-amber-800 shadow-lg">
                                        {zones.map((zone) => (
                                            <button
                                                key={zone.id}
                                                onClick={() => {
                                                    setSelectedPipeZoneId(zone.id);
                                                    setShowPipeZoneDropdown(false);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-amber-700 ${
                                                    selectedPipeZoneId === zone.id
                                                        ? 'bg-amber-700'
                                                        : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-3 w-3 rounded-full"
                                                        style={{ backgroundColor: zone.color }}
                                                    ></div>
                                                    {zone.name}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {selectedPipeZoneId &&
                            (() => {
                                const selectedZone = zones.find((z) => z.id === selectedPipeZoneId);
                                if (!selectedZone) return null;

                                return (
                                    <div className="space-y-2 rounded bg-amber-900/40 p-3 text-sm text-slate-200">
                                        <div className="flex items-center justify-between">
                                            <span className="text-amber-300">
                                                {translations.recommendedSize}:
                                            </span>
                                            <span className="font-semibold text-amber-400">
                                                {pipeRecommendations?.lateral.sizeMM?.toFixed(2)}mm
                                                ({pipeRecommendations?.lateral.sizeInch})
                                            </span>
                                        </div>
                                        <div className="text-xs text-amber-300">
                                            {pipeRecommendations?.lateral.reason}
                                        </div>

                                        {/* Pipe Type Recommendations - PE and PVC */}
                                        {pipeTypeRecommendations?.lateral && (
                                            <div className="border-t border-amber-800/50 pt-2">
                                                <div className="mb-2 text-xs font-medium text-amber-300">
                                                    Pipe Type Recommendations:
                                                </div>
                                                <div className="space-y-3">
                                                    {/* PE Recommendation */}
                                                    {pipeTypeRecommendations.lateral.pe && (
                                                        <div className="rounded border border-blue-700/30 bg-blue-900/30 p-2">
                                                            <div className="mb-1 text-xs font-medium text-blue-300">
                                                                {translations.pePolyethylene}
                                                            </div>
                                                            <div className="space-y-1 text-xs text-slate-300">
                                                                <div className="flex justify-between">
                                                                    <span>
                                                                        {translations.sizeLabel}
                                                                    </span>
                                                                    <span className="font-semibold text-blue-400">
                                                                        {pipeTypeRecommendations.lateral.pe.sizeMM?.toFixed(
                                                                            2
                                                                        )}
                                                                        mm (
                                                                        {
                                                                            pipeTypeRecommendations
                                                                                .lateral.pe.sizeInch
                                                                        }
                                                                        )
                                                                    </span>
                                                                </div>
                                                                {pipeTypeRecommendations.lateral.pe
                                                                    .calculationDetails && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {translations.typeLabel}
                                                                        </span>
                                                                        <span className="font-semibold text-blue-400">
                                                                            {
                                                                                pipeTypeRecommendations
                                                                                    .lateral.pe
                                                                                    .calculationDetails
                                                                                    .selectedPipeType
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pipeTypeRecommendations.lateral.pe
                                                                    .pressureLoss !== undefined && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {
                                                                                translations.pressureLoss
                                                                            }
                                                                        </span>
                                                                        <span className="font-semibold text-blue-400">
                                                                            {pipeTypeRecommendations.lateral.pe.pressureLoss.toFixed(
                                                                                2
                                                                            )}{' '}
                                                                            m
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pipeTypeRecommendations.lateral.pe
                                                                    .hf !== undefined && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {translations.hfLabel}
                                                                        </span>
                                                                        <span className="font-semibold text-blue-400">
                                                                            {pipeTypeRecommendations.lateral.pe.hf.toFixed(
                                                                                3
                                                                            )}{' '}
                                                                            m/100m
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* PVC Recommendation */}
                                                    {pipeTypeRecommendations.lateral.pvc && (
                                                        <div className="rounded border border-green-700/30 bg-green-900/30 p-2">
                                                            <div className="mb-1 text-xs font-medium text-green-300">
                                                                {translations.pvcPolyvinylChloride}
                                                            </div>
                                                            <div className="space-y-1 text-xs text-slate-300">
                                                                <div className="flex justify-between">
                                                                    <span>
                                                                        {translations.sizeLabel}
                                                                    </span>
                                                                    <span className="font-semibold text-green-400">
                                                                        {
                                                                            pipeTypeRecommendations
                                                                                .lateral.pvc
                                                                                .sizeInch
                                                                        }
                                                                    </span>
                                                                </div>
                                                                {pipeTypeRecommendations.lateral.pvc
                                                                    .calculationDetails && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {translations.typeLabel}
                                                                        </span>
                                                                        <span className="font-semibold text-green-400">
                                                                            {
                                                                                pipeTypeRecommendations
                                                                                    .lateral.pvc
                                                                                    .calculationDetails
                                                                                    .selectedPipeType
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pipeTypeRecommendations.lateral.pvc
                                                                    .pressureLoss !== undefined && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {
                                                                                translations.pressureLoss
                                                                            }
                                                                        </span>
                                                                        <span className="font-semibold text-green-400">
                                                                            {pipeTypeRecommendations.lateral.pvc.pressureLoss.toFixed(
                                                                                2
                                                                            )}{' '}
                                                                            m
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {pipeTypeRecommendations.lateral.pvc
                                                                    .hf !== undefined && (
                                                                    <div className="flex justify-between">
                                                                        <span>
                                                                            {translations.hfLabel}
                                                                        </span>
                                                                        <span className="font-semibold text-green-400">
                                                                            {pipeTypeRecommendations.lateral.pvc.hf.toFixed(
                                                                                3
                                                                            )}{' '}
                                                                            m/100m
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="border-t border-amber-800/50 pt-2">
                                            <div className="mb-2 text-xs text-amber-300">
                                                Zone Details:
                                            </div>
                                            <div className="space-y-1 text-xs text-slate-300">
                                                <div className="flex justify-between">
                                                    <span>{translations.zoneFlowRate}:</span>
                                                    <span className="font-semibold text-amber-400">
                                                        {Math.round(selectedZone.lpm || 0)} LPM
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>{translations.pipeLength}:</span>
                                                    <span className="font-semibold text-amber-400">
                                                        {selectedZone.lateralMeters?.toFixed(1) ||
                                                            '0.0'}{' '}
                                                        m
                                                    </span>
                                                </div>
                                                {longestPipes[selectedPipeZoneId]?.longestLateral >
                                                    0 && (
                                                    <div className="flex justify-between">
                                                        <span>{translations.longestPipe}:</span>
                                                        <span className="font-semibold text-amber-400">
                                                            {longestPipes[
                                                                selectedPipeZoneId
                                                            ].longestLateral.toFixed(1)}{' '}
                                                            m
                                                        </span>
                                                    </div>
                                                )}
                                                {selectedZone.lateralOutlets !== undefined &&
                                                    selectedZone.lateralOutlets > 0 && (
                                                        <div className="flex justify-between">
                                                            <span>
                                                                {translations.outletsLabel}:
                                                            </span>
                                                            <span className="font-semibold text-amber-400">
                                                                {selectedZone.lateralOutlets}
                                                            </span>
                                                        </div>
                                                    )}
                                                <div className="flex justify-between">
                                                    <span>
                                                        {translations.flowPerSprinklerLabel}
                                                    </span>
                                                    <span className="font-semibold text-amber-400">
                                                        {(sprinklerMode === 'preset'
                                                            ? sprinklerSpecs?.flowRatePerMin
                                                            : calculatedSprinklerSpecs?.flowRatePerMin) ||
                                                            0}{' '}
                                                        LPM
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        {!selectedPipeZoneId && (
                            <div className="rounded bg-amber-900/40 p-3 text-sm text-slate-200">
                                {translations.loadingPipeRecommendations}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg bg-sky-900/30 p-3">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="font-semibold text-white">
                                {translations.pumpSelection}
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setShowPumpZoneDropdown(!showPumpZoneDropdown)}
                                    className="flex items-center gap-1 rounded bg-sky-800 px-2 py-1 hover:bg-sky-700"
                                >
                                    <span className="text-xs">
                                        {selectedPumpZoneId === 'all'
                                            ? translations.allZones
                                            : selectedPumpZoneId === 'single'
                                              ? translations.singleZoneHighestFlow
                                              : translations.selectZone}
                                    </span>
                                    <span>{showPumpZoneDropdown ? '▴' : '▾'}</span>
                                </button>
                                {showPumpZoneDropdown && (
                                    <div className="absolute right-0 top-8 z-10 w-56 rounded-lg border border-sky-600 bg-sky-800 shadow-lg">
                                        <button
                                            onClick={() => {
                                                setSelectedPumpZoneId('all');
                                                setShowPumpZoneDropdown(false);
                                            }}
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-sky-700 ${
                                                selectedPumpZoneId === 'all' ? 'bg-sky-700' : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 rounded-full bg-sky-400"></div>
                                                {translations.allZones}
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedPumpZoneId('single');
                                                setShowPumpZoneDropdown(false);
                                            }}
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-sky-700 ${
                                                selectedPumpZoneId === 'single' ? 'bg-sky-700' : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 rounded-full bg-orange-400"></div>
                                                {translations.singleZoneHighestFlow}
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        {selectedPumpZoneId &&
                            (() => {
                                const isAllZones = selectedPumpZoneId === 'all';
                                const selectedZone = isAllZones
                                    ? null
                                    : findHighestFlowRateZone(zones);

                                return (
                                    <div className="space-y-2 rounded bg-sky-900/40 p-3 text-sm text-slate-200">
                                        {isAllZones ? (
                                            // All Zones View
                                            <>
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sky-300">
                                                            {translations.flowRateProduct}:
                                                        </span>
                                                        <span className="font-semibold text-sky-400">
                                                            {pumpRecommendations?.flowRate} LPM
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sky-300">
                                                            {translations.headProduct}:
                                                        </span>
                                                        <span className="font-semibold text-sky-400">
                                                            {pumpRecommendations?.head} m
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sky-300">
                                                            {translations.powerProduct}:
                                                        </span>
                                                        <span className="font-semibold text-sky-400">
                                                            {pumpRecommendations?.power} HP
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="border-t border-sky-800/50 pt-2">
                                                    <div className="mb-1 text-xs text-sky-300">
                                                        {pumpRecommendations?.reason}
                                                    </div>
                                                    <div className="text-xs text-sky-400">
                                                        {pumpRecommendations?.specifications}
                                                    </div>
                                                </div>
                                                <div className="border-t border-sky-800/50 pt-2">
                                                    <div className="mb-2 text-xs text-sky-300">
                                                        {translations.systemOverview}
                                                    </div>
                                                    <div className="space-y-1 text-xs text-slate-300">
                                                        <div className="flex justify-between">
                                                            <span>{translations.totalZones}</span>
                                                            <span className="font-semibold text-sky-400">
                                                                {zones.length}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>
                                                                {translations.totalFlowRateProduct}:
                                                            </span>
                                                            <span className="font-semibold text-sky-400">
                                                                {Math.round(
                                                                    (sprinklerMode === 'preset'
                                                                        ? sprinklerSpecs?.totalLPM
                                                                        : calculatedSprinklerSpecs?.totalLPM) ||
                                                                        0
                                                                )}{' '}
                                                                LPM
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>
                                                                {translations.waterPressureProduct}:
                                                            </span>
                                                            <span className="font-semibold text-sky-400">
                                                                {(sprinklerMode === 'preset'
                                                                    ? sprinklerSpecs?.waterPressure
                                                                    : calculatedSprinklerSpecs?.waterPressure) ||
                                                                    0}{' '}
                                                                Bar
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Pump Calculation Details */}
                                                {pumpRecommendations?.calculationDetails && (
                                                    <div className="border-t border-sky-800/50 pt-2">
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <div className="text-xs font-medium text-sky-300">
                                                                {translations.calculationDetails}
                                                            </div>
                                                            <button
                                                                onClick={() =>
                                                                    setShowPumpCalculationDetails(
                                                                        !showPumpCalculationDetails
                                                                    )
                                                                }
                                                                className="flex items-center gap-2 rounded-lg bg-sky-800/50 px-3 py-1 text-xs text-sky-300 transition-colors hover:bg-sky-700/50"
                                                            >
                                                                <span>
                                                                    {showPumpCalculationDetails
                                                                        ? translations.hideDetails
                                                                        : translations.showDetails}
                                                                </span>
                                                                <span
                                                                    className={`transition-transform duration-200 ${showPumpCalculationDetails ? 'rotate-180' : ''}`}
                                                                >
                                                                    ▼
                                                                </span>
                                                            </button>
                                                        </div>

                                                        {/* รายละเอียดที่ซ่อนไว้ */}
                                                        {showPumpCalculationDetails && (
                                                            <>
                                                                {/* Step 1: System Flow Rate */}
                                                                <div className="mb-3 rounded border border-sky-700/30 bg-sky-800/30 p-2">
                                                                    <div className="mb-1 text-xs font-medium text-sky-300">
                                                                        {translations.step1Label}
                                                                    </div>
                                                                    <div className="text-xs text-slate-300">
                                                                        {
                                                                            translations.systemFlowRate
                                                                        }{' '}
                                                                        <span className="font-semibold text-sky-400">
                                                                            {
                                                                                pumpRecommendations
                                                                                    .calculationDetails
                                                                                    .systemFlowRate
                                                                            }{' '}
                                                                            LPM
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Step 2: TDH Calculation - แยก PE และ PVC */}
                                                                <div className="mb-3 rounded border border-sky-700/30 bg-sky-800/30 p-2">
                                                                    <div className="mb-3 text-xs font-medium text-sky-300">
                                                                        {translations.step2Label}
                                                                    </div>
                                                                    <div className="space-y-3">
                                                                        {/* PE Calculation */}
                                                                        {pumpRecommendations
                                                                            .calculationDetails
                                                                            .pe && (
                                                                            <div className="rounded border border-blue-700/30 bg-blue-900/30 p-2">
                                                                                <div className="mb-2 text-xs font-medium text-blue-300">
                                                                                    PE
                                                                                    (Polyethylene)
                                                                                </div>
                                                                                <div className="space-y-1 text-xs text-slate-300">
                                                                                    {pumpRecommendations
                                                                                        .calculationDetails
                                                                                        .pe
                                                                                        .staticHead !==
                                                                                        undefined &&
                                                                                        pumpRecommendations
                                                                                            .calculationDetails
                                                                                            .pe
                                                                                            .staticHead >
                                                                                            0 && (
                                                                                            <div className="flex justify-between">
                                                                                                <span>
                                                                                                    {
                                                                                                        translations.staticHead
                                                                                                    }
                                                                                                </span>
                                                                                                <span className="font-semibold text-blue-400">
                                                                                                    {
                                                                                                        pumpRecommendations
                                                                                                            .calculationDetails
                                                                                                            .pe
                                                                                                            .staticHead
                                                                                                    }{' '}
                                                                                                    m
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.frictionLosses
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.frictionLosses.totalFrictionLoss.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="ml-3 space-y-0.5 text-xs text-slate-400">
                                                                                        <div className="flex justify-between">
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    translations.mainPipeLabel3
                                                                                                }
                                                                                            </span>
                                                                                            <span>
                                                                                                {pumpRecommendations.calculationDetails.pe.frictionLosses.mainLoss.toFixed(
                                                                                                    2
                                                                                                )}{' '}
                                                                                                m
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex justify-between">
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    translations.subMainPipeLabel3
                                                                                                }
                                                                                            </span>
                                                                                            <span>
                                                                                                {pumpRecommendations.calculationDetails.pe.frictionLosses.subMainLoss.toFixed(
                                                                                                    2
                                                                                                )}{' '}
                                                                                                m
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex justify-between">
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    translations.lateralPipeLabel3
                                                                                                }
                                                                                            </span>
                                                                                            <span>
                                                                                                {pumpRecommendations.calculationDetails.pe.frictionLosses.lateralLoss.toFixed(
                                                                                                    2
                                                                                                )}{' '}
                                                                                                m
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.minorLosses
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.minorLosses.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.pressureRequirement
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.pressureRequirement.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between border-t border-blue-700/50 pt-1">
                                                                                        <span className="font-medium">
                                                                                            {
                                                                                                translations.step2TotalDynamicHead
                                                                                            }
                                                                                            :
                                                                                        </span>
                                                                                        <span className="font-bold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.totalDynamicHead.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* PVC Calculation */}
                                                                        {pumpRecommendations
                                                                            .calculationDetails
                                                                            .pvc && (
                                                                            <div className="rounded border border-green-700/30 bg-green-900/30 p-2">
                                                                                <div className="mb-2 text-xs font-medium text-green-300">
                                                                                    PVC (Polyvinyl
                                                                                    Chloride)
                                                                                </div>
                                                                                <div className="space-y-1 text-xs text-slate-300">
                                                                                    {pumpRecommendations
                                                                                        .calculationDetails
                                                                                        .pvc
                                                                                        .staticHead !==
                                                                                        undefined &&
                                                                                        pumpRecommendations
                                                                                            .calculationDetails
                                                                                            .pvc
                                                                                            .staticHead >
                                                                                            0 && (
                                                                                            <div className="flex justify-between">
                                                                                                <span>
                                                                                                    {
                                                                                                        translations.staticHead
                                                                                                    }
                                                                                                </span>
                                                                                                <span className="font-semibold text-green-400">
                                                                                                    {
                                                                                                        pumpRecommendations
                                                                                                            .calculationDetails
                                                                                                            .pvc
                                                                                                            .staticHead
                                                                                                    }{' '}
                                                                                                    m
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.frictionLosses
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.frictionLosses.totalFrictionLoss.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="ml-3 space-y-0.5 text-xs text-slate-400">
                                                                                        <div className="flex justify-between">
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    translations.mainPipeLabel3
                                                                                                }
                                                                                            </span>
                                                                                            <span>
                                                                                                {pumpRecommendations.calculationDetails.pvc.frictionLosses.mainLoss.toFixed(
                                                                                                    2
                                                                                                )}{' '}
                                                                                                m
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex justify-between">
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    translations.subMainPipeLabel3
                                                                                                }
                                                                                            </span>
                                                                                            <span>
                                                                                                {pumpRecommendations.calculationDetails.pvc.frictionLosses.subMainLoss.toFixed(
                                                                                                    2
                                                                                                )}{' '}
                                                                                                m
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex justify-between">
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    translations.lateralPipeLabel3
                                                                                                }
                                                                                            </span>
                                                                                            <span>
                                                                                                {pumpRecommendations.calculationDetails.pvc.frictionLosses.lateralLoss.toFixed(
                                                                                                    2
                                                                                                )}{' '}
                                                                                                m
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.minorLosses
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.minorLosses.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.pressureRequirement
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.pressureRequirement.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between border-t border-green-700/50 pt-1">
                                                                                        <span className="font-medium">
                                                                                            {
                                                                                                translations.step2TotalDynamicHead
                                                                                            }
                                                                                            :
                                                                                        </span>
                                                                                        <span className="font-bold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.totalDynamicHead.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Step 3: Pump Power - แสดงทั้ง PE และ PVC */}
                                                                <div className="mb-3 rounded border border-sky-700/30 bg-sky-800/30 p-2">
                                                                    <div className="mb-3 text-xs font-medium text-sky-300">
                                                                        {translations.step3Label}
                                                                    </div>
                                                                    <div className="space-y-3">
                                                                        {/* PE Power */}
                                                                        {pumpRecommendations
                                                                            .calculationDetails
                                                                            .pe && (
                                                                            <div className="rounded border border-blue-700/30 bg-blue-900/30 p-2">
                                                                                <div className="mb-2 text-xs font-medium text-blue-300">
                                                                                    PE
                                                                                    (Polyethylene)
                                                                                </div>
                                                                                <div className="space-y-1 text-xs text-slate-300">
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.hydraulicPower
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.hydraulicPower.toFixed(
                                                                                                3
                                                                                            )}{' '}
                                                                                            kW
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.pumpEfficiency
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-blue-400">
                                                                                            {(
                                                                                                pumpRecommendations
                                                                                                    .calculationDetails
                                                                                                    .pe
                                                                                                    .efficiency *
                                                                                                100
                                                                                            ).toFixed(
                                                                                                0
                                                                                            )}
                                                                                            %
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.brakePower
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.brakePower.toFixed(
                                                                                                3
                                                                                            )}{' '}
                                                                                            kW
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between border-t border-blue-700/50 pt-1">
                                                                                        <span className="font-medium">
                                                                                            {
                                                                                                translations.requiredPower
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-bold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.powerHP.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            HP
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* PVC Power */}
                                                                        {pumpRecommendations
                                                                            .calculationDetails
                                                                            .pvc && (
                                                                            <div className="rounded border border-green-700/30 bg-green-900/30 p-2">
                                                                                <div className="mb-2 text-xs font-medium text-green-300">
                                                                                    PVC (Polyvinyl
                                                                                    Chloride)
                                                                                </div>
                                                                                <div className="space-y-1 text-xs text-slate-300">
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.hydraulicPower
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.hydraulicPower.toFixed(
                                                                                                3
                                                                                            )}{' '}
                                                                                            kW
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.pumpEfficiency
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {(
                                                                                                pumpRecommendations
                                                                                                    .calculationDetails
                                                                                                    .pvc
                                                                                                    .efficiency *
                                                                                                100
                                                                                            ).toFixed(
                                                                                                0
                                                                                            )}
                                                                                            %
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.brakePower
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.brakePower.toFixed(
                                                                                                3
                                                                                            )}{' '}
                                                                                            kW
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between border-t border-green-700/50 pt-1">
                                                                                        <span className="font-medium">
                                                                                            {
                                                                                                translations.requiredPower
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-bold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.powerHP.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            HP
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        ) : selectedZone ? (
                                            // Single Zone View (Highest Flow Rate Zone)
                                            <>
                                                <div className="mb-2 flex items-center gap-2 text-xs text-orange-400">
                                                    <span className="h-2 w-2 rounded-full bg-orange-400"></span>
                                                    <span>
                                                        {
                                                            translations.calculatedBasedOnHighestFlowRateZone
                                                        }{' '}
                                                        <strong>{selectedZone.name}</strong>
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sky-300">
                                                            {translations.flowRateProduct}:
                                                        </span>
                                                        <span className="font-semibold text-sky-400">
                                                            {Math.round(selectedZone.lpm || 0)} LPM
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sky-300">
                                                            {translations.headProduct}:
                                                        </span>
                                                        <span className="font-semibold text-sky-400">
                                                            {pumpRecommendations?.head} m
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sky-300">
                                                            {translations.powerProduct}:
                                                        </span>
                                                        <span className="font-semibold text-sky-400">
                                                            {pumpRecommendations?.power} HP
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="border-t border-sky-800/50 pt-2">
                                                    <div className="mb-1 text-xs text-sky-300">
                                                        {pumpRecommendations?.reason}
                                                    </div>
                                                    <div className="text-xs text-sky-400">
                                                        {pumpRecommendations?.specifications}
                                                    </div>
                                                </div>
                                                <div className="border-t border-sky-800/50 pt-2">
                                                    <div className="mb-2 text-xs text-sky-300">
                                                        {translations.highestFlowZoneDetails}:
                                                    </div>
                                                    <div className="space-y-1 text-xs text-slate-300">
                                                        <div className="flex justify-between">
                                                            <span>{translations.zoneName}</span>
                                                            <span className="font-semibold text-sky-400">
                                                                {selectedZone.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>
                                                                {translations.zoneFlowRate}:
                                                            </span>
                                                            <span className="font-semibold text-sky-400">
                                                                {Math.round(selectedZone.lpm || 0)}{' '}
                                                                LPM
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Zone Area:</span>
                                                            <span className="font-semibold text-sky-400">
                                                                {selectedZone.area?.toFixed(2) ||
                                                                    '0.00'}{' '}
                                                                Rai
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{translations.plantsInZone}</span>
                                                            <span className="font-semibold text-sky-400">
                                                                {selectedZone.plants || 0}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>
                                                                {translations.waterPressureProduct}:
                                                            </span>
                                                            <span className="font-semibold text-sky-400">
                                                                {(sprinklerMode === 'preset'
                                                                    ? sprinklerSpecs?.waterPressure
                                                                    : calculatedSprinklerSpecs?.waterPressure) ||
                                                                    0}{' '}
                                                                Bar
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Pump Calculation Details */}
                                                {pumpRecommendations?.calculationDetails && (
                                                    <div className="border-t border-sky-800/50 pt-2">
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <div className="text-xs font-medium text-sky-300">
                                                                {translations.calculationDetails}
                                                            </div>
                                                            <button
                                                                onClick={() =>
                                                                    setShowPumpCalculationDetails(
                                                                        !showPumpCalculationDetails
                                                                    )
                                                                }
                                                                className="flex items-center gap-2 rounded-lg bg-sky-800/50 px-3 py-1 text-xs text-sky-300 transition-colors hover:bg-sky-700/50"
                                                            >
                                                                <span>
                                                                    {showPumpCalculationDetails
                                                                        ? translations.hideDetails
                                                                        : translations.showDetails}
                                                                </span>
                                                                <span
                                                                    className={`transition-transform duration-200 ${showPumpCalculationDetails ? 'rotate-180' : ''}`}
                                                                >
                                                                    ▼
                                                                </span>
                                                            </button>
                                                        </div>

                                                        {/* รายละเอียดที่ซ่อนไว้ */}
                                                        {showPumpCalculationDetails && (
                                                            <>
                                                                {/* Step 1: System Flow Rate */}
                                                                <div className="mb-3 rounded border border-sky-700/30 bg-sky-800/30 p-2">
                                                                    <div className="mb-1 text-xs font-medium text-sky-300">
                                                                        {translations.step1Label}
                                                                    </div>
                                                                    <div className="text-xs text-slate-300">
                                                                        {
                                                                            translations.systemFlowRate
                                                                        }{' '}
                                                                        <span className="font-semibold text-sky-400">
                                                                            {
                                                                                pumpRecommendations
                                                                                    .calculationDetails
                                                                                    .systemFlowRate
                                                                            }{' '}
                                                                            LPM
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Step 2: TDH Calculation - แยก PE และ PVC */}
                                                                <div className="mb-3 rounded border border-sky-700/30 bg-sky-800/30 p-2">
                                                                    <div className="mb-3 text-xs font-medium text-sky-300">
                                                                        {translations.step2Label}
                                                                    </div>
                                                                    <div className="space-y-3">
                                                                        {/* PE Calculation */}
                                                                        {pumpRecommendations
                                                                            .calculationDetails
                                                                            .pe && (
                                                                            <div className="rounded border border-blue-700/30 bg-blue-900/30 p-2">
                                                                                <div className="mb-2 text-xs font-medium text-blue-300">
                                                                                    PE
                                                                                    (Polyethylene)
                                                                                </div>
                                                                                <div className="space-y-1 text-xs text-slate-300">
                                                                                    {pumpRecommendations
                                                                                        .calculationDetails
                                                                                        .pe
                                                                                        .staticHead !==
                                                                                        undefined &&
                                                                                        pumpRecommendations
                                                                                            .calculationDetails
                                                                                            .pe
                                                                                            .staticHead >
                                                                                            0 && (
                                                                                            <div className="flex justify-between">
                                                                                                <span>
                                                                                                    {
                                                                                                        translations.staticHead
                                                                                                    }
                                                                                                </span>
                                                                                                <span className="font-semibold text-blue-400">
                                                                                                    {
                                                                                                        pumpRecommendations
                                                                                                            .calculationDetails
                                                                                                            .pe
                                                                                                            .staticHead
                                                                                                    }{' '}
                                                                                                    m
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.frictionLosses
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.frictionLosses.totalFrictionLoss.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="ml-3 space-y-0.5 text-xs text-slate-400">
                                                                                        <div className="flex justify-between">
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    translations.mainPipeLabel3
                                                                                                }
                                                                                            </span>
                                                                                            <span>
                                                                                                {pumpRecommendations.calculationDetails.pe.frictionLosses.mainLoss.toFixed(
                                                                                                    2
                                                                                                )}{' '}
                                                                                                m
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex justify-between">
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    translations.subMainPipeLabel3
                                                                                                }
                                                                                            </span>
                                                                                            <span>
                                                                                                {pumpRecommendations.calculationDetails.pe.frictionLosses.subMainLoss.toFixed(
                                                                                                    2
                                                                                                )}{' '}
                                                                                                m
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex justify-between">
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    translations.lateralPipeLabel3
                                                                                                }
                                                                                            </span>
                                                                                            <span>
                                                                                                {pumpRecommendations.calculationDetails.pe.frictionLosses.lateralLoss.toFixed(
                                                                                                    2
                                                                                                )}{' '}
                                                                                                m
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.minorLosses
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.minorLosses.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.pressureRequirement
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.pressureRequirement.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between border-t border-blue-700/50 pt-1">
                                                                                        <span className="font-medium">
                                                                                            {
                                                                                                translations.step2TotalDynamicHead
                                                                                            }
                                                                                            :
                                                                                        </span>
                                                                                        <span className="font-bold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.totalDynamicHead.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* PVC Calculation */}
                                                                        {pumpRecommendations
                                                                            .calculationDetails
                                                                            .pvc && (
                                                                            <div className="rounded border border-green-700/30 bg-green-900/30 p-2">
                                                                                <div className="mb-2 text-xs font-medium text-green-300">
                                                                                    PVC (Polyvinyl
                                                                                    Chloride)
                                                                                </div>
                                                                                <div className="space-y-1 text-xs text-slate-300">
                                                                                    {pumpRecommendations
                                                                                        .calculationDetails
                                                                                        .pvc
                                                                                        .staticHead !==
                                                                                        undefined &&
                                                                                        pumpRecommendations
                                                                                            .calculationDetails
                                                                                            .pvc
                                                                                            .staticHead >
                                                                                            0 && (
                                                                                            <div className="flex justify-between">
                                                                                                <span>
                                                                                                    {
                                                                                                        translations.staticHead
                                                                                                    }
                                                                                                </span>
                                                                                                <span className="font-semibold text-green-400">
                                                                                                    {
                                                                                                        pumpRecommendations
                                                                                                            .calculationDetails
                                                                                                            .pvc
                                                                                                            .staticHead
                                                                                                    }{' '}
                                                                                                    m
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.frictionLosses
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.frictionLosses.totalFrictionLoss.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="ml-3 space-y-0.5 text-xs text-slate-400">
                                                                                        <div className="flex justify-between">
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    translations.mainPipeLabel3
                                                                                                }
                                                                                            </span>
                                                                                            <span>
                                                                                                {pumpRecommendations.calculationDetails.pvc.frictionLosses.mainLoss.toFixed(
                                                                                                    2
                                                                                                )}{' '}
                                                                                                m
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex justify-between">
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    translations.subMainPipeLabel3
                                                                                                }
                                                                                            </span>
                                                                                            <span>
                                                                                                {pumpRecommendations.calculationDetails.pvc.frictionLosses.subMainLoss.toFixed(
                                                                                                    2
                                                                                                )}{' '}
                                                                                                m
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex justify-between">
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    translations.lateralPipeLabel3
                                                                                                }
                                                                                            </span>
                                                                                            <span>
                                                                                                {pumpRecommendations.calculationDetails.pvc.frictionLosses.lateralLoss.toFixed(
                                                                                                    2
                                                                                                )}{' '}
                                                                                                m
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.minorLosses
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.minorLosses.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.pressureRequirement
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.pressureRequirement.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between border-t border-green-700/50 pt-1">
                                                                                        <span className="font-medium">
                                                                                            {
                                                                                                translations.step2TotalDynamicHead
                                                                                            }
                                                                                            :
                                                                                        </span>
                                                                                        <span className="font-bold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.totalDynamicHead.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            m
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Step 3: Pump Power - แสดงทั้ง PE และ PVC */}
                                                                <div className="mb-3 rounded border border-sky-700/30 bg-sky-800/30 p-2">
                                                                    <div className="mb-3 text-xs font-medium text-sky-300">
                                                                        {translations.step3Label}
                                                                    </div>
                                                                    <div className="space-y-3">
                                                                        {/* PE Power */}
                                                                        {pumpRecommendations
                                                                            .calculationDetails
                                                                            .pe && (
                                                                            <div className="rounded border border-blue-700/30 bg-blue-900/30 p-2">
                                                                                <div className="mb-2 text-xs font-medium text-blue-300">
                                                                                    PE
                                                                                    (Polyethylene)
                                                                                </div>
                                                                                <div className="space-y-1 text-xs text-slate-300">
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.hydraulicPower
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.hydraulicPower.toFixed(
                                                                                                3
                                                                                            )}{' '}
                                                                                            kW
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.pumpEfficiency
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-blue-400">
                                                                                            {(
                                                                                                pumpRecommendations
                                                                                                    .calculationDetails
                                                                                                    .pe
                                                                                                    .efficiency *
                                                                                                100
                                                                                            ).toFixed(
                                                                                                0
                                                                                            )}
                                                                                            %
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.brakePower
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.brakePower.toFixed(
                                                                                                3
                                                                                            )}{' '}
                                                                                            kW
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between border-t border-blue-700/50 pt-1">
                                                                                        <span className="font-medium">
                                                                                            {
                                                                                                translations.requiredPower
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-bold text-blue-400">
                                                                                            {pumpRecommendations.calculationDetails.pe.powerHP.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            HP
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {/* PVC Power */}
                                                                        {pumpRecommendations
                                                                            .calculationDetails
                                                                            .pvc && (
                                                                            <div className="rounded border border-green-700/30 bg-green-900/30 p-2">
                                                                                <div className="mb-2 text-xs font-medium text-green-300">
                                                                                    PVC (Polyvinyl
                                                                                    Chloride)
                                                                                </div>
                                                                                <div className="space-y-1 text-xs text-slate-300">
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.hydraulicPower
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.hydraulicPower.toFixed(
                                                                                                3
                                                                                            )}{' '}
                                                                                            kW
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.pumpEfficiency
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {(
                                                                                                pumpRecommendations
                                                                                                    .calculationDetails
                                                                                                    .pvc
                                                                                                    .efficiency *
                                                                                                100
                                                                                            ).toFixed(
                                                                                                0
                                                                                            )}
                                                                                            %
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between">
                                                                                        <span>
                                                                                            {
                                                                                                translations.brakePower
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-semibold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.brakePower.toFixed(
                                                                                                3
                                                                                            )}{' '}
                                                                                            kW
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-between border-t border-green-700/50 pt-1">
                                                                                        <span className="font-medium">
                                                                                            {
                                                                                                translations.requiredPower
                                                                                            }
                                                                                        </span>
                                                                                        <span className="font-bold text-green-400">
                                                                                            {pumpRecommendations.calculationDetails.pvc.powerHP.toFixed(
                                                                                                2
                                                                                            )}{' '}
                                                                                            HP
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        ) : null}
                                    </div>
                                );
                            })()}
                        {!selectedPumpZoneId && (
                            <div className="rounded bg-sky-900/40 p-3 text-sm text-slate-200">
                                {translations.loadingPumpRecommendations}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer actions */}
                <div className="mt-4 flex items-center gap-3">
                    <button
                        onClick={handleBack}
                        className="rounded-lg bg-slate-600 px-6 py-3 font-medium text-white hover:bg-slate-500"
                    >
                        {translations.back}
                    </button>
                    <div className="ml-auto">
                        <button
                            onClick={handleCheckout}
                            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
                        >
                            {translations.checkout}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 3. Export
export default FreeProduct;
