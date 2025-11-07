// 1. Import
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Head, router } from '@inertiajs/react';
import FreeNav from './components/freeNav';
import { GardenPlant, getTranslatedPlantName } from './utils/freeCrop';
// import { createVoronoiZones as createVoronoiZonesFromUtils } from '../../utils/autoZoneUtils';
import type { PlantLocation } from '../../utils/irrigationZoneUtils';
import { getTranslations } from './utils/language';
// use dynamic import of html2canvas in handler for better compatibility

// Google Maps TypeScript declarations
interface MapOptions {
    zoom: number;
    center: { lat: number; lng: number };
    mapTypeId: string;
    mapTypeControl?: boolean;
    mapTypeControlOptions?: {
        style: unknown;
        position: unknown;
    };
    styles?: Array<{
        featureType: string;
        elementType: string;
        stylers: Array<{ color: string }>;
    }>;
    // Enable direct wheel zoom without holding Ctrl
    gestureHandling?: 'cooperative' | 'greedy' | 'none' | 'auto';
    scrollwheel?: boolean;
    fullscreenControl?: boolean;
    fullscreenControlOptions?: {
        position: unknown;
    };
}

// 2. Component
function FreeMap() {
    // State
    const [searchValue, setSearchValue] = useState('');
    const [searchResults, setSearchResults] = useState<google.maps.places.AutocompletePrediction[]>(
        []
    );
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [autocompleteService, setAutocompleteService] =
        useState<google.maps.places.AutocompleteService | null>(null);
    const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(
        null
    );
    const [projectName, setProjectName] = useState('');
    const [mapLoaded, setMapLoaded] = useState(false);
    const [apiLoading, setApiLoading] = useState(true);
    const [selectedPlant, setSelectedPlant] = useState<GardenPlant | null>(null);
    const [currentStep, setCurrentStep] = useState(0); // 0: draw area, 1: water, 2: place pump, 3: zones, 4: generate pipe system
    const [completedSteps, setCompletedSteps] = useState<number[]>([]);
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [drawnShapes, setDrawnShapes] = useState<
        Array<{
            overlay: unknown;
            type: string;
            id: number;
            data?: {
                bounds?: { north: number; south: number; east: number; west: number };
                center?: { lat: number; lng: number };
                radius?: number;
                path?: Array<{ lat: number; lng: number }>;
            };
        }>
    >([]);
    const [waterSources, setWaterSources] = useState<
        Array<{
            id: number;
            position: { lat: number; lng: number };
            marker: unknown;
        }>
    >([]);
    const [pumps, setPumps] = useState<
        Array<{
            id: number;
            position: { lat: number; lng: number };
            marker: unknown;
        }>
    >([]);
    const [pumpPlacementPoints, setPumpPlacementPoints] = useState<
        Array<{
            id: number;
            position: { lat: number; lng: number };
            marker: unknown;
            type: 'corner' | 'midpoint';
        }>
    >([]);
    const [mainPipes, setMainPipes] = useState<
        Array<{
            id: number;
            fromPump: { lat: number; lng: number };
            toZoneCenter: { lat: number; lng: number };
            overlay: unknown;
            zoneId: number;
        }>
    >([]);
    const [subMainPipes, setSubMainPipes] = useState<
        Array<{
            id: number;
            path: Array<{ lat: number; lng: number }>;
            overlay: unknown;
            zoneId: number;
        }>
    >([]);
    const [lateralPipes, setLateralPipes] = useState<
        Array<{
            id: number;
            path: Array<{ lat: number; lng: number }>;
            overlay: unknown;
            zoneId: number;
        }>
    >([]);
    const [zones, setZones] = useState<
        Array<{
            id: number;
            name: string;
            color: string;
            bounds: { north: number; south: number; east: number; west: number };
            coordinates?: Array<{ lat: number; lng: number }>; // For polygon zones
            overlay: unknown;
            center: { lat: number; lng: number };
            centerMarker: unknown;
        }>
    >([]);
    const [showZoneModal, setShowZoneModal] = useState(false);
    const [zoneCount, setZoneCount] = useState(2);

    // State for language
    const [translations, setTranslations] = useState(getTranslations());
    const [plantPoints, setPlantPoints] = useState<
        Array<{
            id: number;
            position: { lat: number; lng: number };
            marker: unknown;
        }>
    >([]);
    const mapRef = useRef<HTMLDivElement>(null);
    const drawingManagerRef = useRef<unknown>(null);
    const mapInstanceRef = useRef<unknown>(null);
    const [mapInitialized, setMapInitialized] = useState(false);
    // Remove plant points that overlap a given position within a small radius
    const removeOverlappedPlantPoints = useCallback(
        (position: { lat: number; lng: number }, radiusMeters: number = 5) => {
            console.log(
                `🔍 Removing overlapped plant points within ${radiusMeters}m of position:`,
                position
            );
            const geometry = window.google?.maps?.geometry;

            setPlantPoints((prevPlantPoints) => {
                console.log(`📊 Current plant points count: ${prevPlantPoints.length}`);

                const updated = prevPlantPoints.filter((point) => {
                    if (!geometry?.spherical) {
                        // Rough fallback: 2m ≈ 0.00002 degrees
                        const degTol = 0.00002;
                        const close =
                            Math.abs(point.position.lat - position.lat) <= degTol &&
                            Math.abs(point.position.lng - position.lng) <= degTol;
                        if (close && point.marker) {
                            (point.marker as { setMap: (map: unknown) => void }).setMap(null);
                            console.log(
                                '❌ Removed plant point (fallback method):',
                                point.position
                            );
                        }
                        return !close;
                    }
                    const a = new window.google.maps.LatLng(point.position.lat, point.position.lng);
                    const b = new window.google.maps.LatLng(position.lat, position.lng);
                    const dist = geometry.spherical.computeDistanceBetween(a, b);
                    const overlapped = dist <= radiusMeters;
                    if (overlapped && point.marker) {
                        (point.marker as { setMap: (map: unknown) => void }).setMap(null);
                        console.log(
                            `❌ Removed plant point at distance ${dist.toFixed(2)}m:`,
                            point.position
                        );
                    }
                    return !overlapped;
                });

                console.log(`📊 After filtering: ${updated.length} plant points remaining`);
                console.log(`🗑️ Removed ${prevPlantPoints.length - updated.length} plant points`);

                if (updated.length !== prevPlantPoints.length) {
                    const stored = updated.map((pp) => ({ id: pp.id, position: pp.position }));
                    localStorage.setItem('plantPoints', JSON.stringify(stored));
                    console.log('💾 Updated localStorage with new plant points');
                }

                return updated;
            });
        },
        [setPlantPoints]
    );
    // no-op state removed

    // 3. Hooks
    // Handle incoming data from chooseCrop page
    useEffect(() => {
        // Get data from Inertia page props or localStorage
        const pageData = (
            window as unknown as { page?: { props?: { data?: { selectedPlant?: GardenPlant } } } }
        ).page?.props?.data;
        const localData = localStorage.getItem('selectedPlantData');
        const stepData = localStorage.getItem('mapStepProgress');

        // Console check localStorage data

        if (pageData?.selectedPlant) {
            setSelectedPlant(pageData.selectedPlant);
        } else if (localData) {
            try {
                const plantData = JSON.parse(localData) as GardenPlant;
                setSelectedPlant(plantData);
            } catch (error) {
                console.error('Error parsing localStorage data:', error);
            }
        }

        // Restore step progress
        if (stepData) {
            try {
                const progress = JSON.parse(stepData);
                setCurrentStep(progress.currentStep || 0);
                setCompletedSteps(progress.completedSteps || []);
            } catch (error) {
                console.error('Error parsing step progress:', error);
            }
        } else {
            // If no saved progress, start with step 0 (Draw Area) and auto-activate drawing
            setCurrentStep(0);
            setCompletedSteps([]);
        }

        // Restore drawn shapes from localStorage
        const savedShapes = localStorage.getItem('drawnShapes');
        if (savedShapes) {
            try {
                const shapes = JSON.parse(savedShapes);
                // Note: We'll recreate the overlays when the map is initialized
                setDrawnShapes(
                    shapes.map((shape: { type: string; id: number; data: unknown }) => ({
                        ...shape,
                        overlay: null,
                    }))
                );
            } catch (error) {
                console.error('Error parsing drawn shapes:', error);
            }
        }

        // Restore water sources from localStorage
        const savedWaterSources = localStorage.getItem('waterSources');
        if (savedWaterSources) {
            try {
                const waterSources = JSON.parse(savedWaterSources);
                setWaterSources(
                    waterSources.map(
                        (ws: { id: number; position: { lat: number; lng: number } }) => ({
                            ...ws,
                            marker: null,
                        })
                    )
                );

                // If we have water sources and step 1 is completed, ensure step 1 is marked as completed
                if (waterSources.length > 0 && stepData) {
                    const progress = JSON.parse(stepData);
                    if (progress.completedSteps && !progress.completedSteps.includes(1)) {
                        const newCompletedSteps = [...progress.completedSteps, 1];
                        const newProgress = {
                            currentStep: Math.max(progress.currentStep, 2), // Move to step 2 if still on step 1
                            completedSteps: newCompletedSteps,
                        };
                        localStorage.setItem('mapStepProgress', JSON.stringify(newProgress));
                    }
                }
            } catch (error) {
                console.error('Error parsing water sources:', error);
            }
        }

        // Restore pumps from localStorage
        const savedPumps = localStorage.getItem('pumps');
        if (savedPumps) {
            try {
                const pumps = JSON.parse(savedPumps);
                setPumps(
                    pumps.map((pump: { id: number; position: { lat: number; lng: number } }) => ({
                        ...pump,
                        marker: null,
                    }))
                );
            } catch (error) {
                console.error('Error parsing pumps:', error);
            }
        }

        // Restore zones from localStorage
        const savedZones = localStorage.getItem('zones');
        if (savedZones) {
            try {
                const zones = JSON.parse(savedZones);
                setZones(
                    zones.map(
                        (zone: {
                            id: number;
                            name: string;
                            color: string;
                            bounds: { north: number; south: number; east: number; west: number };
                            coordinates?: Array<{ lat: number; lng: number }>; // For polygon zones
                            center: { lat: number; lng: number };
                        }) => ({
                            ...zone,
                            overlay: null,
                            centerMarker: null,
                        })
                    )
                );
            } catch (error) {
                console.error('Error parsing zones:', error);
            }
        }

        // Restore plant points from localStorage
        const savedPlantPoints = localStorage.getItem('plantPoints');
        if (savedPlantPoints) {
            try {
                const plantPoints = JSON.parse(savedPlantPoints);
                setPlantPoints(
                    plantPoints.map(
                        (point: { id: number; position: { lat: number; lng: number } }) => ({
                            ...point,
                            marker: null,
                        })
                    )
                );
            } catch (error) {
                console.error('Error parsing plant points:', error);
            }
        }

        // Restore main pipes from localStorage
        const savedMainPipes = localStorage.getItem('mainPipes');
        if (savedMainPipes) {
            try {
                const mainPipes = JSON.parse(savedMainPipes);
                setMainPipes(
                    mainPipes.map(
                        (pipe: {
                            id: number;
                            fromPump: { lat: number; lng: number };
                            toZoneCenter: { lat: number; lng: number };
                            zoneId: number;
                        }) => ({
                            ...pipe,
                            overlay: null,
                        })
                    )
                );
            } catch (error) {
                console.error('Error parsing main pipes:', error);
            }
        }

        // Restore sub-main pipes from localStorage
        const savedSubMainPipes = localStorage.getItem('subMainPipes');
        if (savedSubMainPipes) {
            try {
                const subMainPipes = JSON.parse(savedSubMainPipes);
                setSubMainPipes(
                    subMainPipes.map(
                        (pipe: {
                            id: number;
                            path: Array<{ lat: number; lng: number }>;
                            zoneId: number;
                        }) => ({
                            ...pipe,
                            overlay: null,
                        })
                    )
                );
            } catch (error) {
                console.error('Error parsing sub-main pipes:', error);
            }
        }

        // Restore lateral pipes from localStorage
        const savedLateralPipes = localStorage.getItem('lateralPipes');
        if (savedLateralPipes) {
            try {
                const lateralPipes = JSON.parse(savedLateralPipes);
                setLateralPipes(
                    lateralPipes.map(
                        (pipe: {
                            id: number;
                            path: Array<{ lat: number; lng: number }>;
                            zoneId: number;
                        }) => ({
                            ...pipe,
                            overlay: null,
                        })
                    )
                );
            } catch (error) {
                console.error('Error parsing lateral pipes:', error);
            }
        }
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

    // Function to create plant points based on spacing
    const createPlantPoints = useCallback(
        (
            map: google.maps.Map,
            shapeData: {
                bounds?: { north: number; south: number; east: number; west: number };
                center?: { lat: number; lng: number };
                radius?: number;
                path?: Array<{ lat: number; lng: number }>;
            },
            shapeType: string
        ) => {
            // Get plant data from localStorage
            const savedPlantData = localStorage.getItem('selectedPlantData');
            if (!savedPlantData) {
                console.error('❌ No plant data found in localStorage');
                return;
            }

            let plantData;
            try {
                plantData = JSON.parse(savedPlantData);
            } catch (error) {
                console.error('❌ Error parsing plant data:', error);
                return;
            }

            if (!plantData.plantSpacing || !plantData.rowSpacing) {
                console.error('❌ Plant spacing data not found');
                return;
            }

            // Convert spacing from cm to degrees (rough approximation)
            // 1 degree ≈ 111,000 meters
            const plantSpacingDegrees = plantData.plantSpacing / 100 / 111000; // cm to degrees
            const rowSpacingDegrees = plantData.rowSpacing / 100 / 111000; // cm to degrees

            let bounds: { north: number; south: number; east: number; west: number };

            // Get bounds based on shape type
            if (
                shapeType === window.google.maps.drawing.OverlayType.RECTANGLE &&
                shapeData.bounds
            ) {
                bounds = shapeData.bounds;
            } else if (
                shapeType === window.google.maps.drawing.OverlayType.CIRCLE &&
                shapeData.center &&
                shapeData.radius
            ) {
                // Convert circle to approximate rectangle bounds
                const center = shapeData.center;
                const radius = shapeData.radius / 111000; // Convert meters to degrees
                bounds = {
                    north: center.lat + radius,
                    south: center.lat - radius,
                    east: center.lng + radius,
                    west: center.lng - radius,
                };
            } else if (
                shapeType === window.google.maps.drawing.OverlayType.POLYGON &&
                shapeData.path
            ) {
                // Calculate bounds from polygon points
                const path = shapeData.path;
                const lats = path.map((p: { lat: number; lng: number }) => p.lat);
                const lngs = path.map((p: { lat: number; lng: number }) => p.lng);
                bounds = {
                    north: Math.max(...lats),
                    south: Math.min(...lats),
                    east: Math.max(...lngs),
                    west: Math.min(...lngs),
                };
            } else {
                console.error('❌ Unsupported shape type for plant points');
                return;
            }

            // Calculate grid dimensions and centering
            const areaWidth = bounds.east - bounds.west;
            const areaHeight = bounds.north - bounds.south;

            // Calculate how many points can fit in each direction
            const maxPointsWidth = Math.floor(areaWidth / plantSpacingDegrees);
            const maxPointsHeight = Math.floor(areaHeight / rowSpacingDegrees);

            // Calculate actual grid size (use all available space)
            const gridWidth = maxPointsWidth;
            const gridHeight = maxPointsHeight;

            // Calculate total grid dimensions
            const gridTotalWidth = (gridWidth - 1) * plantSpacingDegrees;
            const gridTotalHeight = (gridHeight - 1) * rowSpacingDegrees;

            // Calculate margins to center the grid
            const marginWidth = (areaWidth - gridTotalWidth) / 2;
            const marginHeight = (areaHeight - gridTotalHeight) / 2;

            // Calculate starting position (centered)
            const startLat = bounds.south + marginHeight;
            const startLng = bounds.west + marginWidth;

            // Generate plant points in a centered grid pattern
            const plantPoints: Array<{
                id: number;
                position: { lat: number; lng: number };
                marker: unknown;
            }> = [];
            let pointId = 1;

            for (let row = 0; row < gridHeight; row++) {
                for (let col = 0; col < gridWidth; col++) {
                    const position = {
                        lat: startLat + row * rowSpacingDegrees,
                        lng: startLng + col * plantSpacingDegrees,
                    };

                    // Check if point is within the shape (for polygon and circle)
                    let isWithinShape = true;
                    if (
                        shapeType === window.google.maps.drawing.OverlayType.POLYGON &&
                        shapeData.path
                    ) {
                        isWithinShape = isPointInPolygon(position, shapeData.path);
                    } else if (
                        shapeType === window.google.maps.drawing.OverlayType.CIRCLE &&
                        shapeData.center &&
                        shapeData.radius
                    ) {
                        const distance = getDistanceFromLatLonInMeters(position, shapeData.center);
                        isWithinShape = distance <= shapeData.radius;
                    }

                    if (isWithinShape) {
                        // Create plant point marker
                        const marker = new window.google.maps.Marker({
                            position: position,
                            map: map,
                            title: `${getTranslatedPlantName(plantData.name, translations)} Plant`,
                            icon: {
                                url:
                                    'data:image/svg+xml;charset=UTF-8,' +
                                    encodeURIComponent(`
                                <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="8" cy="8" r="6" fill="#10B981" stroke="#059669" stroke-width="1"/>
                                    <text x="8" y="11" text-anchor="middle" font-size="8" fill="white">${plantData.icon}</text>
                                </svg>
                            `),
                                scaledSize: new window.google.maps.Size(16, 16),
                                anchor: new window.google.maps.Point(8, 8),
                            },
                            draggable: false,
                            clickable: false,
                            zIndex: 500, // Between area and zones
                        });

                        plantPoints.push({
                            id: pointId++,
                            position: position,
                            marker: marker,
                        });
                    }
                }
            }

            // Update state
            setPlantPoints(plantPoints);

            // Save to localStorage
            const plantPointsForStorage = plantPoints.map((point) => ({
                id: point.id,
                position: point.position,
            }));
            localStorage.setItem('plantPoints', JSON.stringify(plantPointsForStorage));

            return plantPoints;
        },
        [translations]
    );

    // Helper function to check if point is inside polygon
    const isPointInPolygon = (
        point: { lat: number; lng: number },
        polygon: Array<{ lat: number; lng: number }>
    ) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (
                polygon[i].lat > point.lat !== polygon[j].lat > point.lat &&
                point.lng <
                    ((polygon[j].lng - polygon[i].lng) * (point.lat - polygon[i].lat)) /
                        (polygon[j].lat - polygon[i].lat) +
                        polygon[i].lng
            ) {
                inside = !inside;
            }
        }
        return inside;
    };

    // Helper function to calculate distance between two points
    const getDistanceFromLatLonInMeters = (
        point1: { lat: number; lng: number },
        point2: { lat: number; lng: number }
    ) => {
        const R = 6371000; // Radius of the earth in meters
        const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
        const dLon = ((point2.lng - point1.lng) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((point1.lat * Math.PI) / 180) *
                Math.cos((point2.lat * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    useEffect(() => {
        let isMounted = true;

        // Only initialize map once
        if (mapInitialized) return;

        // Load Google Maps script
        const loadGoogleMaps = () => {
            // Check if Google Maps is already loaded with all required libraries
            if (
                window.google &&
                window.google.maps &&
                window.google.maps.drawing &&
                window.google.maps.geometry
            ) {
                if (isMounted) {
                    setApiLoading(false);
                    setMapLoaded(true);
                    initializeMap();
                }
                return;
            }

            const script = document.createElement('script');
            // Include geometry library for distance/area calculations used in summary
            script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY'}&libraries=places,drawing,geometry`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                // Wait a bit more to ensure all libraries are fully loaded
                setTimeout(() => {
                    if (
                        isMounted &&
                        window.google &&
                        window.google.maps &&
                        window.google.maps.drawing
                    ) {
                        setApiLoading(false);
                        setMapLoaded(true);
                        initializeMap();
                    } else {
                        console.warn('Google Maps libraries not fully loaded yet, retrying...');
                        setTimeout(() => {
                            if (isMounted) {
                                setApiLoading(false);
                                setMapLoaded(true);
                                initializeMap();
                            }
                        }, 500);
                    }
                }, 100);
            };
            script.onerror = () => {
                console.error('Failed to load Google Maps API');
                if (isMounted) {
                    setApiLoading(false);
                    setMapLoaded(false);
                }
            };
            document.head.appendChild(script);
        };

        const initializeMap = () => {
            if (!isMounted || !mapRef.current || !window.google || !window.google.maps) {
                console.warn('Google Maps not ready for initialization');
                return;
            }

            // Default center (Bangkok, Thailand)
            const defaultLocation = {
                lat: 13.7563,
                lng: 100.5018,
            };

            // Restore previous map view if available
            const savedView = localStorage.getItem('freeMapView');
            let startZoom = 15;
            let startCenter = defaultLocation;
            if (savedView) {
                try {
                    const parsed = JSON.parse(savedView) as {
                        zoom: number;
                        center: { lat: number; lng: number };
                    };
                    if (
                        typeof parsed.zoom === 'number' &&
                        parsed.center?.lat &&
                        parsed.center?.lng
                    ) {
                        startZoom = parsed.zoom;
                        startCenter = parsed.center;
                    }
                } catch {
                    // ignore parse error
                }
            }

            const mapOptions: MapOptions = {
                zoom: startZoom,
                center: startCenter,
                mapTypeId: window.google.maps.MapTypeId.SATELLITE,
                mapTypeControl: false,
                mapTypeControlOptions: {
                    style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                    position: window.google.maps.ControlPosition.TOP_CENTER,
                },
                // Allow scroll wheel zoom without holding Ctrl
                gestureHandling: 'greedy',
                scrollwheel: true,
                // Adjust fullscreen control position
                fullscreenControl: true,
                fullscreenControlOptions: {
                    position: window.google.maps.ControlPosition.BOTTOM_RIGHT,
                },
            };

            const map = new window.google.maps.Map(mapRef.current, mapOptions);
            mapInstanceRef.current = map;
            setMapInitialized(true);

            // Initialize Places services for search functionality
            if (window.google.maps.places) {
                const autocomplete = new window.google.maps.places.AutocompleteService();
                const places = new window.google.maps.places.PlacesService(map);
                setAutocompleteService(autocomplete);
                setPlacesService(places);
            }

            // Clear search value when map initializes
            setSearchValue('');

            // Persist map view changes
            map.addListener('idle', () => {
                const center = map.getCenter();
                if (!center) return;
                const view = {
                    zoom: map.getZoom() || startZoom,
                    center: { lat: center.lat(), lng: center.lng() },
                };
                localStorage.setItem('freeMapView', JSON.stringify(view));
            });

            // Initialize drawing manager with proper error handling
            const initializeDrawingManager = () => {
                try {
                    // Check if drawing library is available
                    if (!window.google?.maps?.drawing?.DrawingManager) {
                        console.warn(
                            'Google Maps drawing library not ready yet. Scheduling retry...'
                        );
                        setTimeout(() => {
                            initializeDrawingManager();
                        }, 500);
                        return;
                    }

                    const drawingManager = new window.google.maps.drawing.DrawingManager({
                        drawingMode: null,
                        drawingControl: false, // Initially hidden
                        drawingControlOptions: {
                            position: window.google.maps.ControlPosition.LEFT_TOP,
                            drawingModes: [
                                window.google.maps.drawing.OverlayType.POLYGON,
                                window.google.maps.drawing.OverlayType.RECTANGLE,
                                window.google.maps.drawing.OverlayType.CIRCLE,
                            ],
                        },
                        polygonOptions: {
                            fillColor: '#10b981',
                            fillOpacity: 0.2, // Lower opacity so zones can be seen on top
                            strokeColor: '#10b981',
                            strokeOpacity: 0.6,
                            strokeWeight: 2,
                            clickable: true,
                            zIndex: 100, // Lower z-index to appear below zones
                        },
                        rectangleOptions: {
                            fillColor: '#10b981',
                            fillOpacity: 0.2, // Lower opacity so zones can be seen on top
                            strokeColor: '#10b981',
                            strokeOpacity: 0.6,
                            strokeWeight: 2,
                            clickable: true,
                            zIndex: 100, // Lower z-index to appear below zones
                        },
                        circleOptions: {
                            fillColor: '#10b981',
                            fillOpacity: 0.2, // Lower opacity so zones can be seen on top
                            strokeColor: '#10b981',
                            strokeOpacity: 0.6,
                            strokeWeight: 2,
                            clickable: true,
                            zIndex: 100, // Lower z-index to appear below zones
                        },
                    });

                    drawingManager.setMap(map);
                    drawingManagerRef.current = drawingManager;
                    console.log('✅ DrawingManager initialized successfully');
                } catch (error) {
                    console.error('❌ Failed to initialize DrawingManager:', error);
                    // Retry after a longer delay
                    setTimeout(() => {
                        initializeDrawingManager();
                    }, 1000);
                }
            };

            // Initialize drawing manager
            initializeDrawingManager();

            // Recreate zone overlays from saved data
            if (zones.length > 0) {
                zones.forEach((zone) => {
                    if (zone.bounds && !zone.overlay) {
                        let overlay: google.maps.Rectangle | google.maps.Polygon;

                        // Check if zone has coordinates (polygon) or just bounds (rectangle)
                        if (zone.coordinates && zone.coordinates.length > 0) {
                            // Create polygon overlay for Voronoi zones
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
                        } else {
                            // Create rectangle overlay for legacy zones
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
                        }

                        overlay.setMap(map);

                        // Recreate center marker if center data exists
                        let centerMarker = null;
                        if (zone.center) {
                            centerMarker = createZoneCenterMarker(
                                map,
                                zone.center,
                                zone.name,
                                zone.color
                            );
                        }

                        setZones((prev) =>
                            prev.map((z) =>
                                z.id === zone.id ? { ...z, overlay, centerMarker } : z
                            )
                        );
                    }
                });
            }

            // Recreate plant point markers from saved data
            if (plantPoints.length > 0) {
                // Get plant data for icon
                const savedPlantData = localStorage.getItem('selectedPlantData');
                let plantData: { name: string; icon: string } | null = null;
                if (savedPlantData) {
                    try {
                        plantData = JSON.parse(savedPlantData);
                    } catch (error) {
                        console.error('Error parsing plant data for markers:', error);
                    }
                }

                plantPoints.forEach((point) => {
                    if (point.position && !point.marker) {
                        const marker = new window.google.maps.Marker({
                            position: point.position,
                            map: map,
                            title: plantData
                                ? `${getTranslatedPlantName(plantData.name, translations)} Plant`
                                : 'Plant',
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
                            draggable: false,
                            clickable: false,
                            zIndex: 500, // Between area and zones
                        });
                        setPlantPoints((prev) =>
                            prev.map((p) => (p.id === point.id ? { ...p, marker } : p))
                        );
                    }
                });
            }

            // Recreate main pipes from saved data
            if (mainPipes.length > 0) {
                mainPipes.forEach((pipe) => {
                    if (pipe.fromPump && pipe.toZoneCenter && !pipe.overlay) {
                        const polyline = new window.google.maps.Polyline({
                            path: [pipe.fromPump, pipe.toZoneCenter],
                            geodesic: true,
                            strokeColor: '#DC2626', // Red color for main pipes
                            strokeOpacity: 0.8,
                            strokeWeight: 4, // Thicker line for main pipes
                            zIndex: 1200, // Between zones and center markers
                        });

                        polyline.setMap(map);
                        setMainPipes((prev) =>
                            prev.map((p) => (p.id === pipe.id ? { ...p, overlay: polyline } : p))
                        );
                    }
                });
            }

            // Recreate sub-main pipes from saved data
            if (subMainPipes.length > 0) {
                subMainPipes.forEach((pipe) => {
                    if (pipe.path && pipe.path.length > 0 && !pipe.overlay) {
                        const polyline = new window.google.maps.Polyline({
                            path: pipe.path,
                            geodesic: true,
                            strokeColor: '#8B5CF6', // Purple color for sub-main pipes
                            strokeOpacity: 0.7,
                            strokeWeight: 3, // Slightly thinner than main pipes
                            zIndex: 1100, // Between main pipes and zones
                        });

                        polyline.setMap(map);
                        setSubMainPipes((prev) =>
                            prev.map((p) => (p.id === pipe.id ? { ...p, overlay: polyline } : p))
                        );
                    }
                });
            }

            // Recreate lateral pipes from saved data
            if (lateralPipes.length > 0) {
                lateralPipes.forEach((pipe) => {
                    if (pipe.path && pipe.path.length > 0 && !pipe.overlay) {
                        const polyline = new window.google.maps.Polyline({
                            path: pipe.path,
                            geodesic: true,
                            strokeColor: '#FCD34D', // Yellow color for lateral pipes
                            strokeOpacity: 0.8,
                            strokeWeight: 2, // Thinner than sub-main pipes
                            zIndex: 1000, // Below sub-main pipes
                        });

                        polyline.setMap(map);
                        setLateralPipes((prev) =>
                            prev.map((p) => (p.id === pipe.id ? { ...p, overlay: polyline } : p))
                        );
                    }
                });
            }

            // Recreate overlays from saved data
            if (drawnShapes.length > 0) {
                drawnShapes.forEach((shape) => {
                    if (shape.data) {
                        let overlay: unknown = null;

                        if (
                            shape.type === window.google.maps.drawing.OverlayType.POLYGON &&
                            shape.data.path
                        ) {
                            overlay = new window.google.maps.Polygon({
                                paths: shape.data.path,
                                fillColor: '#10b981',
                                fillOpacity: 0.2, // Lower opacity so zones can be seen on top
                                strokeColor: '#10b981',
                                strokeOpacity: 0.6,
                                strokeWeight: 2,
                                editable: false,
                                draggable: false,
                                clickable: true, // Keep clickable for water source placement
                                zIndex: 100, // Lower z-index to appear below zones
                            });
                            (overlay as { setMap: (map: unknown) => void }).setMap(map);
                        } else if (
                            shape.type === window.google.maps.drawing.OverlayType.RECTANGLE &&
                            shape.data.bounds
                        ) {
                            overlay = new window.google.maps.Rectangle({
                                bounds: new window.google.maps.LatLngBounds(
                                    { lat: shape.data.bounds.south, lng: shape.data.bounds.west },
                                    { lat: shape.data.bounds.north, lng: shape.data.bounds.east }
                                ),
                                fillColor: '#10b981',
                                fillOpacity: 0.2, // Lower opacity so zones can be seen on top
                                strokeColor: '#10b981',
                                strokeOpacity: 0.6,
                                strokeWeight: 2,
                                editable: false,
                                draggable: false,
                                clickable: true, // Keep clickable for water source placement
                                zIndex: 100, // Lower z-index to appear below zones
                            });
                            (overlay as { setMap: (map: unknown) => void }).setMap(map);
                        } else if (
                            shape.type === window.google.maps.drawing.OverlayType.CIRCLE &&
                            shape.data.center &&
                            shape.data.radius
                        ) {
                            overlay = new window.google.maps.Circle({
                                center: { lat: shape.data.center.lat, lng: shape.data.center.lng },
                                radius: shape.data.radius,
                                fillColor: '#10b981',
                                fillOpacity: 0.2, // Lower opacity so zones can be seen on top
                                strokeColor: '#10b981',
                                strokeOpacity: 0.6,
                                strokeWeight: 2,
                                editable: false,
                                draggable: false,
                                clickable: true, // Keep clickable for water source placement
                                zIndex: 100, // Lower z-index to appear below zones
                            });
                            (overlay as { setMap: (map: unknown) => void }).setMap(map);
                        }

                        // Update the shape with the recreated overlay
                        if (overlay) {
                            setDrawnShapes((prev) =>
                                prev.map((s) => (s.id === shape.id ? { ...s, overlay } : s))
                            );

                            // Add click listener to the overlay for water source placement
                            window.google.maps.event.addListener(
                                overlay,
                                'click',
                                (event: { latLng: { lat: () => number; lng: () => number } }) => {
                                    const clickedLat = event.latLng.lat();
                                    const clickedLng = event.latLng.lng();

                                    // Get the actual current step from localStorage (more reliable than state)
                                    const savedProgress = localStorage.getItem('mapStepProgress');
                                    let actualCurrentStep = currentStep;

                                    if (savedProgress) {
                                        try {
                                            const progress = JSON.parse(savedProgress);
                                            actualCurrentStep = progress.currentStep;
                                        } catch (error) {
                                            console.error('Error parsing saved progress:', error);
                                        }
                                    }

                                    // Handle water source placement
                                    if (actualCurrentStep === 1) {
                                        // Create water source marker
                                        const waterMarker = createWaterSourceMarkerSimple(
                                            { lat: clickedLat, lng: clickedLng },
                                            map as google.maps.Map
                                        );

                                        if (waterMarker) {
                                            // Add to water sources state
                                            const newWaterSource = {
                                                id: Date.now(),
                                                position: { lat: clickedLat, lng: clickedLng },
                                                marker: waterMarker,
                                            };

                                            setWaterSources((prev) => {
                                                const updated = [...prev, newWaterSource];
                                                return updated;
                                            });

                                            // Save to localStorage
                                            const waterSourcesForStorage = [
                                                ...waterSources,
                                                newWaterSource,
                                            ].map((ws) => ({
                                                id: ws.id,
                                                position: ws.position,
                                            }));
                                            localStorage.setItem(
                                                'waterSources',
                                                JSON.stringify(waterSourcesForStorage)
                                            );

                                            console.log(
                                                '✅ Water source placed successfully:',
                                                newWaterSource
                                            );
                                            console.log(
                                                '💾 Saved to localStorage:',
                                                waterSourcesForStorage
                                            );

                                            // Auto-advance to Place Pump step after placing water source
                                            setCompletedSteps((prev) => {
                                                const newCompletedSteps = [...prev, 1]; // Mark step 1 (Water) as completed

                                                // Save progress to localStorage
                                                const progressData = {
                                                    currentStep: 2, // Move to step 2 (Place Pump)
                                                    completedSteps: newCompletedSteps,
                                                };
                                                localStorage.setItem(
                                                    'mapStepProgress',
                                                    JSON.stringify(progressData)
                                                );

                                                console.log(
                                                    'Auto-advanced to Place Pump step after placing water source'
                                                );
                                                console.log(
                                                    'Saved progress to localStorage:',
                                                    progressData
                                                );

                                                return newCompletedSteps;
                                            });

                                            setCurrentStep(2); // Move to step 2 (Place Pump)

                                            // Create pump placement points immediately after placing water source
                                            const placementPoints = createPumpPlacementPoints(
                                                { lat: clickedLat, lng: clickedLng },
                                                map as google.maps.Map
                                            );
                                            setPumpPlacementPoints(placementPoints);
                                        } else {
                                            console.error('❌ Failed to create water marker');
                                        }
                                    } else if (actualCurrentStep === 2) {
                                        // Pump placement step - no action needed
                                    } else {
                                        // Other steps - no action needed
                                    }
                                }
                            );
                        }
                    }
                });
            }

            // Add click listener to map for area interaction
            window.google.maps.event.addListener(
                map,
                'click',
                (event: { latLng: { lat: () => number; lng: () => number } }) => {
                    const clickedLat = event.latLng.lat();
                    const clickedLng = event.latLng.lng();

                    // Check if click is within any drawn area
                    if (drawnShapes.length > 0) {
                        drawnShapes.forEach((shape) => {
                            if (shape.data) {
                                let isInside = false;

                                if (
                                    shape.type ===
                                        window.google.maps.drawing.OverlayType.RECTANGLE &&
                                    shape.data.bounds
                                ) {
                                    const bounds = shape.data.bounds;
                                    isInside =
                                        clickedLat >= bounds.south &&
                                        clickedLat <= bounds.north &&
                                        clickedLng >= bounds.west &&
                                        clickedLng <= bounds.east;
                                } else if (
                                    shape.type === window.google.maps.drawing.OverlayType.CIRCLE &&
                                    shape.data.center &&
                                    shape.data.radius
                                ) {
                                    const center = shape.data.center;
                                    const radius = shape.data.radius;
                                    const distance =
                                        Math.sqrt(
                                            Math.pow(clickedLat - center.lat, 2) +
                                                Math.pow(clickedLng - center.lng, 2)
                                        ) * 111000; // Convert to meters (rough approximation)
                                    isInside = distance <= radius;
                                } else if (
                                    shape.type === window.google.maps.drawing.OverlayType.POLYGON &&
                                    shape.data.path
                                ) {
                                    // Simple point-in-polygon check
                                    const path = shape.data.path;
                                    let inside = false;
                                    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
                                        if (
                                            path[i].lat > clickedLat !== path[j].lat > clickedLat &&
                                            clickedLng <
                                                ((path[j].lng - path[i].lng) *
                                                    (clickedLat - path[i].lat)) /
                                                    (path[j].lat - path[i].lat) +
                                                    path[i].lng
                                        ) {
                                            inside = !inside;
                                        }
                                    }
                                    isInside = inside;
                                }

                                if (isInside) {
                                    // Log current step context
                                    if (currentStep === 1) {
                                        // Water step - no action needed
                                    } else if (currentStep === 2) {
                                        // Pump step - no action needed
                                    } else {
                                        // Other steps - no action needed
                                    }
                                }
                            }
                        });
                    } else {
                        // No drawn areas found - no action needed
                    }
                }
            );

            // Add event listeners for drawing events
            window.google.maps.event.addListener(
                drawingManagerRef.current,
                'overlaycomplete',
                (event: { overlay: unknown; type: string }) => {
                    const overlay = event.overlay;
                    const type = event.type;
                    console.log('🔍 Google Maps API sent type:', type, 'typeof:', typeof type);

                    // Extract data from overlay for storage
                    let overlayData: {
                        bounds?: { north: number; south: number; east: number; west: number };
                        center?: { lat: number; lng: number };
                        radius?: number;
                        path?: Array<{ lat: number; lng: number }>;
                    } = {};

                    if (type === window.google.maps.drawing.OverlayType.POLYGON) {
                        const polygon = overlay as {
                            getPath: () => {
                                getArray: () => Array<{ lat: () => number; lng: () => number }>;
                            };
                        };
                        const path = polygon
                            .getPath()
                            .getArray()
                            .map((point) => ({
                                lat: point.lat(),
                                lng: point.lng(),
                            }));
                        overlayData = { path };
                    } else if (type === window.google.maps.drawing.OverlayType.RECTANGLE) {
                        const rectangle = overlay as {
                            getBounds: () => {
                                getNorthEast: () => { lat: () => number; lng: () => number };
                                getSouthWest: () => { lat: () => number; lng: () => number };
                            };
                        };
                        const bounds = rectangle.getBounds();
                        overlayData = {
                            bounds: {
                                north: bounds.getNorthEast().lat(),
                                east: bounds.getNorthEast().lng(),
                                south: bounds.getSouthWest().lat(),
                                west: bounds.getSouthWest().lng(),
                            },
                        };
                    } else if (type === window.google.maps.drawing.OverlayType.CIRCLE) {
                        const circle = overlay as {
                            getCenter: () => { lat: () => number; lng: () => number };
                            getRadius: () => number;
                        };
                        overlayData = {
                            center: {
                                lat: circle.getCenter().lat(),
                                lng: circle.getCenter().lng(),
                            },
                            radius: circle.getRadius(),
                        };
                    }

                    // Add the drawn shape to our state (only allow one shape)
                    const newShape = { overlay, type, id: Date.now(), data: overlayData };
                    setDrawnShapes([newShape]); // Replace all shapes with just the new one

                    // Add click listener to the newly drawn overlay
                    window.google.maps.event.addListener(
                        overlay,
                        'click',
                        (event: { latLng: { lat: () => number; lng: () => number } }) => {
                            const clickedLat = event.latLng.lat();
                            const clickedLng = event.latLng.lng();

                            // Get current step from localStorage as backup
                            const savedProgress = localStorage.getItem('mapStepProgress');
                            if (savedProgress) {
                                try {
                                    JSON.parse(savedProgress);
                                } catch (error) {
                                    console.error('Error parsing saved progress:', error);
                                }
                            }

                            // Get the actual current step from localStorage (more reliable than state)
                            let actualCurrentStep = currentStep;

                            if (savedProgress) {
                                try {
                                    const progress = JSON.parse(savedProgress);
                                    actualCurrentStep = progress.currentStep;
                                } catch (error) {
                                    console.error('Error parsing saved progress:', error);
                                }
                            }

                            // Handle water source placement
                            if (actualCurrentStep === 1) {
                                // Create water source marker
                                const waterMarker = createWaterSourceMarkerSimple(
                                    { lat: clickedLat, lng: clickedLng },
                                    map as google.maps.Map
                                );

                                if (waterMarker) {
                                    // Add to water sources state
                                    const newWaterSource = {
                                        id: Date.now(),
                                        position: { lat: clickedLat, lng: clickedLng },
                                        marker: waterMarker,
                                    };

                                    setWaterSources((prev) => {
                                        const updated = [...prev, newWaterSource];
                                        return updated;
                                    });

                                    // Save to localStorage
                                    const waterSourcesForStorage = [
                                        ...waterSources,
                                        newWaterSource,
                                    ].map((ws) => ({
                                        id: ws.id,
                                        position: ws.position,
                                    }));
                                    localStorage.setItem(
                                        'waterSources',
                                        JSON.stringify(waterSourcesForStorage)
                                    );

                                    console.log(
                                        '✅ Water source placed successfully:',
                                        newWaterSource
                                    );
                                    console.log(
                                        '💾 Saved to localStorage:',
                                        waterSourcesForStorage
                                    );

                                    // Auto-advance to Place Pump step after placing water source
                                    setCompletedSteps((prev) => {
                                        const newCompletedSteps = [...prev, 1]; // Mark step 1 (Water) as completed

                                        // Save progress to localStorage
                                        const progressData = {
                                            currentStep: 2, // Move to step 2 (Place Pump)
                                            completedSteps: newCompletedSteps,
                                        };
                                        localStorage.setItem(
                                            'mapStepProgress',
                                            JSON.stringify(progressData)
                                        );

                                        console.log(
                                            'Auto-advanced to Place Pump step after placing water source'
                                        );
                                        console.log(
                                            'Saved progress to localStorage:',
                                            progressData
                                        );

                                        return newCompletedSteps;
                                    });

                                    setCurrentStep(2); // Move to step 2 (Place Pump)

                                    // Create pump placement points immediately after placing water source
                                    const placementPoints = createPumpPlacementPoints(
                                        { lat: clickedLat, lng: clickedLng },
                                        map as google.maps.Map
                                    );
                                    setPumpPlacementPoints(placementPoints);
                                } else {
                                    console.error('❌ Failed to create water marker');
                                }
                            } else if (actualCurrentStep === 2) {
                                // Pump placement step - no action needed
                            } else {
                                // Other steps - no action needed
                            }
                        }
                    );

                    // Save only the data part to localStorage (not the overlay object)
                    const shapesForStorage = [
                        {
                            type: newShape.type,
                            id: newShape.id,
                            data: newShape.data,
                        },
                    ];
                    localStorage.setItem('drawnShapes', JSON.stringify(shapesForStorage));

                    // Make the overlay non-editable (clickable is set during creation)
                    if (type === window.google.maps.drawing.OverlayType.POLYGON) {
                        const polygon = overlay as {
                            setEditable: (editable: boolean) => void;
                            setDraggable: (draggable: boolean) => void;
                        };
                        polygon.setEditable(false);
                        polygon.setDraggable(false);
                    } else if (type === window.google.maps.drawing.OverlayType.RECTANGLE) {
                        const rectangle = overlay as {
                            setEditable: (editable: boolean) => void;
                            setDraggable: (draggable: boolean) => void;
                        };
                        rectangle.setEditable(false);
                        rectangle.setDraggable(false);
                    } else if (type === window.google.maps.drawing.OverlayType.CIRCLE) {
                        const circle = overlay as {
                            setEditable: (editable: boolean) => void;
                            setDraggable: (draggable: boolean) => void;
                        };
                        circle.setEditable(false);
                        circle.setDraggable(false);
                    }

                    // Exit drawing mode after drawing
                    if (drawingManagerRef.current) {
                        (
                            drawingManagerRef.current as { setDrawingMode: (mode: unknown) => void }
                        ).setDrawingMode(null);
                    }
                    setIsDrawingMode(false);

                    // Create plant points after drawing area
                    const newPlantPoints = createPlantPoints(map, overlayData, type);

                    if (newPlantPoints && newPlantPoints.length > 0) {
                        // Plant points created successfully
                    } else {
                        // No plant points created
                    }

                    // Auto-advance to next step (Water)
                    setCompletedSteps((prev) => {
                        const newCompletedSteps = [...prev, 0]; // Mark step 0 (Draw Area) as completed

                        // Save progress to localStorage
                        const progressData = {
                            currentStep: 1, // Move to step 1 (Water)
                            completedSteps: newCompletedSteps,
                        };
                        localStorage.setItem('mapStepProgress', JSON.stringify(progressData));

                        return newCompletedSteps;
                    });

                    setCurrentStep(1); // Move to step 1 (Water)

                    // Force a re-render to ensure state is updated
                    setTimeout(() => {}, 100);
                }
            );
        };

        loadGoogleMaps();

        // Cleanup function
        return () => {
            isMounted = false;
        };
    }, [
        mapInitialized,
        completedSteps,
        drawnShapes,
        currentStep,
        waterSources,
        pumps,
        zones,
        plantPoints,
        mainPipes,
        subMainPipes,
        lateralPipes,
        createPlantPoints,
    ]); // eslint-disable-line react-hooks/exhaustive-deps

    // 4. Handlers

    // Function to create center marker for a zone
    const createZoneCenterMarker = useCallback(
        (
            map: google.maps.Map,
            center: { lat: number; lng: number },
            zoneName: string,
            zoneColor: string
        ) => {
            const marker = new window.google.maps.Marker({
                position: center,
                map: map,
                title: `Center of ${zoneName}`,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: zoneColor,
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                },
                zIndex: 1500, // Higher than zones to appear on top
            });

            // Add info window for center marker
            const infoWindow = new window.google.maps.InfoWindow({
                content: `<div class="text-center">
                <div class="font-semibold text-gray-800">${zoneName}</div>
                <div class="text-sm text-gray-600">${translations.zoneCenter}</div>
                <div class="text-xs text-gray-500 mt-1">
                    Lat: ${center.lat.toFixed(6)}<br>
                    Lng: ${center.lng.toFixed(6)}
                </div>
            </div>`,
            });

            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });

            return marker;
        },
        [translations]
    );

    // Ensure overlays are recreated after state is restored (when navigating back)
    useEffect(() => {
        if (!mapInitialized || !mapInstanceRef.current) return;

        const map = mapInstanceRef.current as google.maps.Map;

        // Zones
        if (zones.length > 0) {
            zones.forEach((zone) => {
                if (!zone.overlay && zone.bounds) {
                    let overlay: google.maps.Rectangle | google.maps.Polygon;
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
                    } else {
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
                    }
                    overlay.setMap(map);

                    let centerMarker = null;
                    if (zone.center) {
                        centerMarker = createZoneCenterMarker(
                            map,
                            zone.center,
                            zone.name,
                            zone.color
                        );
                    }

                    setZones((prev) =>
                        prev.map((z) => (z.id === zone.id ? { ...z, overlay, centerMarker } : z))
                    );
                }
            });
        }

        // Plant points
        if (plantPoints.length > 0) {
            // Get plant data for icon (same as initial render)
            const savedPlantData = localStorage.getItem('selectedPlantData');
            let plantData: { name: string; icon: string } | null = null;
            if (savedPlantData) {
                try {
                    plantData = JSON.parse(savedPlantData);
                } catch {
                    plantData = null;
                }
            }

            plantPoints.forEach((point) => {
                if (!point.marker) {
                    const marker = new window.google.maps.Marker({
                        position: point.position,
                        map: map,
                        title: plantData
                            ? `${getTranslatedPlantName(plantData.name, translations)} Plant`
                            : 'Plant',
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
                        draggable: false,
                        clickable: false,
                        zIndex: 500,
                    });
                    setPlantPoints((prev) =>
                        prev.map((p) => (p.id === point.id ? { ...p, marker } : p))
                    );
                }
            });
        }

        // Pipes
        if (mainPipes.length > 0) {
            mainPipes.forEach((pipe) => {
                if (!pipe.overlay) {
                    const polyline = new window.google.maps.Polyline({
                        path: [pipe.fromPump, pipe.toZoneCenter],
                        geodesic: true,
                        strokeColor: '#DC2626',
                        strokeOpacity: 0.8,
                        strokeWeight: 4,
                        zIndex: 1200,
                    });
                    polyline.setMap(map);
                    setMainPipes((prev) =>
                        prev.map((p) => (p.id === pipe.id ? { ...p, overlay: polyline } : p))
                    );
                }
            });
        }

        if (subMainPipes.length > 0) {
            subMainPipes.forEach((pipe) => {
                if (!pipe.overlay) {
                    const polyline = new window.google.maps.Polyline({
                        path: pipe.path,
                        geodesic: true,
                        strokeColor: '#8B5CF6',
                        strokeOpacity: 0.7,
                        strokeWeight: 3,
                        zIndex: 1100,
                    });
                    polyline.setMap(map);
                    setSubMainPipes((prev) =>
                        prev.map((p) => (p.id === pipe.id ? { ...p, overlay: polyline } : p))
                    );
                }
            });
        }

        if (lateralPipes.length > 0) {
            lateralPipes.forEach((pipe) => {
                if (!pipe.overlay) {
                    const polyline = new window.google.maps.Polyline({
                        path: pipe.path,
                        geodesic: true,
                        strokeColor: '#FCD34D',
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        zIndex: 1000,
                    });
                    polyline.setMap(map);
                    setLateralPipes((prev) =>
                        prev.map((p) => (p.id === pipe.id ? { ...p, overlay: polyline } : p))
                    );
                }
            });
        }

        // Drawn shapes (area)
        if (drawnShapes.length > 0) {
            drawnShapes.forEach((shape) => {
                if (!shape.overlay && shape.data) {
                    let overlay:
                        | google.maps.Polygon
                        | google.maps.Rectangle
                        | google.maps.Circle
                        | null = null;
                    if (
                        shape.type === window.google.maps.drawing.OverlayType.POLYGON &&
                        shape.data.path
                    ) {
                        overlay = new window.google.maps.Polygon({
                            paths: shape.data.path,
                            fillColor: '#10b981',
                            fillOpacity: 0.2,
                            strokeColor: '#10b981',
                            strokeOpacity: 0.6,
                            strokeWeight: 2,
                            clickable: true,
                            zIndex: 100,
                        });
                    } else if (
                        shape.type === window.google.maps.drawing.OverlayType.RECTANGLE &&
                        shape.data.bounds
                    ) {
                        overlay = new window.google.maps.Rectangle({
                            bounds: new window.google.maps.LatLngBounds(
                                { lat: shape.data.bounds.south, lng: shape.data.bounds.west },
                                { lat: shape.data.bounds.north, lng: shape.data.bounds.east }
                            ),
                            fillColor: '#10b981',
                            fillOpacity: 0.2,
                            strokeColor: '#10b981',
                            strokeOpacity: 0.6,
                            strokeWeight: 2,
                            clickable: true,
                            zIndex: 100,
                        });
                    } else if (
                        shape.type === window.google.maps.drawing.OverlayType.CIRCLE &&
                        shape.data.center &&
                        shape.data.radius
                    ) {
                        overlay = new window.google.maps.Circle({
                            center: { lat: shape.data.center.lat, lng: shape.data.center.lng },
                            radius: shape.data.radius,
                            fillColor: '#10b981',
                            fillOpacity: 0.2,
                            strokeColor: '#10b981',
                            strokeOpacity: 0.6,
                            strokeWeight: 2,
                            clickable: true,
                            zIndex: 100,
                        });
                    }
                    if (overlay) {
                        overlay.setMap(map);
                        setDrawnShapes((prev) =>
                            prev.map((s) => (s.id === shape.id ? { ...s, overlay } : s))
                        );
                    }
                }
            });
        }
    }, [
        mapInitialized,
        zones,
        plantPoints,
        mainPipes,
        subMainPipes,
        lateralPipes,
        drawnShapes,
        translations,
        createZoneCenterMarker,
    ]);
    const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value.trim();
        const oldName = projectName; // Store old name before updating

        setProjectName(newName);
        // Save project name to localStorage
        localStorage.setItem('projectName', newName);

        // Update saved project name if it exists and oldName is not empty
        if (oldName && oldName.trim() && newName) {
            try {
                const savedProjects = localStorage.getItem('freePlanProjects');
                if (savedProjects) {
                    const projects = JSON.parse(savedProjects);
                    const projectIndex = projects.findIndex(
                        (p: { projectName: string }) => p.projectName === oldName.trim()
                    );
                    if (projectIndex >= 0) {
                        projects[projectIndex].projectName = newName;
                        localStorage.setItem('freePlanProjects', JSON.stringify(projects));
                        console.log(
                            '✅ Updated project name in saved projects:',
                            oldName.trim(),
                            '→',
                            newName
                        );
                    }
                }
            } catch (error) {
                console.error('Error updating saved project name:', error);
            }
        }
    };

    // Load project name from localStorage on mount
    useEffect(() => {
        const savedProjectName = localStorage.getItem('projectName');
        if (savedProjectName) {
            setProjectName(savedProjectName);
        }
    }, []);
    const handleBack = () => router.visit('/free-plan/choose-crop');
    const handleReset = () => {
        // Clear all overlays from the map first
        if (mapInstanceRef.current) {
            // Clear all drawn shapes overlays
            drawnShapes.forEach((shape) => {
                if (shape.overlay) {
                    (shape.overlay as { setMap: (map: unknown) => void }).setMap(null);
                }
            });

            // Clear all water source markers
            waterSources.forEach((waterSource) => {
                if (waterSource.marker) {
                    (waterSource.marker as { setMap: (map: unknown) => void }).setMap(null);
                }
            });

            // Clear all pump markers
            pumps.forEach((pump) => {
                if (pump.marker) {
                    (pump.marker as { setMap: (map: unknown) => void }).setMap(null);
                }
            });

            // Clear all zone overlays and center markers
            zones.forEach((zone) => {
                if (zone.overlay) {
                    (zone.overlay as { setMap: (map: unknown) => void }).setMap(null);
                }
                if (zone.centerMarker) {
                    (zone.centerMarker as { setMap: (map: unknown) => void }).setMap(null);
                }
            });

            // Clear all plant point markers
            plantPoints.forEach((point) => {
                if (point.marker) {
                    (point.marker as { setMap: (map: unknown) => void }).setMap(null);
                }
            });

            // Clear all main pipes
            mainPipes.forEach((pipe) => {
                if (pipe.overlay) {
                    (pipe.overlay as { setMap: (map: unknown) => void }).setMap(null);
                }
            });

            // Clear all sub-main pipes
            subMainPipes.forEach((pipe) => {
                if (pipe.overlay) {
                    (pipe.overlay as { setMap: (map: unknown) => void }).setMap(null);
                }
            });

            // Clear all lateral pipes
            lateralPipes.forEach((pipe) => {
                if (pipe.overlay) {
                    (pipe.overlay as { setMap: (map: unknown) => void }).setMap(null);
                }
            });

            // Clear all pump placement point markers
            pumpPlacementPoints.forEach((point) => {
                if (point.marker) {
                    (point.marker as { setMap: (map: unknown) => void }).setMap(null);
                }
            });
        }

        // Reset drawing manager
        if (drawingManagerRef.current) {
            (
                drawingManagerRef.current as { setDrawingMode: (mode: unknown) => void }
            ).setDrawingMode(null);
            (
                drawingManagerRef.current as {
                    setOptions: (options: { drawingControl: boolean }) => void;
                }
            ).setOptions({ drawingControl: false });
        }

        // Reset all state
        setCurrentStep(0);
        setCompletedSteps([]);
        setDrawnShapes([]);
        setWaterSources([]);
        setPumps([]);
        setZones([]);
        setPlantPoints([]);
        setPumpPlacementPoints([]);
        setMainPipes([]);
        setSubMainPipes([]);
        setLateralPipes([]);
        setIsDrawingMode(false);

        // Clear step progress, drawn shapes, water sources, pumps, zones, plant points, main pipes, sub-main pipes, and lateral pipes from localStorage, keep plant data
        localStorage.removeItem('mapStepProgress');
        localStorage.removeItem('drawnShapes');
        localStorage.removeItem('waterSources');
        localStorage.removeItem('pumps');
        localStorage.removeItem('zones');
        localStorage.removeItem('plantPoints');
        localStorage.removeItem('mainPipes');
        localStorage.removeItem('subMainPipes');
        localStorage.removeItem('lateralPipes');
    };
    const handleNext = async () => {
        try {
            if (mapRef.current) {
                // Wait a moment to ensure map tiles/overlays are stable
                await new Promise((resolve) => setTimeout(resolve, 500));

                const { default: html2canvasLib } = await import('html2canvas');

                const canvas = await html2canvasLib(mapRef.current, {
                    useCORS: true,
                    allowTaint: true,
                    scale: 2,
                    logging: false,
                    backgroundColor: '#1F2937',
                    width: mapRef.current.offsetWidth,
                    height: mapRef.current.offsetHeight,
                    onclone: (clonedDoc: Document) => {
                        try {
                            // Remove Google Maps UI controls/logos from the cloned DOM
                            const controls = clonedDoc.querySelectorAll(
                                '.gm-control-active, .gmnoprint, .gm-style-cc, a[title="Report a map error"], img[alt="Google"]'
                            );
                            controls.forEach((el) => el.remove());
                        } catch {
                            // ignore clean-up errors
                        }
                    },
                });

                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                if (dataUrl && dataUrl !== 'data:,' && dataUrl.length > 100) {
                    localStorage.setItem('projectMapImage', dataUrl);
                }
            }
        } catch (error) {
            console.error('Failed to capture map image:', error);
        } finally {
            router.visit('/free-plan/summary');
        }
    };

    // Step handlers
    const handleStepClick = (stepIndex: number) => {
        // Only allow clicking if it's the current step
        if (stepIndex === currentStep) {
            // Handle specific step actions
            if (stepIndex === 0) {
                handleDrawAreaClick();
                return;
            }

            // Check if Water step (step 1) has water sources before proceeding
            if (stepIndex === 1) {
                if (waterSources.length === 0) {
                    console.log('❌ Cannot complete Water step: No water sources placed');
                    alert('กรุณาวางแหล่งน้ำก่อนไปขั้นตอนถัดไป');
                    return;
                }
            }

            // Handle Zones step (step 3) - show zone modal
            if (stepIndex === 3) {
                if (drawnShapes.length === 0) {
                    console.log('❌ Cannot create zones: No drawn area');
                    alert('กรุณาวาดพื้นที่ก่อนแบ่งโซน');
                    return;
                }

                // Show zone modal instead of creating zones immediately
                setShowZoneModal(true);
                return;
            }

            // For Generate Pipe System (step 4), generate main pipes
            if (stepIndex === 4) {
                console.log(`Executed step ${stepIndex + 1}: ${getStepName(stepIndex)}`);
                const map = mapInstanceRef.current as google.maps.Map;
                if (map) {
                    generateMainPipes(map);
                } else {
                    console.error('❌ Map not available for pipe generation');
                    alert('ไม่สามารถสร้างระบบท่อได้ - แผนที่ยังไม่พร้อม');
                }
                return;
            }

            // Complete current step and move to next
            setCompletedSteps((prev) => {
                const newCompletedSteps = [...prev, stepIndex];
                const newCurrentStep = Math.min(stepIndex + 1, 4); // Max step is 4

                // Save progress to localStorage
                const progressData = {
                    currentStep: newCurrentStep,
                    completedSteps: newCompletedSteps,
                };
                localStorage.setItem('mapStepProgress', JSON.stringify(progressData));

                console.log(`Completed step ${stepIndex + 1}: ${getStepName(stepIndex)}`);
                console.log('Saved step progress to localStorage:', progressData);

                return newCompletedSteps;
            });

            setCurrentStep(Math.min(stepIndex + 1, 4)); // Max step is 4
        }
    };

    // Draw Area handler
    const handleDrawAreaClick = () => {
        if (!drawingManagerRef.current) return;

        if (isDrawingMode) {
            // Exit drawing mode
            if (drawingManagerRef.current) {
                (
                    drawingManagerRef.current as { setDrawingMode: (mode: unknown) => void }
                ).setDrawingMode(null);
            }
            if (drawingManagerRef.current) {
                (
                    drawingManagerRef.current as {
                        setOptions: (options: { drawingControl: boolean }) => void;
                    }
                ).setOptions({ drawingControl: false });
            }
            setIsDrawingMode(false);
            console.log('Exited drawing mode');
        } else {
            // Clear existing shapes before entering drawing mode
            if (drawnShapes.length > 0) {
                setDrawnShapes([]);
                localStorage.removeItem('drawnShapes');
                console.log('Cleared existing shapes before drawing new one');
            }

            // Enter drawing mode
            if (drawingManagerRef.current) {
                (
                    drawingManagerRef.current as {
                        setOptions: (options: { drawingControl: boolean }) => void;
                    }
                ).setOptions({ drawingControl: true });
            }
            setIsDrawingMode(true);
            console.log('Entered drawing mode - use the drawing tools on the map');
        }
    };

    const getStepName = (stepIndex: number): string => {
        const stepNames = [
            translations.drawingModeActive,
            translations.placingWaterSource,
            translations.placingWaterPump,
            translations.zones,
            translations.generatePipeSystem,
        ];
        return stepNames[stepIndex] || '';
    };

    // Function to handle pump placement click
    const handlePumpPlacementClick = useCallback(
        (position: { lat: number; lng: number }, map: google.maps.Map) => {
            // Create pump marker
            const pumpMarker = createPumpMarker(position, map);

            if (pumpMarker) {
                // Remove overlapped plant points at pump position (3 meters radius)
                removeOverlappedPlantPoints(position, 3);
                // Add to pumps state
                const newPump = {
                    id: Date.now(),
                    position: position,
                    marker: pumpMarker,
                };

                setPumps((prev) => {
                    const updated = [...prev, newPump];
                    return updated;
                });

                // Save to localStorage
                const pumpsForStorage = [...pumps, newPump].map((pump) => ({
                    id: pump.id,
                    position: pump.position,
                }));
                localStorage.setItem('pumps', JSON.stringify(pumpsForStorage));

                // Hide all placement points after placing pump
                if (pumpPlacementPoints.length > 0) {
                    pumpPlacementPoints.forEach((point) => {
                        if (point.marker) {
                            (point.marker as { setMap: (map: unknown) => void }).setMap(null);
                        }
                    });
                    setPumpPlacementPoints([]);
                }

                // Auto-advance to Zones step after placing pump
                setCompletedSteps((prev) => {
                    const newCompletedSteps = [...prev, 2]; // Mark step 2 (Place Pump) as completed
                    console.log('=== Auto-advance to Zones ===');
                    console.log('Previous completed steps:', prev);
                    console.log('New completed steps:', newCompletedSteps);

                    // Save progress to localStorage
                    const progressData = {
                        currentStep: 3, // Move to step 3 (Zones)
                        completedSteps: newCompletedSteps,
                    };
                    localStorage.setItem('mapStepProgress', JSON.stringify(progressData));

                    console.log('Auto-advanced to Zones step after placing pump');
                    console.log('Saved progress to localStorage:', progressData);

                    return newCompletedSteps;
                });

                setCurrentStep(3); // Move to step 3 (Zones)
            } else {
                console.error('❌ Failed to create pump marker');
            }
        },
        [
            pumps,
            pumpPlacementPoints,
            setPumps,
            setPumpPlacementPoints,
            setCompletedSteps,
            setCurrentStep,
            removeOverlappedPlantPoints,
        ]
    );

    // Function to create pump placement points around water source
    const createPumpPlacementPoints = useCallback(
        (waterSourcePosition: { lat: number; lng: number }, map: google.maps.Map) => {
            // Define offset distances (in degrees, roughly 10 meters - further from water source icon)
            const offset = 0.00004; // Approximately 10 meters - further away from the water source icon

            const placementPoints: Array<{
                id: number;
                position: { lat: number; lng: number };
                marker: unknown;
                type: 'corner' | 'midpoint';
            }> = [];

            // 4 corner points
            const cornerPoints = [
                { lat: waterSourcePosition.lat + offset, lng: waterSourcePosition.lng + offset }, // Top-right
                { lat: waterSourcePosition.lat + offset, lng: waterSourcePosition.lng - offset }, // Top-left
                { lat: waterSourcePosition.lat - offset, lng: waterSourcePosition.lng - offset }, // Bottom-left
                { lat: waterSourcePosition.lat - offset, lng: waterSourcePosition.lng + offset }, // Bottom-right
            ];

            // 4 midpoint points
            const midpointPoints = [
                { lat: waterSourcePosition.lat + offset, lng: waterSourcePosition.lng }, // Top
                { lat: waterSourcePosition.lat, lng: waterSourcePosition.lng - offset }, // Left
                { lat: waterSourcePosition.lat - offset, lng: waterSourcePosition.lng }, // Bottom
                { lat: waterSourcePosition.lat, lng: waterSourcePosition.lng + offset }, // Right
            ];

            // Create corner point markers
            cornerPoints.forEach((position, index) => {
                const marker = new window.google.maps.Marker({
                    position: position,
                    map: map,
                    title: `Pump Placement Point (Corner ${index + 1})`,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
                        <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="8" cy="8" r="6" fill="#EF4444" stroke="#DC2626" stroke-width="1"/>
                            <circle cx="8" cy="8" r="2" fill="#FFFFFF"/>
                        </svg>
                    `),
                        scaledSize: new window.google.maps.Size(16, 16),
                        anchor: new window.google.maps.Point(8, 8),
                    },
                    draggable: false,
                    clickable: true,
                    zIndex: 1500, // Between water source and zones
                });

                placementPoints.push({
                    id: Date.now() + index,
                    position: position,
                    marker: marker,
                    type: 'corner',
                });

                // Add click listener to corner point
                window.google.maps.event.addListener(marker, 'click', () => {
                    console.log('🎯 Corner pump placement point clicked:', position);
                    handlePumpPlacementClick(position, map);
                });
            });

            // Create midpoint markers
            midpointPoints.forEach((position, index) => {
                const marker = new window.google.maps.Marker({
                    position: position,
                    map: map,
                    title: `Pump Placement Point (Midpoint ${index + 1})`,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
                        <svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="7" cy="7" r="5" fill="#F59E0B" stroke="#D97706" stroke-width="1"/>
                            <circle cx="7" cy="7" r="2" fill="#FFFFFF"/>
                        </svg>
                    `),
                        scaledSize: new window.google.maps.Size(14, 14),
                        anchor: new window.google.maps.Point(7, 7),
                    },
                    draggable: false,
                    clickable: true,
                    zIndex: 1500, // Between water source and zones
                });

                placementPoints.push({
                    id: Date.now() + index + 4,
                    position: position,
                    marker: marker,
                    type: 'midpoint',
                });

                // Add click listener to midpoint
                window.google.maps.event.addListener(marker, 'click', () => {
                    console.log('🎯 Midpoint pump placement point clicked:', position);
                    handlePumpPlacementClick(position, map);
                });
            });

            console.log('✅ Created pump placement points:', placementPoints.length);
            return placementPoints;
        },
        [handlePumpPlacementClick]
    );

    // Function to create water source marker (simple version for useEffect)
    const createWaterSourceMarkerSimple = (
        position: { lat: number; lng: number },
        map: google.maps.Map
    ) => {
        console.log('🔧 Creating water source marker at:', position);
        console.log('🔧 Map instance:', map);

        try {
            const marker = new window.google.maps.Marker({
                position: position,
                map: map,
                title: 'Water Source',
                icon: {
                    url:
                        'data:image/svg+xml;charset=UTF-8,' +
                        encodeURIComponent(`
                        <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <rect x="4" y="4" width="40" height="40" rx="8" fill="#3B82F6" stroke="#1E40AF" stroke-width="3"/>
                            <rect x="12" y="12" width="24" height="24" rx="4" fill="#FFFFFF"/>
                            <path d="M24 16 L28 24 L24 32 L20 24 Z" fill="#3B82F6"/>
                            <circle cx="24" cy="24" r="4" fill="#3B82F6"/>
                        </svg>
                    `),
                    scaledSize: new window.google.maps.Size(48, 48),
                    anchor: new window.google.maps.Point(24, 24),
                },
                draggable: false,
                clickable: true,
                zIndex: 2000, // Higher than zones and plant points
            });

            // Remove overlapped plant points at water source position (4 meters radius)
            removeOverlappedPlantPoints(position, 4);

            console.log('✅ Water source marker created successfully:', marker);
            return marker;
        } catch (error) {
            console.error('❌ Error creating water source marker:', error);
            return null;
        }
    };

    // Function to create water source marker (with drag functionality)
    const createWaterSourceMarker = useCallback(
        (position: { lat: number; lng: number }, map: google.maps.Map) => {
            console.log('🔧 Creating water source marker at:', position);
            console.log('🔧 Map instance:', map);

            try {
                const marker = new window.google.maps.Marker({
                    position: position,
                    map: map,
                    title: 'Water Source',
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
                        <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <rect x="4" y="4" width="40" height="40" rx="8" fill="#3B82F6" stroke="#1E40AF" stroke-width="3"/>
                            <rect x="12" y="12" width="24" height="24" rx="4" fill="#FFFFFF"/>
                            <path d="M24 16 L28 24 L24 32 L20 24 Z" fill="#3B82F6"/>
                            <circle cx="24" cy="24" r="4" fill="#3B82F6"/>
                        </svg>
                    `),
                        scaledSize: new window.google.maps.Size(48, 48),
                        anchor: new window.google.maps.Point(24, 24),
                    },
                    draggable: false,
                    clickable: true,
                    zIndex: 2000, // Higher than zones and plant points
                });

                // Remove overlapped plant points at water source position (4 meters radius)
                removeOverlappedPlantPoints(position, 4);

                console.log('✅ Water source marker created successfully:', marker);
                return marker;
            } catch (error) {
                console.error('❌ Error creating water source marker:', error);
                return null;
            }
        },
        [removeOverlappedPlantPoints]
    );

    // Recreate markers from saved data when map is initialized
    useEffect(() => {
        if (!mapInitialized || !mapInstanceRef.current) return;

        const map = mapInstanceRef.current as google.maps.Map;

        // Recreate water source markers from saved data
        if (waterSources.length > 0) {
            waterSources.forEach((waterSource) => {
                if (waterSource.position && !waterSource.marker) {
                    const marker = createWaterSourceMarker(waterSource.position, map);
                    setWaterSources((prev) =>
                        prev.map((ws) => (ws.id === waterSource.id ? { ...ws, marker } : ws))
                    );
                }
            });
        }

        // Recreate pump markers from saved data
        if (pumps.length > 0) {
            pumps.forEach((pump) => {
                if (pump.position && !pump.marker) {
                    const marker = createPumpMarker(pump.position, map);
                    setPumps((prev) => prev.map((p) => (p.id === pump.id ? { ...p, marker } : p)));
                }
            });
        }
    }, [mapInitialized, waterSources, pumps, createWaterSourceMarker, setWaterSources, setPumps]);

    // Auto-activate steps based on current step and completion status
    useEffect(() => {
        if (!mapInitialized || !drawingManagerRef.current) return;

        console.log('=== Auto-activate Step ===');
        console.log('Current step:', currentStep);
        console.log('Completed steps:', completedSteps);
        console.log('Drawn shapes:', drawnShapes.length);
        console.log('Water sources:', waterSources.length);
        console.log('Pumps:', pumps.length);

        // Step 0: Draw Area - Auto-activate drawing when page loads or when step 0 is current
        if (currentStep === 0 && !completedSteps.includes(0)) {
            console.log('🎯 Auto-activating Draw Area step');
            if (drawingManagerRef.current) {
                (
                    drawingManagerRef.current as {
                        setOptions: (options: { drawingControl: boolean }) => void;
                    }
                ).setOptions({ drawingControl: true });
            }
            setIsDrawingMode(true);
        }
        // Step 1: Water - Auto-activate when step 0 is completed and step 1 is current
        else if (currentStep === 1 && completedSteps.includes(0) && !completedSteps.includes(1)) {
            console.log('🎯 Auto-activating Water step');
            if (drawingManagerRef.current) {
                (
                    drawingManagerRef.current as { setDrawingMode: (mode: unknown) => void }
                ).setDrawingMode(null);
            }
            if (drawingManagerRef.current) {
                (
                    drawingManagerRef.current as {
                        setOptions: (options: { drawingControl: boolean }) => void;
                    }
                ).setOptions({ drawingControl: false });
            }
            setIsDrawingMode(false);
        }
        // Step 2: Place Pump - Auto-activate when step 1 is completed and step 2 is current
        else if (currentStep === 2 && completedSteps.includes(1) && !completedSteps.includes(2)) {
            console.log('🎯 Auto-activating Place Pump step');
            if (drawingManagerRef.current) {
                (
                    drawingManagerRef.current as { setDrawingMode: (mode: unknown) => void }
                ).setDrawingMode(null);
            }
            if (drawingManagerRef.current) {
                (
                    drawingManagerRef.current as {
                        setOptions: (options: { drawingControl: boolean }) => void;
                    }
                ).setOptions({ drawingControl: false });
            }
            setIsDrawingMode(false);

            // Pump placement points are now created immediately when water source is placed
            // No need to create them here anymore
        }
        // Step 3: Zones - Auto-activate when step 2 is completed and step 3 is current
        else if (currentStep === 3 && completedSteps.includes(2) && !completedSteps.includes(3)) {
            console.log('🎯 Auto-activating Zones step');
            if (drawingManagerRef.current) {
                (
                    drawingManagerRef.current as { setDrawingMode: (mode: unknown) => void }
                ).setDrawingMode(null);
            }
            if (drawingManagerRef.current) {
                (
                    drawingManagerRef.current as {
                        setOptions: (options: { drawingControl: boolean }) => void;
                    }
                ).setOptions({ drawingControl: false });
            }
            setIsDrawingMode(false);

            // Hide pump placement points when moving to zones step
            if (pumpPlacementPoints.length > 0) {
                console.log('🎯 Hiding pump placement points');
                pumpPlacementPoints.forEach((point) => {
                    if (point.marker) {
                        (point.marker as { setMap: (map: unknown) => void }).setMap(null);
                    }
                });
                setPumpPlacementPoints([]);
            }
        }
        // Other steps - Deactivate drawing
        else {
            if (drawingManagerRef.current) {
                (
                    drawingManagerRef.current as { setDrawingMode: (mode: unknown) => void }
                ).setDrawingMode(null);
            }
            if (drawingManagerRef.current) {
                (
                    drawingManagerRef.current as {
                        setOptions: (options: { drawingControl: boolean }) => void;
                    }
                ).setOptions({ drawingControl: false });
            }
            setIsDrawingMode(false);
        }

        console.log('=== End Auto-activate Step ===');
    }, [
        currentStep,
        completedSteps,
        mapInitialized,
        drawnShapes.length,
        waterSources,
        pumps.length,
        pumpPlacementPoints,
        createPumpPlacementPoints,
    ]);

    // Function to create pump marker
    const createPumpMarker = (position: { lat: number; lng: number }, map: google.maps.Map) => {
        console.log('🔧 Creating pump marker at:', position);
        console.log('🔧 Map instance:', map);

        try {
            const marker = new window.google.maps.Marker({
                position: position,
                map: map,
                title: 'Water Pump',
                icon: {
                    url: '/images/water-pump.png',
                    scaledSize: new window.google.maps.Size(32, 32),
                    anchor: new window.google.maps.Point(16, 16),
                },
                draggable: false,
                clickable: true,
                zIndex: 2000, // Higher than zones and plant points
            });

            console.log('✅ Pump marker created successfully:', marker);
            return marker;
        } catch (error) {
            console.error('❌ Error creating pump marker:', error);
            return null;
        }
    };

    // Function to generate unique colors for zones
    const generateZoneColors = (count: number): string[] => {
        const colors = [
            '#EF4444', // Red
            '#8B5CF6', // Purple
            '#10B981', // Green
            '#F59E0B', // Amber
            '#3B82F6', // Blue
            '#EC4899', // Pink
            '#06B6D4', // Cyan
            '#84CC16', // Lime
            '#F97316', // Orange
            '#6366F1', // Indigo
            '#14B8A6', // Teal
            '#A855F7', // Violet
            '#EF4444', // Red (repeat if needed)
            '#8B5CF6', // Purple (repeat if needed)
            '#10B981', // Green (repeat if needed)
        ];

        return colors.slice(0, count);
    };

    // Function to calculate center point of a zone
    // UNUSED - legacy function
    /*
    const calculateZoneCenter = (bounds: { north: number; south: number; east: number; west: number }) => {
        return {
            lat: (bounds.north + bounds.south) / 2,
            lng: (bounds.east + bounds.west) / 2
        };
    };
    */

    // Function to check if point is inside drawn area
    const isPointInDrawnArea = (
        point: { lat: number; lng: number },
        shapeData: {
            bounds?: { north: number; south: number; east: number; west: number };
            center?: { lat: number; lng: number };
            radius?: number;
            path?: Array<{ lat: number; lng: number }>;
        },
        shapeType: string
    ): boolean => {
        if (shapeType === window.google.maps.drawing.OverlayType.RECTANGLE && shapeData.bounds) {
            const bounds = shapeData.bounds;
            return (
                point.lat >= bounds.south &&
                point.lat <= bounds.north &&
                point.lng >= bounds.west &&
                point.lng <= bounds.east
            );
        } else if (
            shapeType === window.google.maps.drawing.OverlayType.CIRCLE &&
            shapeData.center &&
            shapeData.radius
        ) {
            const distance = getDistanceFromLatLonInMeters(point, shapeData.center);
            return distance <= shapeData.radius;
        } else if (shapeType === window.google.maps.drawing.OverlayType.POLYGON && shapeData.path) {
            return isPointInPolygon(point, shapeData.path);
        }
        return true;
    };

    // Function to clip polygon to bounds (Sutherland-Hodgman algorithm simplified for rectangles)
    const clipPolygonToBounds = (
        polygon: Array<{ lat: number; lng: number }>,
        bounds: { north: number; south: number; east: number; west: number }
    ): Array<{ lat: number; lng: number }> => {
        // Clip against each edge of the bounds
        let input = [...polygon];

        // Clip against west edge
        let output: Array<{ lat: number; lng: number }> = [];
        for (let i = 0; i < input.length; i++) {
            const p1 = input[i];
            const p2 = input[(i + 1) % input.length];

            if (p1.lng >= bounds.west) {
                if (p2.lng >= bounds.west) {
                    output.push(p2);
                } else {
                    // Intersection with west edge
                    const t = (bounds.west - p1.lng) / (p2.lng - p1.lng);
                    const lat = p1.lat + t * (p2.lat - p1.lat);
                    output.push({ lat, lng: bounds.west });
                }
            } else {
                if (p2.lng >= bounds.west) {
                    const t = (bounds.west - p1.lng) / (p2.lng - p1.lng);
                    const lat = p1.lat + t * (p2.lat - p1.lat);
                    output.push({ lat, lng: bounds.west });
                    output.push(p2);
                }
            }
        }
        input = output;
        output = [];

        // Clip against east edge
        for (let i = 0; i < input.length; i++) {
            const p1 = input[i];
            const p2 = input[(i + 1) % input.length];

            if (p1.lng <= bounds.east) {
                if (p2.lng <= bounds.east) {
                    output.push(p2);
                } else {
                    const t = (bounds.east - p1.lng) / (p2.lng - p1.lng);
                    const lat = p1.lat + t * (p2.lat - p1.lat);
                    output.push({ lat, lng: bounds.east });
                }
            } else {
                if (p2.lng <= bounds.east) {
                    const t = (bounds.east - p1.lng) / (p2.lng - p1.lng);
                    const lat = p1.lat + t * (p2.lat - p1.lat);
                    output.push({ lat, lng: bounds.east });
                    output.push(p2);
                }
            }
        }
        input = output;
        output = [];

        // Clip against south edge
        for (let i = 0; i < input.length; i++) {
            const p1 = input[i];
            const p2 = input[(i + 1) % input.length];

            if (p1.lat >= bounds.south) {
                if (p2.lat >= bounds.south) {
                    output.push(p2);
                } else {
                    const t = (bounds.south - p1.lat) / (p2.lat - p1.lat);
                    const lng = p1.lng + t * (p2.lng - p1.lng);
                    output.push({ lat: bounds.south, lng });
                }
            } else {
                if (p2.lat >= bounds.south) {
                    const t = (bounds.south - p1.lat) / (p2.lat - p1.lat);
                    const lng = p1.lng + t * (p2.lng - p1.lng);
                    output.push({ lat: bounds.south, lng });
                    output.push(p2);
                }
            }
        }
        input = output;
        output = [];

        // Clip against north edge
        for (let i = 0; i < input.length; i++) {
            const p1 = input[i];
            const p2 = input[(i + 1) % input.length];

            if (p1.lat <= bounds.north) {
                if (p2.lat <= bounds.north) {
                    output.push(p2);
                } else {
                    const t = (bounds.north - p1.lat) / (p2.lat - p1.lat);
                    const lng = p1.lng + t * (p2.lng - p1.lng);
                    output.push({ lat: bounds.north, lng });
                }
            } else {
                if (p2.lat <= bounds.north) {
                    const t = (bounds.north - p1.lat) / (p2.lat - p1.lat);
                    const lng = p1.lng + t * (p2.lng - p1.lng);
                    output.push({ lat: bounds.north, lng });
                    output.push(p2);
                }
            }
        }

        return output.length >= 3 ? output : polygon; // Return original if clipping failed
    };

    // Function to create Voronoi cell boundary with proper convex hull
    const createVoronoiCell = (
        plantsInZone: Array<{ position: { lat: number; lng: number } }>,
        zoneCenter: { lat: number; lng: number },
        shapeData?: {
            bounds?: { north: number; south: number; east: number; west: number };
            center?: { lat: number; lng: number };
            radius?: number;
            path?: Array<{ lat: number; lng: number }>;
        },
        shapeType?: string
    ) => {
        if (plantsInZone.length === 0) {
            // If no plants, return a small square around center
            const buffer = 0.0001;
            return [
                { lat: zoneCenter.lat + buffer, lng: zoneCenter.lng + buffer },
                { lat: zoneCenter.lat + buffer, lng: zoneCenter.lng - buffer },
                { lat: zoneCenter.lat - buffer, lng: zoneCenter.lng - buffer },
                { lat: zoneCenter.lat - buffer, lng: zoneCenter.lng + buffer },
            ];
        }

        // Create a convex hull around the plants in this zone
        const points = plantsInZone.map((plant) => ({
            lat: plant.position.lat,
            lng: plant.position.lng,
        }));

        // Add zone center to points for better boundary
        points.push({ lat: zoneCenter.lat, lng: zoneCenter.lng });

        // Create convex hull
        let hull = createConvexHull(points);

        // If hull is too small, expand it slightly
        if (hull.length < 3) {
            const buffer = 0.0001; // Small buffer in degrees
            return [
                { lat: zoneCenter.lat + buffer, lng: zoneCenter.lng + buffer },
                { lat: zoneCenter.lat + buffer, lng: zoneCenter.lng - buffer },
                { lat: zoneCenter.lat - buffer, lng: zoneCenter.lng - buffer },
                { lat: zoneCenter.lat - buffer, lng: zoneCenter.lng + buffer },
            ];
        }

        // Clip hull to drawn area bounds if shape data is provided
        if (shapeData && shapeType) {
            // For rectangles, clip to bounds
            if (
                shapeType === window.google.maps.drawing.OverlayType.RECTANGLE &&
                shapeData.bounds
            ) {
                hull = clipPolygonToBounds(hull, shapeData.bounds);
            }
            // For polygons and circles, filter points that are outside
            else if (
                shapeType === window.google.maps.drawing.OverlayType.POLYGON ||
                shapeType === window.google.maps.drawing.OverlayType.CIRCLE
            ) {
                // Filter hull points to only include those inside the drawn area
                hull = hull.filter((point) => isPointInDrawnArea(point, shapeData, shapeType));

                // If too many points removed, use bounds clipping as fallback
                if (hull.length < 3 && shapeData.bounds) {
                    // Get bounds from polygon path if available
                    let bounds = shapeData.bounds;
                    if (
                        shapeType === window.google.maps.drawing.OverlayType.POLYGON &&
                        shapeData.path
                    ) {
                        const lats = shapeData.path.map((p) => p.lat);
                        const lngs = shapeData.path.map((p) => p.lng);
                        bounds = {
                            north: Math.max(...lats),
                            south: Math.min(...lats),
                            east: Math.max(...lngs),
                            west: Math.min(...lngs),
                        };
                    } else if (
                        shapeType === window.google.maps.drawing.OverlayType.CIRCLE &&
                        shapeData.center &&
                        shapeData.radius
                    ) {
                        const radiusDeg = shapeData.radius / 111000;
                        bounds = {
                            north: shapeData.center.lat + radiusDeg,
                            south: shapeData.center.lat - radiusDeg,
                            east: shapeData.center.lng + radiusDeg,
                            west: shapeData.center.lng - radiusDeg,
                        };
                    }

                    // Recreate hull from original points and clip
                    hull = createConvexHull(points);
                    hull = clipPolygonToBounds(hull, bounds);

                    // Final filter to ensure all points are inside
                    hull = hull.filter((point) => isPointInDrawnArea(point, shapeData, shapeType));
                }

                // If still too few points, recreate from plants only inside area
                if (hull.length < 3) {
                    const validPlants = plantsInZone.filter((plant) =>
                        isPointInDrawnArea(plant.position, shapeData, shapeType)
                    );
                    if (validPlants.length > 0) {
                        const validPoints = validPlants.map((plant) => ({
                            lat: plant.position.lat,
                            lng: plant.position.lng,
                        }));
                        validPoints.push({ lat: zoneCenter.lat, lng: zoneCenter.lng });
                        hull = createConvexHull(validPoints);
                    }
                }
            }
        }

        // Ensure minimum 3 points for a valid polygon
        if (hull.length < 3) {
            const buffer = 0.0001;
            return [
                { lat: zoneCenter.lat + buffer, lng: zoneCenter.lng + buffer },
                { lat: zoneCenter.lat + buffer, lng: zoneCenter.lng - buffer },
                { lat: zoneCenter.lat - buffer, lng: zoneCenter.lng - buffer },
                { lat: zoneCenter.lat - buffer, lng: zoneCenter.lng + buffer },
            ];
        }

        return hull;
    };

    // Function to create convex hull from points
    const createConvexHull = (points: Array<{ lat: number; lng: number }>) => {
        if (points.length < 3) return points;

        // Sort points by latitude, then longitude
        const sortedPoints = [...points].sort((a, b) => {
            if (a.lat !== b.lat) return a.lat - b.lat;
            return a.lng - b.lng;
        });

        // Graham scan algorithm
        const hull: Array<{ lat: number; lng: number }> = [];

        // Lower hull
        for (const point of sortedPoints) {
            while (
                hull.length >= 2 &&
                crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0
            ) {
                hull.pop();
            }
            hull.push(point);
        }

        // Upper hull
        const upperHull: Array<{ lat: number; lng: number }> = [];
        for (let i = sortedPoints.length - 1; i >= 0; i--) {
            const point = sortedPoints[i];
            while (
                upperHull.length >= 2 &&
                crossProduct(
                    upperHull[upperHull.length - 2],
                    upperHull[upperHull.length - 1],
                    point
                ) <= 0
            ) {
                upperHull.pop();
            }
            upperHull.push(point);
        }

        // Combine lower and upper hull
        hull.pop();
        upperHull.pop();
        return [...hull, ...upperHull];
    };

    // Function to calculate cross product for convex hull
    const crossProduct = (
        O: { lat: number; lng: number },
        A: { lat: number; lng: number },
        B: { lat: number; lng: number }
    ) => {
        return (A.lat - O.lat) * (B.lng - O.lng) - (A.lng - O.lng) * (B.lat - O.lat);
    };

    // Function to create Voronoi-based zones using plant positions
    const createVoronoiZones = (map: google.maps.Map, numberOfZones: number = 2) => {
        if (drawnShapes.length === 0) {
            console.error('❌ No drawn area to divide');
            return;
        }

        const shape = drawnShapes[0];
        if (!shape.data) {
            console.error('❌ No shape data available');
            return;
        }

        if (plantPoints.length === 0) {
            console.error('❌ No plant points available for zone generation');
            return;
        }

        // Note: Area bounds not needed for Voronoi tessellation as it's based on plant positions

        console.log(`🎯 Creating ${numberOfZones} Voronoi zones based on plant positions`);

        // Use K-means clustering to find optimal zone centers based on plant positions
        const plantPositions = plantPoints.map((p) => ({
            lat: p.position.lat,
            lng: p.position.lng,
        }));

        if (plantPositions.length === 0) {
            console.error('❌ No plant positions available for Voronoi generation');
            return;
        }

        console.log(`📊 Found ${plantPositions.length} plant positions for Voronoi tessellation`);

        // Perform K-means clustering to find zone centers
        const plantLocations = plantPoints.map((p) => ({
            id: p.id.toString(),
            position: p.position,
            plantData: {
                id: 1,
                name: 'Plant',
                plantSpacing: 30,
                rowSpacing: 30,
                waterNeed: 1,
            },
        }));
        const zoneCenters = performKMeansClustering(plantLocations, numberOfZones);

        console.log(`📊 Generated ${zoneCenters.length} zone centers using K-means clustering`);

        // Generate zone colors
        const zoneColors = generateZoneColors(numberOfZones);

        // Create Voronoi zones based on zone centers
        const newZones: Array<{
            id: number;
            name: string;
            color: string;
            bounds: { north: number; south: number; east: number; west: number };
            coordinates: Array<{ lat: number; lng: number }>;
            overlay: google.maps.Polygon;
            center: { lat: number; lng: number };
            centerMarker: google.maps.Marker;
        }> = [];

        // Create Voronoi cells for each zone center
        for (let zoneIdx = 0; zoneIdx < numberOfZones; zoneIdx++) {
            const zoneCenter = zoneCenters[zoneIdx][0]; // Get first plant in cluster as center

            // Find all plants closest to this zone center
            const plantsInZone = plantPoints.filter((plant) => {
                const distances = zoneCenters.map((cluster) => {
                    const clusterCenter = cluster[0];
                    return Math.sqrt(
                        Math.pow(plant.position.lat - clusterCenter.position.lat, 2) +
                            Math.pow(plant.position.lng - clusterCenter.position.lng, 2)
                    );
                });
                const minDistance = Math.min(...distances);
                const distanceToThisCenter = Math.sqrt(
                    Math.pow(plant.position.lat - zoneCenter.position.lat, 2) +
                        Math.pow(plant.position.lng - zoneCenter.position.lng, 2)
                );
                return Math.abs(distanceToThisCenter - minDistance) < 0.000001;
            });

            if (plantsInZone.length === 0) continue;

            // Create Voronoi cell boundary using convex hull of plants in this zone
            // Pass shape data to clip hull to drawn area boundaries
            const zoneCoordinates = createVoronoiCell(
                plantsInZone,
                { lat: zoneCenter.position.lat, lng: zoneCenter.position.lng },
                shape.data,
                shape.type
            );

            // Calculate bounds from coordinates
            const lats = zoneCoordinates.map((coord) => coord.lat);
            const lngs = zoneCoordinates.map((coord) => coord.lng);
            const zoneBounds = {
                north: Math.max(...lats),
                south: Math.min(...lats),
                east: Math.max(...lngs),
                west: Math.min(...lngs),
            };

            const center = {
                lat: zoneCenter.position.lat,
                lng: zoneCenter.position.lng,
            };

            // Create polygon overlay
            const overlay = new window.google.maps.Polygon({
                paths: zoneCoordinates,
                fillColor: zoneColors[zoneIdx],
                fillOpacity: 0.4,
                strokeColor: zoneColors[zoneIdx],
                strokeOpacity: 0.9,
                strokeWeight: 3,
                clickable: false,
                zIndex: 1000,
            });

            overlay.setMap(map);

            // Create center marker
            const zoneName = `Zone ${zoneIdx + 1}`;
            const centerMarker = createZoneCenterMarker(map, center, zoneName, zoneColors[zoneIdx]);

            console.log(`✅ ${zoneName}: ${plantsInZone.length} plants`);

            newZones.push({
                id: Date.now() + zoneIdx,
                name: zoneName,
                color: zoneColors[zoneIdx],
                bounds: zoneBounds,
                coordinates: zoneCoordinates,
                overlay,
                center,
                centerMarker,
            });
        }

        // Update zones state
        setZones(newZones);

        // Save to localStorage
        const zonesForStorage = newZones.map((zone) => ({
            id: zone.id,
            name: zone.name,
            color: zone.color,
            bounds: zone.bounds,
            coordinates: zone.coordinates,
            center: zone.center,
        }));
        localStorage.setItem('zones', JSON.stringify(zonesForStorage));

        console.log('✅ Voronoi zones created successfully:', newZones.length);
        return newZones;
    };

    // Balanced K-means clustering function for plant points (not used with vertical zones)
    // This ensures each zone has approximately equal number of plants
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const performKMeansClustering = (plants: PlantLocation[], k: number): PlantLocation[][] => {
        if (plants.length === 0 || k <= 0) return [];
        if (plants.length <= k) {
            return plants.map((plant) => [plant]);
        }

        console.log(
            `🎯 Starting Balanced K-means clustering for ${plants.length} plants into ${k} zones`
        );

        // Calculate target size for each cluster (balanced distribution)
        const targetSize = Math.floor(plants.length / k);
        const remainder = plants.length % k;

        console.log(
            `📊 Target size per zone: ${targetSize} plants (${remainder} zones will have ${targetSize + 1})`
        );

        // Initialize centroids using k-means++ for better initial distribution
        const centroids: Array<{ lat: number; lng: number }> = [];
        const usedIndices = new Set<number>();

        // First centroid: random
        const firstIdx = Math.floor(Math.random() * plants.length);
        centroids.push({ ...plants[firstIdx].position });
        usedIndices.add(firstIdx);

        // Remaining centroids: choose points far from existing centroids
        for (let i = 1; i < k; i++) {
            let maxMinDistance = -1;
            let bestIdx = 0;

            for (let j = 0; j < plants.length; j++) {
                if (usedIndices.has(j)) continue;

                // Find minimum distance to existing centroids
                let minDistance = Infinity;
                for (const centroid of centroids) {
                    const dist = calculateDistance(plants[j].position, centroid);
                    minDistance = Math.min(minDistance, dist);
                }

                // Choose point with maximum minimum distance
                if (minDistance > maxMinDistance) {
                    maxMinDistance = minDistance;
                    bestIdx = j;
                }
            }

            centroids.push({ ...plants[bestIdx].position });
            usedIndices.add(bestIdx);
        }

        let clusters: PlantLocation[][] = Array(k)
            .fill(null)
            .map(() => []);
        let iteration = 0;
        const maxIterations = 100;

        while (iteration < maxIterations) {
            // Clear clusters
            clusters = Array(k)
                .fill(null)
                .map(() => []);

            // Calculate distances for all plants to all centroids
            const plantDistances: Array<{ plant: PlantLocation; distances: number[] }> = plants.map(
                (plant) => ({
                    plant,
                    distances: centroids.map((centroid) =>
                        calculateDistance(plant.position, centroid)
                    ),
                })
            );

            // Sort plants by their minimum distance to any centroid (for balanced assignment)
            plantDistances.sort((a, b) => Math.min(...a.distances) - Math.min(...b.distances));

            // Balanced assignment: assign plants to clusters ensuring balanced distribution
            const clusterSizes = Array(k).fill(0);
            const maxClusterSize = targetSize + 1;

            for (const { plant, distances } of plantDistances) {
                // Find clusters sorted by distance
                const clustersByDistance = distances
                    .map((dist, idx) => ({ idx, dist }))
                    .sort((a, b) => a.dist - b.dist);

                // Assign to the nearest cluster that hasn't reached max size
                let assigned = false;
                for (const { idx } of clustersByDistance) {
                    const currentSize = clusterSizes[idx];
                    const targetForThisCluster = idx < remainder ? targetSize + 1 : targetSize;

                    if (currentSize < targetForThisCluster) {
                        clusters[idx].push(plant);
                        clusterSizes[idx]++;
                        assigned = true;
                        break;
                    }
                }

                // If all preferred clusters are full, assign to any available cluster
                if (!assigned) {
                    for (let i = 0; i < k; i++) {
                        if (clusterSizes[i] < maxClusterSize) {
                            clusters[i].push(plant);
                            clusterSizes[i]++;
                            break;
                        }
                    }
                }
            }

            // Update centroids
            let converged = true;
            for (let i = 0; i < k; i++) {
                if (clusters[i].length === 0) continue;

                const newCentroid = {
                    lat:
                        clusters[i].reduce((sum, plant) => sum + plant.position.lat, 0) /
                        clusters[i].length,
                    lng:
                        clusters[i].reduce((sum, plant) => sum + plant.position.lng, 0) /
                        clusters[i].length,
                };

                if (calculateDistance(centroids[i], newCentroid) > 0.0001) {
                    converged = false;
                }

                centroids[i] = newCentroid;
            }

            if (converged) {
                console.log(`✅ Converged after ${iteration + 1} iterations`);
                break;
            }
            iteration++;
        }

        // Log final distribution
        const finalClusters = clusters.filter((cluster) => cluster.length > 0);
        console.log(`📊 Final distribution:`);
        finalClusters.forEach((cluster, idx) => {
            console.log(`   Zone ${idx + 1}: ${cluster.length} plants`);
        });

        const minSize = Math.min(...finalClusters.map((c) => c.length));
        const maxSize = Math.max(...finalClusters.map((c) => c.length));
        const variance = maxSize - minSize;
        console.log(`📈 Balance: min=${minSize}, max=${maxSize}, variance=${variance}`);

        return finalClusters;
    };

    // Calculate distance between two coordinates
    const calculateDistance = (
        coord1: { lat: number; lng: number },
        coord2: { lat: number; lng: number }
    ): number => {
        const R = 6371000; // Earth's radius in meters
        const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
        const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((coord1.lat * Math.PI) / 180) *
                Math.cos((coord2.lat * Math.PI) / 180) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Function to divide area into zones (legacy rectangular method) - UNUSED
    /*
    const divideAreaIntoZones = (map: google.maps.Map, numberOfZones: number = 2) => {
        console.log(`🔧 Dividing area into ${numberOfZones} zones`);
        
        if (drawnShapes.length === 0) {
            console.error('❌ No drawn area to divide');
            return;
        }

        const shape = drawnShapes[0];
        if (!shape.data) {
            console.error('❌ No shape data available');
            return;
        }

        let originalBounds: { north: number; south: number; east: number; west: number };

        // Get bounds from different shape types
        if (shape.type === window.google.maps.drawing.OverlayType.RECTANGLE && shape.data.bounds) {
            originalBounds = shape.data.bounds;
        } else if (shape.type === window.google.maps.drawing.OverlayType.CIRCLE && shape.data.center && shape.data.radius) {
            // Convert circle to approximate rectangle bounds
            const center = shape.data.center;
            const radius = shape.data.radius / 111000; // Convert meters to degrees (rough approximation)
            originalBounds = {
                north: center.lat + radius,
                south: center.lat - radius,
                east: center.lng + radius,
                west: center.lng - radius
            };
        } else if (shape.type === window.google.maps.drawing.OverlayType.POLYGON && shape.data.path) {
            // Calculate bounds from polygon points
            const path = shape.data.path;
            const lats = path.map(p => p.lat);
            const lngs = path.map(p => p.lng);
            originalBounds = {
                north: Math.max(...lats),
                south: Math.min(...lats),
                east: Math.max(...lngs),
                west: Math.min(...lngs)
            };
        } else {
            console.error('❌ Unsupported shape type for zone division');
            return;
        }

        console.log('🔧 Original bounds:', originalBounds);

        // Generate unique colors for zones
        const zoneColors = generateZoneColors(numberOfZones);
        
        // Calculate zone width
        const totalWidth = originalBounds.east - originalBounds.west;
        const zoneWidth = totalWidth / numberOfZones;

        // Create zones
        const newZones: Array<{
            id: number;
            name: string;
            color: string;
            bounds: { north: number; south: number; east: number; west: number };
            overlay: google.maps.Rectangle;
            center: { lat: number; lng: number };
            centerMarker: google.maps.Marker;
        }> = [];
        const overlays: google.maps.Rectangle[] = [];

        for (let i = 0; i < numberOfZones; i++) {
            const zoneStartLng = originalBounds.west + (i * zoneWidth);
            const zoneEndLng = originalBounds.west + ((i + 1) * zoneWidth);

            const zoneBounds = {
                north: originalBounds.north,
                south: originalBounds.south,
                east: zoneEndLng,
                west: zoneStartLng
            };

            const zone = {
                id: Date.now() + i,
                name: `Zone ${i + 1}`,
                color: zoneColors[i],
                bounds: zoneBounds
            };

            // Calculate center point
            const center = calculateZoneCenter(zoneBounds);

            // Create zone overlay
            const overlay = new window.google.maps.Rectangle({
                bounds: new window.google.maps.LatLngBounds(
                    { lat: zone.bounds.south, lng: zone.bounds.west },
                    { lat: zone.bounds.north, lng: zone.bounds.east }
                ),
                fillColor: zone.color,
                fillOpacity: 0.4, // Slightly higher opacity to be more visible
                strokeColor: zone.color,
                strokeOpacity: 0.9,
                strokeWeight: 3, // Thicker border to stand out
                clickable: false,
                zIndex: 1000 // Higher z-index to appear on top
            });

            // Create center marker
            const centerMarker = createZoneCenterMarker(map, center, zone.name, zone.color);

            // Add overlay to map
            overlay.setMap(map);

            newZones.push({ ...zone, overlay, center, centerMarker });
            overlays.push(overlay);
        }

        // Update state
        setZones(newZones);

        // Save to localStorage
        const zonesForStorage = newZones.map(zone => ({
            id: zone.id,
            name: zone.name,
            color: zone.color,
            bounds: zone.bounds,
            center: zone.center
        }));
        localStorage.setItem('zones', JSON.stringify(zonesForStorage));

        console.log(`✅ ${numberOfZones} zones created successfully:`, newZones);
        console.log('💾 Saved to localStorage:', zonesForStorage);

        return newZones;
    };
    */

    // Function to handle zone generation from modal
    const handleGenerateZones = () => {
        console.log(`🎯 Generating ${zoneCount} zones`);

        if (drawnShapes.length === 0) {
            console.log('❌ Cannot create zones: No drawn area');
            alert('กรุณาวาดพื้นที่ก่อนแบ่งโซน');
            return;
        }

        // Create Voronoi-based zones with specified count
        const newZones = createVoronoiZones(mapInstanceRef.current as google.maps.Map, zoneCount);

        if (newZones && newZones.length > 0) {
            console.log('✅ Zones created successfully:', newZones.length);

            // Close modal
            setShowZoneModal(false);

            // Complete current step and move to next
            setCompletedSteps((prev) => {
                const newCompletedSteps = [...prev, 3];
                const newCurrentStep = Math.min(4, 4); // Max step is 4

                // Save progress to localStorage
                const progressData = {
                    currentStep: newCurrentStep,
                    completedSteps: newCompletedSteps,
                };
                localStorage.setItem('mapStepProgress', JSON.stringify(progressData));

                console.log('Saved progress to localStorage:', progressData);

                return newCompletedSteps;
            });

            setCurrentStep(4); // Move to step 4 (Generate Pipe System)
        } else {
            console.error('❌ Failed to create zones');
        }
    };

    // Function to close zone modal
    const handleCloseZoneModal = () => {
        setShowZoneModal(false);
    };

    // Search functionality handlers
    const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchValue(value);

        if (value.length > 2 && autocompleteService) {
            autocompleteService.getPlacePredictions(
                {
                    input: value,
                    types: ['geocode'],
                    componentRestrictions: { country: 'th' }, // Restrict to Thailand
                },
                (predictions, status) => {
                    if (
                        status === window.google.maps.places.PlacesServiceStatus.OK &&
                        predictions
                    ) {
                        setSearchResults(predictions);
                        setShowSearchResults(true);
                    } else {
                        setSearchResults([]);
                        setShowSearchResults(false);
                    }
                }
            );
        } else {
            setSearchResults([]);
            setShowSearchResults(false);
        }
    };

    const handleSearchResultClick = (placeId: string) => {
        if (placesService && mapInstanceRef.current) {
            placesService.getDetails(
                {
                    placeId: placeId,
                    fields: ['geometry', 'name', 'formatted_address'],
                },
                (place, status) => {
                    if (
                        status === window.google.maps.places.PlacesServiceStatus.OK &&
                        place?.geometry?.location
                    ) {
                        const location = place.geometry.location;
                        const map = mapInstanceRef.current as google.maps.Map;

                        // Move map to the selected location
                        map.setCenter(location);
                        map.setZoom(16);

                        // Update search value with the place name
                        setSearchValue(place.name || '');
                        setShowSearchResults(false);
                    }
                }
            );
        }
    };

    const handleSearchInputFocus = () => {
        if (searchResults.length > 0) {
            setShowSearchResults(true);
        }
    };

    const handleSearchInputBlur = () => {
        // Delay hiding results to allow clicking on them
        setTimeout(() => {
            setShowSearchResults(false);
        }, 200);
    };

    // Function to generate main pipes from pumps to zone centers
    const generateMainPipes = (map: google.maps.Map) => {
        console.log('🔧 Generating main pipes from pumps to zone centers');

        // Check if pipe system already generated
        const existingMainPipes = localStorage.getItem('mainPipes');
        const existingSubMainPipes = localStorage.getItem('subMainPipes');
        const existingLateralPipes = localStorage.getItem('lateralPipes');

        if (existingMainPipes && existingSubMainPipes && existingLateralPipes) {
            try {
                const mainPipesData = JSON.parse(existingMainPipes);
                const subMainPipesData = JSON.parse(existingSubMainPipes);
                const lateralPipesData = JSON.parse(existingLateralPipes);

                if (
                    mainPipesData.length > 0 &&
                    subMainPipesData.length > 0 &&
                    lateralPipesData.length > 0
                ) {
                    console.log('⚠️ Pipe system already generated');
                    alert('ระบบท่อถูกสร้างแล้ว กรุณากดรีเซ็ตก่อนสร้างใหม่');
                    return;
                }
            } catch (e) {
                console.error('Error checking existing pipes:', e);
            }
        }

        if (pumps.length === 0) {
            console.error('❌ No pumps available for pipe generation');
            alert('กรุณาวางปั๊มก่อนสร้างระบบท่อ');
            return;
        }

        if (zones.length === 0) {
            console.error('❌ No zones available for pipe generation');
            alert('กรุณาแบ่งโซนก่อนสร้างระบบท่อ');
            return;
        }

        // Clear existing main pipes
        mainPipes.forEach((pipe) => {
            if (pipe.overlay) {
                (pipe.overlay as { setMap: (map: unknown) => void }).setMap(null);
            }
        });
        setMainPipes([]);

        const newMainPipes: Array<{
            id: number;
            fromPump: { lat: number; lng: number };
            toZoneCenter: { lat: number; lng: number };
            overlay: google.maps.Polyline;
            zoneId: number;
        }> = [];

        // Create only ONE main pipe per zone: from nearest pump to that zone's center
        const geometry = window.google?.maps?.geometry;
        zones.forEach((zone, zoneIndex) => {
            if (!zone.center) return;

            // Choose nearest pump to this zone center
            let nearestPump = pumps[0];
            let nearestDistance = Number.POSITIVE_INFINITY;
            pumps.forEach((pump) => {
                const a = new window.google.maps.LatLng(zone.center.lat, zone.center.lng);
                const b = new window.google.maps.LatLng(pump.position.lat, pump.position.lng);
                let d = 0;
                if (geometry?.spherical) {
                    d = geometry.spherical.computeDistanceBetween(a, b);
                } else {
                    // rough fallback in degrees
                    d = Math.hypot(
                        zone.center.lat - pump.position.lat,
                        zone.center.lng - pump.position.lng
                    );
                }
                if (d < nearestDistance) {
                    nearestDistance = d;
                    nearestPump = pump;
                }
            });

            if (!nearestPump) return;

            const pipeId = Date.now() + zoneIndex;

            const polyline = new window.google.maps.Polyline({
                path: [nearestPump.position, zone.center],
                geodesic: true,
                strokeColor: '#DC2626',
                strokeOpacity: 0.8,
                strokeWeight: 4,
                zIndex: 1200,
            });

            polyline.setMap(map);

            newMainPipes.push({
                id: pipeId,
                fromPump: nearestPump.position,
                toZoneCenter: zone.center,
                overlay: polyline,
                zoneId: zone.id,
            });
        });

        // Update state
        setMainPipes(newMainPipes);

        // Save to localStorage
        const pipesForStorage = newMainPipes.map((pipe) => ({
            id: pipe.id,
            fromPump: pipe.fromPump,
            toZoneCenter: pipe.toZoneCenter,
            zoneId: pipe.zoneId,
        }));
        localStorage.setItem('mainPipes', JSON.stringify(pipesForStorage));

        console.log(`✅ ${newMainPipes.length} main pipes created successfully`);
        console.log('💾 Saved main pipes to localStorage:', pipesForStorage);

        // Generate sub-main pipes after main pipes
        const generatedSubMainPipes = generateSubMainPipes(map);

        // Generate lateral pipes after sub-main pipes (pass generated sub-main pipes)
        const generatedLateralPipes = generateLateralPipes(map, generatedSubMainPipes || []);

        // After full pipeline is generated, compute and save summary metrics
        setTimeout(() => {
            try {
                const geometry = window.google?.maps?.geometry;
                const computePolylineLength = (
                    path: Array<{ lat: number; lng: number }>
                ): number => {
                    if (!geometry?.spherical || path.length < 2) return 0;
                    const latLngs = path.map((p) => new window.google.maps.LatLng(p.lat, p.lng));
                    return geometry.spherical.computeLength(latLngs);
                };

                // 1) Area (sqm and rai) by zone and total
                let totalAreaSqm = 0;
                const zoneAreas: Array<{
                    zoneId: number;
                    name: string;
                    areaSqm: number;
                    areaRai: number;
                }> = [];
                if (geometry?.spherical) {
                    zones.forEach((zone) => {
                        let areaSqm = 0;
                        if (zone.coordinates && zone.coordinates.length >= 3) {
                            const latLngs = zone.coordinates.map(
                                (c) => new window.google.maps.LatLng(c.lat, c.lng)
                            );
                            areaSqm = geometry.spherical.computeArea(latLngs);
                        } else if (zone.bounds) {
                            const ne = new window.google.maps.LatLng(
                                zone.bounds.north,
                                zone.bounds.east
                            );
                            const sw = new window.google.maps.LatLng(
                                zone.bounds.south,
                                zone.bounds.west
                            );
                            const nw = new window.google.maps.LatLng(
                                zone.bounds.north,
                                zone.bounds.west
                            );
                            const width = geometry.spherical.computeDistanceBetween(nw, ne);
                            const height = geometry.spherical.computeDistanceBetween(sw, nw);
                            areaSqm = width * height;
                        }
                        totalAreaSqm += Math.max(0, areaSqm);
                        zoneAreas.push({
                            zoneId: zone.id,
                            name: zone.name,
                            areaSqm,
                            areaRai: areaSqm / 1600,
                        });
                    });
                }

                // 2) Plant count overall and per zone (rectangle boundaries fallback)
                const zonePlantCounts: Array<{ zoneId: number; name: string; plants: number }> =
                    zones.map((zone) => ({ zoneId: zone.id, name: zone.name, plants: 0 }));
                plantPoints.forEach((pt) => {
                    const z = zones.find(
                        (zone) =>
                            zone.bounds &&
                            pt.position.lat >= zone.bounds.south &&
                            pt.position.lat <= zone.bounds.north &&
                            pt.position.lng >= zone.bounds.west &&
                            pt.position.lng <= zone.bounds.east
                    );
                    if (z) {
                        const rec = zonePlantCounts.find((r) => r.zoneId === z.id);
                        if (rec) rec.plants += 1;
                    }
                });
                const totalPlants = plantPoints.length;

                // 3) Pipe lengths (meters) overall and per type; and by zone when applicable
                let mainLen = 0;
                newMainPipes.forEach((p) => {
                    mainLen += computePolylineLength([p.fromPump, p.toZoneCenter]);
                });

                let subMainLen = 0;
                (generatedSubMainPipes || []).forEach((p) => {
                    subMainLen += computePolylineLength(p.path);
                });

                let lateralLen = 0;
                (generatedLateralPipes || []).forEach((p) => {
                    lateralLen += computePolylineLength(p.path);
                });

                // Calculate total outlets for the LONGEST pipe of each type across all zones

                // 1. Find the longest main pipe across all zones
                let totalMainOutlets = 0;
                if (newMainPipes.length > 0) {
                    const longestMainPipe = newMainPipes.reduce((longest, pipe) => {
                        const len = computePolylineLength([pipe.fromPump, pipe.toZoneCenter]);
                        const longestLen = computePolylineLength([
                            longest.fromPump,
                            longest.toZoneCenter,
                        ]);
                        return len > longestLen ? pipe : longest;
                    });
                    // Count sub-main pipes in the same zone as the longest main pipe
                    totalMainOutlets = (generatedSubMainPipes || []).filter(
                        (p) => p.zoneId === longestMainPipe.zoneId
                    ).length;
                }

                // 2. Find the longest sub-main pipe across all zones
                let totalSubMainOutlets = 0;
                if ((generatedSubMainPipes || []).length > 0) {
                    const longestSubMainPipe = (generatedSubMainPipes || []).reduce(
                        (longest, pipe) => {
                            const len = computePolylineLength(pipe.path);
                            const longestLen = computePolylineLength(longest.path);
                            return len > longestLen ? pipe : longest;
                        }
                    );
                    // Count lateral pipes in the same zone as the longest sub-main pipe
                    totalSubMainOutlets = (generatedLateralPipes || []).filter(
                        (p) => p.zoneId === longestSubMainPipe.zoneId
                    ).length;
                }

                // 3. Find the longest lateral pipe across all zones
                let totalLateralOutlets = 0;
                if ((generatedLateralPipes || []).length > 0) {
                    const longestLateralPipe = (generatedLateralPipes || []).reduce(
                        (longest, pipe) => {
                            const len = computePolylineLength(pipe.path);
                            const longestLen = computePolylineLength(longest.path);
                            return len > longestLen ? pipe : longest;
                        }
                    );
                    // Count plants along this lateral pipe
                    const lateralLng = longestLateralPipe.path[0].lng;
                    const tolerance = 0.00001;
                    totalLateralOutlets = plantPoints.filter(
                        (plant) => Math.abs(plant.position.lng - lateralLng) < tolerance
                    ).length;
                }

                const zonePipeLengths = zones.map((zone) => {
                    // Main pipe length
                    const zoneMainPipes = newMainPipes.filter((p) => p.zoneId === zone.id);
                    const mainLen = zoneMainPipes.reduce(
                        (sum, p) => sum + computePolylineLength([p.fromPump, p.toZoneCenter]),
                        0
                    );

                    // Sub-main pipe length and count
                    const zoneSubMainPipes = (generatedSubMainPipes || []).filter(
                        (p) => p.zoneId === zone.id
                    );
                    const subLen = zoneSubMainPipes.reduce(
                        (sum, p) => sum + computePolylineLength(p.path),
                        0
                    );

                    // Lateral pipe length and count
                    const zoneLateralPipes = (generatedLateralPipes || []).filter(
                        (p) => p.zoneId === zone.id
                    );
                    const latLen = zoneLateralPipes.reduce(
                        (sum, p) => sum + computePolylineLength(p.path),
                        0
                    );

                    // Get plants in this zone
                    const zonePlants = plantPoints.filter(
                        (point) =>
                            point.position.lat >= zone.bounds.south &&
                            point.position.lat <= zone.bounds.north &&
                            point.position.lng >= zone.bounds.west &&
                            point.position.lng <= zone.bounds.east
                    );

                    // Calculate outlets for the LONGEST pipe of each type:

                    // 1. Main pipe outlets = number of sub-main pipes connected to the longest main pipe
                    let mainOutlets = 0;
                    if (zoneMainPipes.length > 0) {
                        // Find the longest main pipe in this zone (we just need to verify it exists)
                        zoneMainPipes.reduce((longest, pipe) => {
                            const len = computePolylineLength([pipe.fromPump, pipe.toZoneCenter]);
                            const longestLen = computePolylineLength([
                                longest.fromPump,
                                longest.toZoneCenter,
                            ]);
                            return len > longestLen ? pipe : longest;
                        });
                        // Count sub-main pipes connected to this main pipe (in this zone, usually all sub-mains)
                        mainOutlets = zoneSubMainPipes.length;
                    }

                    // 2. Sub-main pipe outlets = number of lateral pipes connected to the longest sub-main pipe
                    let subMainOutlets = 0;
                    if (zoneSubMainPipes.length > 0) {
                        // Find the longest sub-main pipe (we just need to verify it exists)
                        zoneSubMainPipes.reduce((longest, pipe) => {
                            const len = computePolylineLength(pipe.path);
                            const longestLen = computePolylineLength(longest.path);
                            return len > longestLen ? pipe : longest;
                        });
                        // Count lateral pipes connected to this sub-main (all laterals in the zone)
                        subMainOutlets = zoneLateralPipes.length;
                    }

                    // 3. Lateral pipe outlets = number of plants connected to the longest lateral pipe
                    let lateralOutlets = 0;
                    if (zoneLateralPipes.length > 0) {
                        // Find the longest lateral pipe
                        const longestLateralPipe = zoneLateralPipes.reduce((longest, pipe) => {
                            const len = computePolylineLength(pipe.path);
                            const longestLen = computePolylineLength(longest.path);
                            return len > longestLen ? pipe : longest;
                        });

                        // Count plants along this lateral pipe
                        // Lateral pipes are vertical, so we count plants with the same longitude
                        const lateralLng = longestLateralPipe.path[0].lng;
                        const tolerance = 0.00001; // Small tolerance for floating point comparison
                        lateralOutlets = zonePlants.filter(
                            (plant) => Math.abs(plant.position.lng - lateralLng) < tolerance
                        ).length;
                    }

                    return {
                        zoneId: zone.id,
                        name: zone.name,
                        mainMeters: mainLen,
                        subMainMeters: subLen,
                        lateralMeters: latLen,
                        mainOutlets,
                        subMainOutlets,
                        lateralOutlets,
                    };
                });

                // Get selected plant data from localStorage
                let selectedPlantData = null;
                try {
                    const savedPlantData = localStorage.getItem('selectedPlantData');
                    if (savedPlantData) {
                        selectedPlantData = JSON.parse(savedPlantData);
                    }
                } catch (error) {
                    console.error('Error parsing selected plant data:', error);
                }

                const summary = {
                    area: {
                        totalSqm: totalAreaSqm,
                        totalRai: totalAreaSqm / 1600,
                        byZone: zoneAreas,
                    },
                    plants: { total: totalPlants, byZone: zonePlantCounts },
                    pipes: {
                        mainMeters: mainLen,
                        subMainMeters: subMainLen,
                        lateralMeters: lateralLen,
                        mainOutlets: totalMainOutlets,
                        subMainOutlets: totalSubMainOutlets,
                        lateralOutlets: totalLateralOutlets,
                        byZone: zonePipeLengths,
                    },
                    selectedPlant: selectedPlantData,
                    savedAt: new Date().toISOString(),
                };
                localStorage.setItem('freePlanSummary', JSON.stringify(summary));
                console.log('💾 Saved freePlanSummary:', summary);
            } catch (e) {
                console.error('Failed to compute/save free plan summary:', e);
            }
        }, 0);

        return newMainPipes;
    };

    // Function to generate sub-main pipes connecting through main pipes
    const generateSubMainPipes = (map: google.maps.Map) => {
        console.log('🔧 Generating sub-main pipes through main pipes');

        if (zones.length === 0) {
            console.error('❌ No zones available for sub-main pipe generation');
            return;
        }

        if (plantPoints.length === 0) {
            console.error('❌ No plant points available for sub-main pipe generation');
            return;
        }

        // Clear existing sub-main pipes
        subMainPipes.forEach((pipe) => {
            if (pipe.overlay) {
                (pipe.overlay as { setMap: (map: unknown) => void }).setMap(null);
            }
        });
        setSubMainPipes([]);

        const newSubMainPipes: Array<{
            id: number;
            path: Array<{ lat: number; lng: number }>;
            overlay: google.maps.Polyline;
            zoneId: number;
        }> = [];

        // Create sub-main pipes for each zone
        zones.forEach((zone, index) => {
            console.log(`🔍 Processing zone ${index + 1}:`, zone);

            // Find plant points in this zone to determine the actual tree boundaries
            const zonePlantPoints = plantPoints.filter(
                (point) =>
                    point.position.lat >= zone.bounds.south &&
                    point.position.lat <= zone.bounds.north &&
                    point.position.lng >= zone.bounds.west &&
                    point.position.lng <= zone.bounds.east
            );

            if (zonePlantPoints.length === 0) {
                console.log(
                    `⚠️ No plant points found in zone ${index + 1}, skipping sub-main pipe`
                );
                return;
            }

            // Calculate actual pipe boundaries that stay strictly within zone polygon
            // For polygon zones, we need to find intersection points with zone boundaries
            let westLng = zone.bounds.west;
            let eastLng = zone.bounds.east;

            // If zone has coordinates (polygon), find actual intersection points
            if (zone.coordinates && zone.coordinates.length > 0) {
                const pipeLat = zone.center.lat;

                // Find all intersection points where horizontal line at pipeLat intersects zone polygon edges
                const intersections: Array<{ lat: number; lng: number }> = [];

                // Check all edges of the polygon
                for (let i = 0; i < zone.coordinates.length; i++) {
                    const p1 = zone.coordinates[i];
                    const p2 = zone.coordinates[(i + 1) % zone.coordinates.length];

                    // Check if horizontal line at pipeLat intersects this edge
                    const latMin = Math.min(p1.lat, p2.lat);
                    const latMax = Math.max(p1.lat, p2.lat);

                    if (pipeLat >= latMin && pipeLat <= latMax && latMin !== latMax) {
                        // Calculate intersection point
                        const t = (pipeLat - p1.lat) / (p2.lat - p1.lat);
                        const intersectionLng = p1.lng + t * (p2.lng - p1.lng);

                        // Verify intersection is within edge longitude bounds
                        const lngMin = Math.min(p1.lng, p2.lng);
                        const lngMax = Math.max(p1.lng, p2.lng);

                        if (intersectionLng >= lngMin && intersectionLng <= lngMax) {
                            intersections.push({ lat: pipeLat, lng: intersectionLng });
                        }
                    }

                    // Also check if edge vertices are exactly at pipeLat
                    if (Math.abs(p1.lat - pipeLat) < 0.000001) {
                        intersections.push(p1);
                    }
                    if (Math.abs(p2.lat - pipeLat) < 0.000001) {
                        intersections.push(p2);
                    }
                }

                // Remove duplicate intersections (within tolerance)
                const uniqueIntersections: Array<{ lat: number; lng: number }> = [];
                intersections.forEach((intersection) => {
                    const isDuplicate = uniqueIntersections.some(
                        (existing) => Math.abs(existing.lng - intersection.lng) < 0.000001
                    );
                    if (!isDuplicate) {
                        uniqueIntersections.push(intersection);
                    }
                });

                // Find westernmost and easternmost intersection points
                if (uniqueIntersections.length >= 2) {
                    const lngs = uniqueIntersections.map((i) => i.lng);
                    westLng = Math.min(...lngs);
                    eastLng = Math.max(...lngs);
                } else if (uniqueIntersections.length === 1) {
                    // Only one intersection (edge case), use bounds as fallback
                    westLng = Math.max(zone.bounds.west, uniqueIntersections[0].lng - 0.0001);
                    eastLng = Math.min(zone.bounds.east, uniqueIntersections[0].lng + 0.0001);
                } else {
                    // No intersections found, use bounds but ensure we're conservative
                    westLng = zone.bounds.west;
                    eastLng = zone.bounds.east;
                }
            } else {
                // For rectangle zones, use bounds directly
                westLng = zone.bounds.west;
                eastLng = zone.bounds.east;
            }

            // Final safety check: ensure pipe doesn't exceed zone bounds
            westLng = Math.max(westLng, zone.bounds.west);
            eastLng = Math.min(eastLng, zone.bounds.east);

            console.log(`🌳 Zone ${index + 1} has ${zonePlantPoints.length} plant points`);
            console.log(
                `🌳 Zone bounds: west=${zone.bounds.west.toFixed(6)}, east=${zone.bounds.east.toFixed(6)}`
            );
            console.log(
                `🌳 Sub-main pipe bounds: west=${westLng.toFixed(6)}, east=${eastLng.toFixed(6)}`
            );

            // Create horizontal sub-main pipe within zone boundaries
            // This ensures the pipe never exceeds zone boundaries
            const pipePath = [
                { lat: zone.center.lat, lng: westLng }, // Western boundary (within zone)
                { lat: zone.center.lat, lng: eastLng }, // Eastern boundary (within zone)
            ];

            console.log(`📍 Sub-main pipe path (strictly within zone polygon):`, pipePath);

            // Create polyline for sub-main pipe
            const polyline = new window.google.maps.Polyline({
                path: pipePath,
                geodesic: true,
                strokeColor: '#8B5CF6', // Purple color for sub-main pipes
                strokeOpacity: 0.8,
                strokeWeight: 3, // Slightly thinner than main pipes
                zIndex: 1100, // Between main pipes and zones
            });

            // Add to map
            polyline.setMap(map);
            console.log(`✅ Created sub-main pipe for zone ${zone.id}`);

            newSubMainPipes.push({
                id: Date.now() + zone.id,
                path: pipePath,
                overlay: polyline,
                zoneId: zone.id,
            });

            // Check if sub-main pipe needs to be connected to main pipe (zone center)
            // Find the closest point on sub-main pipe to zone center
            const zoneCenter = zone.center;
            const geometry = window.google?.maps?.geometry;

            // Calculate distance from zone center to both endpoints of sub-main pipe
            let closestPointOnSubMain: { lat: number; lng: number };

            // Check if zone center's longitude is within sub-main pipe range
            if (zoneCenter.lng >= westLng && zoneCenter.lng <= eastLng) {
                // Zone center is directly on the sub-main pipe line - use it as connection point
                closestPointOnSubMain = { lat: zoneCenter.lat, lng: zoneCenter.lng };
                console.log(
                    `📍 Zone center is on sub-main pipe, using zone center as connection point`
                );
            } else {
                // Zone center is outside sub-main pipe range - find closest endpoint
                const westEndpoint = { lat: zone.center.lat, lng: westLng };
                const eastEndpoint = { lat: zone.center.lat, lng: eastLng };

                let distToWest = 0;
                let distToEast = 0;

                if (geometry?.spherical) {
                    const centerLatLng = new window.google.maps.LatLng(
                        zoneCenter.lat,
                        zoneCenter.lng
                    );
                    const westLatLng = new window.google.maps.LatLng(
                        westEndpoint.lat,
                        westEndpoint.lng
                    );
                    const eastLatLng = new window.google.maps.LatLng(
                        eastEndpoint.lat,
                        eastEndpoint.lng
                    );

                    distToWest = geometry.spherical.computeDistanceBetween(
                        centerLatLng,
                        westLatLng
                    );
                    distToEast = geometry.spherical.computeDistanceBetween(
                        centerLatLng,
                        eastLatLng
                    );
                } else {
                    // Fallback: use simple distance calculation
                    distToWest = Math.hypot(
                        zoneCenter.lat - westEndpoint.lat,
                        zoneCenter.lng - westEndpoint.lng
                    );
                    distToEast = Math.hypot(
                        zoneCenter.lat - eastEndpoint.lat,
                        zoneCenter.lng - eastEndpoint.lng
                    );
                }

                // Choose the closest endpoint
                closestPointOnSubMain = distToWest < distToEast ? westEndpoint : eastEndpoint;
                console.log(
                    `📍 Zone center is outside sub-main pipe, closest endpoint: ${distToWest < distToEast ? 'west' : 'east'}`
                );
            }

            // Check if connection point is different from zone center (needs connection)
            const needsConnection =
                Math.abs(closestPointOnSubMain.lat - zoneCenter.lat) > 0.000001 ||
                Math.abs(closestPointOnSubMain.lng - zoneCenter.lng) > 0.000001;

            if (needsConnection) {
                // Create extended path that includes connection from zone center to closest point on sub-main pipe
                // Build path: zone center -> closest point -> rest of sub-main pipe
                let finalPath: Array<{ lat: number; lng: number }>;

                // Determine the order of points in the final path
                if (closestPointOnSubMain.lng === westLng) {
                    // Connection point is at west end - path: zone center -> west -> east
                    finalPath = [
                        zoneCenter,
                        closestPointOnSubMain,
                        { lat: zone.center.lat, lng: eastLng },
                    ];
                } else {
                    // Connection point is at east end - path: zone center -> east -> west
                    finalPath = [
                        zoneCenter,
                        closestPointOnSubMain,
                        { lat: zone.center.lat, lng: westLng },
                    ];
                }

                // Update the sub-main pipe overlay with extended path
                polyline.setPath(finalPath);

                // Update the stored path in the array
                const pipeIndex = newSubMainPipes.findIndex((p) => p.zoneId === zone.id);
                if (pipeIndex >= 0) {
                    newSubMainPipes[pipeIndex].path = finalPath;
                }

                console.log(
                    `✅ Created connection from zone center to sub-main pipe for zone ${zone.id}`
                );
            } else {
                console.log(
                    `📍 Zone center is already connected to sub-main pipe for zone ${zone.id}`
                );
            }
        });

        // Update state
        setSubMainPipes(newSubMainPipes);

        // Save to localStorage
        const pipesForStorage = newSubMainPipes.map((pipe) => ({
            id: pipe.id,
            path: pipe.path,
            zoneId: pipe.zoneId,
        }));
        localStorage.setItem('subMainPipes', JSON.stringify(pipesForStorage));

        console.log(`✅ ${newSubMainPipes.length} sub-main pipes created successfully`);
        console.log('💾 Saved sub-main pipes to localStorage:', pipesForStorage);

        return newSubMainPipes;
    };

    // Function to find tree columns in a zone
    const findTreeColumns = (zoneBounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    }) => {
        // Filter plant points that are within the zone bounds
        const treesInZone = plantPoints.filter((point) => {
            const lat = point.position.lat;
            const lng = point.position.lng;
            return (
                lat >= zoneBounds.south &&
                lat <= zoneBounds.north &&
                lng >= zoneBounds.west &&
                lng <= zoneBounds.east
            );
        });

        if (treesInZone.length === 0) {
            console.log('❌ No trees found in zone bounds:', zoneBounds);
            return [];
        }

        console.log(`📍 Found ${treesInZone.length} trees in zone`);

        // First, sort all trees by longitude to make grouping easier
        const sortedTrees = [...treesInZone].sort((a, b) => a.position.lng - b.position.lng);

        // Group trees by longitude (columns)
        const treeColumns: Array<Array<{ lat: number; lng: number }>> = [];

        // Calculate dynamic tolerance based on zone width
        const zoneWidth = zoneBounds.east - zoneBounds.west;
        const tolerance = Math.max(0.00002, zoneWidth * 0.05); // 5% of zone width, minimum 0.0005

        console.log(`📏 Zone width: ${zoneWidth.toFixed(6)}, tolerance: ${tolerance.toFixed(6)}`);

        sortedTrees.forEach((tree, index) => {
            const lng = tree.position.lng;
            let foundColumn = false;

            // Check if this tree belongs to an existing column
            for (let i = 0; i < treeColumns.length; i++) {
                const columnLng = treeColumns[i][0].lng;
                if (Math.abs(lng - columnLng) <= tolerance) {
                    treeColumns[i].push(tree.position);
                    foundColumn = true;
                    console.log(
                        `📍 Tree ${index + 1} added to existing column ${i + 1} (lng: ${lng.toFixed(6)})`
                    );
                    break;
                }
            }

            // If no existing column found, create a new one
            if (!foundColumn) {
                treeColumns.push([tree.position]);
                console.log(
                    `📍 Tree ${index + 1} created new column ${treeColumns.length} (lng: ${lng.toFixed(6)})`
                );
            }
        });

        // Sort each column by latitude
        treeColumns.forEach((column, index) => {
            column.sort((a, b) => a.lat - b.lat);
            console.log(
                `📏 Column ${index + 1}: ${column.length} trees, lng: ${column[0].lng.toFixed(6)}`
            );
        });

        // Sort columns by longitude
        treeColumns.sort((a, b) => a[0].lng - b[0].lng);

        console.log(`✅ Total columns found: ${treeColumns.length}`);
        return treeColumns;
    };

    // Helper function: Calculate distance from a point to a line segment
    const distanceToLineSegment = (
        point: { lat: number; lng: number },
        segmentStart: { lat: number; lng: number },
        segmentEnd: { lat: number; lng: number },
        geometry?: {
            spherical?: {
                computeDistanceBetween: (
                    from: google.maps.LatLng,
                    to: google.maps.LatLng
                ) => number;
            };
        }
    ): number => {
        // Calculate parameter t (0 to 1 means point is on segment)
        const A = point.lat - segmentStart.lat;
        const B = point.lng - segmentStart.lng;
        const C = segmentEnd.lat - segmentStart.lat;
        const D = segmentEnd.lng - segmentStart.lng;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        // If segment has zero length, calculate distance to start point
        if (lenSq === 0) {
            if (geometry?.spherical) {
                const pointLatLng = new window.google.maps.LatLng(point.lat, point.lng);
                const startLatLng = new window.google.maps.LatLng(
                    segmentStart.lat,
                    segmentStart.lng
                );
                return geometry.spherical.computeDistanceBetween(pointLatLng, startLatLng);
            }
            return Math.sqrt(A * A + B * B) * 111000; // Convert to meters (rough approximation)
        }

        // Calculate parameter t (clamped to [0, 1])
        const t = Math.max(0, Math.min(1, dot / lenSq));

        // Calculate closest point on segment
        const closestPoint = {
            lat: segmentStart.lat + t * C,
            lng: segmentStart.lng + t * D,
        };

        // Calculate distance from point to closest point on segment
        if (geometry?.spherical) {
            const pointLatLng = new window.google.maps.LatLng(point.lat, point.lng);
            const closestLatLng = new window.google.maps.LatLng(closestPoint.lat, closestPoint.lng);
            return geometry.spherical.computeDistanceBetween(pointLatLng, closestLatLng);
        }

        // Fallback: use simple distance calculation
        const dist = Math.sqrt(
            Math.pow(point.lat - closestPoint.lat, 2) + Math.pow(point.lng - closestPoint.lng, 2)
        );
        return dist * 111000; // Convert to meters (rough approximation)
    };

    // Helper function: Find the closest point on a line segment to a given point
    const closestPointOnLineSegment = (
        point: { lat: number; lng: number },
        segmentStart: { lat: number; lng: number },
        segmentEnd: { lat: number; lng: number }
    ): { lat: number; lng: number } => {
        const A = point.lat - segmentStart.lat;
        const B = point.lng - segmentStart.lng;
        const C = segmentEnd.lat - segmentStart.lat;
        const D = segmentEnd.lng - segmentStart.lng;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        // If segment has zero length, return start point
        if (lenSq === 0) {
            return segmentStart;
        }

        // Calculate parameter t (clamped to [0, 1])
        const t = Math.max(0, Math.min(1, dot / lenSq));

        // Return closest point on segment
        return {
            lat: segmentStart.lat + t * C,
            lng: segmentStart.lng + t * D,
        };
    };

    // Helper function: Get intersection latitude on polyline at a given longitude
    // Returns the latitude where the polyline intersects a vertical line at the given longitude
    // Returns null if no intersection is found
    const getIntersectionLatOnPolyline = (
        polylinePath: Array<{ lat: number; lng: number }>,
        targetLng: number,
        tolerance: number = 0.00001
    ): number | null => {
        if (!polylinePath || polylinePath.length < 2) {
            return null;
        }

        // Check each segment of the polyline
        for (let i = 0; i < polylinePath.length - 1; i++) {
            const segStart = polylinePath[i];
            const segEnd = polylinePath[i + 1];

            // Check if this segment crosses the vertical line at targetLng
            const lngMin = Math.min(segStart.lng, segEnd.lng);
            const lngMax = Math.max(segStart.lng, segEnd.lng);

            // Check intersection with tolerance
            if (
                targetLng >= lngMin - tolerance &&
                targetLng <= lngMax + tolerance &&
                Math.abs(lngMax - lngMin) > tolerance
            ) {
                // Calculate intersection point
                const t = (targetLng - segStart.lng) / (segEnd.lng - segStart.lng);
                const intersectionLat = segStart.lat + t * (segEnd.lat - segStart.lat);

                return intersectionLat;
            }

            // Also check if segment endpoints are close to targetLng
            if (Math.abs(segStart.lng - targetLng) < tolerance) {
                return segStart.lat;
            }
            if (Math.abs(segEnd.lng - targetLng) < tolerance) {
                return segEnd.lat;
            }
        }

        // No intersection found
        return null;
    };

    // Function to generate lateral pipes perpendicular to sub-main pipes
    const generateLateralPipes = (
        map: google.maps.Map,
        generatedSubMainPipes?: Array<{
            id: number;
            path: Array<{ lat: number; lng: number }>;
            overlay: google.maps.Polyline;
            zoneId: number;
        }>
    ) => {
        console.log(
            '🔧 Generating lateral pipes perpendicular to sub-main pipes following tree columns'
        );

        if (zones.length === 0) {
            console.error('❌ No zones available for lateral pipe generation');
            return;
        }

        if (plantPoints.length === 0) {
            console.error('❌ No plant points available for lateral pipe generation');
            return;
        }

        // Clear existing lateral pipes
        lateralPipes.forEach((pipe) => {
            if (pipe.overlay) {
                (pipe.overlay as { setMap: (map: unknown) => void }).setMap(null);
            }
        });
        setLateralPipes([]);

        const newLateralPipes: Array<{
            id: number;
            path: Array<{ lat: number; lng: number }>;
            overlay: google.maps.Polyline;
            zoneId: number;
        }> = [];

        // Use provided sub-main pipes or fall back to state
        const currentSubMainPipes =
            generatedSubMainPipes && generatedSubMainPipes.length > 0
                ? generatedSubMainPipes
                : subMainPipes.length > 0
                  ? subMainPipes
                  : [];

        console.log(
            `📊 Using ${currentSubMainPipes.length} sub-main pipes for lateral pipe generation`
        );

        // Create lateral pipes for each zone
        zones.forEach((zone, index) => {
            console.log(`🔍 Processing zone ${index + 1} for lateral pipes:`, zone);
            console.log(`🔍 Zone bounds:`, zone.bounds);

            // Find sub-main pipe for this zone
            const zoneSubMainPipe = currentSubMainPipes.find((pipe) => pipe.zoneId === zone.id);

            if (!zoneSubMainPipe || !zoneSubMainPipe.path || zoneSubMainPipe.path.length < 2) {
                console.log(
                    `⚠️ No sub-main pipe found for zone ${zone.id}, skipping lateral pipes`
                );
                return;
            }

            // Get sub-main pipe latitude (horizontal line)
            const subMainLat = zoneSubMainPipe.path[0].lat;
            console.log(`📍 Sub-main pipe at latitude: ${subMainLat.toFixed(6)}`);

            // Find tree columns in this zone
            const treeColumns = findTreeColumns(zone.bounds);

            if (treeColumns.length > 0) {
                console.log(`📍 Found ${treeColumns.length} tree columns in zone ${zone.id}`);

                // Create lateral pipes for each tree column
                treeColumns.forEach((column, columnIndex) => {
                    // Create a vertical line from sub-main pipe to the plants
                    const columnLng = column[0].lng; // Use the longitude of the first tree in the column

                    // Find the northernmost and southernmost plant points in this column
                    const columnLats = column.map((tree) => tree.lat);
                    const northernmostLat = Math.max(...columnLats);
                    const southernmostLat = Math.min(...columnLats);

                    // Calculate actual pipe boundaries that stay strictly within zone polygon
                    // For polygon zones, we need to find intersection points with zone boundaries
                    let topLat = northernmostLat;
                    let bottomLat = southernmostLat;

                    // If zone has coordinates (polygon), find actual intersection points
                    if (zone.coordinates && zone.coordinates.length > 0) {
                        // Find all intersection points where vertical line at columnLng intersects zone polygon edges
                        const intersections: Array<{ lat: number; lng: number }> = [];

                        // Check all edges of the polygon
                        for (let i = 0; i < zone.coordinates.length; i++) {
                            const p1 = zone.coordinates[i];
                            const p2 = zone.coordinates[(i + 1) % zone.coordinates.length];

                            // Check if vertical line at columnLng intersects this edge
                            const lngMin = Math.min(p1.lng, p2.lng);
                            const lngMax = Math.max(p1.lng, p2.lng);

                            if (columnLng >= lngMin && columnLng <= lngMax && lngMin !== lngMax) {
                                // Calculate intersection point
                                const t = (columnLng - p1.lng) / (p2.lng - p1.lng);
                                const intersectionLat = p1.lat + t * (p2.lat - p1.lat);

                                // Verify intersection is within edge latitude bounds
                                const latMin = Math.min(p1.lat, p2.lat);
                                const latMax = Math.max(p1.lat, p2.lat);

                                if (intersectionLat >= latMin && intersectionLat <= latMax) {
                                    intersections.push({ lat: intersectionLat, lng: columnLng });
                                }
                            }

                            // Also check if edge vertices are exactly at columnLng
                            if (Math.abs(p1.lng - columnLng) < 0.000001) {
                                intersections.push(p1);
                            }
                            if (Math.abs(p2.lng - columnLng) < 0.000001) {
                                intersections.push(p2);
                            }
                        }

                        // Remove duplicate intersections (within tolerance)
                        const uniqueIntersections: Array<{ lat: number; lng: number }> = [];
                        intersections.forEach((intersection) => {
                            const isDuplicate = uniqueIntersections.some(
                                (existing) => Math.abs(existing.lat - intersection.lat) < 0.000001
                            );
                            if (!isDuplicate) {
                                uniqueIntersections.push(intersection);
                            }
                        });

                        // Find northernmost and southernmost intersection points
                        // These are the ONLY valid boundaries - they are guaranteed to be within polygon
                        if (uniqueIntersections.length >= 2) {
                            const lats = uniqueIntersections.map((i) => i.lat);
                            const intersectionNorth = Math.max(...lats);
                            const intersectionSouth = Math.min(...lats);

                            // Use intersections as strict boundaries (these are polygon boundaries)
                            // Only extend to plants if they are within the intersection range
                            topLat = intersectionNorth;
                            bottomLat = intersectionSouth;

                            // Only extend to plant positions if they are within intersection range
                            if (
                                northernmostLat <= intersectionNorth &&
                                northernmostLat >= intersectionSouth
                            ) {
                                topLat = northernmostLat;
                            }
                            if (
                                southernmostLat >= intersectionSouth &&
                                southernmostLat <= intersectionNorth
                            ) {
                                bottomLat = southernmostLat;
                            }

                            // Final clamp to zone bounds for safety
                            topLat = Math.min(topLat, zone.bounds.north);
                            bottomLat = Math.max(bottomLat, zone.bounds.south);
                        } else if (uniqueIntersections.length === 1) {
                            // Only one intersection - use it and extend to plant positions with bounds as fallback
                            const singleIntersection = uniqueIntersections[0];
                            console.log(
                                `⚠️ Column ${columnIndex + 1} has only one intersection, using fallback bounds`
                            );

                            // Use intersection as anchor, extend to plants within zone bounds
                            topLat = Math.min(
                                Math.max(northernmostLat, singleIntersection.lat),
                                zone.bounds.north
                            );
                            bottomLat = Math.max(
                                Math.min(southernmostLat, singleIntersection.lat),
                                zone.bounds.south
                            );

                            // Ensure we have a valid range
                            if (topLat <= bottomLat) {
                                // Use bounds as fallback
                                topLat = Math.min(northernmostLat, zone.bounds.north);
                                bottomLat = Math.max(southernmostLat, zone.bounds.south);
                            }
                        } else {
                            // No intersections found - use plant positions with zone bounds as fallback
                            console.log(
                                `⚠️ Column ${columnIndex + 1} does not intersect zone boundary, using fallback bounds`
                            );
                            topLat = Math.min(northernmostLat, zone.bounds.north);
                            bottomLat = Math.max(southernmostLat, zone.bounds.south);
                        }
                    } else {
                        // For rectangle zones, use bounds directly
                        topLat = Math.min(northernmostLat, zone.bounds.north);
                        bottomLat = Math.max(southernmostLat, zone.bounds.south);
                    }

                    // Final safety check: ensure pipe doesn't exceed zone bounds
                    topLat = Math.min(topLat, zone.bounds.north);
                    bottomLat = Math.max(bottomLat, zone.bounds.south);

                    // Ensure topLat is greater than bottomLat
                    if (topLat <= bottomLat) {
                        // Try to fix by using a minimum height
                        const minHeight = 0.0001; // Approximately 10 meters
                        const centerLat = (topLat + bottomLat) / 2;
                        topLat = centerLat + minHeight / 2;
                        bottomLat = centerLat - minHeight / 2;

                        // Final check - if still invalid, use plant positions directly
                        if (topLat <= bottomLat) {
                            console.log(
                                `⚠️ Invalid pipe bounds for column ${columnIndex + 1}, using plant positions directly`
                            );
                            topLat = Math.max(northernmostLat, zone.bounds.south + minHeight);
                            bottomLat = Math.min(southernmostLat, zone.bounds.north - minHeight);
                        }

                        // If still invalid, skip
                        if (topLat <= bottomLat) {
                            console.log(
                                `⚠️ Cannot create valid pipe bounds for column ${columnIndex + 1}, skipping lateral pipe`
                            );
                            return; // Skip this column
                        }
                    }

                    // Define lateral pipe endpoints
                    const lateralTopPoint = { lat: topLat, lng: columnLng };
                    const lateralBottomPoint = { lat: bottomLat, lng: columnLng };

                    // Use new helper function to find intersection latitude on sub-main pipe
                    const latTolerance = 0.00001; // Approximately 1 meter
                    const actualIntersectionLat = getIntersectionLatOnPolyline(
                        zoneSubMainPipe.path,
                        columnLng
                    );

                    // Determine pipe path
                    let pipePath: Array<{ lat: number; lng: number }>;

                    if (actualIntersectionLat !== null) {
                        // Found intersection - check if it's within lateral pipe range
                        if (
                            actualIntersectionLat >= bottomLat - latTolerance &&
                            actualIntersectionLat <= topLat + latTolerance
                        ) {
                            // Sub-main pipe intersects the vertical line - create vertical connection
                            const intersectionPoint = {
                                lat: actualIntersectionLat,
                                lng: columnLng,
                            };
                            console.log(
                                `📍 Sub-main pipe intersects lateral pipe at (${actualIntersectionLat.toFixed(6)}, ${columnLng.toFixed(6)})`
                            );

                            if (
                                topLat > actualIntersectionLat &&
                                bottomLat < actualIntersectionLat
                            ) {
                                // Plants on both sides of sub-main pipe
                                pipePath = [lateralTopPoint, intersectionPoint, lateralBottomPoint];
                                console.log(
                                    `📏 Lateral pipe crosses sub-main (plants on both sides)`
                                );
                            } else if (topLat <= actualIntersectionLat) {
                                // All plants below sub-main pipe
                                pipePath = [intersectionPoint, lateralBottomPoint];
                                console.log(`📏 Lateral pipe extends downward from sub-main`);
                            } else {
                                // All plants above sub-main pipe
                                pipePath = [intersectionPoint, lateralTopPoint];
                                console.log(`📏 Lateral pipe extends upward from sub-main`);
                            }
                        } else {
                            // Intersection found but outside lateral pipe range - use diagonal connection
                            console.log(
                                `📍 Intersection found but outside lateral pipe range, using diagonal connection`
                            );
                            // Fall through to diagonal connection logic below
                            const geometry = window.google?.maps?.geometry;

                            // Find which endpoint of lateral pipe is closest to sub-main pipe
                            let closestLateralEndpoint: { lat: number; lng: number };
                            let farthestLateralEndpoint: { lat: number; lng: number };

                            // Calculate distances from both endpoints to sub-main pipe
                            let minDistTop = Number.POSITIVE_INFINITY;
                            let minDistBottom = Number.POSITIVE_INFINITY;
                            let closestPointOnSubMainTop: { lat: number; lng: number } | null =
                                null;
                            let closestPointOnSubMainBottom: { lat: number; lng: number } | null =
                                null;

                            // Check all segments of sub-main pipe
                            for (let i = 0; i < zoneSubMainPipe.path.length - 1; i++) {
                                const segStart = zoneSubMainPipe.path[i];
                                const segEnd = zoneSubMainPipe.path[i + 1];

                                // Calculate distance from top endpoint to this segment
                                const distTop = distanceToLineSegment(
                                    lateralTopPoint,
                                    segStart,
                                    segEnd,
                                    geometry
                                );
                                if (distTop < minDistTop) {
                                    minDistTop = distTop;
                                    closestPointOnSubMainTop = closestPointOnLineSegment(
                                        lateralTopPoint,
                                        segStart,
                                        segEnd
                                    );
                                }

                                // Calculate distance from bottom endpoint to this segment
                                const distBottom = distanceToLineSegment(
                                    lateralBottomPoint,
                                    segStart,
                                    segEnd,
                                    geometry
                                );
                                if (distBottom < minDistBottom) {
                                    minDistBottom = distBottom;
                                    closestPointOnSubMainBottom = closestPointOnLineSegment(
                                        lateralBottomPoint,
                                        segStart,
                                        segEnd
                                    );
                                }
                            }

                            // Determine which endpoint is closer to sub-main pipe
                            if (minDistTop < minDistBottom) {
                                closestLateralEndpoint = lateralTopPoint;
                                farthestLateralEndpoint = lateralBottomPoint;
                            } else {
                                closestLateralEndpoint = lateralBottomPoint;
                                farthestLateralEndpoint = lateralTopPoint;
                            }

                            // Ensure we have valid connection points
                            if (!closestPointOnSubMainTop || !closestPointOnSubMainBottom) {
                                console.log(
                                    `⚠️ Failed to find connection point on sub-main pipe for column ${columnIndex + 1}, skipping`
                                );
                                return; // Skip this column
                            }

                            const closestPointOnSubMain =
                                minDistTop < minDistBottom
                                    ? closestPointOnSubMainTop
                                    : closestPointOnSubMainBottom;

                            console.log(
                                `📍 Closest endpoint: ${minDistTop < minDistBottom ? 'top' : 'bottom'}, distance: ${Math.min(minDistTop, minDistBottom).toFixed(2)}m`
                            );
                            console.log(
                                `📍 Connection point on sub-main: (${closestPointOnSubMain.lat.toFixed(6)}, ${closestPointOnSubMain.lng.toFixed(6)})`
                            );

                            // Build path: farthest endpoint -> closest endpoint -> connection point on sub-main
                            pipePath = [
                                farthestLateralEndpoint,
                                closestLateralEndpoint,
                                closestPointOnSubMain,
                            ];

                            console.log(
                                `📏 Lateral pipe with diagonal connection: ${farthestLateralEndpoint === lateralTopPoint ? 'top' : 'bottom'} -> ${closestLateralEndpoint === lateralTopPoint ? 'top' : 'bottom'} -> sub-main`
                            );
                        }
                    } else {
                        // No intersection found - sub-main pipe does NOT intersect - use diagonal connection
                        console.log(
                            `📍 Sub-main pipe does NOT intersect lateral pipe, creating diagonal connection`
                        );

                        const geometry = window.google?.maps?.geometry;

                        // Find which endpoint of lateral pipe is closest to sub-main pipe
                        let closestLateralEndpoint: { lat: number; lng: number };
                        let farthestLateralEndpoint: { lat: number; lng: number };

                        // Calculate distances from both endpoints to sub-main pipe
                        let minDistTop = Number.POSITIVE_INFINITY;
                        let minDistBottom = Number.POSITIVE_INFINITY;
                        let closestPointOnSubMainTop: { lat: number; lng: number } | null = null;
                        let closestPointOnSubMainBottom: { lat: number; lng: number } | null = null;

                        // Check all segments of sub-main pipe
                        for (let i = 0; i < zoneSubMainPipe.path.length - 1; i++) {
                            const segStart = zoneSubMainPipe.path[i];
                            const segEnd = zoneSubMainPipe.path[i + 1];

                            // Calculate distance from top endpoint to this segment
                            const distTop = distanceToLineSegment(
                                lateralTopPoint,
                                segStart,
                                segEnd,
                                geometry
                            );
                            if (distTop < minDistTop) {
                                minDistTop = distTop;
                                closestPointOnSubMainTop = closestPointOnLineSegment(
                                    lateralTopPoint,
                                    segStart,
                                    segEnd
                                );
                            }

                            // Calculate distance from bottom endpoint to this segment
                            const distBottom = distanceToLineSegment(
                                lateralBottomPoint,
                                segStart,
                                segEnd,
                                geometry
                            );
                            if (distBottom < minDistBottom) {
                                minDistBottom = distBottom;
                                closestPointOnSubMainBottom = closestPointOnLineSegment(
                                    lateralBottomPoint,
                                    segStart,
                                    segEnd
                                );
                            }
                        }

                        // Determine which endpoint is closer to sub-main pipe
                        if (minDistTop < minDistBottom) {
                            closestLateralEndpoint = lateralTopPoint;
                            farthestLateralEndpoint = lateralBottomPoint;
                        } else {
                            closestLateralEndpoint = lateralBottomPoint;
                            farthestLateralEndpoint = lateralTopPoint;
                        }

                        // Ensure we have valid connection points
                        if (!closestPointOnSubMainTop || !closestPointOnSubMainBottom) {
                            console.log(
                                `⚠️ Failed to find connection point on sub-main pipe for column ${columnIndex + 1}, skipping`
                            );
                            return; // Skip this column
                        }

                        const closestPointOnSubMain =
                            minDistTop < minDistBottom
                                ? closestPointOnSubMainTop
                                : closestPointOnSubMainBottom;

                        console.log(
                            `📍 Closest endpoint: ${minDistTop < minDistBottom ? 'top' : 'bottom'}, distance: ${Math.min(minDistTop, minDistBottom).toFixed(2)}m`
                        );
                        console.log(
                            `📍 Connection point on sub-main: (${closestPointOnSubMain.lat.toFixed(6)}, ${closestPointOnSubMain.lng.toFixed(6)})`
                        );

                        // Build path: farthest endpoint -> closest endpoint -> connection point on sub-main
                        pipePath = [
                            farthestLateralEndpoint,
                            closestLateralEndpoint,
                            closestPointOnSubMain,
                        ];

                        console.log(
                            `📏 Lateral pipe with diagonal connection: ${farthestLateralEndpoint === lateralTopPoint ? 'top' : 'bottom'} -> ${closestLateralEndpoint === lateralTopPoint ? 'top' : 'bottom'} -> sub-main`
                        );
                    }

                    // Final verification: ensure lateral pipe endpoints are within zone bounds (with tolerance)
                    // Note: connection point on sub-main may be outside zone bounds (that's OK)
                    const boundsTolerance = 0.00005; // Approximately 5 meters tolerance
                    const lateralEndpointsValid = pipePath
                        .slice(0, -1)
                        .every(
                            (point) =>
                                point.lat >= zone.bounds.south - boundsTolerance &&
                                point.lat <= zone.bounds.north + boundsTolerance &&
                                point.lng >= zone.bounds.west - boundsTolerance &&
                                point.lng <= zone.bounds.east + boundsTolerance
                        );

                    if (!lateralEndpointsValid) {
                        // Try to clamp endpoints to valid bounds instead of skipping
                        console.log(
                            `⚠️ Lateral pipe endpoints exceed zone bounds for column ${columnIndex + 1}, clamping to bounds`
                        );
                        console.log(`   Original pipe path:`, pipePath);

                        // Clamp lateral endpoints to zone bounds
                        const clampedPath = pipePath.map((point, idx) => {
                            if (idx < pipePath.length - 1) {
                                // Clamp lateral endpoints
                                return {
                                    lat: Math.max(
                                        zone.bounds.south,
                                        Math.min(zone.bounds.north, point.lat)
                                    ),
                                    lng: Math.max(
                                        zone.bounds.west,
                                        Math.min(zone.bounds.east, point.lng)
                                    ),
                                };
                            } else {
                                // Keep connection point as is (may be outside bounds)
                                return point;
                            }
                        });

                        // Verify clamped path is still valid
                        const clampedEndpointsValid = clampedPath
                            .slice(0, -1)
                            .every(
                                (point) =>
                                    point.lat >= zone.bounds.south &&
                                    point.lat <= zone.bounds.north &&
                                    point.lng >= zone.bounds.west &&
                                    point.lng <= zone.bounds.east
                            );

                        if (!clampedEndpointsValid) {
                            console.log(
                                `⚠️ Cannot clamp lateral pipe endpoints for column ${columnIndex + 1}, skipping`
                            );
                            return; // Skip this column
                        }

                        pipePath = clampedPath;
                        console.log(`   Clamped pipe path:`, pipePath);
                    }

                    // Verify that connection point is valid (not NaN or Infinity)
                    const connectionPoint = pipePath[pipePath.length - 1];
                    if (!isFinite(connectionPoint.lat) || !isFinite(connectionPoint.lng)) {
                        console.log(
                            `⚠️ Invalid connection point for column ${columnIndex + 1}, skipping`
                        );
                        return; // Skip this column
                    }

                    console.log(
                        `📏 Creating lateral pipe ${columnIndex + 1}/${treeColumns.length} for zone ${zone.id}`
                    );
                    console.log(
                        `📏 Column ${columnIndex + 1} has ${column.length} trees at lng: ${columnLng.toFixed(6)}`
                    );
                    console.log(
                        `📏 Lateral pipe bounds: top=${topLat.toFixed(6)}, bottom=${bottomLat.toFixed(6)}`
                    );
                    console.log(`📏 Lateral pipe path:`, pipePath);

                    // Create polyline for lateral pipe
                    const polyline = new window.google.maps.Polyline({
                        path: pipePath,
                        geodesic: true,
                        strokeColor: '#FCD34D', // Yellow color for lateral pipes
                        strokeOpacity: 0.8,
                        strokeWeight: 2, // Thinner than sub-main pipes
                        zIndex: 1000, // Below sub-main pipes
                    });

                    // Add to map
                    polyline.setMap(map);
                    console.log(
                        `✅ Successfully created lateral pipe ${columnIndex + 1} for zone ${zone.id}`
                    );

                    newLateralPipes.push({
                        id: Date.now() + zone.id + columnIndex,
                        path: pipePath,
                        overlay: polyline,
                        zoneId: zone.id,
                    });
                });

                // Verify all columns have lateral pipes
                console.log(
                    `🔍 Verification: Expected ${treeColumns.length} lateral pipes, created ${newLateralPipes.filter((pipe) => pipe.zoneId === zone.id).length}`
                );

                console.log(`✅ Zone ${zone.id}: Created ${treeColumns.length} lateral pipes`);

                // Find trees that are not connected to any lateral pipe
                const zoneLateralPipes = newLateralPipes.filter((pipe) => pipe.zoneId === zone.id);
                const zonePlantPoints = plantPoints.filter(
                    (point) =>
                        point.position.lat >= zone.bounds.south &&
                        point.position.lat <= zone.bounds.north &&
                        point.position.lng >= zone.bounds.west &&
                        point.position.lng <= zone.bounds.east
                );

                // Helper function to check if a point is on a line segment
                const isPointOnLineSegment = (
                    point: { lat: number; lng: number },
                    segmentStart: { lat: number; lng: number },
                    segmentEnd: { lat: number; lng: number },
                    tolerance: number = 0.00002
                ): boolean => {
                    // Calculate distance from point to line segment
                    const A = point.lat - segmentStart.lat;
                    const B = point.lng - segmentStart.lng;
                    const C = segmentEnd.lat - segmentStart.lat;
                    const D = segmentEnd.lng - segmentStart.lng;

                    const dot = A * C + B * D;
                    const lenSq = C * C + D * D;

                    // If segment has zero length, just check distance to point
                    if (lenSq === 0) {
                        const dist = Math.sqrt(A * A + B * B);
                        return dist < tolerance;
                    }

                    // Calculate parameter t (0 to 1 means point is on segment)
                    const t = dot / lenSq;

                    // If t is outside [0, 1], point is not on segment
                    if (t < 0 || t > 1) {
                        return false;
                    }

                    // Calculate closest point on segment
                    const closestPoint = {
                        lat: segmentStart.lat + t * C,
                        lng: segmentStart.lng + t * D,
                    };

                    // Calculate distance from point to closest point on segment
                    const dist = Math.sqrt(
                        Math.pow(point.lat - closestPoint.lat, 2) +
                            Math.pow(point.lng - closestPoint.lng, 2)
                    );

                    return dist < tolerance;
                };

                // Find trees that are not connected to any lateral pipe
                const tolerance = 0.00002; // Approximately 2 meters
                const unconnectedTrees = zonePlantPoints.filter((plantPoint) => {
                    const isConnected = zoneLateralPipes.some((pipe) => {
                        // Check if tree is on any segment of this lateral pipe path
                        for (let i = 0; i < pipe.path.length - 1; i++) {
                            const segmentStart = pipe.path[i];
                            const segmentEnd = pipe.path[i + 1];

                            if (
                                isPointOnLineSegment(
                                    plantPoint.position,
                                    segmentStart,
                                    segmentEnd,
                                    tolerance
                                )
                            ) {
                                return true; // Tree is on this pipe segment
                            }
                        }

                        // Also check if tree is exactly at any endpoint
                        return pipe.path.some(
                            (pipePoint) =>
                                Math.abs(pipePoint.lng - plantPoint.position.lng) < tolerance &&
                                Math.abs(pipePoint.lat - plantPoint.position.lat) < tolerance
                        );
                    });

                    return !isConnected;
                });

                console.log(
                    `🔍 Found ${unconnectedTrees.length} unconnected trees in zone ${zone.id}`
                );

                // Group unconnected trees by longitude (columns)
                const unconnectedTreeColumns: Array<
                    Array<{ id: number; position: { lat: number; lng: number } }>
                > = [];
                const columnTolerance = 0.00005; // 5% of typical zone width or minimum 0.00005

                unconnectedTrees.forEach((tree) => {
                    const lng = tree.position.lng;
                    let foundColumn = false;

                    // Check if this tree belongs to an existing column
                    for (let i = 0; i < unconnectedTreeColumns.length; i++) {
                        const columnLng = unconnectedTreeColumns[i][0].position.lng;
                        if (Math.abs(lng - columnLng) <= columnTolerance) {
                            unconnectedTreeColumns[i].push(tree);
                            foundColumn = true;
                            break;
                        }
                    }

                    // If no existing column found, create a new one
                    if (!foundColumn) {
                        unconnectedTreeColumns.push([tree]);
                    }
                });

                // Sort each column by latitude (top to bottom)
                unconnectedTreeColumns.forEach((column) => {
                    column.sort((a, b) => b.position.lat - a.position.lat); // Sort descending (north to south)
                });

                console.log(
                    `🔍 Found ${unconnectedTreeColumns.length} unconnected tree columns in zone ${zone.id}`
                );

                // Create lateral pipes for unconnected tree columns
                unconnectedTreeColumns.forEach((column, columnIndex) => {
                    if (column.length === 0) return;

                    const columnLng = column[0].position.lng;

                    // Find the northernmost and southernmost trees in this column
                    const columnLats = column.map((tree) => tree.position.lat);
                    const northernmostLat = Math.max(...columnLats);
                    const southernmostLat = Math.min(...columnLats);

                    // Calculate pipe boundaries that stay strictly within zone polygon
                    let topLat = northernmostLat;
                    let bottomLat = southernmostLat;

                    // If zone has coordinates (polygon), find actual intersection points
                    if (zone.coordinates && zone.coordinates.length > 0) {
                        // Find all intersection points where vertical line at columnLng intersects zone polygon edges
                        const intersections: Array<{ lat: number; lng: number }> = [];

                        // Check all edges of the polygon
                        for (let i = 0; i < zone.coordinates.length; i++) {
                            const p1 = zone.coordinates[i];
                            const p2 = zone.coordinates[(i + 1) % zone.coordinates.length];

                            // Check if vertical line at columnLng intersects this edge
                            const lngMin = Math.min(p1.lng, p2.lng);
                            const lngMax = Math.max(p1.lng, p2.lng);

                            if (columnLng >= lngMin && columnLng <= lngMax && lngMin !== lngMax) {
                                // Calculate intersection point
                                const t = (columnLng - p1.lng) / (p2.lng - p1.lng);
                                const intersectionLat = p1.lat + t * (p2.lat - p1.lat);

                                // Verify intersection is within edge latitude bounds
                                const latMin = Math.min(p1.lat, p2.lat);
                                const latMax = Math.max(p1.lat, p2.lat);

                                if (intersectionLat >= latMin && intersectionLat <= latMax) {
                                    intersections.push({ lat: intersectionLat, lng: columnLng });
                                }
                            }

                            // Also check if edge vertices are exactly at columnLng
                            if (Math.abs(p1.lng - columnLng) < 0.000001) {
                                intersections.push(p1);
                            }
                            if (Math.abs(p2.lng - columnLng) < 0.000001) {
                                intersections.push(p2);
                            }
                        }

                        // Remove duplicate intersections
                        const uniqueIntersections: Array<{ lat: number; lng: number }> = [];
                        intersections.forEach((intersection) => {
                            const isDuplicate = uniqueIntersections.some(
                                (existing) => Math.abs(existing.lat - intersection.lat) < 0.000001
                            );
                            if (!isDuplicate) {
                                uniqueIntersections.push(intersection);
                            }
                        });

                        // Find northernmost and southernmost intersection points
                        if (uniqueIntersections.length >= 2) {
                            const lats = uniqueIntersections.map((i) => i.lat);
                            const intersectionNorth = Math.max(...lats);
                            const intersectionSouth = Math.min(...lats);

                            // Use intersections as strict boundaries
                            topLat = intersectionNorth;
                            bottomLat = intersectionSouth;

                            // Only extend to plant positions if they are within intersection range
                            if (
                                northernmostLat <= intersectionNorth &&
                                northernmostLat >= intersectionSouth
                            ) {
                                topLat = northernmostLat;
                            }
                            if (
                                southernmostLat >= intersectionSouth &&
                                southernmostLat <= intersectionNorth
                            ) {
                                bottomLat = southernmostLat;
                            }

                            // Final clamp to zone bounds
                            topLat = Math.min(topLat, zone.bounds.north);
                            bottomLat = Math.max(bottomLat, zone.bounds.south);
                        } else if (uniqueIntersections.length === 1) {
                            // Only one intersection - skip this column
                            console.log(
                                `⚠️ Unconnected column ${columnIndex + 1} has only one intersection, skipping`
                            );
                            return;
                        } else {
                            // No intersections - skip this column
                            console.log(
                                `⚠️ Unconnected column ${columnIndex + 1} does not intersect zone boundary, skipping`
                            );
                            return;
                        }
                    } else {
                        // For rectangle zones, use bounds directly
                        topLat = Math.min(northernmostLat, zone.bounds.north);
                        bottomLat = Math.max(southernmostLat, zone.bounds.south);
                    }

                    // Final safety check
                    topLat = Math.min(topLat, zone.bounds.north);
                    bottomLat = Math.max(bottomLat, zone.bounds.south);

                    // Ensure topLat is greater than bottomLat
                    if (topLat <= bottomLat) {
                        console.log(
                            `⚠️ Invalid pipe bounds for unconnected column ${columnIndex + 1}, skipping`
                        );
                        return;
                    }

                    // Create pipe path from top to bottom
                    const pipePath = [
                        { lat: topLat, lng: columnLng }, // Top boundary (within zone)
                        { lat: bottomLat, lng: columnLng }, // Bottom boundary (within zone)
                    ];

                    // Final verification: ensure all points are within zone bounds
                    const allPointsValid = pipePath.every(
                        (point) =>
                            point.lat >= zone.bounds.south &&
                            point.lat <= zone.bounds.north &&
                            point.lng >= zone.bounds.west &&
                            point.lng <= zone.bounds.east
                    );

                    if (!allPointsValid) {
                        console.log(`⚠️ Unconnected lateral pipe exceeds zone bounds, skipping`);
                        return;
                    }

                    console.log(
                        `📏 Creating lateral pipe for unconnected column ${columnIndex + 1}/${unconnectedTreeColumns.length}`
                    );
                    console.log(
                        `📏 Column has ${column.length} trees at lng: ${columnLng.toFixed(6)}`
                    );
                    console.log(
                        `📏 Pipe bounds: top=${topLat.toFixed(6)}, bottom=${bottomLat.toFixed(6)}`
                    );

                    // Create polyline for lateral pipe
                    const polyline = new window.google.maps.Polyline({
                        path: pipePath,
                        geodesic: true,
                        strokeColor: '#FCD34D', // Yellow color for lateral pipes
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        zIndex: 1000,
                    });

                    // Add to map
                    polyline.setMap(map);
                    console.log(
                        `✅ Successfully created lateral pipe for unconnected column ${columnIndex + 1}`
                    );

                    newLateralPipes.push({
                        id: Date.now() + zone.id + columnIndex + 10000, // Use higher ID to distinguish
                        path: pipePath,
                        overlay: polyline,
                        zoneId: zone.id,
                    });
                });

                console.log(
                    `✅ Zone ${zone.id}: Created ${treeColumns.length} main lateral pipes + ${unconnectedTreeColumns.length} additional pipes for unconnected trees`
                );
            } else {
                console.log(`❌ Zone ${zone.id} has no tree columns - no lateral pipes created`);
            }
        });

        // Update state
        setLateralPipes(newLateralPipes);

        // Save to localStorage
        const pipesForStorage = newLateralPipes.map((pipe) => ({
            id: pipe.id,
            path: pipe.path,
            zoneId: pipe.zoneId,
        }));
        localStorage.setItem('lateralPipes', JSON.stringify(pipesForStorage));

        console.log(`✅ ${newLateralPipes.length} lateral pipes created successfully`);
        console.log('💾 Saved lateral pipes to localStorage:', pipesForStorage);

        return newLateralPipes;
    };

    const getButtonState = (stepIndex: number) => {
        console.log(
            `getButtonState(${stepIndex}): currentStep=${currentStep}, completedSteps=[${completedSteps.join(',')}]`
        );

        // Generate Pipe System (step 4) - check if already generated
        if (stepIndex === 4) {
            // Check if pipe system already generated in localStorage
            const existingMainPipes = localStorage.getItem('mainPipes');
            const existingSubMainPipes = localStorage.getItem('subMainPipes');
            const existingLateralPipes = localStorage.getItem('lateralPipes');

            if (existingMainPipes && existingSubMainPipes && existingLateralPipes) {
                try {
                    const mainPipesData = JSON.parse(existingMainPipes);
                    const subMainPipesData = JSON.parse(existingSubMainPipes);
                    const lateralPipesData = JSON.parse(existingLateralPipes);

                    if (
                        mainPipesData.length > 0 &&
                        subMainPipesData.length > 0 &&
                        lateralPipesData.length > 0
                    ) {
                        console.log(`Step ${stepIndex} state: disabled (already generated)`);
                        return 'disabled';
                    }
                } catch (e) {
                    console.error('Error checking pipe state:', e);
                }
            }

            const state = stepIndex === currentStep ? 'active' : 'disabled';
            console.log(`Step ${stepIndex} state: ${state} (special case for step 4)`);
            return state;
        }

        if (completedSteps.includes(stepIndex)) {
            console.log(`Step ${stepIndex} state: completed`);
            return 'completed';
        } else if (stepIndex === currentStep) {
            console.log(`Step ${stepIndex} state: active`);
            return 'active';
        } else {
            console.log(`Step ${stepIndex} state: disabled`);
            return 'disabled';
        }
    };

    const isStepCompleted = (stepIndex: number) => {
        return completedSteps.includes(stepIndex);
    };

    // 4. Render
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title={translations.irrigationSystemDesign} />

            {/* Navbar */}
            <FreeNav />

            {/* Loading indicator */}
            {apiLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-800/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                        <p className="text-lg text-white">{translations.loadingGoogleMaps}</p>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
                {/* Header Bar (title and quick chips) */}
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white md:text-xl">
                        {translations.irrigationSystemDesign}
                    </h2>
                </div>

                {/* Plant and Project Name Inputs */}
                <div className="mb-4 flex gap-3">
                    {/* Plant Selection Display - 1/4 width */}
                    <div className="w-1/4">
                        <div className="relative">
                            <input
                                type="text"
                                value={
                                    selectedPlant
                                        ? getTranslatedPlantName(selectedPlant.name, translations)
                                        : ''
                                }
                                readOnly
                                placeholder={translations.plant}
                                title={
                                    selectedPlant
                                        ? `Water need: ${selectedPlant.waterNeed}L/day, Spacing: ${selectedPlant.plantSpacing}cm`
                                        : translations.noPlantSelected
                                }
                                className="w-full cursor-not-allowed rounded-lg border border-slate-500 bg-slate-100 px-4 py-2 text-gray-900 placeholder-gray-500"
                            />
                        </div>
                    </div>

                    {/* Project Name Input - 3/4 width */}
                    <div className="w-3/4">
                        <div className="relative">
                            <input
                                type="text"
                                value={projectName}
                                onChange={handleProjectNameChange}
                                placeholder={translations.labelNameOfProject}
                                className="w-full rounded-lg border border-slate-500 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>
                </div>

                {/* Google Maps Container */}
                <div className="relative mb-4 h-[420px] overflow-hidden rounded-lg border border-slate-600 bg-slate-700/40">
                    {/* Search Component */}
                    <div className="absolute left-32 top-1 z-10 w-48 sm:w-56 md:w-80 lg:w-96">
                        <div className="relative">
                            <input
                                type="text"
                                value={searchValue}
                                onChange={handleSearchInputChange}
                                onFocus={handleSearchInputFocus}
                                onBlur={handleSearchInputBlur}
                                placeholder={translations.searchLocation}
                                className="w-full rounded-lg border border-slate-500 bg-white px-3 py-2 pr-8 text-sm text-gray-900 placeholder-gray-500 shadow-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 md:px-4 md:py-2 md:pr-10 md:text-base"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 md:right-3">
                                <svg
                                    className="h-3 w-3 text-gray-400 md:h-4 md:w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                            </div>

                            {/* Search Results Dropdown */}
                            {showSearchResults && searchResults.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-lg md:max-h-60">
                                    {searchResults.map((result) => (
                                        <div
                                            key={result.place_id}
                                            onClick={() => handleSearchResultClick(result.place_id)}
                                            className="cursor-pointer px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 md:px-4 md:py-2 md:text-sm"
                                        >
                                            <div className="font-medium">
                                                {result.structured_formatting?.main_text}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {result.structured_formatting?.secondary_text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div ref={mapRef} className="h-full w-full" style={{ minHeight: '420px' }} />
                    {!mapLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-700/40 backdrop-blur-sm">
                            <div className="text-center text-sky-300">
                                <p className="mb-3 text-xs italic">// Loading Google Maps API...</p>
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border-2 border-slate-400">
                                    <svg
                                        className="h-8 w-8 animate-spin text-slate-300"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                        />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tools + Info Panel */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                    {/* Left tools */}
                    <div className="space-y-3 md:col-span-2">
                        {/* Step 1: Draw Area */}
                        <button
                            onClick={() => !isStepCompleted(0) && handleStepClick(0)}
                            disabled={getButtonState(0) === 'disabled' || isStepCompleted(0)}
                            className={`w-full rounded-lg px-4 py-3 text-white transition-colors ${
                                getButtonState(0) === 'completed'
                                    ? 'cursor-not-allowed bg-green-600'
                                    : getButtonState(0) === 'active'
                                      ? isDrawingMode
                                          ? 'bg-blue-600 hover:bg-blue-700'
                                          : 'bg-slate-600 hover:bg-slate-500'
                                      : 'cursor-not-allowed bg-slate-400'
                            }`}
                        >
                            {getButtonState(0) === 'completed'
                                ? translations.drawAreaCompleted
                                : isDrawingMode
                                  ? translations.drawing
                                  : translations.drawArea}
                        </button>

                        {/* Step 2: Water */}
                        <button
                            onClick={() => !isStepCompleted(1) && handleStepClick(1)}
                            disabled={getButtonState(1) === 'disabled' || isStepCompleted(1)}
                            className={`w-full rounded-lg px-4 py-3 text-white transition-colors ${
                                getButtonState(1) === 'completed'
                                    ? 'cursor-not-allowed bg-green-600'
                                    : getButtonState(1) === 'active'
                                      ? waterSources.length > 0
                                          ? 'bg-green-600 hover:bg-green-700'
                                          : 'bg-blue-600 hover:bg-blue-700'
                                      : 'cursor-not-allowed bg-slate-400'
                            }`}
                            title={
                                currentStep === 1 && waterSources.length === 0
                                    ? translations.clickAnywhereInDrawnArea
                                    : ''
                            }
                        >
                            {getButtonState(1) === 'completed'
                                ? translations.waterCompleted
                                : currentStep === 1 && waterSources.length === 0
                                  ? translations.placingWater
                                  : translations.water}
                        </button>

                        {/* Step 3: Place Pump */}
                        <button
                            onClick={() => !isStepCompleted(2) && handleStepClick(2)}
                            disabled={getButtonState(2) === 'disabled' || isStepCompleted(2)}
                            className={`w-full rounded-lg px-4 py-3 text-white transition-colors ${
                                getButtonState(2) === 'completed'
                                    ? 'cursor-not-allowed bg-green-600'
                                    : getButtonState(2) === 'active'
                                      ? pumps.length > 0
                                          ? 'bg-green-600 hover:bg-green-700'
                                          : 'bg-blue-600 hover:bg-blue-700'
                                      : 'cursor-not-allowed bg-slate-400'
                            }`}
                            title={
                                currentStep === 2 && pumps.length === 0
                                    ? translations.clickOnlyOnRedOrangePoints
                                    : ''
                            }
                        >
                            {getButtonState(2) === 'completed'
                                ? translations.placePumpCompleted
                                : currentStep === 2 && pumps.length === 0
                                  ? translations.placingWaterPump
                                  : translations.placePump}
                        </button>

                        {/* Step 4: Zones */}
                        <button
                            onClick={() => !isStepCompleted(3) && handleStepClick(3)}
                            disabled={getButtonState(3) === 'disabled' || isStepCompleted(3)}
                            className={`w-full rounded-lg px-4 py-3 text-white transition-colors ${
                                getButtonState(3) === 'completed'
                                    ? 'cursor-not-allowed bg-green-600'
                                    : getButtonState(3) === 'active'
                                      ? zones.length > 0
                                          ? 'bg-green-600 hover:bg-green-700'
                                          : 'bg-blue-600 hover:bg-blue-700'
                                      : 'cursor-not-allowed bg-slate-400'
                            }`}
                            title={
                                currentStep === 3 && zones.length === 0
                                    ? translations.clickToDivideZones
                                    : ''
                            }
                        >
                            {getButtonState(3) === 'completed'
                                ? `${translations.zones} ✓`
                                : currentStep === 3 && zones.length === 0
                                  ? translations.clickToDivideZones
                                  : translations.zones}
                        </button>
                    </div>

                    {/* Right info */}
                    <div className="flex flex-col md:col-span-3">
                        <div className="flex-1 rounded-lg border border-slate-600 bg-slate-700/40 p-3 text-white">
                            {currentStep === 0 && isDrawingMode ? (
                                <div className="text-center">
                                    <p className="mb-2 text-sm font-medium text-blue-300">
                                        {translations.drawingModeActive}
                                    </p>
                                    <p className="text-xs text-slate-300">
                                        {translations.useDrawingTools}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {translations.availablePolygonRectangleCircle}
                                    </p>
                                </div>
                            ) : currentStep === 1 && waterSources.length === 0 ? (
                                <div className="text-center">
                                    <p className="mb-2 text-sm font-medium text-blue-300">
                                        {translations.placingWaterSource}
                                    </p>
                                    <p className="text-xs text-slate-300">
                                        {translations.clickAnywhereInDrawnArea}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {translations.waterSourceWillSupplyWater}
                                    </p>
                                </div>
                            ) : currentStep === 2 && pumps.length === 0 ? (
                                <div className="text-center">
                                    <p className="mb-2 text-sm font-medium text-blue-300">
                                        {translations.placingWaterPump}
                                    </p>
                                    <p className="text-xs text-slate-300">
                                        {translations.clickOnlyOnRedOrangePoints}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {translations.redCirclesCornerPoints}
                                    </p>
                                    <p className="mt-1 text-xs text-amber-300">
                                        {translations.cannotPlacePumpsAnywhereElse}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {translations.pumpWillDistributeWater}
                                    </p>
                                </div>
                            ) : currentStep === 3 && zones.length === 0 ? (
                                <div className="text-center">
                                    <p className="mb-2 text-sm font-medium text-blue-300">
                                        {translations.readyToDivideZones}
                                    </p>
                                    <p className="text-xs text-slate-300">
                                        {translations.clickToDivideZonesButton}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {translations.willHelpOptimizeWaterDistribution}
                                    </p>
                                </div>
                            ) : drawnShapes.length > 0 ? (
                                <div>
                                    <p className="mb-2 text-sm font-medium text-green-300">
                                        {translations.areaDrawn}
                                    </p>
                                    <p className="text-xs text-slate-300">
                                        {translations.shapes} {drawnShapes.length}
                                    </p>
                                    {plantPoints.length > 0 ? (
                                        <p className="text-xs text-green-300">
                                            {translations.plantPoints} {plantPoints.length}
                                        </p>
                                    ) : null}
                                    {waterSources.length > 0 ? (
                                        <div>
                                            <p className="text-xs text-blue-300">
                                                {translations.waterSources} {waterSources.length}
                                            </p>
                                            <p className="text-xs text-green-300">
                                                {translations.dragWaterSourceToReposition}
                                            </p>
                                        </div>
                                    ) : null}
                                    {pumps.length > 0 ? (
                                        <p className="text-xs text-red-300">
                                            {translations.pumps} {pumps.length}
                                        </p>
                                    ) : null}
                                    {zones.length > 0 ? (
                                        <p className="text-xs text-purple-300">
                                            {translations.zones} {zones.length}
                                        </p>
                                    ) : null}
                                    <p className="text-xs text-slate-400">
                                        {translations.finalAreaCannotBeEdited}
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <p className="text-sm text-slate-300">
                                        {translations.readyToStartDrawing}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="mt-3">
                            {/* Step 5: Generate Pipe System */}
                            <button
                                onClick={() => handleStepClick(4)}
                                disabled={getButtonState(4) === 'disabled'}
                                className={`w-full rounded-lg px-4 py-3 font-medium text-white transition-colors ${
                                    getButtonState(4) === 'completed'
                                        ? 'cursor-not-allowed bg-green-600'
                                        : getButtonState(4) === 'active'
                                          ? 'bg-blue-600 hover:bg-blue-700'
                                          : 'cursor-not-allowed bg-slate-400'
                                }`}
                            >
                                {translations.generatePipeSystem}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Nav */}
                <div className="mt-6 flex gap-3">
                    <button
                        onClick={handleBack}
                        className="flex-1 rounded-lg bg-slate-600 px-4 py-3 text-white hover:bg-slate-500"
                    >
                        {translations.back}
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex-1 rounded-lg bg-amber-600 px-4 py-3 text-white hover:bg-amber-700"
                    >
                        {translations.reset}
                    </button>
                    <button
                        onClick={handleNext}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700"
                    >
                        {translations.next}
                    </button>
                </div>
            </div>

            {/* Zone Configuration Modal */}
            {showZoneModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="mx-4 w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-xl">
                        <div className="mb-4 text-center">
                            <h3 className="text-lg font-semibold text-white">
                                Determine number of zones
                            </h3>
                        </div>

                        <div className="mb-6">
                            <div className="mb-4">
                                <label className="mb-2 block text-sm font-medium text-slate-300">
                                    Number of zones (1-15):
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="15"
                                    value={zoneCount}
                                    onChange={(e) =>
                                        setZoneCount(
                                            Math.max(1, Math.min(15, parseInt(e.target.value) || 1))
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder={translations.enterNumberOfZones}
                                />
                            </div>

                            <div className="mb-4">
                                <p className="text-sm text-slate-400">
                                    Each zone will have a unique color and will be divided
                                    horizontally across your area.
                                </p>
                            </div>

                            {/* Color preview */}
                            <div className="mb-4">
                                <p className="mb-2 text-sm font-medium text-slate-300">
                                    Zone colors preview:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {generateZoneColors(zoneCount).map((color, index) => (
                                        <div
                                            key={index}
                                            className="flex h-8 w-8 items-center justify-center rounded border border-slate-600"
                                            style={{ backgroundColor: color }}
                                        >
                                            <span className="text-xs font-bold text-white">
                                                {index + 1}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleCloseZoneModal}
                                className="flex-1 rounded-lg bg-slate-600 px-4 py-3 text-white transition-colors hover:bg-slate-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerateZones}
                                className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-white transition-colors hover:bg-green-700"
                            >
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 3. Export
export default FreeMap;
