import React, { useEffect, useRef, useState } from 'react';
import { FaRuler, FaTimes } from 'react-icons/fa';
import { 
    calculateDistance, 
    formatDistance, 
    getDrawingModeText, 
    isPolygonMode, 
    isPolylineMode,
    isValidCoordinate 
} from '../../utils/distanceMeasurementUtils';

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

    // Distance calculation functions are now imported from utils


    // Mode checking functions are now imported from utils

    // Calculate distance when start point and current mouse position change
    useEffect(() => {
        if (startPoint && currentMousePosition && 
            isValidCoordinate(startPoint) && isValidCoordinate(currentMousePosition)) {
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
                            {getDrawingModeText(editMode, t)}
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
