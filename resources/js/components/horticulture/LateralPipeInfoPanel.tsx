/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {
    FaWater,
    FaTree,
    FaRulerCombined,
    FaInfoCircle,
    FaCheck,
    FaTimes,
} from 'react-icons/fa';
import { loadSprinklerConfig } from '../../utils/sprinklerUtils';

interface Coordinate {
    lat: number;
    lng: number;
}

interface PlantLocation {
    id: string;
    position: Coordinate;
    plantData: {
        id: number;
        name: string;
        plantSpacing: number;
        rowSpacing: number;
        waterNeed: number;
    };
}

interface LateralPipeInfoPanelProps {
    isVisible: boolean;
    placementMode: 'over_plants' | 'between_plants' | null;
    selectedPlants: PlantLocation[];
    totalWaterNeed: number;
    plantCount: number;
    startPoint: Coordinate | null;
    currentPoint: Coordinate | null;
    snappedStartPoint?: Coordinate | null;
    alignedCurrentPoint?: Coordinate | null;
    waypoints?: Coordinate[];
    isMultiSegmentMode?: boolean;
    segmentCount?: number;
    onCancel: () => void;
    onConfirm: () => void;
    t: (key: string) => string;
}

const LateralPipeInfoPanel: React.FC<LateralPipeInfoPanelProps> = ({
    isVisible,
    placementMode,
    plantCount,
    startPoint,
    currentPoint,
    snappedStartPoint,
    alignedCurrentPoint,
    waypoints = [],
    isMultiSegmentMode = false,
    onCancel,
    onConfirm,
    t,
}) => {
    if (!isVisible) return null;

    const calculateLength = (): number => {
        try {
            if (isMultiSegmentMode && Array.isArray(waypoints) && waypoints.length > 0) {
                const effectiveStartPoint = snappedStartPoint || startPoint;
                const effectiveEndPoint = alignedCurrentPoint || currentPoint;

                if (!effectiveStartPoint || !effectiveEndPoint) return 0;

                const allPoints = [effectiveStartPoint, ...waypoints, effectiveEndPoint];
                let totalLength = 0;

                for (let i = 0; i < allPoints.length - 1; i++) {
                    const segmentStart = allPoints[i];
                    const segmentEnd = allPoints[i + 1];

                    if (
                        !segmentStart ||
                        !segmentEnd ||
                        typeof segmentStart.lat !== 'number' ||
                        typeof segmentStart.lng !== 'number' ||
                        typeof segmentEnd.lat !== 'number' ||
                        typeof segmentEnd.lng !== 'number' ||
                        !isFinite(segmentStart.lat) ||
                        !isFinite(segmentStart.lng) ||
                        !isFinite(segmentEnd.lat) ||
                        !isFinite(segmentEnd.lng)
                    ) {
                        continue;
                    }

                    const R = 6371000;
                    const dLat = ((segmentEnd.lat - segmentStart.lat) * Math.PI) / 180;
                    const dLng = ((segmentEnd.lng - segmentStart.lng) * Math.PI) / 180;
                    const lat1Rad = (segmentStart.lat * Math.PI) / 180;
                    const lat2Rad = (segmentEnd.lat * Math.PI) / 180;

                    const a =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(lat1Rad) *
                            Math.cos(lat2Rad) *
                            Math.sin(dLng / 2) *
                            Math.sin(dLng / 2);
                    const c =
                        2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));

                    const segmentLength = R * c;
                    if (isFinite(segmentLength) && segmentLength >= 0 && segmentLength < 100000) {
                        totalLength += segmentLength;
                    }
                }

                return Math.max(0, totalLength);
            } else {
                const effectiveStartPoint = snappedStartPoint || startPoint;
                const effectiveEndPoint = alignedCurrentPoint || currentPoint;

                if (!effectiveStartPoint || !effectiveEndPoint) return 0;

                if (
                    !isFinite(effectiveStartPoint.lat) ||
                    !isFinite(effectiveStartPoint.lng) ||
                    !isFinite(effectiveEndPoint.lat) ||
                    !isFinite(effectiveEndPoint.lng)
                ) {
                    return 0;
                }

                const R = 6371000;
                const dLat = ((effectiveEndPoint.lat - effectiveStartPoint.lat) * Math.PI) / 180;
                const dLng = ((effectiveEndPoint.lng - effectiveStartPoint.lng) * Math.PI) / 180;
                const lat1Rad = (effectiveStartPoint.lat * Math.PI) / 180;
                const lat2Rad = (effectiveEndPoint.lat * Math.PI) / 180;

                const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
                const c = 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));

                const distance = R * c;
                return isFinite(distance) && distance >= 0 && distance < 100000 ? distance : 0;
            }
        } catch (error) {
            console.warn('Error calculating pipe length:', error);
            return 0;
        }
    };

    const length = calculateLength();

    const sprinklerConfig = loadSprinklerConfig();
    const flowRatePerMinute = sprinklerConfig?.flowRatePerMinute || 0;

    const totalFlowRatePerMinute = plantCount * flowRatePerMinute;
    // const totalFlowRatePerHour = totalFlowRatePerMinute * 60;

    return (
        <div className="fixed right-[10px] top-[190px] z-[1000] min-w-[320px] rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
                    <FaWater className="text-blue-600" />
                    {t('วางท่อย่อย') || 'วางท่อย่อย'}
                </h3>
                <button
                    onClick={onCancel}
                    className="text-gray-400 transition-colors hover:text-gray-600"
                    title={t('ปิด') || 'ปิด'}
                >
                    <FaTimes size={16} />
                </button>
            </div>

            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-blue-700">
                    <FaInfoCircle size={14} />
                    <span className="text-sm font-medium">{t('โหมดการวาง') || 'โหมดการวาง'}</span>
                </div>
                <div className="text-sm text-blue-600">
                    {placementMode === 'over_plants' && (
                        <span>🎯 {t('วางทับแนวต้นไม้') || 'วางทับแนวต้นไม้'}</span>
                    )}
                    {placementMode === 'between_plants' && (
                        <span>🌱 {t('วางระหว่างแนวต้นไม้') || 'วางระหว่างแนวต้นไม้'}</span>
                    )}
                    {!placementMode && (
                        <span className="text-gray-500">
                            ⚙️ {t('รอการเลือกโหมด') || 'รอการเลือกโหมด'}
                        </span>
                    )}
                </div>
            </div>

            {isMultiSegmentMode && waypoints.length > 0 && (
                <div className="mb-4 rounded-md border border-orange-200 bg-orange-50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-orange-700">
                        <span className="text-lg">🔄</span>
                        <span className="text-sm font-medium">
                            {t('ท่อแบบหักเลี้ยว') || 'ท่อแบบหักเลี้ยว'}
                        </span>
                    </div>
                    <div className="space-y-1 text-sm text-orange-600">
                        <div>
                            📍 {t('จุดหักเลี้ยว') || 'จุดหักเลี้ยว'}: {waypoints.length}{' '}
                            {t('จุด') || 'จุด'}
                        </div>
                        <div>
                            📏 {t('ส่วนท่อ') || 'ส่วนท่อ'}: {waypoints.length + 1}{' '}
                            {t('ส่วน') || 'ส่วน'}
                        </div>
                        <div className="mt-2 rounded bg-orange-100 p-2 text-xs text-orange-500">
                            💡{' '}
                            {t('คลิกขวาเพื่อเพิ่มจุดหักเลี้ยว, คลิกซ้ายเพื่อจบการวาด') ||
                                'คลิกขวาเพื่อเพิ่มจุดหักเลี้ยว, คลิกซ้ายเพื่อจบการวาด'}
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-4 rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50 p-4">
                <h4 className="text-md mb-3 flex items-center gap-2 font-semibold text-gray-800">
                    📊 สถิติแบบ Real-time
                    <span className="ml-2 rounded-full bg-green-500 px-2 py-1 text-xs text-white">
                        LIVE
                    </span>
                </h4>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
                    <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 p-3">
                        <div className="flex items-center gap-2 text-green-700">
                            <FaTree size={16} />
                            <span className="text-sm font-medium">
                                {t('จำนวนต้นไม้') || 'จำนวนต้นไม้'}
                            </span>
                        </div>
                        <div className="text-lg font-bold text-green-800">
                            {plantCount.toLocaleString()}
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-cyan-200 bg-cyan-50 p-3">
                        <div className="flex items-center gap-2 text-cyan-700">
                            <FaWater size={16} />
                            <span className="text-sm font-medium">
                                {t('อัตราการไหล') || 'อัตราการไหล'}
                            </span>
                        </div>
                        <div className="text-lg font-bold text-cyan-800">
                            {totalFlowRatePerMinute.toLocaleString()} {t('ลิตร/นาที') || 'ลิตร/นาที'}
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-orange-200 bg-orange-50 p-3">
                        <div className="flex items-center gap-2 text-orange-700">
                            <FaRulerCombined size={16} />
                            <span className="text-sm font-medium">
                                {t('ความยาวท่อ') || 'ความยาวท่อ'}
                            </span>
                        </div>
                        <div className="text-lg font-bold text-orange-800">
                            {length.toFixed(1)} {t('เมตร') || 'เมตร'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={onCancel}
                    className="flex flex-1 items-center justify-center gap-2 rounded-md bg-red-600 px-3 py-2 font-medium text-white transition-colors hover:bg-red-700"
                >
                    <FaTimes size={14} />
                    {t('ยกเลิก') || 'ยกเลิก'}
                </button>
                <button
                    onClick={onConfirm}
                    disabled={plantCount === 0 || length === 0}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 font-medium transition-colors ${
                        plantCount > 0 && length > 0
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'cursor-not-allowed bg-gray-300 text-gray-500'
                    }`}
                >
                    <FaCheck size={14} />
                    {t('ยืนยัน') || 'ยืนยัน'}
                </button>
            </div>
        </div>
    );
};

export default LateralPipeInfoPanel;
