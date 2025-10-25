import React, { useEffect, useRef, useState } from 'react';
import { FaTimes, FaRoute, FaDownload } from 'react-icons/fa';

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
    elevationGain: number;
    elevationLoss: number;
}

const ElevationProfile: React.FC<ElevationProfileProps> = ({
    map,
    isActive,
    onToggle,
    t,
}) => {
    const [isDrawing, setIsDrawing] = useState(false);
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [startPoint, setStartPoint] = useState<google.maps.LatLng | null>(null);
    const [endPoint, setEndPoint] = useState<google.maps.LatLng | null>(null);
    const [, setCurrentPoint] = useState<google.maps.LatLng | null>(null);
    
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

    // Setup drawing mode
    useEffect(() => {
        if (!map || !isActive) {
            cleanup();
            return;
        }

        if (isDrawing) {
            setupDrawingMode();
        } else {
            cleanup();
        }

        return cleanup;
    }, [map, isActive, isDrawing]);

    const cleanup = () => {
        if (clickListenerRef.current) {
            google.maps.event.removeListener(clickListenerRef.current);
            clickListenerRef.current = null;
        }
        if (mouseMoveListenerRef.current) {
            google.maps.event.removeListener(mouseMoveListenerRef.current);
            mouseMoveListenerRef.current = null;
        }
        if (polylineRef.current) {
            polylineRef.current.setMap(null);
            polylineRef.current = null;
        }
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];
        setStartPoint(null);
        setEndPoint(null);
        setCurrentPoint(null);
        startPointRef.current = null;
        endPointRef.current = null;
    };

    const setupDrawingMode = () => {
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
                
                // Create line between start and end points
                createLineBetweenPoints(startPointRef.current, event.latLng);
                
                // Store the points for later use
                const startPointForProfile = startPointRef.current;
                const endPointForProfile = event.latLng;
                
                // Create elevation profile after a short delay to ensure line is visible
                setTimeout(() => {
                    if (startPointForProfile && endPointForProfile) {
                        createElevationProfile(startPointForProfile, endPointForProfile);
                    }
                }, 100);
                
                setIsDrawing(false);
            }
        };

        const handleMouseMove = (event: google.maps.MapMouseEvent) => {
            if (event.latLng && startPoint && !endPoint) {
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
    };

    const createMarker = (position: google.maps.LatLng, type: 'start' | 'end') => {
        if (!map) return;

        const marker = new google.maps.Marker({
            position,
            map,
            title: type === 'start' ? t('จุดเริ่มต้น') || 'จุดเริ่มต้น' : t('จุดสิ้นสุด') || 'จุดสิ้นสุด',
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: type === 'start' ? '#4CAF50' : '#F44336',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2
            }
        });

        markersRef.current.push(marker);
    };

    const createLineBetweenPoints = (start: google.maps.LatLng, end: google.maps.LatLng) => {
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
            map: map
        });
    };

    const createElevationProfile = async (start: google.maps.LatLng, end: google.maps.LatLng) => {
        if (!elevationServiceRef.current) {
            setError(t('Elevation service ไม่พร้อมใช้งาน') || 'Elevation service ไม่พร้อมใช้งาน');
            return;
        }

        if (!start || !end) {
            setError(t('จุดเริ่มต้นหรือจุดสิ้นสุดไม่ถูกต้อง') || 'จุดเริ่มต้นหรือจุดสิ้นสุดไม่ถูกต้อง');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Don't remove the permanent line during profile creation
            // Keep the line visible while creating the profile
            
            // Create path with multiple points for detailed profile
            const path = createDetailedPath(start, end, 50); // Reduced from 100 to avoid API limits
            
            elevationServiceRef.current.getElevationAlongPath({
                path,
                samples: 50
            }, (results, status) => {
                if (status === google.maps.ElevationStatus.OK && results && results.length > 0) {
                    const points = results.map((result, index) => {
                        const point = path[index];
                        const distance = index * (calculateDistance(start, end) / (results.length - 1));
                        return {
                            lat: point.lat(),
                            lng: point.lng(),
                            elevation: result.elevation || 0,
                            distance
                        };
                    });

                    const totalDistance = calculateDistance(start, end);
                    const elevations = points.map(p => p.elevation);
                    const minElevation = Math.min(...elevations);
                    const maxElevation = Math.max(...elevations);
                    
                    let elevationGain = 0;
                    let elevationLoss = 0;
                    for (let i = 1; i < points.length; i++) {
                        const diff = points[i].elevation - points[i-1].elevation;
                        if (diff > 0) elevationGain += diff;
                        else elevationLoss += Math.abs(diff);
                    }

                    const newProfileData = {
                        points,
                        totalDistance,
                        minElevation,
                        maxElevation,
                        elevationGain,
                        elevationLoss
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
                    setError(t('ไม่สามารถสร้างกราฟแสดงความสูงได้ - สถานะ: ') + status || 'ไม่สามารถสร้างกราฟแสดงความสูงได้ - สถานะ: ' + status);
                }
                setIsLoading(false);
            });
        } catch (err) {
            setError(t('เกิดข้อผิดพลาดในการสร้างโปรไฟล์: ') + (err as Error).message || 'เกิดข้อผิดพลาดในการสร้างโปรไฟล์: ' + (err as Error).message);
            setIsLoading(false);
        }
    };

    const createDetailedPath = (start: google.maps.LatLng, end: google.maps.LatLng, samples: number): google.maps.LatLng[] => {
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

    const drawProfileChart = (points: ElevationPoint[]) => {
        const canvas = canvasRef.current;
        if (!canvas || !points.length) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

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
        const elevations = points.map(p => p.elevation);
        // const minElevation = Math.min(...elevations);
        const maxElevation = Math.max(...elevations);
        
        // Create nice Y-axis scale starting from 0
        const yAxisMin = 0;
        const yAxisMax = Math.ceil(maxElevation / 10) * 10; // Round up to nearest 10
        const yAxisRange = yAxisMax - yAxisMin;
        
        // Calculate step size for Y-axis (used in multiple places)
        const stepSize = Math.max(1, Math.ceil(yAxisRange / 8)); // At least 1m steps
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
            const elevation = yAxisMin + i * stepSize;
            if (elevation <= yAxisMax) {
                const y = padding + chartHeight - ((elevation - yAxisMin) / yAxisRange) * chartHeight;
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
            const y = padding + chartHeight - ((point.elevation - yAxisMin) / yAxisRange) * chartHeight;
            
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
            const y = padding + chartHeight - ((point.elevation - yAxisMin) / yAxisRange) * chartHeight;
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
            const elevation = yAxisMin + i * stepSize;
            if (elevation <= yAxisMax) {
                const y = padding + chartHeight - ((elevation - yAxisMin) / yAxisRange) * chartHeight;
                ctx.fillText(`${elevation} m`, padding - 10, y + 4);
            }
        }

        // Draw title
        ctx.fillStyle = '#333';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(t('กราฟแสดงความสูง') || 'กราฟแสดงความสูง', canvas.width / 2, 20);
    };

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
        startPointRef.current = null;
        endPointRef.current = null;
        cleanup();
    };

    if (!isActive) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 max-w-md">
            <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <FaRoute className="text-blue-600" size={16} />
                        <h3 className="font-semibold text-gray-800">
                            {t('กราฟแสดงความสูง') || 'กราฟแสดงความสูง'}
                        </h3>
                    </div>
                    <button
                        onClick={onToggle}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <FaTimes size={14} />
                    </button>
                </div>

                {!profileData && (
                    <div className="space-y-3">
                        <div className="text-sm text-gray-600">
                            {t('คลิก 2 จุดบนแผนที่เพื่อสร้างกราฟแสดงความสูง') || 'คลิก 2 จุดบนแผนที่เพื่อสร้างกราฟแสดงความสูง'}
                        </div>
                        
                        <button
                            onClick={() => {
                                // Reset state before starting
                                setStartPoint(null);
                                setEndPoint(null);
                                setCurrentPoint(null);
                                setProfileData(null);
                                startPointRef.current = null;
                                endPointRef.current = null;
                                cleanup();
                                setIsDrawing(true);
                            }}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            {t('เริ่มวาดเส้นทาง') || 'เริ่มวาดเส้นทาง'}
                        </button>
                    </div>
                )}

                {isDrawing && (
                    <div className="space-y-3">
                        <div className="text-sm text-blue-600">
                            {startPoint ? t('คลิกจุดสิ้นสุด') || 'คลิกจุดสิ้นสุด' : t('คลิกจุดเริ่มต้น') || 'คลิกจุดเริ่มต้น'}
                        </div>
                        
                        {startPoint && (
                            <div className="text-xs text-gray-500">
                                {t('จุดเริ่มต้น:') || 'จุดเริ่มต้น:'} {startPoint.lat().toFixed(6)}, {startPoint.lng().toFixed(6)}
                            </div>
                        )}
                        
                        <button
                            onClick={() => {
                                setIsDrawing(false);
                                cleanup();
                            }}
                            className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            {t('ยกเลิก') || 'ยกเลิก'}
                        </button>
                    </div>
                )}

                {isLoading && (
                    <div className="flex items-center gap-2 text-blue-600 text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        {t('กำลังสร้างโปรไฟล์...') || 'กำลังสร้างโปรไฟล์...'}
                    </div>
                )}

                {error && (
                    <div className="text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {profileData && (
                    <div className="space-y-4">
                        {/* Profile Chart */}
                        <div className="border border-gray-200 rounded-lg p-2">
                            <canvas ref={canvasRef} className="w-full h-auto" />
                        </div>

                        {/* Profile Statistics */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-blue-50 p-2 rounded">
                                <div className="text-blue-600 font-medium">{t('ระยะทาง') || 'ระยะทาง'}</div>
                                <div className="text-gray-800">{(profileData.totalDistance / 1000).toFixed(2)} km</div>
                            </div>
                            
                            <div className="bg-green-50 p-2 rounded">
                                <div className="text-green-600 font-medium">{t('ความสูงต่ำสุด') || 'ความสูงต่ำสุด'}</div>
                                <div className="text-gray-800">{profileData.minElevation.toFixed(1)} m</div>
                            </div>
                            
                            <div className="bg-orange-50 p-2 rounded">
                                <div className="text-orange-600 font-medium">{t('ความสูงสูงสุด') || 'ความสูงสูงสุด'}</div>
                                <div className="text-gray-800">{profileData.maxElevation.toFixed(1)} m</div>
                            </div>
                            
                            <div className="bg-purple-50 p-2 rounded">
                                <div className="text-purple-600 font-medium">{t('ขึ้น') || 'ขึ้น'}</div>
                                <div className="text-gray-800">{profileData.elevationGain.toFixed(1)} m</div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={downloadProfile}
                                className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <FaDownload size={12} />
                                {t('ดาวน์โหลด') || 'ดาวน์โหลด'}
                            </button>
                            
                            <button
                                onClick={resetProfile}
                                className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
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
