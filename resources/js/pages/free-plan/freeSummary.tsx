// 1. Import
import React from 'react';
import { Head, router } from '@inertiajs/react';
import FreeNav from './components/freeNav';

// 2. Component
function FreeSummary() {
    const [imageUrl, setImageUrl] = React.useState<string | null>(null);
    const mapRef = React.useRef<HTMLDivElement>(null);
    const mapInstanceRef = React.useRef<unknown>(null);
    const [summaryData, setSummaryData] = React.useState<{
        area: { totalRai: number; byZone: Array<{ zoneId: number; name: string; areaRai: number }> };
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
        zones: number;
    } | null>(null);
    const [expandedZones, setExpandedZones] = React.useState<Set<number>>(new Set());
    const [showFlowRateModal, setShowFlowRateModal] = React.useState(false);
    const [flowRateConfig, setFlowRateConfig] = React.useState({
        flowRatePerMin: 2.5,
        waterPressure: 2.0,
        radius: 4.0
    });

    // Toggle zone expansion
    const toggleZone = (zoneId: number) => {
        setExpandedZones(prev => {
            const newSet = new Set(prev);
            if (newSet.has(zoneId)) {
                newSet.delete(zoneId);
            } else {
                newSet.add(zoneId);
            }
            return newSet;
        });
    };

    // Load summary data from localStorage
    React.useEffect(() => {
        const savedSummary = localStorage.getItem('freePlanSummary');
        const savedZones = localStorage.getItem('zones');
        const savedFlowRateConfig = localStorage.getItem('flowRateConfig');
        
        if (savedSummary) {
            try {
                const summary = JSON.parse(savedSummary);
                const zones = savedZones ? JSON.parse(savedZones) : [];
                
                // Calculate flow rate data
                const flowRatePerMin = flowRateConfig.flowRatePerMin;
                const totalPlants = summary.plants?.total || 0;
                const totalLPM = totalPlants * flowRatePerMin;
                
                // Calculate flow rate by zone
                const flowRateByZone = summary.plants?.byZone?.map(zone => ({
                    zoneId: zone.zoneId,
                    name: zone.name,
                    plants: zone.plants,
                    lpm: zone.plants * flowRatePerMin
                })) || [];
                
                setSummaryData({
                    area: summary.area || { totalRai: 0, byZone: [] },
                    plants: summary.plants || { total: 0, byZone: [] },
                    pipes: summary.pipes || { mainMeters: 0, subMainMeters: 0, lateralMeters: 0, byZone: [] },
                    flowRate: {
                        totalLPM,
                        flowRatePerMin,
                        waterPressure: flowRateConfig.waterPressure,
                        radius: flowRateConfig.radius,
                        byZone: flowRateByZone
                    },
                    zones: zones.length || 0
                });
            } catch (error) {
                console.error('Error loading summary data:', error);
            }
        }

        // Load flow rate configuration
        if (savedFlowRateConfig) {
            try {
                const config = JSON.parse(savedFlowRateConfig);
                setFlowRateConfig(config);
            } catch (error) {
                console.error('Error loading flow rate config:', error);
            }
        }
    }, [flowRateConfig.flowRatePerMin, flowRateConfig.waterPressure, flowRateConfig.radius]);

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
    }, [flowRateConfig.flowRatePerMin, flowRateConfig.waterPressure, flowRateConfig.radius]);

    // Handlers
    const handleSave = () => {
        // Placeholder: save data to storage/server in Pro version
        alert('Saved (demo)');
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
                const totalPlants = summary.plants?.total || 0;
                const totalLPM = totalPlants * flowRateConfig.flowRatePerMin;
                
                // Calculate flow rate by zone
                const flowRateByZone = summary.plants?.byZone?.map(zone => ({
                    zoneId: zone.zoneId,
                    name: zone.name,
                    plants: zone.plants,
                    lpm: zone.plants * flowRateConfig.flowRatePerMin
                })) || [];
                
                // Update summary with flow rate data
                const updatedSummary = {
                    ...summary,
                    flowRate: {
                        totalLPM,
                        flowRatePerMin: flowRateConfig.flowRatePerMin,
                        waterPressure: flowRateConfig.waterPressure,
                        radius: flowRateConfig.radius,
                        byZone: flowRateByZone
                    }
                };
                
                localStorage.setItem('freePlanSummary', JSON.stringify(updatedSummary));
                
                // Update local state
                setSummaryData(prev => prev ? {
                    ...prev,
                    flowRate: {
                        totalLPM,
                        flowRatePerMin: flowRateConfig.flowRatePerMin,
                        waterPressure: flowRateConfig.waterPressure,
                        radius: flowRateConfig.radius,
                        byZone: flowRateByZone
                    }
                } : null);
                
            } catch (error) {
                console.error('Error updating summary with flow rate config:', error);
            }
        }
        
        setShowFlowRateModal(false);
        alert('Flow rate configuration saved!');
    };

    const handleFlowRateChange = (field: string, value: number) => {
        setFlowRateConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Equipment calculation action will be available in Pro version

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title="Irrigation System Summary" />

            {/* Navbar */}
            <FreeNav />

            {/* Header */}
            <div className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white md:text-xl">Irrigation Summary</h2>
                    <div className="flex items-center gap-2 text-xs text-emerald-300">
                        <button onClick={handleSave} className="rounded-lg bg-green-600 px-6 py-2 font-medium text-white hover:bg-green-700">Save</button>
                        <button onClick={handleEdit} className="rounded-lg bg-amber-600 px-6 py-2 font-medium text-white hover:bg-amber-700">Edit</button>
                    </div>
                </div>

                {/* Interactive Google Map (read-only). Fallback to image if map can't load */}
                <div className="mb-6 h-[360px] overflow-hidden rounded-lg border border-slate-600 bg-slate-700/40">
                    <div ref={mapRef} className="h-full w-full" />
                    {!window.google && imageUrl && (
                        <img src={imageUrl} alt="Map snapshot" className="h-full w-full object-cover" />
                    )}
                </div>

                {/* Data Summary */}
                <div className="rounded-lg bg-slate-800/50 p-4">
                    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded-lg bg-slate-700/40 p-3 text-center text-white">
                            <div className="text-sm">Area</div>
                            <div className="text-lg font-semibold">
                                {summaryData ? summaryData.area.totalRai.toFixed(2) : '0.00'} Rai
                            </div>
                        </div>
                        <div className="rounded-lg bg-slate-700/40 p-3 text-center text-white">
                            <div className="text-sm">Zone</div>
                            <div className="text-lg font-semibold">{summaryData?.zones || 0}</div>
                        </div>
                        <div className="rounded-lg bg-slate-700/40 p-3 text-center text-white">
                            <div className="text-sm">Plants</div>
                            <div className="text-lg font-semibold">{summaryData?.plants.total || 0}</div>
                        </div>
                        <div className="rounded-lg bg-slate-700/40 p-3 text-center text-white">
                            <div className="text-sm">Flow</div>
                            <div className="text-lg font-semibold text-blue-400">
                                {summaryData?.flowRate?.totalLPM ? Math.round(summaryData.flowRate.totalLPM) : 0} LPM
                            </div>
                            <div className="text-[10px] text-slate-400">~{summaryData?.flowRate?.flowRatePerMin || flowRateConfig.flowRatePerMin} L/plant/min</div>
                        </div>
                    </div>

                    {/* Flow Rate Summary */}
                    <div className="mb-3 text-white">
                        <h3 className="mb-2 text-base font-semibold">Flow Rate Summary</h3>
                        <div className="space-y-2 text-sm">
                            <div className="rounded-lg bg-slate-700/40 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full bg-blue-500"></span> 
                                        Total Flow Rate
                                    </div>
                                    <div className="text-right">
                                        <div className="text-blue-400 font-semibold text-lg">
                                            {summaryData?.flowRate?.totalLPM ? Math.round(summaryData.flowRate.totalLPM) : 0} LPM
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {summaryData?.plants?.total || 0} plants × {summaryData?.flowRate?.flowRatePerMin || flowRateConfig.flowRatePerMin} LPM
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-lg bg-slate-700/40 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full bg-yellow-500"></span> 
                                        Water Pressure
                                    </div>
                                    <div className="text-right">
                                        <div className="text-yellow-400 font-semibold text-lg">
                                            {summaryData?.flowRate?.waterPressure || flowRateConfig.waterPressure} Bar
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-lg bg-slate-700/40 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full bg-gray-500"></span> 
                                        Sprinkler Radius
                                    </div>
                                    <div className="text-right">
                                        <div className="text-gray-400 font-semibold text-lg">
                                            {summaryData?.flowRate?.radius || flowRateConfig.radius} m
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pipe System Summary */}
                    <div className="mb-3 text-white">
                        <h3 className="mb-2 text-base font-semibold">Pipe System Summary</h3>
                        <div className="space-y-2 text-sm">
                            <div className="rounded-lg bg-slate-700/40 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full bg-red-500"></span> 
                                        Main Pipe ({summaryData?.zones || 0})
                                    </div>
                                    <div className="text-right">
                                        <div>Length: <span className="text-red-400 font-semibold text-lg">{summaryData ? summaryData.pipes.mainMeters.toFixed(1) : '0.0'} m</span></div>
                                        {summaryData?.pipes.mainOutlets !== undefined && (
                                            <div className="text-xs text-slate-400">Outlets: {summaryData.pipes.mainOutlets} sub-main pipes</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-lg bg-slate-700/40 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full bg-purple-500"></span> 
                                        Sub Main Pipe ({summaryData?.zones || 0})
                                    </div>
                                    <div className="text-right">
                                        <div>Length: <span className="text-purple-400 font-semibold text-lg">{summaryData ? summaryData.pipes.subMainMeters.toFixed(1) : '0.0'} m</span></div>
                                        {summaryData?.pipes.subMainOutlets !== undefined && (
                                            <div className="text-xs text-slate-400">Outlets: {summaryData.pipes.subMainOutlets} lateral pipes</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-lg bg-slate-700/40 p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full bg-yellow-500"></span> 
                                        Lateral Pipe ({summaryData?.pipes.subMainOutlets || 0})
                                    </div>
                                    <div className="text-right">
                                        <div>Length: <span className="text-yellow-400 font-semibold text-lg">{summaryData ? summaryData.pipes.lateralMeters.toFixed(1) : '0.0'} m</span></div>
                                        {summaryData?.pipes.lateralOutlets !== undefined && (
                                            <div className="text-xs text-slate-400">Outlets: {summaryData.pipes.lateralOutlets} plants</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Zones */}
                    <div className="space-y-2">
                        {summaryData && summaryData.pipes.byZone.length > 0 ? (
                            summaryData.pipes.byZone.map((zone) => {
                                const zoneArea = summaryData.area.byZone.find(z => z.zoneId === zone.zoneId);
                                const zonePlants = summaryData.plants.byZone.find(z => z.zoneId === zone.zoneId);
                                const isExpanded = expandedZones.has(zone.zoneId);
                                
                                return (
                                    <div key={zone.zoneId} className="rounded-lg bg-slate-700/40 overflow-hidden text-white">
                                        <button
                                            onClick={() => toggleZone(zone.zoneId)}
                                            className="w-full p-3 flex items-center justify-between hover:bg-slate-600/40 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                                    ▶
                                                </span>
                                                <span className="font-semibold">{zone.name}</span>
                                            </div>
                                            <div className="text-xs text-slate-300">
                                                {zoneArea ? `${zoneArea.areaRai.toFixed(2)} Rai` : ''} • {zonePlants?.plants || 0} Plants
                                            </div>
                                        </button>
                                        
                                        {isExpanded && (
                                            <div className="px-3 pb-3 space-y-2 text-xs text-slate-300 border-t border-slate-600/50 pt-2">
                                                {/* Flow Rate for this zone */}
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                                                        Flow Rate
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-semibold text-blue-400 text-lg">
                                                            {summaryData?.flowRate?.byZone?.find(z => z.zoneId === zone.zoneId)?.lpm ? 
                                                                Math.round(summaryData.flowRate.byZone.find(z => z.zoneId === zone.zoneId)!.lpm) : 
                                                                Math.round((zonePlants?.plants || 0) * flowRateConfig.flowRatePerMin)
                                                            } LPM
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">
                                                            {zonePlants?.plants || 0} plants × {summaryData?.flowRate?.flowRatePerMin || flowRateConfig.flowRatePerMin} LPM
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="h-2 w-2 rounded-full bg-red-500"></span>
                                                        Main Pipe
                                                    </div>
                                                    <div className="text-right">
                                                        <div><span className="text-red-400 font-semibold text-lg">{zone.mainMeters.toFixed(1)} m</span></div>
                                                        {zone.mainOutlets !== undefined && (
                                                            <div className="text-[10px] text-slate-400">{zone.mainOutlets} outlets</div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                                                        Sub Main Pipe
                                                    </div>
                                                    <div className="text-right">
                                                        <div><span className="text-purple-400 font-semibold text-lg">{zone.subMainMeters.toFixed(1)} m</span></div>
                                                        {zone.subMainOutlets !== undefined && (
                                                            <div className="text-[10px] text-slate-400">{zone.subMainOutlets} outlets</div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                                                        Lateral Pipe
                                                    </div>
                                                    <div className="text-right">
                                                        <div><span className="text-yellow-400 font-semibold text-lg">{zone.lateralMeters.toFixed(1)} m</span></div>
                                                        {zone.lateralOutlets !== undefined && (
                                                            <div className="text-[10px] text-slate-400">{zone.lateralOutlets} outlets</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="rounded-lg bg-slate-700/40 p-3 text-center text-slate-400">
                                No zone data available
                            </div>
                        )}
                    </div>

                    {/* Equipment Calculation button */}
                    <div className="mt-4 flex items-center justify-between">
                        <button onClick={() => router.visit('/free-plan/map')} className="rounded-lg bg-slate-600 px-6 py-2 font-medium text-white hover:bg-slate-500">Back</button>
                        <div className="text-center">
                            <button onClick={() => router.visit('/free-plan/product')} className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700">Next</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Flow Rate Config Modal */}
            {showFlowRateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-slate-800 p-4 text-white sm:p-6">
                        {/* Header */}
                        <div className="mb-6">
                            <h3 className="text-xl font-bold">Flow Rate Config</h3>
                        </div>

                        {/* Flow Rate Setting Section */}
                        <div className="mb-6">
                            <h4 className="mb-2 text-lg font-semibold">Flow Rate Setting</h4>
                            <p className="mb-4 text-sm text-slate-300">
                                determine flow rate properties for plant ({summaryData?.plants.total || 0} plants)
                            </p>
                            
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {/* Flow Rate per min */}
                                <div className="rounded-lg bg-slate-700/50 p-3">
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 sm:h-8 sm:w-8">
                                            <span className="text-xs sm:text-sm">💧</span>
                                        </div>
                                        <span className="text-xs font-medium sm:text-sm">Flow Rate per min</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={flowRateConfig.flowRatePerMin}
                                            onChange={(e) => handleFlowRateChange('flowRatePerMin', parseFloat(e.target.value) || 0)}
                                            className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-3 sm:py-2"
                                        />
                                        <span className="text-xs text-slate-300 sm:text-sm">LPM</span>
                                    </div>
                                </div>

                                {/* Water Pressure */}
                                <div className="rounded-lg bg-slate-700/50 p-3">
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 sm:h-8 sm:w-8">
                                            <span className="text-xs sm:text-sm">⚡</span>
                                        </div>
                                        <span className="text-xs font-medium sm:text-sm">Water Pressure</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={flowRateConfig.waterPressure}
                                            onChange={(e) => handleFlowRateChange('waterPressure', parseFloat(e.target.value) || 0)}
                                            className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-3 sm:py-2"
                                        />
                                        <span className="text-xs text-slate-300 sm:text-sm">Bar</span>
                                    </div>
                                </div>

                                {/* Radius */}
                                <div className="rounded-lg bg-slate-700/50 p-3 sm:col-span-2 lg:col-span-1">
                                    <div className="mb-2 flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-500 sm:h-8 sm:w-8">
                                            <span className="text-xs sm:text-sm">📏</span>
                                        </div>
                                        <span className="text-xs font-medium sm:text-sm">Radius</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={flowRateConfig.radius}
                                            onChange={(e) => handleFlowRateChange('radius', parseFloat(e.target.value) || 0)}
                                            className="w-full rounded bg-slate-600 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-3 sm:py-2"
                                        />
                                        <span className="text-xs text-slate-300 sm:text-sm">m</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Real-time Statistics */}
                        <div className="mb-6 rounded-lg bg-blue-600/20 p-3 sm:p-4">
                            <div className="mb-3 flex items-center gap-2 sm:mb-4">
                                <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500 sm:h-6 sm:w-6">
                                    <span className="text-xs">📊</span>
                                </div>
                                <h4 className="text-base font-semibold sm:text-lg">Real-time Statistics</h4>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
                                {/* Total plants */}
                                <div className="rounded-lg bg-slate-700/50 p-2 text-center sm:p-3">
                                    <div className="mb-1 flex justify-center">
                                        <span className="text-sm sm:text-lg">🌱</span>
                                    </div>
                                    <div className="text-sm font-bold sm:text-lg">{summaryData?.plants.total || 0}</div>
                                    <div className="text-[10px] text-slate-300 sm:text-xs">Total plants</div>
                                </div>

                                {/* LPM/plant */}
                                <div className="rounded-lg bg-slate-700/50 p-2 text-center sm:p-3">
                                    <div className="mb-1 flex justify-center">
                                        <span className="text-sm sm:text-lg">💧</span>
                                    </div>
                                    <div className="text-sm font-bold sm:text-lg">{flowRateConfig.flowRatePerMin}</div>
                                    <div className="text-[10px] text-slate-300 sm:text-xs">LPM/plant</div>
                                </div>

                                {/* LPM Total */}
                                <div className="rounded-lg bg-slate-700/50 p-2 text-center sm:p-3">
                                    <div className="mb-1 flex justify-center">
                                        <span className="text-sm sm:text-lg">🚿</span>
                                    </div>
                                    <div className="text-sm font-bold sm:text-lg">
                                        {((summaryData?.plants.total || 0) * flowRateConfig.flowRatePerMin).toFixed(0)}
                                    </div>
                                    <div className="text-[10px] text-slate-300 sm:text-xs">LPM Total</div>
                                </div>

                                {/* LPHr Total */}
                                <div className="rounded-lg bg-slate-700/50 p-2 text-center sm:p-3">
                                    <div className="mb-1 flex justify-center">
                                        <span className="text-sm sm:text-lg">⏰</span>
                                    </div>
                                    <div className="text-sm font-bold sm:text-lg">
                                        {(((summaryData?.plants.total || 0) * flowRateConfig.flowRatePerMin) * 60).toFixed(0)}
                                    </div>
                                    <div className="text-[10px] text-slate-300 sm:text-xs">LPHr Total</div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
                            <button
                                onClick={handleFlowRateCancel}
                                className="rounded-lg border border-slate-500 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 sm:px-6"
                            >
                                cancel
                            </button>
                            <button
                                onClick={handleFlowRateApply}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 sm:px-6"
                            >
                                apply setting
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 3. Export
export default FreeSummary;


