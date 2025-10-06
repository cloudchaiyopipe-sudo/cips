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
    const startPointRef = useRef<Coordinate | null>(null);
    const labelMarkerRef = useRef<google.maps.Marker | null>(null);
    const polylineRef = useRef<google.maps.Polyline | null>(null);
    const listenersRef = useRef<google.maps.MapsEventListener[]>([]);
    const cleanupFunctionsRef = useRef<(() => void)[]>([]);

    const calculateDistance = (point1: Coordinate, point2: Coordinate): number => {
        const R = 6371000;
        const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
        const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((point1.lat * Math.PI) / 180) *
                Math.cos((point2.lat * Math.PI) / 180) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
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
            if (labelMarkerRef.current) {
                labelMarkerRef.current.setMap(null);
                labelMarkerRef.current = null;
            }
            if (polylineRef.current) {
                polylineRef.current.setMap(null);
                polylineRef.current = null;
            }
            setStartPoint(null);
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

                    const rect = mapContainer.getBoundingClientRect();
                    const isInMainMapArea =
                        e.clientX >= rect.left + 50 &&
                        e.clientX <= rect.right - 50 &&
                        e.clientY >= rect.top + 50 &&
                        e.clientY <= rect.bottom - 50;

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

                    const bounds = map.getBounds();
                    if (bounds) {
                        const rect = mapContainer.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;

                        const ne = bounds.getNorthEast();
                        const sw = bounds.getSouthWest();

                        const lng =
                            sw.lng() + (ne.lng() - sw.lng()) * (x / mapContainer.offsetWidth);
                        const lat =
                            ne.lat() - (ne.lat() - sw.lat()) * (y / mapContainer.offsetHeight);

                        const clickedPoint = { lat, lng };

                        if (!startPoint) {
                            setStartPoint(clickedPoint);
                            startPointRef.current = clickedPoint;
                        } else {
                            setStartPoint(null);
                            startPointRef.current = null;
                            if (labelMarkerRef.current) {
                                labelMarkerRef.current.setMap(null);
                                labelMarkerRef.current = null;
                            }
                            if (polylineRef.current) {
                                polylineRef.current.setMap(null);
                                polylineRef.current = null;
                            }
                        }
                    }
                }

                isMouseDown = false;
                isDragging = false;
            };

            mapContainer.addEventListener('mousedown', mouseDownListener, true);
            mapContainer.addEventListener('mousemove', mouseMoveListener, true);
            mapContainer.addEventListener('mouseup', mouseUpListener, true);

            const cleanupListeners = () => {
                mapContainer.removeEventListener('mousedown', mouseDownListener, true);
                mapContainer.removeEventListener('mousemove', mouseMoveListener, true);
                mapContainer.removeEventListener('mouseup', mouseUpListener, true);
            };
            cleanupFunctionsRef.current.push(cleanupListeners);

            const drawingCompleteListener = google.maps.event.addListener(
                map,
                'overlaycomplete',
                () => {
                    setStartPoint(null);
                    startPointRef.current = null;
                    if (polylineRef.current) {
                        polylineRef.current.setMap(null);
                        polylineRef.current = null;
                    }
                    if (labelMarkerRef.current) {
                        labelMarkerRef.current.setMap(null);
                        labelMarkerRef.current = null;
                    }
                }
            );
            listenersRef.current.push(drawingCompleteListener);

            const doubleClickListener = google.maps.event.addListener(map, 'dblclick', () => {
                setTimeout(() => {
                    setStartPoint(null);
                    startPointRef.current = null;
                    if (polylineRef.current) {
                        polylineRef.current.setMap(null);
                        polylineRef.current = null;
                    }
                    if (labelMarkerRef.current) {
                        labelMarkerRef.current.setMap(null);
                        labelMarkerRef.current = null;
                    }
                }, 100);
            });
            listenersRef.current.push(doubleClickListener);

            const keydownListener = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && startPoint) {
                    setStartPoint(null);
                    startPointRef.current = null;
                    if (polylineRef.current) {
                        polylineRef.current.setMap(null);
                        polylineRef.current = null;
                    }
                    if (labelMarkerRef.current) {
                        labelMarkerRef.current.setMap(null);
                        labelMarkerRef.current = null;
                    }
                }
            };
            document.addEventListener('keydown', keydownListener);

            const keyboardCleanup = () => {
                document.removeEventListener('keydown', keydownListener);
            };
            cleanupFunctionsRef.current.push(keyboardCleanup);

            const mapDiv = map.getDiv();
            let frameId: number | null = null;

            const handleMouseMove = (e: MouseEvent) => {
                if (!startPointRef.current) return;

                if (frameId) return;

                frameId = requestAnimationFrame(() => {
                    frameId = null;

                    try {
                        const bounds = map.getBounds();
                        if (!bounds) return;

                        const rect = mapDiv.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;

                        const ne = bounds.getNorthEast();
                        const sw = bounds.getSouthWest();

                        const lng = sw.lng() + (ne.lng() - sw.lng()) * (x / mapDiv.offsetWidth);
                        const lat = ne.lat() - (ne.lat() - sw.lat()) * (y / mapDiv.offsetHeight);

                        const currentPoint = { lat, lng };

                        if (!startPointRef.current) return;

                        const distance = calculateDistance(startPointRef.current, currentPoint);

                        const path = [
                            new google.maps.LatLng(
                                startPointRef.current.lat,
                                startPointRef.current.lng
                            ),
                            new google.maps.LatLng(currentPoint.lat, currentPoint.lng),
                        ];

                        if (!polylineRef.current) {
                            polylineRef.current = new google.maps.Polyline({
                                path,
                                strokeColor: '#ffffff',
                                strokeOpacity: 0.9,
                                strokeWeight: 2,
                                map,
                            });
                        } else {
                            polylineRef.current.setPath(path);
                            polylineRef.current.setMap(map);
                        }

                        const midLat = (startPointRef.current.lat + currentPoint.lat) / 2;
                        const midLng = (startPointRef.current.lng + currentPoint.lng) / 2;
                        const mid = new google.maps.LatLng(midLat, midLng);

                        const labelText = formatDistance(distance);

                        if (!labelMarkerRef.current) {
                            labelMarkerRef.current = new google.maps.Marker({
                                position: mid,
                                map,
                                icon: {
                                    path: google.maps.SymbolPath.CIRCLE,
                                    scale: 0,
                                    labelOrigin: new google.maps.Point(0, 14),
                                } as google.maps.Symbol,
                                label: {
                                    text: labelText,
                                    color: '#ffffff',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                },
                                clickable: false,
                                zIndex: 9999,
                            });
                        } else {
                            labelMarkerRef.current.setPosition(mid);
                            labelMarkerRef.current.setLabel({
                                text: labelText,
                                color: '#ffffff',
                                fontSize: '12px',
                                fontWeight: '700',
                            } as google.maps.MarkerLabel);
                            labelMarkerRef.current.setMap(map);
                        }
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

            if (labelMarkerRef.current) {
                labelMarkerRef.current.setMap(null);
                labelMarkerRef.current = null;
            }
            if (polylineRef.current) {
                polylineRef.current.setMap(null);
                polylineRef.current = null;
            }
        };
    }, [map, isActive, editMode]);

    useEffect(() => {
        setStartPoint(null);
        startPointRef.current = null;
        if (labelMarkerRef.current) {
            labelMarkerRef.current.setMap(null);
            labelMarkerRef.current = null;
        }
        if (polylineRef.current) {
            polylineRef.current.setMap(null);
            polylineRef.current = null;
        }
    }, [editMode]);

    return null;
};

export default DistanceMeasurementOverlay;
