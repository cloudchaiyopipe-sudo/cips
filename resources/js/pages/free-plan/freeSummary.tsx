// 1. Import
import { useState, useEffect, useRef, useCallback } from 'react';
import { Head, router } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import { getTranslations } from './utils/language';
import { getPlantImagePath } from './utils/freeCrop';
import { motion, AnimatePresence } from 'framer-motion';

// 2. Component
function FreeSummary() {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<unknown>(null);
    const [summaryData, setSummaryData] = useState<{
        area: {
            totalRai: number;
            byZone: Array<{ zoneId: number; name: string; areaRai: number }>;
        };
        plants: { total: number; byZone: Array<{ zoneId: number; name: string; plants: number }> };
        pipes: {
            mainMeters: number;
            subMainMeters: number;
            lateralMeters: number;
            mainOutlets?: number;
            subMainOutlets?: number;
            lateralOutlets?: number;
            byZone: Array<{
                zoneId: number;
                name: string;
                mainMeters: number;
                subMainMeters: number;
                lateralMeters: number;
                mainOutlets?: number;
                subMainOutlets?: number;
                lateralOutlets?: number;
                longestMainMeters?: number;
                longestSubMainMeters?: number;
                longestLateralMeters?: number;
            }>;
        };
        flowRate: {
            totalLPM: number;
            flowRatePerMin: number;
            waterPressure: number;
            radius: number;
            byZone: Array<{
                zoneId: number;
                name: string;
                plants: number;
                lpm: number;
            }>;
        };
        selectedPlant?: {
            name: string;
            waterNeed: number;
            plantSpacing: number;
            rowSpacing: number;
            icon: string;
        };
        zones: number;
    } | null>(null);
    const [expandedZones, setExpandedZones] = useState<Set<number>>(new Set());
    const [showFlowRateModal, setShowFlowRateModal] = useState(false);
    const [flowRateConfig, setFlowRateConfig] = useState({
        flowRatePerMin: 2.5, // LPM per sprinkler
        sprinklersPerPlant: 1, // จำนวนสปริงเกลอร์ต่อต้น
        waterPressure: 2.0,
        radius: 4.0,
    });
    const [translations, setTranslations] = useState(getTranslations());
    
    // Toast notifications
    interface Toast {
        id: number;
        message: string;
        type: 'success' | 'error' | 'info';
    }
    const [toasts, setToasts] = useState<Toast[]>([]);
    
    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

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

    // Toggle zone expansion
    const toggleZone = (zoneId: number) => {
        setExpandedZones((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(zoneId)) {
                newSet.delete(zoneId);
            } else {
                newSet.add(zoneId);
            }
            return newSet;
        });
    };

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

    // Function to calculate longest pipe lengths for each zone
    const calculateLongestPipes = () => {
        if (!summaryData) return {};

        const longestPipes: {
            [zoneId: number]: {
                longestMain: number;
                longestSubMain: number;
                longestLateral: number;
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
                        zoneId: number;
                        fromPump: { lat: number; lng: number };
                        toZoneCenter: { lat: number; lng: number };
                    }) => {
                        if (!longestPipes[pipe.zoneId]) {
                            longestPipes[pipe.zoneId] = {
                                longestMain: 0,
                                longestSubMain: 0,
                                longestLateral: 0,
                            };
                        }
                        const length = calculateDistance(pipe.fromPump, pipe.toZoneCenter);
                        if (length > longestPipes[pipe.zoneId].longestMain) {
                            longestPipes[pipe.zoneId].longestMain = length;
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
                    (pipe: { zoneId: number; path: Array<{ lat: number; lng: number }> }) => {
                        if (!longestPipes[pipe.zoneId]) {
                            longestPipes[pipe.zoneId] = {
                                longestMain: 0,
                                longestSubMain: 0,
                                longestLateral: 0,
                            };
                        }
                        let totalLength = 0;
                        for (let i = 0; i < pipe.path.length - 1; i++) {
                            totalLength += calculateDistance(pipe.path[i], pipe.path[i + 1]);
                        }
                        if (totalLength > longestPipes[pipe.zoneId].longestSubMain) {
                            longestPipes[pipe.zoneId].longestSubMain = totalLength;
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
                    (pipe: { zoneId: number; path: Array<{ lat: number; lng: number }> }) => {
                        if (!longestPipes[pipe.zoneId]) {
                            longestPipes[pipe.zoneId] = {
                                longestMain: 0,
                                longestSubMain: 0,
                                longestLateral: 0,
                            };
                        }
                        let totalLength = 0;
                        for (let i = 0; i < pipe.path.length - 1; i++) {
                            totalLength += calculateDistance(pipe.path[i], pipe.path[i + 1]);
                        }
                        if (totalLength > longestPipes[pipe.zoneId].longestLateral) {
                            longestPipes[pipe.zoneId].longestLateral = totalLength;
                        }
                    }
                );
            } catch (error) {
                console.error('Error parsing lateral pipes:', error);
            }
        }

        return longestPipes;
    };

    // Load flow rate configuration from localStorage (initial load only)
    useEffect(() => {
        const savedFlowRateConfig = localStorage.getItem('flowRateConfig');
        if (savedFlowRateConfig) {
            try {
                const config = JSON.parse(savedFlowRateConfig);
                // Ensure sprinklersPerPlant exists
                if (!config.sprinklersPerPlant) {
                    config.sprinklersPerPlant = 1;
                }
                setFlowRateConfig(config);
            } catch (error) {
                console.error('Error loading flow rate config:', error);
            }
        }
    }, []); // Only run on mount

    // Load summary data from localStorage (initial load only)
    useEffect(() => {
        const savedSummary = localStorage.getItem('freePlanSummary');
        const savedZones = localStorage.getItem('zones');

        if (savedSummary) {
            try {
                const summary = JSON.parse(savedSummary);
                const zones = savedZones ? JSON.parse(savedZones) : [];

                // Calculate flow rate data using current flowRateConfig
                const flowRatePerMin = flowRateConfig.flowRatePerMin; // LPM per sprinkler
                const sprinklersPerPlant = flowRateConfig.sprinklersPerPlant || 1;
                const totalPlants = summary.plants?.total || 0;
                const totalLPM = totalPlants * sprinklersPerPlant * flowRatePerMin;

                // Calculate flow rate by zone
                const flowRateByZone =
                    summary.plants?.byZone?.map((zone) => ({
                        zoneId: zone.zoneId,
                        name: zone.name,
                        plants: zone.plants,
                        lpm: zone.plants * sprinklersPerPlant * flowRatePerMin,
                    })) || [];

                setSummaryData({
                    area: summary.area || { totalRai: 0, byZone: [] },
                    plants: summary.plants || { total: 0, byZone: [] },
                    pipes: summary.pipes || {
                        mainMeters: 0,
                        subMainMeters: 0,
                        lateralMeters: 0,
                        byZone: [],
                    },
                    flowRate: {
                        totalLPM,
                        flowRatePerMin,
                        waterPressure: flowRateConfig.waterPressure,
                        radius: flowRateConfig.radius,
                        byZone: flowRateByZone,
                    },
                    selectedPlant: summary.selectedPlant || undefined,
                    zones: zones.length || 0,
                });
            } catch (error) {
                console.error('Error loading summary data:', error);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flowRateConfig]); // Run when flowRateConfig is loaded

    // Update summary data when flowRateConfig changes
    useEffect(() => {
        if (!summaryData) return;

        // Calculate flow rate data using current flowRateConfig
        const flowRatePerMin = flowRateConfig.flowRatePerMin; // LPM per sprinkler
        const sprinklersPerPlant = flowRateConfig.sprinklersPerPlant || 1;
        const totalPlants = summaryData.plants?.total || 0;
        const totalLPM = totalPlants * sprinklersPerPlant * flowRatePerMin;

        // Calculate flow rate by zone
        const flowRateByZone =
            summaryData.plants?.byZone?.map((zone) => ({
                zoneId: zone.zoneId,
                name: zone.name,
                plants: zone.plants,
                lpm: zone.plants * sprinklersPerPlant * flowRatePerMin,
            })) || [];

        setSummaryData((prev) =>
            prev
                ? {
                      ...prev,
                      flowRate: {
                          totalLPM,
                          flowRatePerMin,
                          waterPressure: flowRateConfig.waterPressure,
                          radius: flowRateConfig.radius,
                          byZone: flowRateByZone,
                      },
                  }
                : null
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flowRateConfig.flowRatePerMin, flowRateConfig.sprinklersPerPlant, flowRateConfig.waterPressure, flowRateConfig.radius]);

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
                            // Check if this is a custom plant
                            const isCustomPlant = localStorage.getItem('isCustomPlant') === 'true';
                            let markerIcon;
                            
                            if (isCustomPlant) {
                                // Use green circle for custom plants
                                markerIcon = {
                                    path: window.google.maps.SymbolPath.CIRCLE,
                                    scale: 8,
                                    fillColor: '#22c55e', // green-500
                                    fillOpacity: 1,
                                    strokeColor: '#ffffff',
                                    strokeWeight: 2,
                                };
                            } else {
                                // Use plant image for regular plants
                                const plantImagePath = plantData ? getPlantImagePath(plantData.name) : '/freePlanImg/fruits/coconut.png';
                                markerIcon = {
                                    url: plantImagePath,
                                    scaledSize: new window.google.maps.Size(24, 24),
                                    anchor: new window.google.maps.Point(12, 12),
                                };
                            }
                            
                            new window.google.maps.Marker({
                                position: point.position,
                                map,
                                title: plantData ? `${plantData.name} ${translations.plant}` : translations.plant,
                                icon: markerIcon,
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
                                '🔍 Reading shape from localStorage:',
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
                console.error('Failed to render summary map overlays:', error);
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
    }, [flowRateConfig.flowRatePerMin, flowRateConfig.waterPressure, flowRateConfig.radius, translations.plant, translations.waterSource, translations.waterPump]);

    // Handlers
    const handleSave = () => {
        try {
            // Get project name from localStorage or use default
            const savedProjectName = localStorage.getItem('projectName') || translations.untitledProject;

            // Collect all project data
            const projectData = {
                id: Date.now(),
                projectName: savedProjectName,
                savedAt: new Date().toISOString(),
                // Map data
                drawnShapes: localStorage.getItem('drawnShapes')
                    ? JSON.parse(localStorage.getItem('drawnShapes') || '[]')
                    : [],
                waterSources: localStorage.getItem('waterSources')
                    ? JSON.parse(localStorage.getItem('waterSources') || '[]')
                    : [],
                pumps: localStorage.getItem('pumps')
                    ? JSON.parse(localStorage.getItem('pumps') || '[]')
                    : [],
                zones: localStorage.getItem('zones')
                    ? JSON.parse(localStorage.getItem('zones') || '[]')
                    : [],
                plantPoints: localStorage.getItem('plantPoints')
                    ? JSON.parse(localStorage.getItem('plantPoints') || '[]')
                    : [],
                mainPipes: localStorage.getItem('mainPipes')
                    ? JSON.parse(localStorage.getItem('mainPipes') || '[]')
                    : [],
                subMainPipes: localStorage.getItem('subMainPipes')
                    ? JSON.parse(localStorage.getItem('subMainPipes') || '[]')
                    : [],
                lateralPipes: localStorage.getItem('lateralPipes')
                    ? JSON.parse(localStorage.getItem('lateralPipes') || '[]')
                    : [],
                // Config data
                selectedPlantData: localStorage.getItem('selectedPlantData')
                    ? JSON.parse(localStorage.getItem('selectedPlantData') || 'null')
                    : null,
                flowRateConfig: localStorage.getItem('flowRateConfig')
                    ? JSON.parse(localStorage.getItem('flowRateConfig') || '{}')
                    : null,
                mapStepProgress: localStorage.getItem('mapStepProgress')
                    ? JSON.parse(localStorage.getItem('mapStepProgress') || '{}')
                    : null,
                freeMapView: localStorage.getItem('freeMapView')
                    ? JSON.parse(localStorage.getItem('freeMapView') || '{}')
                    : null,
                projectMapImage: localStorage.getItem('projectMapImage') || null,
                // Summary data
                freePlanSummary: summaryData
                    ? {
                          ...summaryData,
                          savedAt: new Date().toISOString(),
                      }
                    : null,
            };

            // Get existing saved projects
            const savedProjects = localStorage.getItem('freePlanProjects');
            const projects = savedProjects ? JSON.parse(savedProjects) : [];

            // Check if project with same name exists, update it, otherwise add new
            const existingIndex = projects.findIndex(
                (p: { projectName: string }) => p.projectName === savedProjectName
            );
            if (existingIndex >= 0) {
                // Update existing project
                projects[existingIndex] = projectData;
                showToast(translations.projectSavedSuccessfully, 'success');
            } else {
                // Adding new project - check if we've reached the limit of 2 projects
                if (projects.length >= 2) {
                    // ถ้ามีโปรเจคครบ 2 โปรเจคแล้ว ให้แสดงเตือนและไม่ให้เพิ่ม
                    showToast(
                        `${translations.cannotAddNewProject}\n${translations.projectLimitReached}\n${translations.pleaseDeleteOldProject}`,
                        'error'
                    );
                    return; // หยุดการทำงาน ไม่บันทึกโปรเจคใหม่
                }

                // Add new project
                projects.push(projectData);

                // Show toast message
                showToast(
                    `${translations.projectSavedWithName.replace('{name}', savedProjectName)}\n${translations.youHaveProjects.replace('{count}', projects.length.toString())}`,
                    'success'
                );
            }

            // Save to localStorage
            localStorage.setItem('freePlanProjects', JSON.stringify(projects));
        } catch (error) {
            console.error('Error saving project:', error);
            showToast(translations.errorSavingProject, 'error');
        }
    };

    const handleEdit = () => {
        setShowFlowRateModal(true);
    };

    const handleFlowRateCancel = () => {
        setShowFlowRateModal(false);
    };

    const handleFlowRateApply = () => {
        // Save flow rate configuration
        localStorage.setItem('flowRateConfig', JSON.stringify(flowRateConfig));

        // Also update the summary data with flow rate config
        const savedSummary = localStorage.getItem('freePlanSummary');
        if (savedSummary) {
            try {
                const summary = JSON.parse(savedSummary);

                // Calculate flow rate data
                const flowRatePerMin = flowRateConfig.flowRatePerMin; // LPM per sprinkler
                const sprinklersPerPlant = flowRateConfig.sprinklersPerPlant || 1;
                const totalPlants = summary.plants?.total || 0;
                const totalLPM = totalPlants * sprinklersPerPlant * flowRatePerMin;

                // Calculate flow rate by zone
                const flowRateByZone =
                    summary.plants?.byZone?.map((zone) => ({
                        zoneId: zone.zoneId,
                        name: zone.name,
                        plants: zone.plants,
                        lpm: zone.plants * sprinklersPerPlant * flowRatePerMin,
                    })) || [];

                // Update summary with flow rate data
                const updatedSummary = {
                    ...summary,
                    flowRate: {
                        totalLPM,
                        flowRatePerMin: flowRateConfig.flowRatePerMin,
                        waterPressure: flowRateConfig.waterPressure,
                        radius: flowRateConfig.radius,
                        byZone: flowRateByZone,
                    },
                };

                localStorage.setItem('freePlanSummary', JSON.stringify(updatedSummary));

                // Update local state
                setSummaryData((prev) =>
                    prev
                        ? {
                              ...prev,
                              flowRate: {
                                  totalLPM,
                                  flowRatePerMin: flowRateConfig.flowRatePerMin,
                                  waterPressure: flowRateConfig.waterPressure,
                                  radius: flowRateConfig.radius,
                                  byZone: flowRateByZone,
                              },
                          }
                        : null
                );
            } catch (error) {
                console.error('Error updating summary with flow rate config:', error);
            }
        }

        setShowFlowRateModal(false);
        showToast(translations.flowRateConfigSaved, 'success');
    };

    const handleFlowRateChange = (field: string, value: number) => {
        setFlowRateConfig((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    // Equipment calculation action will be available in Pro version

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600">
            <Head title={translations.irrigationSummary} />

            {/* Toast Notifications */}
            <div className="fixed top-24 right-4 z-[2000] flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 50, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20, scale: 0.9 }}
                            transition={{ duration: 0.3 }}
                            className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-md max-w-md ${
                                toast.type === 'success' ? 'border-green-500/20 bg-green-900/80 text-green-100' :
                                toast.type === 'error' ? 'border-red-500/20 bg-red-900/80 text-red-100' :
                                'border-blue-500/20 bg-blue-900/80 text-blue-100'
                            }`}
                        >
                            <span className="text-sm font-medium whitespace-pre-line">{toast.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Navbar */}
            <FreeNav />

            {/* Header */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6"
            >
                <div className="mb-4 flex items-center justify-between">
                    <motion.h2 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-lg font-bold text-white md:text-xl"
                    >
                        {translations.irrigationSummary}
                    </motion.h2>
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="flex items-center gap-2 text-sm font-medium text-emerald-300"
                    >
                        <button
                            onClick={handleSave}
                            className="rounded-lg bg-green-600 px-6 py-2 font-medium text-white shadow-md shadow-green-500/50 transition-all duration-300 hover:bg-green-700 hover:shadow-lg hover:shadow-green-500/50 hover:scale-105 active:scale-95"
                        >
                            {translations.save}
                        </button>
                        <button
                            onClick={handleEdit}
                            className="rounded-lg bg-amber-600 px-6 py-2 font-medium text-white shadow-md shadow-amber-500/50 transition-all duration-300 hover:bg-amber-700 hover:shadow-lg hover:shadow-amber-500/50 hover:scale-105 active:scale-95"
                        >
                            {translations.config}
                        </button>
                    </motion.div>
                </div>

                {/* Interactive Google Map (read-only). Fallback to image if map can't load */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="relative mb-4 h-[350px] overflow-hidden rounded-lg border border-slate-700 bg-slate-800 shadow-lg md:h-[420px]"
                >
                    <div ref={mapRef} className="h-full w-full min-h-[350px] md:min-h-[420px]" />
                    {!window.google && imageUrl && (
                        <img
                            src={imageUrl}
                            alt={translations.mapSnapshot}
                            className="h-full w-full object-cover"
                        />
                    )}
                </motion.div>

                {/* Data Summary */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="rounded-lg border border-slate-700 bg-slate-800 p-4 shadow-lg"
                >
                    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                        <motion.div 
                            whileHover={{ scale: 1.05, y: -2 }}
                            className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:border-slate-600"
                        >
                            <div className="mb-1 text-sm font-medium text-slate-300 leading-relaxed">{translations.area}</div>
                            <div className="text-2xl font-bold text-white">
                                {summaryData ? summaryData.area.totalRai.toFixed(2) : '0.00'} <span className="text-base font-semibold text-slate-400">Rai</span>
                            </div>
                        </motion.div>
                        <motion.div 
                            whileHover={{ scale: 1.05, y: -2 }}
                            className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:border-slate-600"
                        >
                            <div className="mb-1 text-sm font-medium text-slate-300 leading-relaxed">{translations.zone}</div>
                            <div className="text-2xl font-bold text-emerald-400">{summaryData?.zones || 0}</div>
                        </motion.div>
                        <motion.div 
                            whileHover={{ scale: 1.05, y: -2 }}
                            className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:border-slate-600"
                        >
                            <div className="mb-1 text-sm font-medium text-slate-300 leading-relaxed">{translations.plants}</div>
                            <div className="text-2xl font-bold text-green-400">
                                {summaryData?.plants.total || 0}
                            </div>
                        </motion.div>
                        <motion.div 
                            whileHover={{ scale: 1.05, y: -2 }}
                            className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:border-slate-600"
                        >
                            <div className="mb-1 text-sm font-medium text-slate-300 leading-relaxed">{translations.flow}</div>
                            <div className="text-2xl font-bold text-blue-400">
                                {summaryData?.flowRate?.totalLPM
                                    ? Math.round(summaryData.flowRate.totalLPM)
                                    : 0}{' '}
                                <span className="text-base font-semibold text-slate-400">LPM</span>
                            </div>
                        </motion.div>
                    </div>

                    {/* Selected Plant Information */}
                    {summaryData?.selectedPlant && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.5 }}
                            className="mb-3 text-white"
                        >
                            <h3 className="mb-2 text-base font-semibold">
                                {translations.plants} Information
                            </h3>
                            <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 shadow-lg transition-all duration-300 hover:shadow-xl">
                                <div className="mb-3 flex items-center gap-3">
                                    <img
                                        src={getPlantImagePath(summaryData.selectedPlant.name)}
                                        alt={summaryData.selectedPlant.name}
                                        className="h-10 w-10 object-contain"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                        }}
                                    />
                                    <span className="text-xl font-bold text-white">
                                        {summaryData.selectedPlant.name}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-3 text-sm leading-relaxed md:grid-cols-2">
                                    <div className="flex items-center justify-between rounded-lg bg-slate-700/50 px-3 py-2">
                                        <span className="font-medium text-slate-300">{translations.waterNeed}</span>
                                        <span className="font-bold text-blue-400">
                                            {summaryData.selectedPlant.waterNeed} <span className="text-xs font-normal text-slate-400">{translations.lPerDayPerPlant}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg bg-slate-700/50 px-3 py-2">
                                        <span className="font-medium text-slate-300">{translations.plantSpacing}</span>
                                        <span className="font-bold text-green-400">
                                            {summaryData.selectedPlant.plantSpacing} <span className="text-xs font-normal text-slate-400">cm</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg bg-slate-700/50 px-3 py-2">
                                        <span className="font-medium text-slate-300">{translations.rowSpacing}</span>
                                        <span className="font-bold text-green-400">
                                            {summaryData.selectedPlant.rowSpacing} <span className="text-xs font-normal text-slate-400">cm</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg bg-cyan-900/30 border border-cyan-700/50 px-3 py-2">
                                        <span className="font-medium text-slate-300">{translations.totalWaterNeed}</span>
                                        <span className="font-bold text-cyan-400">
                                            {Math.round(
                                                summaryData.selectedPlant.waterNeed *
                                                    (summaryData?.plants?.total || 0)
                                            )}{' '}
                                            <span className="text-xs font-normal text-slate-400">L/day</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Flow Rate Summary */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.6 }}
                        className="mb-3 text-white"
                    >
                        <h3 className="mb-2 text-base font-semibold">
                            {translations.flowRateSummary}
                        </h3>
                        <div className="space-y-3 text-sm leading-relaxed">
                            <motion.div 
                                whileHover={{ scale: 1.02, x: 4 }}
                                className="rounded-lg border border-blue-700/50 bg-slate-800 p-4 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-blue-600"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="h-4 w-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></span>
                                        <span className="font-semibold text-slate-200">{translations.totalFlowRate}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-blue-400">
                                            {summaryData?.flowRate?.totalLPM
                                                ? Math.round(summaryData.flowRate.totalLPM)
                                                : 0}{' '}
                                            <span className="text-base font-semibold text-slate-400">LPM</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                            <motion.div 
                                whileHover={{ scale: 1.02, x: 4 }}
                                className="rounded-lg border border-yellow-700/50 bg-slate-800 p-4 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-yellow-600"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="h-4 w-4 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50"></span>
                                        <span className="font-semibold text-slate-200">{translations.waterPressure}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-yellow-400">
                                            {summaryData?.flowRate?.waterPressure ||
                                                flowRateConfig.waterPressure}{' '}
                                            <span className="text-base font-semibold text-slate-400">Bar</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                            <motion.div 
                                whileHover={{ scale: 1.02, x: 4 }}
                                className="rounded-lg border border-gray-700/50 bg-slate-800 p-4 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-gray-600"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="h-4 w-4 rounded-full bg-gray-500 shadow-lg shadow-gray-500/50"></span>
                                        <span className="font-semibold text-slate-200">{translations.sprinklerRadius}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-gray-300">
                                            {summaryData?.flowRate?.radius || flowRateConfig.radius}{' '}
                                            <span className="text-base font-semibold text-slate-400">m</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Pipe System Summary */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.7 }}
                        className="mb-3 text-white"
                    >
                        <h3 className="mb-2 text-base font-semibold">
                            {translations.pipeSystemSummary}
                        </h3>
                        <div className="space-y-3 text-sm leading-relaxed">
                            <motion.div 
                                whileHover={{ scale: 1.02, x: 4 }}
                                className="rounded-lg border border-red-700/50 bg-slate-800 p-4 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-red-600"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="h-4 w-4 rounded-full bg-red-500 shadow-lg shadow-red-500/50"></span>
                                        <div>
                                            <span className="font-semibold text-slate-200">{translations.mainPipe}</span>
                                            <span className="ml-2 text-sm font-medium text-slate-400">({summaryData?.zones || 0})</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="mb-1">
                                            <span className="text-sm font-medium text-slate-400">{translations.length}: </span>
                                            <span className="text-2xl font-bold text-red-400">
                                                {summaryData
                                                    ? summaryData.pipes.mainMeters.toFixed(1)
                                                    : '0.0'}{' '}
                                                <span className="text-base font-semibold text-slate-400">m</span>
                                            </span>
                                        </div>
                                        {summaryData?.pipes.mainOutlets !== undefined && (
                                            <div className="text-sm font-medium text-slate-400">
                                                {translations.outlets}: <span className="font-semibold text-red-300">{summaryData.pipes.mainOutlets}</span> {translations.subMainPipe.toLowerCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                            <motion.div 
                                whileHover={{ scale: 1.02, x: 4 }}
                                className="rounded-lg border border-purple-700/50 bg-slate-800 p-4 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-purple-600"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="h-4 w-4 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50"></span>
                                        <div>
                                            <span className="font-semibold text-slate-200">{translations.subMainPipe}</span>
                                            <span className="ml-2 text-sm font-medium text-slate-400">({summaryData?.zones || 0})</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="mb-1">
                                            <span className="text-sm font-medium text-slate-400">{translations.length}: </span>
                                            <span className="text-2xl font-bold text-purple-400">
                                                {summaryData
                                                    ? summaryData.pipes.subMainMeters.toFixed(1)
                                                    : '0.0'}{' '}
                                                <span className="text-base font-semibold text-slate-400">m</span>
                                            </span>
                                        </div>
                                        {summaryData?.pipes.subMainOutlets !== undefined && (
                                            <div className="text-sm font-medium text-slate-400">
                                                {translations.outlets}: <span className="font-semibold text-purple-300">{summaryData.pipes.subMainOutlets}</span> {translations.lateralPipe.toLowerCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                            <motion.div 
                                whileHover={{ scale: 1.02, x: 4 }}
                                className="rounded-lg border border-yellow-700/50 bg-slate-800 p-4 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-yellow-600"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="h-4 w-4 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50"></span>
                                        <div>
                                            <span className="font-semibold text-slate-200">{translations.lateralPipe}</span>
                                            <span className="ml-2 text-sm font-medium text-slate-400">({summaryData?.pipes.subMainOutlets || 0})</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="mb-1">
                                            <span className="text-sm font-medium text-slate-400">{translations.length}: </span>
                                            <span className="text-2xl font-bold text-yellow-400">
                                                {summaryData
                                                    ? summaryData.pipes.lateralMeters.toFixed(1)
                                                    : '0.0'}{' '}
                                                <span className="text-base font-semibold text-slate-400">m</span>
                                            </span>
                                        </div>
                                        {summaryData?.pipes.lateralOutlets !== undefined && (
                                            <div className="text-sm font-medium text-slate-400">
                                                {translations.outlets}: <span className="font-semibold text-yellow-300">{summaryData.pipes.lateralOutlets}</span> {translations.plants.toLowerCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Zones */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.8 }}
                        className="space-y-3"
                    >
                        {summaryData && summaryData.pipes.byZone.length > 0 ? (
                            summaryData.pipes.byZone.map((zone, index) => {
                                const zoneArea = summaryData.area.byZone.find(
                                    (z) => z.zoneId === zone.zoneId
                                );
                                const zonePlants = summaryData.plants.byZone.find(
                                    (z) => z.zoneId === zone.zoneId
                                );
                                const isExpanded = expandedZones.has(zone.zoneId);

                                return (
                                    <motion.div
                                        key={zone.zoneId}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4, delay: 0.9 + index * 0.1 }}
                                        className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800 text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:border-slate-600"
                                    >
                                        <button
                                            onClick={() => toggleZone(zone.zoneId)}
                                            className="flex w-full items-center justify-between p-4 transition-all duration-300 hover:bg-slate-700/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className={`text-lg transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                                >
                                                    ▶
                                                </span>
                                                <span className="text-lg font-bold text-white">{zone.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm font-medium text-slate-300">
                                                {zoneArea && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="text-emerald-400 font-semibold">{zoneArea.areaRai.toFixed(2)}</span>
                                                        <span className="text-slate-400">Rai</span>
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <span className="text-green-400 font-semibold">{zonePlants?.plants || 0}</span>
                                                    <span className="text-slate-400">{translations.plantsLabel}</span>
                                                </span>
                                            </div>
                                        </button>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div 
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="space-y-4 border-t border-slate-700 px-4 pb-4 pt-4"
                                                >
                                                {/* Flow Rate and Water Need Grid */}
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                    {/* Flow Rate for this zone */}
                                                    <div className="rounded-lg border border-blue-700/50 bg-slate-700/50 p-3">
                                                        <div className="mb-2 flex items-center gap-2">
                                                            <span className="h-3 w-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></span>
                                                            <span className="text-sm font-semibold text-slate-200">{translations.flowRate}</span>
                                                        </div>
                                                        <div className="text-2xl font-bold text-blue-400">
                                                            {summaryData?.flowRate?.byZone?.find(
                                                                (z) => z.zoneId === zone.zoneId
                                                            )?.lpm
                                                                ? Math.round(
                                                                      summaryData.flowRate.byZone.find(
                                                                          (z) =>
                                                                              z.zoneId ===
                                                                              zone.zoneId
                                                                      )!.lpm
                                                                  )
                                                                : Math.round(
                                                                      (zonePlants?.plants || 0) *
                                                                          (flowRateConfig.sprinklersPerPlant || 1) *
                                                                          flowRateConfig.flowRatePerMin
                                                                  )}{' '}
                                                            <span className="text-base font-semibold text-slate-400">LPM</span>
                                                        </div>
                                                    </div>

                                                    {/* Water Need per Session for this zone */}
                                                    {summaryData?.selectedPlant && (
                                                        <div className="rounded-lg border border-cyan-700/50 bg-slate-700/50 p-3">
                                                            <div className="mb-2 flex items-center gap-2">
                                                                <span className="h-3 w-3 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/50"></span>
                                                                <span className="text-sm font-semibold text-slate-200">{translations.waterNeedPerSession}</span>
                                                            </div>
                                                            <div className="text-2xl font-bold text-cyan-400">
                                                                {Math.round(
                                                                    (zonePlants?.plants || 0) *
                                                                        summaryData.selectedPlant
                                                                            .waterNeed
                                                                )}{' '}
                                                                <span className="text-base font-semibold text-slate-400">{translations.lPerSession}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Pipe Information */}
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                    {/* Main Pipe */}
                                                    <div className="rounded-lg border border-red-700/50 bg-slate-700/50 p-3">
                                                        <div className="mb-2 flex items-center gap-2">
                                                            <span className="h-3 w-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50"></span>
                                                            <span className="text-sm font-semibold text-slate-200">
                                                                {translations.mainPipe}
                                                            </span>
                                                        </div>
                                                        <div className="mb-2">
                                                            <div className="text-2xl font-bold text-red-400">
                                                                {zone.mainMeters.toFixed(1)}{' '}
                                                                <span className="text-base font-semibold text-slate-400">m</span>
                                                            </div>
                                                            {(() => {
                                                                const longestPipes =
                                                                    calculateLongestPipes();
                                                                const longestMain =
                                                                    longestPipes[
                                                                        zone.zoneId
                                                                    ]?.longestMain || 0;
                                                                // Only show longest if it's different from total length
                                                                return (
                                                                    longestMain > 0 && 
                                                                    Math.abs(longestMain - zone.mainMeters) > 0.1 && (
                                                                        <div className="mt-1 text-sm font-medium text-red-300">
                                                                            {translations.longest}: {longestMain.toFixed(1)} m
                                                                        </div>
                                                                    )
                                                                );
                                                            })()}
                                                        </div>
                                                        {zone.mainOutlets !== undefined && (
                                                            <div className="text-sm font-medium text-slate-400">
                                                                {translations.outlets}: <span className="font-semibold text-red-300">{zone.mainOutlets}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Sub Main Pipe */}
                                                    <div className="rounded-lg border border-purple-700/50 bg-slate-700/50 p-3">
                                                        <div className="mb-2 flex items-center gap-2">
                                                            <span className="h-3 w-3 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50"></span>
                                                            <span className="text-sm font-semibold text-slate-200">
                                                                {translations.subMainPipe}
                                                            </span>
                                                        </div>
                                                        <div className="mb-2">
                                                            <div className="text-2xl font-bold text-purple-400">
                                                                {zone.subMainMeters.toFixed(1)}{' '}
                                                                <span className="text-base font-semibold text-slate-400">m</span>
                                                            </div>
                                                            {(() => {
                                                                const longestPipes =
                                                                    calculateLongestPipes();
                                                                const longestSubMain =
                                                                    longestPipes[
                                                                        zone.zoneId
                                                                    ]?.longestSubMain || 0;
                                                                // Only show longest if it's different from total length
                                                                return (
                                                                    longestSubMain > 0 && 
                                                                    Math.abs(longestSubMain - zone.subMainMeters) > 0.1 && (
                                                                        <div className="mt-1 text-sm font-medium text-purple-300">
                                                                            {translations.longest}: {longestSubMain.toFixed(1)} m
                                                                        </div>
                                                                    )
                                                                );
                                                            })()}
                                                        </div>
                                                        {zone.subMainOutlets !== undefined && (
                                                            <div className="text-sm font-medium text-slate-400">
                                                                {translations.outlets}: <span className="font-semibold text-purple-300">{zone.subMainOutlets}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Lateral Pipe */}
                                                    <div className="rounded-lg border border-yellow-700/50 bg-slate-700/50 p-3">
                                                        <div className="mb-2 flex items-center gap-2">
                                                            <span className="h-3 w-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50"></span>
                                                            <span className="text-sm font-semibold text-slate-200">
                                                                {translations.lateralPipe}
                                                            </span>
                                                        </div>
                                                        <div className="mb-2">
                                                            <div className="text-2xl font-bold text-yellow-400">
                                                                {zone.lateralMeters.toFixed(1)}{' '}
                                                                <span className="text-base font-semibold text-slate-400">m</span>
                                                            </div>
                                                            {(() => {
                                                                const longestPipes =
                                                                    calculateLongestPipes();
                                                                const longestLateral =
                                                                    longestPipes[
                                                                        zone.zoneId
                                                                    ]?.longestLateral || 0;
                                                                // Only show longest if it's different from total length
                                                                return (
                                                                    longestLateral > 0 && 
                                                                    Math.abs(longestLateral - zone.lateralMeters) > 0.1 && (
                                                                        <div className="mt-1 text-sm font-medium text-yellow-300">
                                                                            {translations.longest}: {longestLateral.toFixed(1)} m
                                                                        </div>
                                                                    )
                                                                );
                                                            })()}
                                                        </div>
                                                        {zone.lateralOutlets !== undefined && (
                                                            <div className="text-sm font-medium text-slate-400">
                                                                {translations.outlets}: <span className="font-semibold text-yellow-300">{zone.lateralOutlets}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-center text-slate-400 shadow-lg"
                            >
                                <span className="text-sm font-medium">{translations.noZoneDataAvailable}</span>
                            </motion.div>
                        )}
                    </motion.div>

                    {/* Equipment Calculation button */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 1.0 }}
                        className="mt-4 flex items-center justify-between"
                    >
                        <button
                            onClick={() => router.visit('/free-plan/map')}
                            className="rounded-lg bg-slate-600 px-6 py-2 font-medium text-white shadow-md shadow-slate-500/50 transition-all duration-300 hover:bg-slate-500 hover:shadow-lg hover:shadow-slate-500/50 hover:scale-105 active:scale-95"
                        >
                            {translations.back}
                        </button>
                        <div className="text-center">
                            <button
                                onClick={() => router.visit('/free-plan/product')}
                                className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white shadow-md shadow-blue-500/50 transition-all duration-300 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 active:scale-95"
                            >
                                {translations.next}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            </motion.div>

            {/* Flow Rate Config Modal */}
            <AnimatePresence>
                {showFlowRateModal && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleFlowRateCancel}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ duration: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-400/20 bg-slate-800/40 backdrop-blur-lg p-4 text-white shadow-xl sm:p-6"
                        >
                        {/* Header */}
                        <div className="mb-6">
                            <h3 className="text-xl font-bold">{translations.flowRateConfig}</h3>
                        </div>

                        {/* Flow Rate Setting Section */}
                        <div className="mb-6">
                            <h4 className="mb-2 text-lg font-semibold">
                                {translations.flowRateSetting}
                            </h4>
                            <p className="mb-4 text-sm text-slate-300">
                                {translations.determineFlowRateProperties} (
                                {summaryData?.plants.total || 0} {translations.plants.toLowerCase()}
                                )
                            </p>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {/* Sprinklers per plant */}
                                <motion.div 
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    className="rounded-lg border border-slate-400/20 bg-slate-700/50 backdrop-blur-sm p-3 shadow-md transition-all duration-300 hover:shadow-lg"
                                >
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 sm:h-8 sm:w-8">
                                            <span className="text-xs sm:text-sm">🌿</span>
                                        </div>
                                        <span className="text-xs font-medium sm:text-sm">
                                            จำนวนสปริงเกลอร์ต่อต้น
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="1"
                                            min="1"
                                            value={flowRateConfig.sprinklersPerPlant || 1}
                                            onChange={(e) =>
                                                handleFlowRateChange(
                                                    'sprinklersPerPlant',
                                                    parseInt(e.target.value) || 1
                                                )
                                            }
                                            className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500 sm:px-3 sm:py-2"
                                        />
                                        <span className="text-xs text-slate-300 sm:text-sm">
                                            ตัว/ต้น
                                        </span>
                                    </div>
                                </motion.div>

                                {/* Flow Rate per min (per sprinkler) */}
                                <motion.div 
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    className="rounded-lg border border-slate-400/20 bg-slate-700/50 backdrop-blur-sm p-3 shadow-md transition-all duration-300 hover:shadow-lg"
                                >
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 sm:h-8 sm:w-8">
                                            <span className="text-xs sm:text-sm">💧</span>
                                        </div>
                                        <span className="text-xs font-medium sm:text-sm">
                                            {translations.flowRatePerMin} (ต่อสปริงเกลอร์)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={flowRateConfig.flowRatePerMin}
                                            onChange={(e) =>
                                                handleFlowRateChange(
                                                    'flowRatePerMin',
                                                    parseFloat(e.target.value) || 0
                                                )
                                            }
                                            className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-3 sm:py-2"
                                        />
                                        <span className="text-xs text-slate-300 sm:text-sm">
                                            LPM
                                        </span>
                                    </div>
                                </motion.div>

                                {/* Water Pressure */}
                                <motion.div 
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    className="rounded-lg border border-slate-400/20 bg-slate-700/50 backdrop-blur-sm p-3 shadow-md transition-all duration-300 hover:shadow-lg"
                                >
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 sm:h-8 sm:w-8">
                                            <span className="text-xs sm:text-sm">⚡</span>
                                        </div>
                                        <span className="text-xs font-medium sm:text-sm">
                                            {translations.waterPressure}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={flowRateConfig.waterPressure}
                                            onChange={(e) =>
                                                handleFlowRateChange(
                                                    'waterPressure',
                                                    parseFloat(e.target.value) || 0
                                                )
                                            }
                                            className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-3 sm:py-2"
                                        />
                                        <span className="text-xs text-slate-300 sm:text-sm">
                                            Bar
                                        </span>
                                    </div>
                                </motion.div>

                                {/* Radius */}
                                <motion.div 
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    className="rounded-lg border border-slate-400/20 bg-slate-700/50 backdrop-blur-sm p-3 shadow-md transition-all duration-300 hover:shadow-lg sm:col-span-2 lg:col-span-1"
                                >
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-500 sm:h-8 sm:w-8">
                                            <span className="text-xs sm:text-sm">📏</span>
                                        </div>
                                        <span className="text-xs font-medium sm:text-sm">
                                            {translations.sprinklerRadius}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={flowRateConfig.radius}
                                            onChange={(e) =>
                                                handleFlowRateChange(
                                                    'radius',
                                                    parseFloat(e.target.value) || 0
                                                )
                                            }
                                            className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-3 sm:py-2"
                                        />
                                        <span className="text-xs text-slate-300 sm:text-sm">m</span>
                                    </div>
                                </motion.div>
                            </div>
                        </div>

                        {/* Real-time Statistics */}
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.2 }}
                            className="mb-6 rounded-lg border border-blue-500/20 bg-blue-600/20 backdrop-blur-sm p-3 shadow-md sm:p-4"
                        >
                            <div className="mb-3 flex items-center gap-2 sm:mb-4">
                                <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500 sm:h-6 sm:w-6">
                                    <span className="text-xs">📊</span>
                                </div>
                                <h4 className="text-base font-semibold sm:text-lg">
                                    {translations.realTimeStatistics}
                                </h4>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
                                {/* Total plants */}
                                <div className="rounded-lg bg-slate-700/50 p-2 text-center sm:p-3">
                                    <div className="mb-1 flex justify-center">
                                        {summaryData?.selectedPlant ? (
                                            <img
                                                src={getPlantImagePath(summaryData.selectedPlant.name)}
                                                alt={summaryData.selectedPlant.name}
                                                className="h-6 w-6 object-contain sm:h-8 sm:w-8"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <span className="text-sm sm:text-lg">🌱</span>
                                        )}
                                    </div>
                                    <div className="text-sm font-bold sm:text-lg">
                                        {summaryData?.plants.total || 0}
                                    </div>
                                    <div className="text-[10px] text-slate-300 sm:text-xs">
                                        {translations.totalPlants}
                                    </div>
                                </div>

                                {/* LPM per sprinkler */}
                                <div className="rounded-lg bg-slate-700/50 p-2 text-center sm:p-3">
                                    <div className="mb-1 flex justify-center">
                                        <span className="text-sm sm:text-lg">💧</span>
                                    </div>
                                    <div className="text-sm font-bold sm:text-lg">
                                        {flowRateConfig.flowRatePerMin}
                                    </div>
                                    <div className="text-[10px] text-slate-300 sm:text-xs">
                                        LPM/สปริงเกลอร์
                                    </div>
                                </div>

                                {/* LPM Total */}
                                <div className="rounded-lg bg-slate-700/50 p-2 text-center sm:p-3">
                                    <div className="mb-1 flex justify-center">
                                        <span className="text-sm sm:text-lg">🚿</span>
                                    </div>
                                    <div className="text-sm font-bold sm:text-lg">
                                        {(
                                            (summaryData?.plants.total || 0) *
                                            (flowRateConfig.sprinklersPerPlant || 1) *
                                            flowRateConfig.flowRatePerMin
                                        ).toFixed(0)}
                                    </div>
                                    <div className="text-[10px] text-slate-300 sm:text-xs">
                                        {translations.lpmTotal}
                                    </div>
                                </div>

                                {/* LPHr Total */}
                                <div className="rounded-lg bg-slate-700/50 p-2 text-center sm:p-3">
                                    <div className="mb-1 flex justify-center">
                                        <span className="text-sm sm:text-lg">⏰</span>
                                    </div>
                                    <div className="text-sm font-bold sm:text-lg">
                                        {(
                                            (summaryData?.plants.total || 0) *
                                            (flowRateConfig.sprinklersPerPlant || 1) *
                                            flowRateConfig.flowRatePerMin *
                                            60
                                        ).toFixed(0)}
                                    </div>
                                    <div className="text-[10px] text-slate-300 sm:text-xs">
                                        {translations.lphrTotal}
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
                            <button
                                onClick={handleFlowRateCancel}
                                className="rounded-lg border border-slate-500 bg-white px-4 py-2 text-sm text-slate-700 shadow-md transition-all duration-300 hover:bg-slate-100 hover:shadow-lg hover:scale-105 active:scale-95 sm:px-6"
                            >
                                {translations.cancel}
                            </button>
                            <button
                                onClick={handleFlowRateApply}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow-md shadow-blue-500/50 transition-all duration-300 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 active:scale-95 sm:px-6"
                            >
                                {translations.applySetting}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// 3. Export
export default FreeSummary;
