// 1. Import
import React from 'react';
import { Head, router } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import { calculatePipeRecommendations, PipeRecommendations } from './utils/pipeSelection';
import { calculatePumpRequirements, PumpRecommendation } from './utils/pumpSelection';

// 2. Component
function FreeProduct() {
    const [imageUrl, setImageUrl] = React.useState<string | null>(null);
    const mapRef = React.useRef<HTMLDivElement>(null);
    const mapInstanceRef = React.useRef<unknown>(null);
    const [zones, setZones] = React.useState<Array<{
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
    }>>([]);
    const [selectedZoneId, setSelectedZoneId] = React.useState<number | null>(null);
    const [showZoneDropdown, setShowZoneDropdown] = React.useState(false);
    const [sprinklerSpecs, setSprinklerSpecs] = React.useState<{
        flowRatePerMin: number;
        waterPressure: number;
        radius: number;
        totalLPM: number;
    } | null>(null);
    const [pipeRecommendations, setPipeRecommendations] = React.useState<PipeRecommendations | null>(null);
    const [pumpRecommendations, setPumpRecommendations] = React.useState<PumpRecommendation | null>(null);

    const handleBack = () => router.visit('/free-plan/summary');
    const handleCheckout = () => alert('Use price data from database (demo)');

    // Load zone data from localStorage
    React.useEffect(() => {
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
                    area?: { totalRai?: number; byZone?: Array<{ zoneId: number; areaRai: number }> };
                    plants?: { total?: number; byZone?: Array<{ zoneId: number; plants: number }> };
                    pipes?: { byZone?: Array<{ 
                        zoneId: number; 
                        mainMeters: number; 
                        subMainMeters: number; 
                        lateralMeters: number;
                        mainOutlets?: number;
                        subMainOutlets?: number;
                        lateralOutlets?: number;
                    }> };
                    flowRate?: { 
                        totalLPM?: number;
                        flowRatePerMin?: number;
                        waterPressure?: number;
                        radius?: number;
                        byZone?: Array<{ zoneId: number; lpm: number }> 
                    };
                } | null = null;
                if (savedSummary) {
                    try {
                        summaryData = JSON.parse(savedSummary);
                    } catch {
                        // ignore parse error
                    }
                }
                
                // Get flow rate config for calculation
                const savedFlowRateConfig = localStorage.getItem('flowRateConfig');
                let flowRatePerMin = 2.5; // default value
                if (savedFlowRateConfig) {
                    try {
                        const config = JSON.parse(savedFlowRateConfig);
                        flowRatePerMin = config.flowRatePerMin || 2.5;
                    } catch {
                        // use default
                    }
                }
                
                const zonesWithData = zonesData.map(zone => {
                    const areaData = summaryData?.area?.byZone?.find((z) => z.zoneId === zone.id);
                    const plantData = summaryData?.plants?.byZone?.find((z) => z.zoneId === zone.id);
                    const pipeData = summaryData?.pipes?.byZone?.find((z) => z.zoneId === zone.id);
                    const flowData = summaryData?.flowRate?.byZone?.find((z) => z.zoneId === zone.id);
                    
                    // Calculate LPM if not available in flowData
                    const calculatedLpm = flowData?.lpm || (plantData?.plants || 0) * flowRatePerMin;
                    
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
                        lpm: calculatedLpm
                    };
                });
                
                console.log('Zones with data:', zonesWithData);
                console.log('Flow rate config:', flowRatePerMin);
                console.log('Summary data:', summaryData);
                
                // Display sprinkler specifications
                console.log('=== SPRINKLER SPECIFICATIONS ===');
                console.log('Flow Rate per Plant:', flowRatePerMin, 'LPM');
                console.log('Water Pressure:', summaryData?.flowRate?.waterPressure || 'Not set', 'Bar');
                console.log('Sprinkler Radius:', summaryData?.flowRate?.radius || 'Not set', 'm');
                console.log('Total Plants:', summaryData?.plants?.total || 0);
                console.log('Total Flow Rate:', (summaryData?.plants?.total || 0) * flowRatePerMin, 'LPM');
                console.log('===============================');
                
                setZones(zonesWithData);
                if (zonesWithData.length > 0) {
                    setSelectedZoneId(zonesWithData[0].id);
                }
                
                // Set sprinkler specifications
                setSprinklerSpecs({
                    flowRatePerMin: flowRatePerMin,
                    waterPressure: summaryData?.flowRate?.waterPressure || 0,
                    radius: summaryData?.flowRate?.radius || 0,
                    totalLPM: summaryData?.flowRate?.totalLPM || 0
                });

                // Calculate pipe recommendations
                const totalFlowRate = summaryData?.flowRate?.totalLPM || 0;
                const avgZoneFlowRate = zonesWithData.length > 0 ? 
                    zonesWithData.reduce((sum, zone) => sum + (zone.lpm || 0), 0) / zonesWithData.length : 0;
                const avgSprinklerFlowRate = sprinklerSpecs?.flowRatePerMin || 2.5;

                const pipeRecs = calculatePipeRecommendations(
                    totalFlowRate,
                    avgZoneFlowRate,
                    avgSprinklerFlowRate
                );
                setPipeRecommendations(pipeRecs);

                // Calculate pump recommendations
                const pumpRecs = calculatePumpRequirements(
                    totalFlowRate,
                    sprinklerSpecs?.waterPressure || 2.0
                );
                setPumpRecommendations(pumpRecs);
            } catch (error) {
                console.error('Error loading zones:', error);
            }
        }
    }, [sprinklerSpecs?.flowRatePerMin, sprinklerSpecs?.waterPressure]);

    // Load Google Maps and render an interactive, read-only map like freeMap
    React.useEffect(() => {
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
                                zone.coordinates.forEach((p) => bounds.extend(new window.google.maps.LatLng(p.lat, p.lng)));
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
                                bounds.extend(new window.google.maps.LatLng(zone.bounds.north, zone.bounds.east));
                                bounds.extend(new window.google.maps.LatLng(zone.bounds.south, zone.bounds.west));
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
                                bounds.extend(new window.google.maps.LatLng(zone.center.lat, zone.center.lng));
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
                        const plantPoints = JSON.parse(savedPlantPoints) as Array<{ position: { lat: number; lng: number } }>;
                        plantPoints.forEach((point) => {
                            new window.google.maps.Marker({
                                position: point.position,
                                map,
                                title: plantData ? `${plantData.name} Plant` : 'Plant',
                                icon: {
                                    url:
                                        'data:image/svg+xml;charset=UTF-8,' +
                                        encodeURIComponent(`
                                            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                                <circle cx="8" cy="8" r="6" fill="#10B981" stroke="#059669" stroke-width="1"/>
                                                <text x="8" y="11" text-anchor="middle" font-size="8" fill="white">${plantData ? plantData.icon : '🌱'}</text>
                                            </svg>
                                        `),
                                    scaledSize: new window.google.maps.Size(16, 16),
                                    anchor: new window.google.maps.Point(8, 8),
                                },
                                clickable: false,
                            });
                            bounds.extend(new window.google.maps.LatLng(point.position.lat, point.position.lng));
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                // Water sources
                const savedWaterSources = localStorage.getItem('waterSources');
                if (savedWaterSources) {
                    try {
                        const waterSources = JSON.parse(savedWaterSources) as Array<{ position: { lat: number; lng: number } }>;
                        waterSources.forEach((ws) => {
                            new window.google.maps.Marker({
                                position: ws.position,
                                map,
                                title: 'Water Source',
                                icon: {
                                    url:
                                        'data:image/svg+xml;charset=UTF-8,' +
                                        encodeURIComponent(`
                                            <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                                <rect x="4" y="4" width="40" height="40" rx="8" fill="#3B82F6" stroke="#1E40AF" stroke-width="3"/>
                                                <rect x="12" y="12" width="24" height="24" rx="4" fill="#FFFFFF"/>
                                                <path d="M24 16C21 16 19 19 19 21.5C19 25 24 30 24 30C24 30 29 25 29 21.5C29 19 27 16 24 16ZM24 23C22.6 23 21.5 21.9 21.5 20.5C21.5 19.1 22.6 18 24 18C25.4 18 26.5 19.1 26.5 20.5C26.5 21.9 25.4 23 24 23Z" fill="#2563EB"/>
                                            </svg>
                                        `),
                                    scaledSize: new window.google.maps.Size(36, 36),
                                    anchor: new window.google.maps.Point(18, 18),
                                },
                            });
                            bounds.extend(new window.google.maps.LatLng(ws.position.lat, ws.position.lng));
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                // Pumps
                const savedPumps = localStorage.getItem('pumps');
                if (savedPumps) {
                    try {
                        const pumps = JSON.parse(savedPumps) as Array<{ position: { lat: number; lng: number } }>;
                        pumps.forEach((pump) => {
                            new window.google.maps.Marker({
                                position: pump.position,
                                map,
                                title: 'Water Pump',
                                icon: {
                                    url: '/images/water-pump.png',
                                    scaledSize: new window.google.maps.Size(32, 32),
                                    anchor: new window.google.maps.Point(16, 16),
                                },
                            });
                            bounds.extend(new window.google.maps.LatLng(pump.position.lat, pump.position.lng));
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                // Pipes
                const savedMainPipes = localStorage.getItem('mainPipes');
                if (savedMainPipes) {
                    try {
                        const mainPipes = JSON.parse(savedMainPipes) as Array<{ fromPump: { lat: number; lng: number }; toZoneCenter: { lat: number; lng: number } }>;
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
                            [pipe.fromPump, pipe.toZoneCenter].forEach((p) => bounds.extend(new window.google.maps.LatLng(p.lat, p.lng)));
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                const savedSubMainPipes = localStorage.getItem('subMainPipes');
                if (savedSubMainPipes) {
                    try {
                        const subMainPipes = JSON.parse(savedSubMainPipes) as Array<{ path: Array<{ lat: number; lng: number }> }>;
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
                            pipe.path.forEach((p) => bounds.extend(new window.google.maps.LatLng(p.lat, p.lng)));
                        });
                    } catch {
                        // ignore parse error
                    }
                }

                const savedLateralPipes = localStorage.getItem('lateralPipes');
                if (savedLateralPipes) {
                    try {
                        const lateralPipes = JSON.parse(savedLateralPipes) as Array<{ path: Array<{ lat: number; lng: number }> }>;
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
                            pipe.path.forEach((p) => bounds.extend(new window.google.maps.LatLng(p.lat, p.lng)));
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
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title="Irrigation Products" />

            {/* Navbar */}
            <FreeNav />

            {/* Main */}
            <div className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
                {/* Top layout */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                    {/* Map preview */}
                    <div className="md:col-span-3 rounded-lg border border-slate-600 bg-slate-600/30 p-4">
                        <div className="h-[300px] overflow-hidden rounded bg-slate-700/40">
                            <div ref={mapRef} className="h-full w-full" />
                            {!window.google && imageUrl && (
                                <img src={imageUrl} alt="Map snapshot" className="h-full w-full object-cover" />
                            )}
                        </div>
                    </div>

                    {/* Right summary panel */}
                    <div className="md:col-span-2 rounded-lg border border-slate-600 bg-slate-600/30 p-4 text-white">
                        <div className="mb-2 flex items-center justify-between">
                            <h2 className="text-lg font-bold">
                                {selectedZoneId ? zones.find(z => z.id === selectedZoneId)?.name || 'Select Zone' : 'Select Zone'}
                            </h2>
                            <div className="relative">
                                <button 
                                    onClick={() => setShowZoneDropdown(!showZoneDropdown)}
                                    className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600 flex items-center gap-1"
                                >
                                    <span className="text-xs">
                                        {selectedZoneId ? zones.find(z => z.id === selectedZoneId)?.name || 'Select Zone' : 'Select Zone'}
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
                        {selectedZoneId && (() => {
                            const selectedZone = zones.find(z => z.id === selectedZoneId);
                            if (!selectedZone) return null;
                            
                            return (
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span>Area</span>
                                        <span className="text-green-400 font-semibold">{selectedZone.area?.toFixed(2) || '0.00'} Rai</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Plants</span>
                                        <span className="text-emerald-400 font-semibold">{selectedZone.plants || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Flow Rate</span>
                                        <span className="text-blue-400 font-semibold">{Math.round(selectedZone.lpm || 0)} LPM</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Main</span>
                                        <div className="text-right">
                                            <div className="text-red-400 font-semibold">{selectedZone.mainMeters?.toFixed(1) || '0.0'} m</div>
                                            {selectedZone.mainOutlets !== undefined && selectedZone.mainOutlets > 0 && (
                                                <div className="text-xs text-red-300">{selectedZone.mainOutlets} outlets</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Sub Main</span>
                                        <div className="text-right">
                                            <div className="text-purple-400 font-semibold">{selectedZone.subMainMeters?.toFixed(1) || '0.0'} m</div>
                                            {selectedZone.subMainOutlets !== undefined && selectedZone.subMainOutlets > 0 && (
                                                <div className="text-xs text-purple-300">{selectedZone.subMainOutlets} outlets</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Lateral</span>
                                        <div className="text-right">
                                            <div className="text-yellow-400 font-semibold">{selectedZone.lateralMeters?.toFixed(1) || '0.0'} m</div>
                                            {selectedZone.lateralOutlets !== undefined && selectedZone.lateralOutlets > 0 && (
                                                <div className="text-xs text-yellow-300">{selectedZone.lateralOutlets} outlets</div>
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
                        <div className="mb-2 font-semibold text-white">Sprinkler Selector</div>
                        {sprinklerSpecs ? (
                            <div className="rounded bg-emerald-900/40 p-3 text-slate-200 text-sm space-y-2">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-emerald-300">Flow Rate:</span>
                                        <span className="font-semibold text-emerald-400">{sprinklerSpecs.flowRatePerMin} LPM/plant</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-emerald-300">Pressure:</span>
                                        <span className="font-semibold text-emerald-400">{sprinklerSpecs.waterPressure} Bar</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-emerald-300">Radius:</span>
                                        <span className="font-semibold text-emerald-400">{sprinklerSpecs.radius} m</span>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-emerald-800/50">
                                    <div className="flex items-center justify-between">
                                        <span className="text-emerald-300">Total Flow Rate:</span>
                                        <span className="font-bold text-emerald-400 text-lg">{Math.round(sprinklerSpecs.totalLPM)} LPM</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded bg-emerald-900/40 p-3 text-slate-200 text-sm">Loading sprinkler specifications...</div>
                        )}
                    </div>

                    <div className="rounded-lg bg-rose-900/30 p-3">
                        <div className="mb-2 font-semibold text-white">Main Pipe Selection</div>
                        {pipeRecommendations ? (
                            <div className="rounded bg-rose-900/40 p-3 text-slate-200 text-sm space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-rose-300">Recommended Size:</span>
                                    <span className="font-semibold text-rose-400">
                                        {pipeRecommendations.main.sizeMM}mm ({pipeRecommendations.main.sizeInch})
                                    </span>
                                </div>
                                <div className="text-xs text-rose-300">
                                    {pipeRecommendations.main.reason}
                                </div>
                                <div className="text-xs text-slate-400">
                                    Total Flow Rate: {Math.round(sprinklerSpecs?.totalLPM || 0)} LPM
                                </div>
                            </div>
                        ) : (
                            <div className="rounded bg-rose-900/40 p-3 text-slate-200 text-sm">Loading pipe recommendations...</div>
                        )}
                    </div>

                    <div className="rounded-lg bg-violet-900/30 p-3">
                        <div className="mb-2 font-semibold text-white">Sub Main Pipe Selection</div>
                        {pipeRecommendations ? (
                            <div className="rounded bg-violet-900/40 p-3 text-slate-200 text-sm space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-violet-300">Recommended Size:</span>
                                    <span className="font-semibold text-violet-400">
                                        {pipeRecommendations.subMain.sizeMM}mm ({pipeRecommendations.subMain.sizeInch})
                                    </span>
                                </div>
                                <div className="text-xs text-violet-300">
                                    {pipeRecommendations.subMain.reason}
                                </div>
                                <div className="text-xs text-slate-400">
                                    Average Flow Rate per Zone: {Math.round((sprinklerSpecs?.totalLPM || 0) / Math.max(zones.length, 1))} LPM
                                </div>
                            </div>
                        ) : (
                            <div className="rounded bg-violet-900/40 p-3 text-slate-200 text-sm">Loading pipe recommendations...</div>
                        )}
                    </div>

                    <div className="rounded-lg bg-amber-900/30 p-3">
                        <div className="mb-2 font-semibold text-white">Lateral Pipe Selection</div>
                        {pipeRecommendations ? (
                            <div className="rounded bg-amber-900/40 p-3 text-slate-200 text-sm space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-amber-300">Recommended Size:</span>
                                    <span className="font-semibold text-amber-400">
                                        {pipeRecommendations.lateral.sizeMM}mm ({pipeRecommendations.lateral.sizeInch})
                                    </span>
                                </div>
                                <div className="text-xs text-amber-300">
                                    {pipeRecommendations.lateral.reason}
                                </div>
                                <div className="text-xs text-slate-400">
                                    Flow Rate per Sprinkler: {sprinklerSpecs?.flowRatePerMin || 0} LPM
                                </div>
                            </div>
                        ) : (
                            <div className="rounded bg-amber-900/40 p-3 text-slate-200 text-sm">Loading pipe recommendations...</div>
                        )}
                    </div>

                    <div className="rounded-lg bg-sky-900/30 p-3">
                        <div className="mb-2 font-semibold text-white">Pump Selection</div>
                        {pumpRecommendations ? (
                            <div className="rounded bg-sky-900/40 p-3 text-slate-200 text-sm space-y-2">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sky-300">Flow Rate:</span>
                                        <span className="font-semibold text-sky-400">{pumpRecommendations.flowRate} LPM</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sky-300">Head:</span>
                                        <span className="font-semibold text-sky-400">{pumpRecommendations.head} m</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sky-300">Power:</span>
                                        <span className="font-semibold text-sky-400">{pumpRecommendations.power} HP</span>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-sky-800/50">
                                    <div className="text-xs text-sky-300 mb-1">
                                        {pumpRecommendations.reason}
                                    </div>
                                    <div className="text-xs text-sky-400">
                                        {pumpRecommendations.specifications}
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-sky-800/50">
                                    <div className="text-xs text-slate-400">
                                        Water Pressure: {sprinklerSpecs?.waterPressure || 0} Bar
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded bg-sky-900/40 p-3 text-slate-200 text-sm">Loading pump recommendations...</div>
                        )}
                    </div>
                </div>

                {/* Footer actions */}
                <div className="mt-4 flex items-center gap-3">
                    <button onClick={handleBack} className="rounded-lg bg-slate-600 px-6 py-3 font-medium text-white hover:bg-slate-500">Back</button>
                    <div className="ml-auto flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-700 px-4 py-3 text-right text-white">
                            <div className="text-xs">Total Price</div>
                            <div className="text-lg font-bold">12,115 Bath</div>
                        </div>
                        <button onClick={handleCheckout} className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">Checkout</button>
                    </div>
                </div>
                <div className="mt-1 text-[10px] text-sky-300">// use price data from database</div>
            </div>
        </div>
    );
}

// 3. Export
export default FreeProduct;
