import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaTimes, FaRoute, FaDownload, FaArrowUp, FaArrowDown } from 'react-icons/fa';

interface ElevationProfileProps {
    map: google.maps.Map | null;
    isActive: boolean;
    onToggle: () => void;
    t: (key: string) => string;
}

interface ElevationPoint {
    lat: number;
    lng: number;
    elevation: number;
    distance: number;
}

interface ProfileData {
    points: ElevationPoint[];
    totalDistance: number;
    minElevation: number;
    maxElevation: number;
    elevationChange: number; // ความต่างระหว่างจุดสุดท้าย - จุดแรก (บวก = สูงขึ้น, ลบ = ต่ำลง)
    startPoint: google.maps.LatLng;
    endPoint: google.maps.LatLng;
}

const ElevationProfile: React.FC<ElevationProfileProps> = ({ map, isActive, onToggle, t }) => {
    const [isDrawing, setIsDrawing] = useState(false);
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [startPoint, setStartPoint] = useState<google.maps.LatLng | null>(null);
    const [, setEndPoint] = useState<google.maps.LatLng | null>(null);
    const [, setCurrentPoint] = useState<google.maps.LatLng | null>(null);
    const [yAxisStepSize] = useState<number>(2); // Fixed step size for Y-axis
    const [yAxisMin, setYAxisMin] = useState<number | null>(null); // Custom Y-axis minimum
    const [yAxisMax, setYAxisMax] = useState<number | null>(null); // Custom Y-axis maximum
    const [useCustomRange, setUseCustomRange] = useState<boolean>(false); // Whether to use custom range

    // Use refs to track current state
    const startPointRef = useRef<google.maps.LatLng | null>(null);
    const endPointRef = useRef<google.maps.LatLng | null>(null);

    const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const mouseMoveListenerRef = useRef<google.maps.MapsEventListener | null>(null);
    const polylineRef = useRef<google.maps.Polyline | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const elevationServiceRef = useRef<google.maps.ElevationService | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Initialize elevation service
    useEffect(() => {
        if (map && window.google?.maps?.ElevationService) {
            elevationServiceRef.current = new google.maps.ElevationService();
        }
    }, [map]);

    const cleanup = (removeLine: boolean = true) => {
        if (clickListenerRef.current) {
            google.maps.event.removeListener(clickListenerRef.current);
            clickListenerRef.current = null;
        }
        if (mouseMoveListenerRef.current) {
            google.maps.event.removeListener(mouseMoveListenerRef.current);
            mouseMoveListenerRef.current = null;
        }
        if (removeLine && polylineRef.current) {
            polylineRef.current.setMap(null);
            polylineRef.current = null;
        }
        if (removeLine) {
            markersRef.current.forEach((marker) => marker.setMap(null));
            markersRef.current = [];
        }

        // Only reset points when removing line (full cleanup)
        if (removeLine) {
            setStartPoint(null);
            setEndPoint(null);
            setCurrentPoint(null);
            startPointRef.current = null;
            endPointRef.current = null;
        }
    };

    const removeLineAndMarkers = () => {
        if (polylineRef.current) {
            polylineRef.current.setMap(null);
            polylineRef.current = null;
        }
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];
    };

    const createMarker = useCallback(
        (position: google.maps.LatLng, type: 'start' | 'end') => {
            if (!map) return;

            const marker = new google.maps.Marker({
                position,
                map,
                title:
                    type === 'start'
                        ? t('จุดเริ่มต้น') || 'จุดเริ่มต้น'
                        : t('จุดสิ้นสุด') || 'จุดสิ้นสุด',
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: type === 'start' ? '#4CAF50' : '#F44336',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2,
                },
            });

            markersRef.current.push(marker);
        },
        [map, t]
    );

    const createLineBetweenPoints = useCallback(
        (start: google.maps.LatLng, end: google.maps.LatLng) => {
            if (!map) return;

            // Remove existing line if any
            if (polylineRef.current) {
                polylineRef.current.setMap(null);
                polylineRef.current = null;
            }

            // Create permanent line between start and end points
            polylineRef.current = new google.maps.Polyline({
                path: [start, end],
                geodesic: true,
                strokeColor: '#FF5722', // Orange color for profile line
                strokeOpacity: 1.0,
                strokeWeight: 4,
                map: map,
            });
        },
        [map]
    );

    const drawProfileChart = useCallback(
        (points: ElevationPoint[], customStepSize?: number) => {
            const canvas = canvasRef.current;
            if (!canvas || !points.length) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Ensure the orange line is still visible when redrawing chart
            // Use profileData points if available, otherwise use refs
            const startPoint = profileData?.startPoint || startPointRef.current;
            const endPoint = profileData?.endPoint || endPointRef.current;

            if (startPoint && endPoint && !polylineRef.current) {
                createLineBetweenPoints(startPoint, endPoint);
            }

            // Use custom step size if provided, otherwise use current state
            const currentStepSize = customStepSize ?? yAxisStepSize;

            // Set canvas size
            canvas.width = 600;
            canvas.height = 300;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Set up drawing parameters
            const padding = 40;
            const chartWidth = canvas.width - 2 * padding;
            const chartHeight = canvas.height - 2 * padding;

            // Find min/max elevation
            const elevations = points.map((p) => p.elevation);
            const minElevation = Math.min(...elevations);
            const maxElevation = Math.max(...elevations);

            // Create Y-axis scale with padding for better visualization
            let finalYAxisMin, finalYAxisMax;

            if (useCustomRange && yAxisMin !== null && yAxisMax !== null) {
                // Use custom range
                finalYAxisMin = yAxisMin;
                finalYAxisMax = yAxisMax;
            } else {
                // Use auto range with padding
                const elevationRange = maxElevation - minElevation;
                const paddingFactor = 0.1; // 10% padding above and below
                const elevationPadding = elevationRange * paddingFactor;

                finalYAxisMin =
                    Math.floor((minElevation - elevationPadding) / currentStepSize) *
                    currentStepSize;
                finalYAxisMax =
                    Math.ceil((maxElevation + elevationPadding) / currentStepSize) *
                    currentStepSize;
            }

            const yAxisRange = finalYAxisMax - finalYAxisMin;

            // Use the current step size
            const stepSize = currentStepSize;
            const numSteps = Math.ceil(yAxisRange / stepSize);

            // Draw background
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw grid lines
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 1;

            // Vertical grid lines
            for (let i = 0; i <= 10; i++) {
                const x = padding + (i / 10) * chartWidth;
                ctx.beginPath();
                ctx.moveTo(x, padding);
                ctx.lineTo(x, padding + chartHeight);
                ctx.stroke();
            }

            // Horizontal grid lines - Match Y-axis scale
            for (let i = 0; i <= numSteps; i++) {
                const elevation = finalYAxisMin + i * stepSize;
                if (elevation <= finalYAxisMax) {
                    const y =
                        padding +
                        chartHeight -
                        ((elevation - finalYAxisMin) / yAxisRange) * chartHeight;
                    ctx.beginPath();
                    ctx.moveTo(padding, y);
                    ctx.lineTo(padding + chartWidth, y);
                    ctx.stroke();
                }
            }

            // Draw elevation profile
            ctx.strokeStyle = '#2196F3';
            ctx.lineWidth = 3;
            ctx.beginPath();

            points.forEach((point, index) => {
                const x = padding + (index / (points.length - 1)) * chartWidth;
                const y =
                    padding +
                    chartHeight -
                    ((point.elevation - finalYAxisMin) / yAxisRange) * chartHeight;

                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });

            ctx.stroke();

            // Fill area under curve
            ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
            ctx.beginPath();
            ctx.moveTo(padding, padding + chartHeight);

            points.forEach((point, index) => {
                const x = padding + (index / (points.length - 1)) * chartWidth;
                const y =
                    padding +
                    chartHeight -
                    ((point.elevation - finalYAxisMin) / yAxisRange) * chartHeight;
                ctx.lineTo(x, y);
            });

            ctx.lineTo(padding + chartWidth, padding + chartHeight);
            ctx.closePath();
            ctx.fill();

            // Draw axes labels
            ctx.fillStyle = '#666';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';

            // X-axis labels (distance)
            for (let i = 0; i <= 10; i++) {
                const x = padding + (i / 10) * chartWidth;
                const distance = (i / 10) * points[points.length - 1].distance;
                ctx.fillText(`${(distance / 1000).toFixed(1)} km`, x, padding + chartHeight + 20);
            }

            // Y-axis labels (elevation) - Create nice scale with whole numbers
            ctx.textAlign = 'right';

            for (let i = 0; i <= numSteps; i++) {
                const elevation = finalYAxisMin + i * stepSize;
                if (elevation <= finalYAxisMax) {
                    const y =
                        padding +
                        chartHeight -
                        ((elevation - finalYAxisMin) / yAxisRange) * chartHeight;
                    ctx.fillText(`${elevation} m`, padding - 10, y + 4);
                }
            }

            // Draw title
            ctx.fillStyle = '#333';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(t('กราฟแสดงความสูง') || 'กราฟแสดงความสูง', canvas.width / 2, 20);
        },
        [yAxisStepSize, useCustomRange, yAxisMin, yAxisMax, createLineBetweenPoints, profileData, t]
    );

    const createElevationProfile = useCallback(
        async (start: google.maps.LatLng, end: google.maps.LatLng) => {
            if (!elevationServiceRef.current) {
                setError(
                    t('Elevation service ไม่พร้อมใช้งาน') || 'Elevation service ไม่พร้อมใช้งาน'
                );
                return;
            }

            if (!start || !end) {
                setError(
                    t('จุดเริ่มต้นหรือจุดสิ้นสุดไม่ถูกต้อง') ||
                    'จุดเริ่มต้นหรือจุดสิ้นสุดไม่ถูกต้อง'
                );
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                // Don't remove the permanent line during profile creation
                // Keep the line visible while creating the profile

                // Create path with multiple points for detailed profile
                const path = createDetailedPath(start, end, 50); // Reduced from 100 to avoid API limits

                elevationServiceRef.current.getElevationAlongPath(
                    {
                        path,
                        samples: 50,
                    },
                    (results, status) => {
                        if (
                            status === google.maps.ElevationStatus.OK &&
                            results &&
                            results.length > 0
                        ) {
                            const points = results.map((result, index) => {
                                const point = path[index];
                                const distance =
                                    index * (calculateDistance(start, end) / (results.length - 1));
                                return {
                                    lat: point.lat(),
                                    lng: point.lng(),
                                    elevation: result.elevation || 0,
                                    distance,
                                };
                            });

                            const totalDistance = calculateDistance(start, end);
                            const elevations = points.map((p) => p.elevation);
                            const minElevation = Math.min(...elevations);
                            const maxElevation = Math.max(...elevations);

                            // คำนวณความต่างระหว่างจุดสุดท้าย - จุดแรก
                            // บวก = สูงขึ้น, ลบ = ต่ำลง
                            const startElevation = points[0].elevation;
                            const endElevation = points[points.length - 1].elevation;
                            const elevationChange = endElevation - startElevation;

                            const newProfileData = {
                                points,
                                totalDistance,
                                minElevation,
                                maxElevation,
                                elevationChange,
                                startPoint: start,
                                endPoint: end,
                            };

                            setProfileData(newProfileData);

                            // Ensure the line is still visible after profile creation
                            if (!polylineRef.current) {
                                createLineBetweenPoints(start, end);
                            }

                            // Draw chart after a short delay to ensure state is updated
                            setTimeout(() => {
                                drawProfileChart(points);
                            }, 100);
                        } else {
                            setError(
                                t('ไม่สามารถสร้างกราฟแสดงความสูงได้ - สถานะ: ') + status ||
                                'ไม่สามารถสร้างกราฟแสดงความสูงได้ - สถานะ: ' + status
                            );
                        }
                        setIsLoading(false);
                    }
                );
            } catch (err) {
                setError(
                    t('เกิดข้อผิดพลาดในการสร้างโปรไฟล์: ') + (err as Error).message ||
                    'เกิดข้อผิดพลาดในการสร้างโปรไฟล์: ' + (err as Error).message
                );
                setIsLoading(false);
            }
        },
        [t, createLineBetweenPoints, drawProfileChart]
    );

    const createDetailedPath = (
        start: google.maps.LatLng,
        end: google.maps.LatLng,
        samples: number
    ): google.maps.LatLng[] => {
        if (!start || !end) {
            return [];
        }

        const path: google.maps.LatLng[] = [];

        for (let i = 0; i < samples; i++) {
            const fraction = i / (samples - 1);
            const lat = start.lat() + (end.lat() - start.lat()) * fraction;
            const lng = start.lng() + (end.lng() - start.lng()) * fraction;
            path.push(new google.maps.LatLng(lat, lng));
        }

        return path;
    };

    const calculateDistance = (start: google.maps.LatLng, end: google.maps.LatLng): number => {
        if (!start || !end) {
            return 0;
        }
        return google.maps.geometry.spherical.computeDistanceBetween(start, end);
    };

    const setupDrawingMode = useCallback(() => {
        if (!map) return;

        const handleMapClick = (event: google.maps.MapMouseEvent) => {
            if (!event.latLng) return;

            if (!startPointRef.current) {
                // First click - set start point
                startPointRef.current = event.latLng;
                setStartPoint(event.latLng);
                createMarker(event.latLng, 'start');
            } else if (!endPointRef.current) {
                // Second click - set end point and create profile
                endPointRef.current = event.latLng;
                setEndPoint(event.latLng);
                createMarker(event.latLng, 'end');

                // Store the points for later use
                const startPointForProfile = startPointRef.current;
                const endPointForProfile = event.latLng;

                // Create line between start and end points
                createLineBetweenPoints(startPointForProfile, endPointForProfile);

                // Create elevation profile after a short delay to ensure line is visible
                setTimeout(() => {
                    if (startPointForProfile && endPointForProfile) {
                        createElevationProfile(startPointForProfile, endPointForProfile);
                    }
                }, 100);

                setIsDrawing(false);
                // Don't remove the line and markers when profile is created
                // Only clean up listeners, not the line and markers
                if (clickListenerRef.current) {
                    google.maps.event.removeListener(clickListenerRef.current);
                    clickListenerRef.current = null;
                }
                if (mouseMoveListenerRef.current) {
                    google.maps.event.removeListener(mouseMoveListenerRef.current);
                    mouseMoveListenerRef.current = null;
                }
            }
        };

        const handleMouseMove = (event: google.maps.MapMouseEvent) => {
            if (event.latLng && startPointRef.current && !endPointRef.current) {
                setCurrentPoint(event.latLng);
                // Don't update polyline during mouse move to preserve the permanent line
                // updatePolyline(startPoint, event.latLng);
            }
        };

        // Remove existing listeners first
        if (clickListenerRef.current) {
            google.maps.event.removeListener(clickListenerRef.current);
        }
        if (mouseMoveListenerRef.current) {
            google.maps.event.removeListener(mouseMoveListenerRef.current);
        }

        clickListenerRef.current = map.addListener('click', handleMapClick);
        mouseMoveListenerRef.current = map.addListener('mousemove', handleMouseMove);
    }, [map, createMarker, createLineBetweenPoints, createElevationProfile]);

    // Setup drawing mode
    useEffect(() => {
        if (!map || !isActive) {
            cleanup(true);
            return;
        }

        if (isDrawing) {
            setupDrawingMode();
        } else {
            // Only clean up listeners when not drawing, but keep the line and points if we have profile data
            if (profileData) {
                // Keep the line and points, only clean up listeners
                cleanup(false);
            } else {
                // No profile data, clean up everything
                cleanup(true);
            }
        }

        return () => cleanup(true);
    }, [map, isActive, isDrawing, setupDrawingMode, profileData]);

    // Redraw chart when yAxisStepSize changes
    useEffect(() => {
        if (profileData && profileData.points.length > 0) {
            drawProfileChart(profileData.points);
        }
    }, [yAxisStepSize, profileData, drawProfileChart]);

    // Redraw chart when custom range changes and ensure line is visible
    useEffect(() => {
        if (profileData && profileData.points.length > 0) {
            // Ensure the orange line is still visible when redrawing chart
            // Use profileData points if available, otherwise use refs
            const startPoint = profileData.startPoint || startPointRef.current;
            const endPoint = profileData.endPoint || endPointRef.current;

            if (startPoint && endPoint && !polylineRef.current) {
                createLineBetweenPoints(startPoint, endPoint);
            }

            drawProfileChart(profileData.points);
        }
    }, [
        useCustomRange,
        yAxisMin,
        yAxisMax,
        profileData,
        drawProfileChart,
        createLineBetweenPoints,
    ]);

    const downloadProfile = () => {
        if (!profileData) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `elevation-profile-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    };

    const resetProfile = () => {
        setProfileData(null);
        setStartPoint(null);
        setEndPoint(null);
        setCurrentPoint(null);
        setIsDrawing(false);
        setYAxisMin(null);
        setYAxisMax(null);
        setUseCustomRange(false);
        startPointRef.current = null;
        endPointRef.current = null;
        removeLineAndMarkers();
        cleanup(true);
    };

    const handleCustomRangeChange = useCallback(
        (min: number, max: number) => {
            setYAxisMin(min);
            setYAxisMax(max);
            setUseCustomRange(true);

            // Ensure the orange line remains visible when changing range
            // Use profileData points if available, otherwise use refs
            const startPoint = profileData?.startPoint || startPointRef.current;
            const endPoint = profileData?.endPoint || endPointRef.current;

            if (startPoint && endPoint && !polylineRef.current) {
                createLineBetweenPoints(startPoint, endPoint);
            }
        },
        [createLineBetweenPoints, profileData]
    );

    const resetToAutoRange = useCallback(() => {
        setUseCustomRange(false);
        setYAxisMin(null);
        setYAxisMax(null);

        // Ensure the orange line remains visible when resetting to auto range
        // Use profileData points if available, otherwise use refs
        const startPoint = profileData?.startPoint || startPointRef.current;
        const endPoint = profileData?.endPoint || endPointRef.current;

        if (startPoint && endPoint && !polylineRef.current) {
            createLineBetweenPoints(startPoint, endPoint);
        }
    }, [createLineBetweenPoints, profileData]);

    if (!isActive) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[1000] max-w-md rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FaRoute className="text-blue-600" size={16} />
                        <h3 className="font-semibold text-gray-800">
                            {t('กราฟแสดงความสูง') || 'กราฟแสดงความสูง'}
                        </h3>
                    </div>
                    <button
                        onClick={() => {
                            removeLineAndMarkers();
                            onToggle();
                        }}
                        className="text-gray-400 transition-colors hover:text-gray-600"
                    >
                        <FaTimes size={14} />
                    </button>
                </div>

                {!isDrawing && (
                    <div className="space-y-3">
                        {!profileData && (
                    <div className="space-y-3">
                        <div className="text-sm text-gray-600">
                            {t('คลิก 2 จุดบนแผนที่เพื่อสร้างกราฟแสดงความสูง') ||
                                'คลิก 2 จุดบนแผนที่เพื่อสร้างกราฟแสดงความสูง'}
                        </div>

                        <button
                            onClick={() => {
                                // Reset state before starting
                                setStartPoint(null);
                                setEndPoint(null);
                                setCurrentPoint(null);
                                setProfileData(null);
                                setYAxisMin(null);
                                setYAxisMax(null);
                                setUseCustomRange(false);
                                startPointRef.current = null;
                                endPointRef.current = null;
                                removeLineAndMarkers();
                                cleanup(true);
                                setIsDrawing(true);
                            }}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                        >
                            {t('เริ่มวาดเส้นทาง') || 'เริ่มวาดเส้นทาง'}
                        </button>
                    </div>
                )}
                    </div>
                )}

                {isDrawing && (
                    <div className="space-y-3">
                        <div className="text-sm text-blue-600">
                            {startPoint
                                ? t('คลิกจุดสิ้นสุด') || 'คลิกจุดสิ้นสุด'
                                : t('คลิกจุดเริ่มต้น') || 'คลิกจุดเริ่มต้น'}
                        </div>

                        {startPoint && (
                            <div className="text-xs text-gray-500">
                                {t('จุดเริ่มต้น:') || 'จุดเริ่มต้น:'} {startPoint.lat().toFixed(6)},{' '}
                                {startPoint.lng().toFixed(6)}
                            </div>
                        )}

                        <button
                            onClick={() => {
                                setIsDrawing(false);
                                setStartPoint(null);
                                setEndPoint(null);
                                setCurrentPoint(null);
                                startPointRef.current = null;
                                endPointRef.current = null;
                                removeLineAndMarkers();
                                cleanup(true);
                            }}
                            className="w-full rounded-lg bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
                        >
                            {t('ยกเลิก') || 'ยกเลิก'}
                        </button>
                    </div>
                )}

                {isLoading && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
                        {t('กำลังสร้างโปรไฟล์...') || 'กำลังสร้างโปรไฟล์...'}
                    </div>
                )}

                {error && <div className="text-sm text-red-600">{error}</div>}

                {profileData && (
                    <div className="space-y-4">
                        {/* Custom Y-Axis Range Control */}
                        <div className="rounded-lg bg-blue-50 p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">
                                    {t('ช่วงความสูงของกราฟ') || 'ช่วงความสูงของกราฟ'}
                                </label>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`rounded px-2 py-1 text-xs ${useCustomRange
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-200 text-gray-600'
                                            }`}
                                    >
                                        {useCustomRange
                                            ? t('กำหนดเอง') || 'กำหนดเอง'
                                            : t('อัตโนมัติ') || 'อัตโนมัติ'}
                                    </span>
                                    {useCustomRange && (
                                        <button
                                            onClick={resetToAutoRange}
                                            className="text-xs text-blue-600 hover:text-blue-800"
                                        >
                                            {t('รีเซ็ต') || 'รีเซ็ต'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* Custom range inputs */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="mb-1 block text-xs text-gray-600">
                                            {t('ต่ำสุด (m):') || 'ต่ำสุด (m):'}
                                        </label>
                                        <input
                                            type="number"
                                            value={yAxisMin?.toFixed(1) || ''}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    handleCustomRangeChange(
                                                        value,
                                                        yAxisMax || profileData.maxElevation
                                                    );
                                                }
                                            }}
                                            className="w-full rounded border px-2 py-1 text-xs text-black"
                                            placeholder={profileData.minElevation.toFixed(1)}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-gray-600">
                                            {t('สูงสุด (m):') || 'สูงสุด (m):'}
                                        </label>
                                        <input
                                            type="number"
                                            value={yAxisMax?.toFixed(1) || ''}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    handleCustomRangeChange(
                                                        yAxisMin || profileData.minElevation,
                                                        value
                                                    );
                                                }
                                            }}
                                            className="w-full rounded border px-2 py-1 text-xs text-black"
                                            placeholder={profileData.maxElevation.toFixed(1)}
                                        />
                                    </div>
                                </div>

                                {/* Quick range buttons */}
                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-gray-600">
                                        {t('ช่วงแนะนำ:') || 'ช่วงแนะนำ:'}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        <button
                                            onClick={() => {
                                                const range =
                                                    profileData.maxElevation -
                                                    profileData.minElevation;
                                                const padding = range * 0.2; // 20% padding
                                                const newMin = Math.floor(
                                                    profileData.minElevation - padding
                                                );
                                                const newMax = Math.ceil(
                                                    profileData.maxElevation + padding
                                                );
                                                handleCustomRangeChange(newMin, newMax);
                                            }}
                                            className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 transition-colors hover:bg-green-200"
                                        >
                                            {t('+20%') || '+20%'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const range =
                                                    profileData.maxElevation -
                                                    profileData.minElevation;
                                                const padding = range * 0.5; // 50% padding
                                                handleCustomRangeChange(
                                                    Math.floor(profileData.minElevation - padding),
                                                    Math.ceil(profileData.maxElevation + padding)
                                                );
                                            }}
                                            className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-200"
                                        >
                                            {t('+50%') || '+50%'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const range =
                                                    profileData.maxElevation -
                                                    profileData.minElevation;
                                                const padding = range * 1.0; // 100% padding
                                                handleCustomRangeChange(
                                                    Math.floor(profileData.minElevation - padding),
                                                    Math.ceil(profileData.maxElevation + padding)
                                                );
                                            }}
                                            className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700 transition-colors hover:bg-purple-200"
                                        >
                                            {t('+100%') || '+100%'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const range =
                                                    profileData.maxElevation -
                                                    profileData.minElevation;
                                                const padding = range * 2.0; // 200% padding
                                                handleCustomRangeChange(
                                                    Math.floor(profileData.minElevation - padding),
                                                    Math.ceil(profileData.maxElevation + padding)
                                                );
                                            }}
                                            className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-700 transition-colors hover:bg-orange-200"
                                        >
                                            {t('+200%') || '+200%'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Profile Chart */}
                        <div className="rounded-lg border border-gray-200 p-2">
                            <canvas ref={canvasRef} className="h-auto w-full" />
                        </div>

                        {/* Profile Statistics */}
                        <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="rounded bg-blue-50 p-2">
                                <div className="font-medium text-blue-600">
                                    {t('ระยะทาง') || 'ระยะทาง'}
                                </div>
                                <div className="text-gray-800">
                                    {profileData.totalDistance < 1000
                                        ? `${profileData.totalDistance.toFixed(1)} m`
                                        : `${(profileData.totalDistance / 1000).toFixed(2)} km`}
                                </div>
                            </div>

                            <div className="rounded bg-green-50 p-2">
                                <div className="font-medium text-green-600">
                                    {t('ความสูงต่ำสุด') || 'ความสูงต่ำสุด'}
                                </div>
                                <div className="text-gray-800">
                                    {profileData.minElevation.toFixed(1)} m
                                </div>
                            </div>

                            <div className="rounded bg-orange-50 p-2">
                                <div className="font-medium text-orange-600">
                                    {t('ความสูงสูงสุด') || 'ความสูงสูงสุด'}
                                </div>
                                <div className="text-gray-800">
                                    {profileData.maxElevation.toFixed(1)} m
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded bg-indigo-50 p-2">
                                <div className="font-medium text-indigo-600">
                                    {t('ความต่าง max-min') || 'ความต่าง max-min'}
                                </div>
                                <div className="text-gray-800">
                                    {(profileData.maxElevation - profileData.minElevation).toFixed(1)} m
                                </div>
                            </div>

                            <div className="rounded bg-purple-50 p-2">
                                <div className="font-medium text-purple-600">
                                    {t('ความต่าง จุดเริ่ม-จุดสิ้นสุด') || 'ความต่าง จุดเริ่ม-จุดสิ้นสุด'}
                                </div>
                                <div className="flex items-center gap-1 text-gray-800">
                                    {profileData.elevationChange > 0 ? (
                                        <>
                                            <FaArrowUp className="text-green-600" size={12} />
                                            <span>+{profileData.elevationChange.toFixed(1)} m</span>
                                        </>
                                    ) : profileData.elevationChange < 0 ? (
                                        <>
                                            <FaArrowDown className="text-red-600" size={12} />
                                            <span>{profileData.elevationChange.toFixed(1)} m</span>
                                        </>
                                    ) : (
                                        <span>0.0 m</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={downloadProfile}
                                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-white transition-colors hover:bg-green-700"
                            >
                                <FaDownload size={12} />
                                {t('ดาวน์โหลด') || 'ดาวน์โหลด'}
                            </button>

                            <button
                                onClick={resetProfile}
                                className="flex-1 rounded-lg bg-gray-600 px-3 py-2 text-white transition-colors hover:bg-gray-700"
                            >
                                {t('ใหม่') || 'ใหม่'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ElevationProfile;
