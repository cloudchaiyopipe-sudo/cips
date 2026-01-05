import React, { useEffect, useRef, useState } from 'react';
import { FaMountain, FaTimes, FaInfoCircle } from 'react-icons/fa';

interface ElevationClickHandlerProps {
    map: google.maps.Map | null;
    isActive: boolean;
    onToggle: () => void;
    t: (key: string) => string;
}

interface ElevationInfo {
    lat: number;
    lng: number;
    elevation: number;
    timestamp: number;
}

const ElevationClickHandler: React.FC<ElevationClickHandlerProps> = ({
    map,
    isActive,
    onToggle,
    t,
}) => {
    const [elevationInfo, setElevationInfo] = useState<ElevationInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const domClickListenerRef = useRef<((event: MouseEvent) => void) | null>(null);
    const elevationServiceRef = useRef<google.maps.ElevationService | null>(null);

    // Initialize elevation service
    useEffect(() => {
        if (map && window.google?.maps?.ElevationService) {
            elevationServiceRef.current = new google.maps.ElevationService();
        }
    }, [map]);

    // Helper function to get elevation for a point
    const getElevationForPoint = (lat: number, lng: number) => {
        if (!elevationServiceRef.current) return;

        setIsLoading(true);
        setError(null);

        const latLng = new google.maps.LatLng(lat, lng);

        // Request elevation for clicked point
        elevationServiceRef.current.getElevationForLocations(
            {
                locations: [latLng],
            },
            (results, status) => {
                if (status === google.maps.ElevationStatus.OK && results && results[0]) {
                    setElevationInfo({
                        lat,
                        lng,
                        elevation: results[0].elevation || 0,
                        timestamp: Date.now(),
                    });
                } else {
                    setError(
                        t('ไม่สามารถดึงข้อมูลความสูงได้') || 'ไม่สามารถดึงข้อมูลความสูงได้'
                    );
                }
                setIsLoading(false);
            }
        );
    };

    // Setup click listeners (both map and DOM to capture polygon clicks)
    useEffect(() => {
        if (!map || !isActive) {
            if (clickListenerRef.current) {
                google.maps.event.removeListener(clickListenerRef.current);
                clickListenerRef.current = null;
            }
            if (domClickListenerRef.current && map) {
                const mapDiv = map.getDiv();
                if (mapDiv) {
                    mapDiv.removeEventListener('click', domClickListenerRef.current);
                }
                domClickListenerRef.current = null;
            }
            return;
        }

        const handleMapClick = (event: google.maps.MapMouseEvent) => {
            if (!event.latLng || !elevationServiceRef.current) return;

            const lat = event.latLng.lat();
            const lng = event.latLng.lng();
            getElevationForPoint(lat, lng);
        };

        // Add Google Maps click listener
        clickListenerRef.current = map.addListener('click', handleMapClick);

        // Add DOM click listener to capture clicks on polygons and other overlays
        const mapDiv = map.getDiv();
        const handleDomClick = (event: MouseEvent) => {
            // Only process if it's a left click
            if (event.button !== 0) return;

            // Check if click is within map bounds
            const mapBounds = mapDiv.getBoundingClientRect();
            if (
                event.clientX < mapBounds.left ||
                event.clientX > mapBounds.right ||
                event.clientY < mapBounds.top ||
                event.clientY > mapBounds.bottom
            ) {
                return;
            }

            // Check if click is on a UI element (buttons, panels, etc.)
            const target = event.target as HTMLElement;
            // Check if the click target or any parent is a UI element
            let element: HTMLElement | null = target;
            while (element && element !== mapDiv) {
                const tagName = element.tagName.toLowerCase();
                const className = element.className || '';
                const style = window.getComputedStyle(element);
                
                // Check for UI elements
                if (
                    tagName === 'button' ||
                    tagName === 'input' ||
                    tagName === 'select' ||
                    tagName === 'textarea' ||
                    className.includes('fixed') ||
                    parseInt(style.zIndex || '0') > 100 ||
                    element.getAttribute('role') === 'button' ||
                    element.getAttribute('role') === 'dialog'
                ) {
                    return;
                }
                element = element.parentElement;
            }

            const bounds = map.getBounds();
            if (!bounds) return;

            const relativeX = (event.clientX - mapBounds.left) / mapBounds.width;
            const relativeY = (event.clientY - mapBounds.top) / mapBounds.height;

            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const lng = sw.lng() + (ne.lng() - sw.lng()) * relativeX;
            const lat = ne.lat() + (sw.lat() - ne.lat()) * relativeY;

            // Get elevation for the clicked point
            getElevationForPoint(lat, lng);
        };

        if (mapDiv) {
            mapDiv.addEventListener('click', handleDomClick, true); // Use capture phase to catch before event.stop()
            domClickListenerRef.current = handleDomClick;
        }

        return () => {
            if (clickListenerRef.current) {
                google.maps.event.removeListener(clickListenerRef.current);
                clickListenerRef.current = null;
            }
            if (domClickListenerRef.current && mapDiv) {
                mapDiv.removeEventListener('click', domClickListenerRef.current, true);
                domClickListenerRef.current = null;
            }
        };
    }, [map, isActive, t]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (clickListenerRef.current) {
                google.maps.event.removeListener(clickListenerRef.current);
            }
        };
    }, []);

    if (!isActive) return null;

    return (
        <div className="fixed right-4 top-4 z-[1000] max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FaMountain className="text-green-600" size={16} />
                    <h3 className="font-semibold text-gray-800">
                        {t('คลิกเพื่อดูความสูง') || 'คลิกเพื่อดูความสูง'}
                    </h3>
                </div>
                <button
                    onClick={onToggle}
                    className="text-gray-400 transition-colors hover:text-gray-600"
                >
                    <FaTimes size={14} />
                </button>
            </div>

            <div className="space-y-2">
                <div className="text-sm text-gray-600">
                    {t('คลิกบนแผนที่เพื่อดูความสูง ณ จุดนั้น') ||
                        'คลิกบนแผนที่เพื่อดูความสูง ณ จุดนั้น'}
                </div>

                {isLoading && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
                        {t('กำลังดึงข้อมูลความสูง...') || 'กำลังดึงข้อมูลความสูง...'}
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                        <FaInfoCircle size={14} />
                        {error}
                    </div>
                )}

                {elevationInfo && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <div className="mb-2 flex items-center gap-2">
                            <FaMountain className="text-green-600" size={14} />
                            <span className="font-medium text-green-800">
                                {t('ข้อมูลความสูง') || 'ข้อมูลความสูง'}
                            </span>
                        </div>

                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">{t('พิกัด:') || 'พิกัด:'}</span>
                                <span className="font-mono text-gray-800">
                                    {elevationInfo.lat.toFixed(6)}, {elevationInfo.lng.toFixed(6)}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-600">{t('ความสูง:') || 'ความสูง:'}</span>
                                <span className="font-semibold text-green-800">
                                    {elevationInfo.elevation.toFixed(2)} {t('เมตร') || 'เมตร'}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-600">
                                    {t('ระดับน้ำทะเล:') || 'ระดับน้ำทะเล:'}
                                </span>
                                <span className="text-gray-800">
                                    {elevationInfo.elevation > 0
                                        ? t('เหนือระดับน้ำทะเล') || 'เหนือระดับน้ำทะเล'
                                        : t('ต่ำกว่าระดับน้ำทะเล') || 'ต่ำกว่าระดับน้ำทะเล'}
                                </span>
                            </div>
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                            {new Date(elevationInfo.timestamp).toLocaleString('th-TH')}
                        </div>
                    </div>
                )}

                <div className="mt-3 text-xs text-gray-500">
                    <div className="mb-1 flex items-center gap-1">
                        <FaInfoCircle size={10} />
                        <span>{t('เคล็ดลับ:') || 'เคล็ดลับ:'}</span>
                    </div>
                    <div className="ml-3">
                        •{' '}
                        {t('คลิกที่ใดก็ได้บนแผนที่เพื่อดูความสูง') ||
                            'คลิกที่ใดก็ได้บนแผนที่เพื่อดูความสูง'}
                        <br />•{' '}
                        {t('ข้อมูลจะอัปเดตทันทีเมื่อคลิก') || 'ข้อมูลจะอัปเดตทันทีเมื่อคลิก'}
                        <br />•{' '}
                        {t('ความสูงแสดงเป็นเมตรเหนือระดับน้ำทะเล') ||
                            'ความสูงแสดงเป็นเมตรเหนือระดับน้ำทะเล'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ElevationClickHandler;
