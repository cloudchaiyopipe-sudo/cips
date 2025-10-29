import React, { useEffect, useRef, useState } from 'react';
import { FaRuler, FaTimes } from 'react-icons/fa';

interface Coordinate {
    lat: number;
    lng: number;
}

interface DrawingDistanceOverlayProps {
    map: google.maps.Map | null;
    isActive: boolean;
    editMode: string | null;
    startPoint: Coordinate | null;
    currentMousePosition: Coordinate | null;
    onClose: () => void;
    t: (key: string) => string;
}

const DrawingDistanceOverlay: React.FC<DrawingDistanceOverlayProps> = ({
    map,
    isActive,
    editMode,
    startPoint,
    currentMousePosition,
    onClose,
    t,
}) => {
    const [distance, setDistance] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    const calculateDistance = (point1: Coordinate, point2: Coordinate): number => {
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
        return R * c;
    };

    const formatDistance = (meters: number): string => {
        if (meters < 1000) {
            return `${meters.toFixed(1)} ม.`;
        } else {
            return `${(meters / 1000).toFixed(2)} กม.`;
        }
    };


    const getDrawingModeText = (mode: string | null): string => {
        switch (mode) {
            case 'mainArea':
                return t('วาดพื้นที่หลัก') || 'วาดพื้นที่หลัก';
            case 'zone':
                return t('วาดโซน') || 'วาดโซน';
            case 'exclusion':
                return t('วาดพื้นที่ยกเว้น') || 'วาดพื้นที่ยกเว้น';
            case 'mainPipe':
                return t('วาดท่อเมน') || 'วาดท่อเมน';
            case 'subMainPipe':
                return t('วาดท่อเมนรอง') || 'วาดท่อเมนรอง';
            default:
                return t('วาด') || 'วาด';
        }
    };

    const isPolygonMode = (mode: string | null): boolean => {
        return mode === 'mainArea' || mode === 'zone' || mode === 'exclusion';
    };

    const isPolylineMode = (mode: string | null): boolean => {
        return mode === 'mainPipe' || mode === 'subMainPipe';
    };

    // Calculate distance when start point and current mouse position change
    useEffect(() => {
        if (startPoint && currentMousePosition) {
            const calculatedDistance = calculateDistance(startPoint, currentMousePosition);
            setDistance(calculatedDistance);
        } else {
            setDistance(0);
        }
    }, [startPoint, currentMousePosition, isActive, editMode]);

    // Show/hide overlay based on active state and edit mode
    useEffect(() => {
        const shouldShow = Boolean(isActive && editMode && (isPolygonMode(editMode) || isPolylineMode(editMode)));
        setIsVisible(shouldShow);
    }, [isActive, editMode]);

    if (!isVisible || !map) {
        return null;
    }

    return (
        <div className="fixed top-4 right-4 z-[1000] w-80 rounded-lg border border-gray-300 bg-white shadow-2xl">
            {/* Header */}
            <div className="rounded-t-lg bg-blue-600 px-3 py-2 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <FaRuler className="text-sm" />
                        <span className="text-sm font-medium">
                            {getDrawingModeText(editMode)}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded p-1 text-white hover:bg-blue-700 transition-colors"
                        title={t('ปิด') || 'ปิด'}
                    >
                        <FaTimes className="text-sm" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-2 p-3">
                {/* Distance Display */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="text-sm font-medium text-blue-800 mb-1">
                        {t('ระยะทางปัจจุบัน') || 'ระยะทางปัจจุบัน'}:
                    </div>
                    <div className="text-3xl font-bold text-blue-600">
                        {formatDistance(distance)}
                    </div>
                </div>

                {/* Instructions */}
                <div className="rounded bg-gray-50 p-2 text-xs text-gray-600">
                    {isPolygonMode(editMode) ? (
                        <div>
                            <div className="font-medium mb-1">
                                {t('การวาดพื้นที่') || 'การวาดพื้นที่'}:
                            </div>
                            <div>• {t('คลิกเพื่อสร้างจุดเริ่มต้น') || 'คลิกเพื่อสร้างจุดเริ่มต้น'}</div>
                            <div>• {t('เลื่อนเมาส์เพื่อดูระยะทางจากจุดล่าสุด') || 'เลื่อนเมาส์เพื่อดูระยะทางจากจุดล่าสุด'}</div>
                            <div>• {t('คลิกซ้ำเพื่อเพิ่มจุดใหม่') || 'คลิกซ้ำเพื่อเพิ่มจุดใหม่'}</div>
                            <div>• {t('ดับเบิลคลิกเพื่อจบการวาด') || 'ดับเบิลคลิกเพื่อจบการวาด'}</div>
                        </div>
                    ) : isPolylineMode(editMode) ? (
                        <div>
                            <div className="font-medium mb-1">
                                {t('การวาดท่อ') || 'การวาดท่อ'}:
                            </div>
                            <div>• {t('คลิกเพื่อสร้างจุดเริ่มต้น') || 'คลิกเพื่อสร้างจุดเริ่มต้น'}</div>
                            <div>• {t('เลื่อนเมาส์เพื่อดูระยะทางจากจุดล่าสุด') || 'เลื่อนเมาส์เพื่อดูระยะทางจากจุดล่าสุด'}</div>
                            <div>• {t('คลิกซ้ำเพื่อเพิ่มจุดใหม่') || 'คลิกซ้ำเพื่อเพิ่มจุดใหม่'}</div>
                            <div>• {t('ดับเบิลคลิกเพื่อจบการวาด') || 'ดับเบิลคลิกเพื่อจบการวาด'}</div>
                        </div>
                    ) : (
                        <div>
                            {t('เลือกโหมดการวาดเพื่อเริ่มใช้งาน') || 'เลือกโหมดการวาดเพื่อเริ่มใช้งาน'}
                        </div>
                    )}
                </div>

                {/* Status */}
                <div className="rounded bg-green-50 p-2 text-xs text-green-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="font-medium">
                                {startPoint 
                                    ? t('กำลังวาด - คลิกเพื่อเพิ่มจุด') || 'กำลังวาด - คลิกเพื่อเพิ่มจุด'
                                    : t('พร้อมวาด - คลิกเพื่อเริ่ม') || 'พร้อมวาด - คลิกเพื่อเริ่ม'
                                }
                            </span>
                        </div>
                        {startPoint && (
                            <button
                                onClick={onClose}
                                className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600 transition-colors"
                            >
                                {t('รีเซ็ต') || 'รีเซ็ต'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DrawingDistanceOverlay;
