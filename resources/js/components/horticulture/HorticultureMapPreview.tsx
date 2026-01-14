/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from 'react';
import { EXCLUSION_COLORS, getZoneColor } from '../../utils/horticultureUtils';
import { findPipeZoneImproved } from '../../utils/horticultureProjectStats';

interface HorticultureMapPreviewProps {
    projectData: any;
    height?: string;
    fieldId: string | number; // Add unique field ID
}

const HorticultureMapPreview: React.FC<HorticultureMapPreviewProps> = ({
    projectData,
    height = '200px',
    fieldId,
}) => {
    const mapDivRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<google.maps.Map | null>(null);
    const overlaysRef = useRef<Array<google.maps.Polygon | google.maps.Polyline | google.maps.Marker>>([]);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!mapDivRef.current || !projectData?.mainArea || projectData.mainArea.length === 0) {
            return;
        }

        const initializeMap = () => {
            if (!mapDivRef.current) return;

            // Clear previous overlays
            overlaysRef.current.forEach((overlay) => overlay.setMap(null));
            overlaysRef.current = [];

            // Calculate center from mainArea
            const latitudes = projectData.mainArea.map((p: any) => p.lat);
            const longitudes = projectData.mainArea.map((p: any) => p.lng);
            const centerLat = (Math.max(...latitudes) + Math.min(...latitudes)) / 2;
            const centerLng = (Math.max(...longitudes) + Math.min(...longitudes)) / 2;

            // Create or reuse map instance
            if (!mapInstanceRef.current) {
                mapInstanceRef.current = new google.maps.Map(mapDivRef.current, {
                    center: { lat: centerLat, lng: centerLng },
                    zoom: 16,
                    disableDefaultUI: true,
                    zoomControl: false,
                    fullscreenControl: false,
                    mapTypeControl: false,
                    streetViewControl: false,
                    clickableIcons: false,
                    gestureHandling: 'none',
                    scrollwheel: false,
                    disableDoubleClickZoom: true,
                    draggable: false,
                    keyboardShortcuts: false,
                    mapTypeId: 'satellite',
                });
            }

            const map = mapInstanceRef.current;

            // Helper to get pipe color based on zone - ใช้ findPipeZoneImproved เหมือนในหน้า planner
            const getPipeColor = (pipe: { coordinates: { lat: number; lng: number }[] }): string => {
                const zoneId = findPipeZoneImproved(
                    pipe,
                    projectData.zones || [],
                    projectData.irrigationZones || []
                );

                if (zoneId === 'main-area' || zoneId === 'unknown') {
                    // Default color for pipes outside zones
                    return '#22C55E'; // Green for main area
                }

                // Find zone index from irrigationZones first (preferred)
                const irrigationZoneIndex = projectData.irrigationZones?.findIndex((z: any) => z.id === zoneId);
                if (irrigationZoneIndex >= 0) {
                    return getZoneColor(irrigationZoneIndex);
                }

                // Then check zones
                const zoneIndex = projectData.zones?.findIndex((z: any) => z.id === zoneId);
                if (zoneIndex >= 0) {
                    return getZoneColor(zoneIndex);
                }

                return '#22C55E';
            };

            // 1. Main Area Polygon - ปรับขนาดให้เล็กลง
            if (projectData.mainArea && projectData.mainArea.length > 0) {
                const mainAreaPolygon = new google.maps.Polygon({
                    paths: projectData.mainArea.map((coord: any) => ({ lat: coord.lat, lng: coord.lng })),
                    fillColor: '#22C55E',
                    fillOpacity: 0.1,
                    strokeColor: '#22C55E',
                    strokeWeight: 2,
                    clickable: false,
                    zIndex: 1,
                });
                mainAreaPolygon.setMap(map);
                overlaysRef.current.push(mainAreaPolygon);
            }

            // 2. Exclusion Areas - ปรับขนาดให้เล็กลง
            projectData.exclusionAreas?.forEach((area: any) => {
                const exclusionColor =
                    EXCLUSION_COLORS[area.type as keyof typeof EXCLUSION_COLORS] || EXCLUSION_COLORS.other;
                const exclusionPolygon = new google.maps.Polygon({
                    paths: area.coordinates.map((coord: any) => ({ lat: coord.lat, lng: coord.lng })),
                    fillColor: exclusionColor,
                    fillOpacity: 0.4,
                    strokeColor: exclusionColor,
                    strokeWeight: 1.5,
                    clickable: false,
                    zIndex: 10,
                });
                exclusionPolygon.setMap(map);
                overlaysRef.current.push(exclusionPolygon);
            });

            // 3. Zones - ปรับขนาดให้เล็กลง
            projectData.zones?.forEach((zone: any, index: number) => {
                const zoneColor = getZoneColor(index);
                const zonePolygon = new google.maps.Polygon({
                    paths: zone.coordinates.map((coord: any) => ({ lat: coord.lat, lng: coord.lng })),
                    fillColor: zoneColor,
                    fillOpacity: 0.08,
                    strokeColor: zoneColor,
                    strokeWeight: 1.5,
                    clickable: false,
                    zIndex: 5,
                });
                zonePolygon.setMap(map);
                overlaysRef.current.push(zonePolygon);
            });

            // 4. Irrigation Zones - ปรับขนาดให้เล็กลง
            projectData.irrigationZones?.forEach((zone: any, index: number) => {
                const zoneColor = getZoneColor(index);
                const irrigationZonePolygon = new google.maps.Polygon({
                    paths: zone.coordinates.map((coord: any) => ({ lat: coord.lat, lng: coord.lng })),
                    fillColor: zoneColor,
                    fillOpacity: 0.08,
                    strokeColor: zoneColor,
                    strokeWeight: 1.5,
                    clickable: false,
                    zIndex: 6,
                });
                irrigationZonePolygon.setMap(map);
                overlaysRef.current.push(irrigationZonePolygon);
            });

            // 5. Main Pipes - ปรับขนาดให้เล็กลง
            projectData.mainPipes?.forEach((pipe: any) => {
                const pipeColor = getPipeColor(pipe);
                const mainPipePolyline = new google.maps.Polyline({
                    path: pipe.coordinates.map((coord: any) => ({ lat: coord.lat, lng: coord.lng })),
                    strokeColor: pipeColor,
                    strokeWeight: 3,
                    strokeOpacity: 0.9,
                    clickable: false,
                    zIndex: 20,
                });
                mainPipePolyline.setMap(map);
                overlaysRef.current.push(mainPipePolyline);
            });

            // 6. Sub-Main Pipes - ปรับขนาดให้เล็กลง
            projectData.subMainPipes?.forEach((subMainPipe: any) => {
                const subMainColor = getPipeColor(subMainPipe);
                const subMainPolyline = new google.maps.Polyline({
                    path: subMainPipe.coordinates.map((coord: any) => ({ lat: coord.lat, lng: coord.lng })),
                    strokeColor: subMainColor,
                    strokeWeight: 2.5,
                    strokeOpacity: 0.9,
                    clickable: false,
                    zIndex: 19,
                });
                subMainPolyline.setMap(map);
                overlaysRef.current.push(subMainPolyline);

                // Branch Pipes - ปรับขนาดให้เล็กลง
                subMainPipe.branchPipes?.forEach((branchPipe: any) => {
                    const branchColor = getPipeColor(branchPipe);
                    const branchPolyline = new google.maps.Polyline({
                        path: branchPipe.coordinates.map((coord: any) => ({ lat: coord.lat, lng: coord.lng })),
                        strokeColor: branchColor,
                        strokeWeight: 2,
                        strokeOpacity: 0.9,
                        clickable: false,
                        zIndex: 18,
                    });
                    branchPolyline.setMap(map);
                    overlaysRef.current.push(branchPolyline);
                });
            });

            // 7. Lateral Pipes - ปรับขนาดให้เล็กลง
            projectData.lateralPipes?.forEach((lateralPipe: any) => {
                const lateralColor = getPipeColor(lateralPipe);
                const lateralPolyline = new google.maps.Polyline({
                    path: lateralPipe.coordinates.map((coord: any) => ({ lat: coord.lat, lng: coord.lng })),
                    strokeColor: lateralColor,
                    strokeWeight: 1.5,
                    strokeOpacity: 0.9,
                    clickable: false,
                    zIndex: 17,
                });
                lateralPolyline.setMap(map);
                overlaysRef.current.push(lateralPolyline);
            });

            // 8. Pump Marker - ปรับขนาดให้เล็กลง
            if (projectData.pump?.position) {
                const pumpMarker = new google.maps.Marker({
                    position: { lat: projectData.pump.position.lat, lng: projectData.pump.position.lng },
                    map: map,
                    icon: {
                        url: '/images/water-pump.png',
                        scaledSize: new google.maps.Size(16, 16),
                        anchor: new google.maps.Point(8, 8),
                    },
                    clickable: false,
                    zIndex: 100,
                });
                overlaysRef.current.push(pumpMarker);
            }

            // 9. Plants - ปรับขนาดให้เล็กลง
            projectData.plants?.forEach((plant: any) => {
                const plantMarker = new google.maps.Marker({
                    position: { lat: plant.position.lat, lng: plant.position.lng },
                    map: map,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 1.8,
                        fillColor: '#10B981',
                        fillOpacity: 0.8,
                        strokeColor: '#FFFFFF',
                        strokeWeight: 0.5,
                    },
                    clickable: false,
                    zIndex: 15,
                });
                overlaysRef.current.push(plantMarker);
            });

            // Fit bounds with padding to show all content
            const bounds = new google.maps.LatLngBounds();
            projectData.mainArea.forEach((coord: any) => {
                bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
            });

            // Extend bounds to include all plants
            projectData.plants?.forEach((plant: any) => {
                bounds.extend(new google.maps.LatLng(plant.position.lat, plant.position.lng));
            });

            map.fitBounds(bounds, { top: 20, right: 20, bottom: 20, left: 20 });

            // Mark as ready after a short delay to ensure rendering
            setTimeout(() => setIsReady(true), 500);
        };

        // Wait for Google Maps API to load
        const checkAndInit = () => {
            if ((window as any).google?.maps) {
                initializeMap();
            } else {
                // Check if script is already being loaded
                const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
                if (existingScript) {
                    // Wait for existing script to load
                    const checkInterval = setInterval(() => {
                        if ((window as any).google?.maps) {
                            clearInterval(checkInterval);
                            initializeMap();
                        }
                    }, 100);
                    
                    // Timeout after 5 seconds
                    setTimeout(() => clearInterval(checkInterval), 5000);
                } else {
                    // Load Google Maps script only if not already loading
                    const script = document.createElement('script');
                    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
                    script.async = true;
                    script.defer = true;
                    script.onload = initializeMap;
                    document.head.appendChild(script);
                }
            }
        };

        // Delay initialization to avoid race conditions with multiple maps
        const timeoutId = setTimeout(checkAndInit, 100 * Math.random());

        return () => {
            clearTimeout(timeoutId);
            overlaysRef.current.forEach((overlay) => overlay.setMap(null));
            overlaysRef.current = [];
        };
    }, [projectData, fieldId]);

    if (!projectData?.mainArea || projectData.mainArea.length === 0) {
        return (
            <div
                className="flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700"
                style={{ height }}
            >
                <div className="text-center">
                    <div className="text-3xl mb-2">📋</div>
                    <p className="text-sm text-gray-400">ยังไม่มีข้อมูลแผนที่</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative" style={{ height, width: '100%' }}>
            {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-800/80 z-10">
                    <div className="text-center">
                        <div className="animate-pulse text-2xl mb-1">🗺️</div>
                        <p className="text-xs text-gray-400">กำลังโหลด...</p>
                    </div>
                </div>
            )}
            <div
                ref={mapDivRef}
                style={{ height, width: '100%' }}
                className="rounded-lg overflow-hidden border border-gray-600 bg-gray-900"
            />
        </div>
    );
};

export default HorticultureMapPreview;
