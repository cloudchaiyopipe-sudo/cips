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
    const elevationServiceRef = useRef<google.maps.ElevationService | null>(null);

    // Initialize elevation service
    useEffect(() => {
        if (map && window.google?.maps?.ElevationService) {
            elevationServiceRef.current = new google.maps.ElevationService();
        }
    }, [map]);

    // Setup click listener
    useEffect(() => {
        if (!map || !isActive) {
            if (clickListenerRef.current) {
                google.maps.event.removeListener(clickListenerRef.current);
                clickListenerRef.current = null;
            }
            return;
        }

        const handleMapClick = (event: google.maps.MapMouseEvent) => {
            if (!event.latLng || !elevationServiceRef.current) return;

            const lat = event.latLng.lat();
            const lng = event.latLng.lng();
            
            setIsLoading(true);
            setError(null);

            // Request elevation for clicked point
            elevationServiceRef.current.getElevationForLocations({
                locations: [event.latLng]
            }, (results, status) => {
                if (status === google.maps.ElevationStatus.OK && results && results[0]) {
                    setElevationInfo({
                        lat,
                        lng,
                        elevation: results[0].elevation || 0,
                        timestamp: Date.now()
                    });
                } else {
                    setError(t('ไม่สามารถดึงข้อมูลความสูงได้') || 'ไม่สามารถดึงข้อมูลความสูงได้');
                }
                setIsLoading(false);
            });
        };

        clickListenerRef.current = map.addListener('click', handleMapClick);

        return () => {
            if (clickListenerRef.current) {
                google.maps.event.removeListener(clickListenerRef.current);
                clickListenerRef.current = null;
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
        <div className="fixed top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <FaMountain className="text-green-600" size={16} />
                    <h3 className="font-semibold text-gray-800">
                        {t('คลิกเพื่อดูความสูง') || 'คลิกเพื่อดูความสูง'}
                    </h3>
                </div>
                <button
                    onClick={onToggle}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <FaTimes size={14} />
                </button>
            </div>

            <div className="space-y-2">
                <div className="text-sm text-gray-600">
                    {t('คลิกบนแผนที่เพื่อดูความสูง ณ จุดนั้น') || 'คลิกบนแผนที่เพื่อดูความสูง ณ จุดนั้น'}
                </div>

                {isLoading && (
                    <div className="flex items-center gap-2 text-blue-600 text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        {t('กำลังดึงข้อมูลความสูง...') || 'กำลังดึงข้อมูลความสูง...'}
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                        <FaInfoCircle size={14} />
                        {error}
                    </div>
                )}

                {elevationInfo && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
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
                                <span className="text-gray-600">{t('ระดับน้ำทะเล:') || 'ระดับน้ำทะเล:'}</span>
                                <span className="text-gray-800">
                                    {elevationInfo.elevation > 0 ? t('เหนือระดับน้ำทะเล') || 'เหนือระดับน้ำทะเล' : t('ต่ำกว่าระดับน้ำทะเล') || 'ต่ำกว่าระดับน้ำทะเล'}
                                </span>
                            </div>
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                            {new Date(elevationInfo.timestamp).toLocaleString('th-TH')}
                        </div>
                    </div>
                )}

                <div className="text-xs text-gray-500 mt-3">
                    <div className="flex items-center gap-1 mb-1">
                        <FaInfoCircle size={10} />
                        <span>{t('เคล็ดลับ:') || 'เคล็ดลับ:'}</span>
                    </div>
                    <div className="ml-3">
                        • {t('คลิกที่ใดก็ได้บนแผนที่เพื่อดูความสูง') || 'คลิกที่ใดก็ได้บนแผนที่เพื่อดูความสูง'}<br/>
                        • {t('ข้อมูลจะอัปเดตทันทีเมื่อคลิก') || 'ข้อมูลจะอัปเดตทันทีเมื่อคลิก'}<br/>
                        • {t('ความสูงแสดงเป็นเมตรเหนือระดับน้ำทะเล') || 'ความสูงแสดงเป็นเมตรเหนือระดับน้ำทะเล'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ElevationClickHandler;
