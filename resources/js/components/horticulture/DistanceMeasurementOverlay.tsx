import React, { useEffect, useRef, useState } from 'react';

interface Coordinate {
    lat: number;
    lng: number;
}

interface DistanceMeasurementOverlayProps {
    map: google.maps.Map | null | undefined;
    isActive: boolean;
    editMode: string | null;
}

const DistanceMeasurementOverlay: React.FC<DistanceMeasurementOverlayProps> = ({
    map,
    isActive,
    editMode,
}) => {
    const [startPoint, setStartPoint] = useState<Coordinate | null>(null);
    const [currentPoint, setCurrentPoint] = useState<Coordinate | null>(null);
    const [distance, setDistance] = useState<number>(0);
    const [isVisible, setIsVisible] = useState<boolean>(false);
    const startPointRef = useRef<Coordinate | null>(null);
    const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
    const cleanupFunctionsRef = useRef<(() => void)[]>([]);

    const calculateDistance = (point1: Coordinate, point2: Coordinate): number => {
        // Check for invalid coordinates
        if (
            !point1 ||
            !point2 ||
            typeof point1.lat !== 'number' ||
            typeof point1.lng !== 'number' ||
            typeof point2.lat !== 'number' ||
            typeof point2.lng !== 'number' ||
            isNaN(point1.lat) ||
            isNaN(point1.lng) ||
            isNaN(point2.lat) ||
            isNaN(point2.lng)
        ) {
            console.warn('Invalid coordinates for distance calculation:', { point1, point2 });
            return 0;
        }

        // Check for coordinates that are too far apart (likely error)
        const latDiff = Math.abs(point2.lat - point1.lat);
        const lngDiff = Math.abs(point2.lng - point1.lng);

        if (latDiff > 1 || lngDiff > 1) {
            console.warn('Coordinates too far apart, likely conversion error:', {
                point1,
                point2,
                latDiff,
                lngDiff,
            });
            return 0;
        }

        // Use Google Maps geometry library for accurate distance calculation
        if (
            window.google?.maps?.geometry?.spherical &&
            typeof window.google.maps.geometry.spherical.computeDistanceBetween === 'function'
        ) {
            try {
                const latLng1 = new google.maps.LatLng(point1.lat, point1.lng);
                const latLng2 = new google.maps.LatLng(point2.lat, point2.lng);
                const distance = google.maps.geometry.spherical.computeDistanceBetween(
                    latLng1,
                    latLng2
                );
                return distance;
            } catch (error) {
                console.warn('Error using Google Maps geometry library:', error);
            }
        }

        // Fallback to Haversine formula if Google Maps geometry is not available
        const R = 6371000; // Earth's radius in meters
        const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
        const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((point1.lat * Math.PI) / 180) *
                Math.cos((point2.lat * Math.PI) / 180) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance;
    };

    const formatDistance = (meters: number): string => {
        if (meters < 1000) {
            return `${meters.toFixed(1)} ม.`;
        } else {
            return `${(meters / 1000).toFixed(2)} กม.`;
        }
    };

    useEffect(() => {
        startPointRef.current = startPoint;
    }, [startPoint]);

    useEffect(() => {
        listenersRef.current.forEach((listener) => {
            if (listener) {
                google.maps.event.removeListener(listener);
            }
        });
        listenersRef.current = [];

        cleanupFunctionsRef.current.forEach((cleanup) => cleanup());
        cleanupFunctionsRef.current = [];

        if (!map || !isActive || !editMode) {
            setStartPoint(null);
            setCurrentPoint(null);
            setDistance(0);
            setIsVisible(false);
            return;
        }

        const setupListeners = () => {
            const mapContainer = map.getDiv();
            let isMouseDown = false;
            let mouseDownPos = { x: 0, y: 0 };
            let isDragging = false;

            const mouseDownListener = (e: MouseEvent) => {
                isMouseDown = true;
                mouseDownPos = { x: e.clientX, y: e.clientY };
                isDragging = false;
            };

            const mouseMoveListener = (e: MouseEvent) => {
                if (isMouseDown) {
                    const deltaX = Math.abs(e.clientX - mouseDownPos.x);
                    const deltaY = Math.abs(e.clientY - mouseDownPos.y);
                    const threshold = 5;

                    if (deltaX > threshold || deltaY > threshold) {
                        isDragging = true;
                    }
                }
            };

            const mouseUpListener = (e: MouseEvent) => {
                if (isMouseDown && !isDragging) {
                    const target = e.target as HTMLElement;

                    const isClickOnControls =
                        target.closest('.gmnoprint') ||
                        target.closest('[role="button"]') ||
                        target.closest('[data-control-width]') ||
                        target.closest('[jsaction]') ||
                        target.closest('.gm-bundled-control') ||
                        target.closest('.gm-control-active') ||
                        target.style.cursor === 'pointer' ||
                        target.parentElement?.style.cursor === 'pointer';

                    const checkRect = mapContainer.getBoundingClientRect();
                    const isInMainMapArea =
                        e.clientX >= checkRect.left + 50 &&
                        e.clientX <= checkRect.right - 50 &&
                        e.clientY >= checkRect.top + 50 &&
                        e.clientY <= checkRect.bottom - 50;

                    if (isClickOnControls || !isInMainMapArea) {
                        isMouseDown = false;
                        isDragging = false;
                        return;
                    }

                    const drawingModes = [
                        'mainArea',
                        'zone',
                        'exclusion',
                        'mainPipe',
                        'subMainPipe',
                    ];
                    if (!drawingModes.includes(editMode || '')) {
                        return;
                    }

                    // Use manual calculation for accurate coordinate conversion
                    const clickRect = mapContainer.getBoundingClientRect();
                    const x = e.clientX - clickRect.left;
                    const y = e.clientY - clickRect.top;

                    // Get map bounds and calculate lat/lng manually
                    const bounds = map.getBounds();
                    if (bounds) {
                        const ne = bounds.getNorthEast();
                        const sw = bounds.getSouthWest();

                        // Calculate lat/lng from screen coordinates (corrected)
                        const lat = sw.lat() + (ne.lat() - sw.lat()) * (1 - y / clickRect.height);
                        const lng = sw.lng() + (ne.lng() - sw.lng()) * (x / clickRect.width);

                        const clickedPoint = { lat, lng };

                        // Always start new measurement on click
                        setStartPoint(clickedPoint);
                        setCurrentPoint(clickedPoint);
                        setDistance(0);
                        setIsVisible(true);
                        startPointRef.current = clickedPoint;
                    }
                }

                isMouseDown = false;
                isDragging = false;
            };

            const rightClickListener = (e: MouseEvent) => {
                if (e.button === 2) {
                    // Right click
                    e.preventDefault();
                    setStartPoint(null);
                    setCurrentPoint(null);
                    setDistance(0);
                    setIsVisible(false);
                    startPointRef.current = null;
                }
            };

            mapContainer.addEventListener('mousedown', mouseDownListener, true);
            mapContainer.addEventListener('mousemove', mouseMoveListener, true);
            mapContainer.addEventListener('mouseup', mouseUpListener, true);
            mapContainer.addEventListener('contextmenu', rightClickListener, true);

            const cleanupListeners = () => {
                mapContainer.removeEventListener('mousedown', mouseDownListener, true);
                mapContainer.removeEventListener('mousemove', mouseMoveListener, true);
                mapContainer.removeEventListener('mouseup', mouseUpListener, true);
                mapContainer.removeEventListener('contextmenu', rightClickListener, true);
            };
            cleanupFunctionsRef.current.push(cleanupListeners);

            const drawingCompleteListener = google.maps.event.addListener(
                map,
                'overlaycomplete',
                () => {
                    setStartPoint(null);
                    setCurrentPoint(null);
                    setDistance(0);
                    setIsVisible(false);
                    startPointRef.current = null;
                }
            );
            listenersRef.current.push(drawingCompleteListener);

            const doubleClickListener = google.maps.event.addListener(map, 'dblclick', () => {
                // Stop measurement on double click
                setStartPoint(null);
                setCurrentPoint(null);
                setDistance(0);
                setIsVisible(false);
                startPointRef.current = null;
            });
            listenersRef.current.push(doubleClickListener);

            const keydownListener = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && startPoint) {
                    setStartPoint(null);
                    setCurrentPoint(null);
                    setDistance(0);
                    setIsVisible(false);
                    startPointRef.current = null;
                }
            };
            document.addEventListener('keydown', keydownListener);

            const keyboardCleanup = () => {
                document.removeEventListener('keydown', keydownListener);
            };
            cleanupFunctionsRef.current.push(keyboardCleanup);

            // Add zoom event listener to refresh bounds
            const zoomListener = () => {
                // Force refresh of bounds when zoom changes
                if (startPointRef.current) {
                    // Trigger a small update to refresh the measurement
                    const currentBounds = map.getBounds();
                    if (currentBounds) {
                        // Refresh measurement on zoom change
                    }
                }
            };

            // Listen for zoom changes
            const zoomChangeListener = map.addListener('zoom_changed', zoomListener);
            const boundsChangeListener = map.addListener('bounds_changed', zoomListener);

            cleanupFunctionsRef.current.push(() => {
                if (zoomChangeListener) {
                    google.maps.event.removeListener(zoomChangeListener);
                }
                if (boundsChangeListener) {
                    google.maps.event.removeListener(boundsChangeListener);
                }
            });

            const mapDiv = map.getDiv();
            let frameId: number | null = null;

            const handleMouseMove = (e: MouseEvent) => {
                if (!startPointRef.current) return;

                if (frameId) return;

                frameId = requestAnimationFrame(() => {
                    frameId = null;

                    try {
                        // Use manual calculation for accurate coordinate conversion
                        const moveRect = mapDiv.getBoundingClientRect();
                        const x = e.clientX - moveRect.left;
                        const y = e.clientY - moveRect.top;

                        // Get fresh map bounds and calculate lat/lng manually
                        const bounds = map.getBounds();
                        if (!bounds) return;

                        const ne = bounds.getNorthEast();
                        const sw = bounds.getSouthWest();

                        // Calculate lat/lng from screen coordinates with proper bounds (corrected)
                        const lat = sw.lat() + (ne.lat() - sw.lat()) * (1 - y / moveRect.height);
                        const lng = sw.lng() + (ne.lng() - sw.lng()) * (x / moveRect.width);

                        const currentPoint = { lat, lng };

                        if (!startPointRef.current) return;

                        const distance = calculateDistance(startPointRef.current, currentPoint);

                        // Update state for popup display (removed line drawing)
                        setCurrentPoint(currentPoint);
                        setDistance(distance);
                    } catch (error) {
                        console.error('Error in mousemove handler:', error);
                    }
                });
            };

            mapDiv.addEventListener('mousemove', handleMouseMove);

            const mouseMoveCleanup = () => {
                if (frameId) {
                    cancelAnimationFrame(frameId);
                }
                mapDiv.removeEventListener('mousemove', handleMouseMove);
            };
            cleanupFunctionsRef.current.push(mouseMoveCleanup);
        };

        const timeoutId = setTimeout(setupListeners, 100);

        return () => {
            clearTimeout(timeoutId);
            listenersRef.current.forEach((listener) => {
                if (listener) {
                    google.maps.event.removeListener(listener);
                }
            });
            listenersRef.current = [];

            cleanupFunctionsRef.current.forEach((cleanup) => cleanup());
            cleanupFunctionsRef.current = [];
        };
    }, [map, isActive, editMode, startPoint]);

    useEffect(() => {
        setStartPoint(null);
        setCurrentPoint(null);
        setDistance(0);
        setIsVisible(false);
        startPointRef.current = null;
    }, [editMode]);

    return (
        <>
            {isVisible && (
                <div className="fixed right-4 top-4 z-[1000] min-w-[200px] rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 animate-pulse rounded-full bg-green-500"></div>
                            <h3 className="text-sm font-semibold text-gray-800">ระยะทาง</h3>
                        </div>
                        <button
                            onClick={() => {
                                setStartPoint(null);
                                setCurrentPoint(null);
                                setDistance(0);
                                setIsVisible(false);
                                startPointRef.current = null;
                            }}
                            className="text-gray-400 transition-colors hover:text-gray-600"
                        >
                            <svg
                                className="h-4 w-4"
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

                    <div className="space-y-2">
                        <div className="text-2xl font-bold text-green-600">
                            {formatDistance(distance)}
                        </div>

                        {startPoint && currentPoint && (
                            <div className="space-y-1 text-xs text-gray-500">
                                <div>
                                    <span className="font-medium">จุดเริ่มต้น:</span>
                                    <br />
                                    {startPoint.lat.toFixed(6)}, {startPoint.lng.toFixed(6)}
                                </div>
                                <div>
                                    <span className="font-medium">จุดปัจจุบัน:</span>
                                    <br />
                                    {currentPoint.lat.toFixed(6)}, {currentPoint.lng.toFixed(6)}
                                </div>
                            </div>
                        )}

                        <div className="space-y-1 text-xs text-gray-400">
                            <div>• คลิกซ้าย: เริ่มการวัดระยะทางใหม่</div>
                            <div>• คลิกขวา: หยุดการวัดระยะทาง</div>
                            <div>• Double click: หยุดการวัดระยะทาง</div>
                            <div>• ESC: หยุดการวัดระยะทาง</div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default DistanceMeasurementOverlay;
